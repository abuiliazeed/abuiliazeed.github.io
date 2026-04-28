# Chapter 8: Making Applications Legible to Agents

> "The most important property of a system built for agents is not that it works—it's that an agent can *tell* whether it works."

In the summer of 2025, a team at a major fintech company deployed Claude Code to automate their regression testing. The agent could execute tests, read failure messages, and even modify code to fix bugs. But there was a problem: the agent couldn't tell whether the application was *actually working* after it made changes.

The test suite returned green. The health check endpoint returned 200. But the UI was broken—dropdown menus rendered off-screen, the payment confirmation modal had been replaced with a blank white box, and the "Export to CSV" button now exported to XML. None of these failures were visible to the agent because the application was opaque to machine inspection. It wasn't *legible*.

This chapter introduces the concept of **application legibility**—the practice of designing systems so that automated agents can observe, inspect, and verify application behavior with high confidence. Legibility is not an optional quality attribute in agent-first development. It is a prerequisite.

---

## What "Legible" Means

When we say an application is legible, we mean that every meaningful aspect of its behavior can be programmatically observed and evaluated. A legible application exposes its state through structured interfaces, produces machine-parseable output, and offers deterministic mechanisms for verification.

Think of it as the difference between a car with an instrument cluster and a car without one. Both cars might run perfectly well. But only the car with gauges, warning lights, and a diagnostic port enables someone other than the driver to assess its condition. In agent-first development, the agent is the mechanic—and your application needs a diagnostic port.

Legibility has five dimensions:

1. **Boot legibility**: Can the agent determine that the application has started correctly?
2. **State legibility**: Can the agent query the current state of the application and its subsystems?
3. **Behavior legibility**: Can the agent observe what the application does in response to inputs?
4. **Error legibility**: When something goes wrong, can the agent understand what failed and why?
5. **Visual legibility**: Can the agent verify that the user interface renders correctly?

Let's examine each dimension and the practical patterns that make them achievable.

---

## The Boot Problem

Every agent interaction with a running system begins with the same question: *Is it up?* This sounds trivial, but in practice it's one of the most common failure points in agent-driven development workflows.

### Deterministic Startup

An agent must be able to start your application and know, with certainty, when it's ready to accept requests. This means your startup process must be:

- **Deterministic**: The same inputs produce the same startup sequence every time
- **Observable**: The startup process emits clear signals about its progress
- **Bounded**: Startup completes within a known time window or fails explicitly

Here's what a non-deterministic startup looks like—an all-too-common pattern:

```python
# Bad: Startup is a black box
app = create_app()
app.run(host="0.0.0.0", port=8080)  # When is it ready? Nobody knows.
```

And here's the legible version:

```python
# Good: Startup is observable and deterministic
import signal
import sys
from healthcheck import HealthCheckPool

app = create_app()
health = HealthCheckPool()

@app.on("startup_complete")
def mark_ready():
    health.set_ready(True)
    logger.info("app_startup_complete", port=8080, pid=os.getpid())

@app.on("startup_failed")
def mark_failed(error):
    health.set_ready(False)
    logger.error("app_startup_failed", error=str(error), stack_trace=traceback.format_exc())
    sys.exit(1)

# Signal handler for orchestrators
signal.signal(signal.SIGTERM, lambda s, f: graceful_shutdown(app))

app.run(host="0.0.0.0", port=8080, readiness_callback=mark_ready)
```

The key difference: in the second version, an agent (or any orchestrator) can poll a readiness endpoint and get a definitive answer. The application doesn't just start—it *announces* that it has started.

### Health Checks and Readiness Probes

Every service you build should expose at least two endpoints:

```yaml
# docker-compose.yml or kubernetes manifest
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 5s
  timeout: 3s
  retries: 3
  start_period: 10s
```

```python
# health.py — Structured health check response
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, Optional
import time

class HealthStatus(BaseModel):
    status: str  # "healthy" | "degraded" | "unhealthy"
    uptime_seconds: float
    version: str
    commit: str
    checks: Dict[str, "ComponentHealth"]

class ComponentHealth(BaseModel):
    status: str
    latency_ms: Optional[float] = None
    message: Optional[str] = None

@app.get("/health")
async def health():
    """Liveness probe — is the process running?"""
    return {"status": "alive", "pid": os.getpid()}

@app.get("/ready")
async def readiness():
    """Readiness probe — can we serve traffic?"""
    checks = {
        "database": await check_database(),
        "cache": await check_redis(),
        "message_queue": await check_rabbitmq(),
    }
    
    all_healthy = all(c.status == "healthy" for c in checks.values())
    
    return HealthStatus(
        status="healthy" if all_healthy else "degraded",
        uptime_seconds=time.time() - START_TIME,
        version=os.environ.get("APP_VERSION", "unknown"),
        commit=os.environ.get("GIT_COMMIT", "unknown"),
        checks=checks,
    )
```

The `/health` endpoint answers "is the process alive?" The `/ready` endpoint answers "can it handle requests?" These are different questions, and conflating them is one of the most common mistakes in agent-friendly infrastructure.

An agent running integration tests needs to know not just that the server process exists, but that the database migrations have run, the cache is warm, and the message queue is connected. The `/ready` endpoint provides this nuance.

For the agent, this enables a simple startup loop:

```typescript
// agent-startup.ts — How an agent waits for readiness
async function waitForApp(url: string, maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${url}/ready`);
      const health = await response.json();
      
      if (health.status === "healthy") {
        console.log(`Application ready after ${(i + 1) * 2}s`);
        return;
      }
      
      console.log(`Waiting... status=${health.status}, checks:`, 
        Object.entries(health.checks)
          .filter(([_, v]) => v.status !== "healthy")
          .map(([k, _]) => k));
    } catch (e) {
      console.log(`Connection refused, retry ${i + 1}/${maxRetries}`);
    }
    await sleep(2000);
  }
  throw new Error(`Application failed to become ready within ${maxRetries * 2}s`);
}
```

This pattern—poll until ready or timeout—is the foundation of every agent-driven test harness. Make it reliable by making your readiness endpoint honest.

---

## Observability for Agents

Observability in traditional software engineering means "can a human debug this in production?" In agent-first development, it means "can an agent understand what happened?" These are different requirements, and optimizing for one doesn't automatically optimize for the other.

A human can read a stack trace, correlate it with a log line, check the metrics dashboard, and form a hypothesis. An agent needs all of that information presented in a structured, machine-parseable format.

### Structured Logging

Structured logging is non-negotiable in agent-first development. Every log line should be a JSON object with consistent fields:

```python
# logging_config.py
import logging
import json
import time
import uuid
from contextvars import ContextVar

correlation_id: ContextVar[str] = ContextVar("correlation_id", default="")

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": correlation_id.get(""),
            "trace_id": getattr(record, "trace_id", None),
            "span_id": getattr(record, "span_id", None),
        }
        
        # Add any extra fields
        if hasattr(record, "extra_fields"):
            log_entry.update(record.extra_fields)
        
        # Add exception info
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "stack_trace": self.formatException(record.exc_info),
            }
        
        return json.dumps(log_entry)
```

```python
# Usage in application code
import logging

logger = logging.getLogger("orders")

def process_order(order_id: str, items: list):
    logger.info(
        "order_processing_started",
        extra={
            "extra_fields": {
                "order_id": order_id,
                "item_count": len(items),
                "total_value": sum(i["price"] for i in items),
            }
        }
    )
    
    try:
        result = charge_payment(order_id, items)
        logger.info(
            "order_completed",
            extra={"extra_fields": {
                "order_id": order_id,
                "payment_id": result.payment_id,
                "charged_amount": result.amount,
            }}
        )
    except PaymentError as e:
        logger.error(
            "order_payment_failed",
            extra={"extra_fields": {
                "order_id": order_id,
                "error_code": e.code,
                "error_category": "payment",
                "remediation": "Check payment gateway status and retry",
                "customer_action": "Contact support with order ID",
            }}
        )
        raise
```

Notice the `remediation` field in the error log. This is a pattern we'll see throughout this section: **error context with remediation guidance**. When an agent encounters a failure, it doesn't just need to know *that* something failed—it needs guidance on *what to do about it*.

### Correlation IDs

Correlation IDs are the connective tissue of observability. They link related events across service boundaries, making it possible to trace a single request from entry point to completion:

```python
# middleware.py
from starlette.middleware.base import BaseHTTPMiddleware
import uuid

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Accept correlation ID from caller or generate one
        corr_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        correlation_id.set(corr_id)
        
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = corr_id
        return response
```

For an agent debugging a failure, the correlation ID is the entry point to the investigation. "Find all logs for correlation ID X" is a query an agent can execute mechanically, without needing to understand the domain.

### Queryable Endpoints

Beyond health checks, a legible application exposes endpoints that let agents inspect internal state:

```python
# debug endpoints (gated behind authentication/authorization)
@app.get("/debug/stats")
async def debug_stats():
    """Current application statistics — for agent inspection."""
    return {
        "active_connections": connection_pool.size,
        "requests_per_second": metrics.get_rate("http_requests"),
        "cache_hit_rate": cache.hit_rate,
        "queue_depth": message_queue.depth,
        "last_error": {
            "timestamp": metrics.last_error_time,
            "type": metrics.last_error_type,
            "message": metrics.last_error_message,
        },
    }

@app.get("/debug/config")
async def debug_config():
    """Effective configuration — for agent verification."""
    # Strip sensitive values
    safe_config = {
        k: ("***" if any(s in k.lower() for s in ["password", "secret", "key", "token"]) 
            else v)
        for k, v in app.config.items()
    }
    return safe_config

@app.get("/debug/feature-flags")
async def debug_feature_flags():
    """Current feature flag states."""
    return {
        flag.name: {
            "enabled": flag.is_enabled(),
            "variant": flag.variant,
            "reason": flag.evaluation_reason,
        }
        for flag in feature_flags.all_flags()
    }
```

These endpoints transform your application from a black box into a glass box. An agent can verify not just that the application is running, but that it's running with the correct configuration, the expected feature flags, and healthy internal metrics.

---

## UI Legibility

The fintech team's problem that opened this chapter was fundamentally a UI legibility problem. Their agent could verify everything *except* the visual rendering of the application. This is the hardest dimension of legibility, and the one most teams neglect.

### The Three Layers of UI Verification

UI verification for agents operates at three layers of increasing fidelity:

**Layer 1: DOM Structure and Accessibility Tree**

The fastest and most reliable way for an agent to verify a UI is through the accessibility tree—a structured representation of all interactive elements, their roles, labels, and states:

```typescript
// accessibility-check.ts — Verify UI structure through a11y tree
import { pw_snapshot } from "playwright";

interface AccessibilityCheck {
  role: string;
  name: string;
  children?: AccessibilityCheck[];
}

async function verifyPageStructure(url: string): Promise<{
  passed: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  
  // Get the accessibility tree
  const snapshot = await pw_snapshot(url);
  
  // Check for required elements
  const requiredElements = [
    { role: "navigation", name: /main/i },
    { role: "main" },
    { role: "button", name: /submit/i },
    { role: "heading", name: /order confirmation/i },
  ];
  
  for (const required of requiredElements) {
    const found = snapshot.find(el => 
      el.role === required.role && 
      (!required.name || required.name.test(el.name))
    );
    if (!found) {
      issues.push(`Missing element: role=${required.role}` + 
        (required.name ? `, name matching ${required.name}` : ""));
    }
  }
  
  // Check for accessibility violations
  const buttonsWithoutLabels = snapshot.filter(
    el => el.role === "button" && (!el.name || el.name.trim() === "")
  );
  if (buttonsWithoutLabels.length > 0) {
    issues.push(`${buttonsWithoutLabels.length} buttons without accessible labels`);
  }
  
  return { passed: issues.length === 0, issues };
}
```

Every HTML element should have a meaningful `aria-label`, `role`, or text content. This isn't just good accessibility practice—it's how agents read your UI.

**Layer 2: Visual Regression Testing**

Visual regression testing compares screenshots to detect unintended visual changes:

```python
# visual_regression_test.py
import pytest
from pathlib import Path
from PIL import Image, ImageChops
import numpy as np

SNAPSHOTS_DIR = Path("tests/__snapshots__")
THRESHOLD = 0.01  # 1% pixel difference tolerance

class VisualRegression:
    def __init__(self, page):
        self.page = page
    
    async def compare(self, name: str):
        """Take a screenshot and compare to baseline."""
        screenshot_path = SNAPSHOTS_DIR / f"{name}.png"
        current = await self.page.screenshot(full_page=True)
        
        if not screenshot_path.exists():
            # First run — save as baseline
            screenshot_path.write_bytes(current)
            return {"status": "baseline_created", "name": name}
        
        # Compare to baseline using PIL
        baseline = Image.open(screenshot_path).convert("RGB")
        current_img = Image.open(io.BytesIO(current)).convert("RGB")
        
        # Resize current to match baseline if needed
        if current_img.size != baseline.size:
            current_img = current_img.resize(baseline.size)
        
        # Compute pixel difference
        diff = ImageChops.difference(baseline, current_img)
        diff_array = np.array(diff)
        total_pixels = baseline.width * baseline.height
        diff_pixels = int(np.count_nonzero(diff_array) / 3)  # 3 channels
        
        diff_ratio = diff_pixels / total_pixels
        
        if diff_ratio > THRESHOLD:
            # Save diff for agent inspection
            diff_path = SNAPSHOTS_DIR / f"{name}.diff.png"
            diff.save(diff_path)
            
            return {
                "status": "mismatch",
                "name": name,
                "diff_ratio": round(diff_ratio, 4),
                "diff_pixels": diff_pixels,
                "diff_image": str(diff_path),
            }
        
        return {"status": "match", "name": name, "diff_ratio": round(diff_ratio, 4)}
```

**Layer 3: Screenshot Comparison via AI**

The highest-fidelity approach uses vision models to compare screenshots semantically:

```typescript
// ai-visual-check.ts
async function visualComparison(
  baselineUrl: string,
  currentUrl: string,
  context: string
): Promise<{ match: boolean; differences: string[] }> {
  const prompt = `
    You are verifying a web application UI. Compare these two screenshots.
    
    Context: ${context}
    
    The screenshots should be visually identical except for:
    - Dynamic content (timestamps, random data)
    - Intentional changes listed in the changelog
    
    List any visual differences that appear to be bugs:
    - Missing elements
    - Broken layouts
    - Incorrect colors or fonts
    - Overlapping elements
    - Truncated text
  `;
  
  // Use vision model to compare
  const analysis = await visionModel.compare(baselineUrl, currentUrl, prompt);
  
  return {
    match: analysis.differences.length === 0,
    differences: analysis.differences,
  };
}
```

### Designing for Headless Browser Automation

If your application will be tested by agents (and it will), design it for headless browser automation from the start:

```typescript
// Design patterns for agent-testable UIs

// 1. Use stable, semantic selectors
// Bad:
<button class="css-1a2b3c">Submit</button>

// Good:
<button data-testid="submit-order" aria-label="Submit order">
  Submit Order
</button>

// 2. Make loading states explicit
// Bad:
<div class="spinner" />  // When does content appear?

// Good:
<div data-state="loading" aria-busy="true" aria-live="polite">
  Loading order details...
</div>
<div data-state="loaded" style="display:none">
  {/* Content appears here */}
</div>

// 3. Use meaningful text, not icons alone
// Bad:
<button aria-label="Submit">✓</button>

// Good:
<button aria-label="Submit order">
  <span class="sr-only">Submit order</span>
  <span aria-hidden="true">✓</span>
</button>

// 4. Make error states programmatically detectable
// Bad:
<div class="text-red">Invalid email</div>

// Good:
<div role="alert" data-testid="email-error" aria-live="assertive">
  Invalid email address. Please enter a valid email like user@example.com
</div>
```

The `data-testid` attribute is your contract with automated testing. It should be stable across refactors, semantic rather than descriptive of implementation, and unique within a page.

---

## End-to-End Agent Testing

End-to-end testing in an agent-first world goes beyond traditional E2E testing. The agent doesn't just execute a scripted test—it interprets results, investigates failures, and can take corrective action.

### The Agent Test Harness

Here's what a complete agent-driven test cycle looks like:

```python
# agent_test_harness.py
"""
A test harness designed for agent-driven verification.
Produces structured, machine-readable results.
"""
import asyncio
import json
from dataclasses import dataclass, asdict
from typing import List, Optional

@dataclass
class TestStep:
    name: str
    action: str  # HTTP request, UI interaction, DB query
    expected: str
    actual: Optional[str] = None
    passed: Optional[bool] = None
    evidence: Optional[str] = None  # Screenshot, log excerpt, API response
    remediation: Optional[str] = None  # What to do if this fails

@dataclass
class TestResult:
    test_name: str
    status: str  # "passed" | "failed" | "error"
    steps: List[TestStep]
    total_duration_ms: int
    artifacts: List[str]  # Paths to screenshots, logs, etc.

class AgentTestHarness:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.steps: List[TestStep] = []
        self.artifacts: List[str] = []
    
    async def run_full_verification(self) -> TestResult:
        """Run the complete verification suite."""
        start = time.time()
        
        # Phase 1: Boot verification
        await self.verify_boot()
        
        # Phase 2: Smoke tests
        await self.run_smoke_tests()
        
        # Phase 3: Critical user journeys
        await self.run_user_journeys()
        
        # Phase 4: Visual verification
        await self.run_visual_checks()
        
        # Phase 5: Error scenario verification
        await self.verify_error_handling()
        
        duration = int((time.time() - start) * 1000)
        
        all_passed = all(s.passed for s in self.steps)
        
        return TestResult(
            test_name="full_verification",
            status="passed" if all_passed else "failed",
            steps=self.steps,
            total_duration_ms=duration,
            artifacts=self.artifacts,
        )
    
    async def verify_boot(self):
        """Verify the application starts correctly."""
        step = TestStep(
            name="application_boot",
            action=f"GET {self.base_url}/ready",
            expected="HTTP 200 with status=healthy",
        )
        
        try:
            response = await http_get(f"{self.base_url}/ready")
            step.actual = f"HTTP {response.status}: {response.body}"
            step.passed = (
                response.status == 200 and 
                response.json()["status"] == "healthy"
            )
            if not step.passed:
                step.remediation = (
                    "Check application logs for startup errors. "
                    "Verify all dependencies (database, cache, queue) are accessible."
                )
        except Exception as e:
            step.actual = f"Exception: {e}"
            step.passed = False
            step.remediation = (
                "Application did not respond. Check if the process is running "
                "and the port is correct."
            )
        
        self.steps.append(step)
    
    async def run_smoke_tests(self):
        """Verify core endpoints return expected responses."""
        smoke_tests = [
            ("GET", "/api/v1/status", 200, {"status": "operational"}),
            ("GET", "/api/v1/version", 200, lambda r: "version" in r),
            ("GET", "/api/v1/health", 200, lambda r: r.get("checks", {})),
        ]
        
        for method, path, expected_status, expected_body in smoke_tests:
            step = TestStep(
                name=f"smoke_{path.replace('/', '_')}",
                action=f"{method} {self.base_url}{path}",
                expected=f"HTTP {expected_status} with valid body",
            )
            
            response = await http_request(method, f"{self.base_url}{path}")
            step.actual = f"HTTP {response.status}: {response.body[:200]}"
            step.passed = response.status == expected_status
            
            if callable(expected_body):
                step.passed = step.passed and expected_body(response.json())
            
            if not step.passed:
                step.remediiation = (
                    f"Smoke test failed for {path}. This endpoint should always "
                    f"return {expected_status}. Check recent deployments."
                )
            
            self.steps.append(step)
```

This harness produces structured JSON output that an agent can parse, reason about, and act on. Each step includes:
- What was tested (action)
- What was expected (expected)
- What actually happened (actual)
- Whether it passed (passed)
- Evidence (screenshots, responses)
- **What to do next** (remediation)

The remediation field is the key innovation. It turns test output from a diagnostic report into an action plan.

### The Observability Stack

A complete observability stack for agent-first development has four components:

```
┌─────────────────────────────────────────────┐
│               Logging                        │
│  Structured JSON with correlation IDs       │
│  Query: "Show all logs for order-123"       │
├─────────────────────────────────────────────┤
│               Metrics                        │
│  Time-series counters and gauges            │
│  Query: "p99 latency for /api/orders"       │
├─────────────────────────────────────────────┤
│               Tracing                        │
│  Distributed traces across service calls    │
│  Query: "Trace the path of request X"       │
├─────────────────────────────────────────────┤
│               Profiling                      │
│  CPU, memory, and allocation profiles        │
│  Query: "What allocated 500MB at 14:30?"    │
└─────────────────────────────────────────────┘
```

Each layer answers different questions, and an agent needs all of them. Here's how to instrument each layer for agent accessibility:

**Logging** — Already covered. JSON-structured, correlation-linked, with remediation hints.

**Metrics** — Expose a `/metrics` endpoint in Prometheus format:

```python
# metrics.py
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from fastapi import Response

# Define metrics with labels that enable useful queries
http_requests = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"],
)

request_duration = Histogram(
    "http_request_duration_seconds",
    "Request duration in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

active_connections = Gauge(
    "active_connections",
    "Currently active connections",
)

@app.get("/metrics")
async def metrics():
    return Response(
        content=generate_latest(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )
```

**Tracing** — Use OpenTelemetry for distributed tracing:

```python
# tracing.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

# Configure tracing
provider = TracerProvider()
processor = BatchSpanProcessor(OTLPSpanExporter(
    endpoint=os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317"),
))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

tracer = trace.get_tracer("orders-service")

# Use in application code
@tracer.start_as_current_span("process_order")
async def process_order(order_id: str):
    with tracer.start_as_current_span("validate_order") as span:
        span.set_attribute("order.id", order_id)
        # ... validation logic
    
    with tracer.start_as_current_span("charge_payment") as span:
        span.set_attribute("order.id", order_id)
        # ... payment logic
```

When an agent investigates a failure, it can query traces by correlation ID, see exactly which service and span failed, and pinpoint the root cause—without human intervention.

---

## Practical Patterns for Legibility

Let's consolidate the patterns into a checklist you can apply to any service:

### The Legibility Checklist

For every service in your system, verify:

**Boot Legibility**
- [ ] Application has a `/health` (liveness) endpoint
- [ ] Application has a `/ready` (readiness) endpoint that checks all dependencies
- [ ] Startup emits structured logs with a `startup_complete` event
- [ ] Startup fails fast and loudly (not silently) when dependencies are unavailable
- [ ] Startup time is bounded and documented

**State Legibility**
- [ ] Application exposes a `/debug/stats` endpoint (gated by auth)
- [ ] Application exposes a `/debug/config` endpoint (with secrets masked)
- [ ] Feature flags are queryable via API
- [ ] Database connection pool status is observable
- [ ] Queue depths and processing rates are exposed as metrics

**Behavior Legibility**
- [ ] All requests are logged with correlation IDs
- [ ] Request/response pairs can be traced end-to-end
- [ ] Critical business operations emit structured events
- [ ] API responses follow a consistent schema
- [ ] Pagination uses cursor-based (not offset-based) navigation

**Error Legibility**
- [ ] Errors include machine-readable error codes (not just messages)
- [ ] Error responses include remediation hints
- [ ] Stack traces are captured in logs (not returned to clients)
- [ ] Error rates are tracked as metrics
- [ ] Common failure modes have documented runbooks

**Visual Legibility**
- [ ] All interactive elements have `data-testid` attributes
- [ ] All elements have accessible labels (`aria-label` or semantic text)
- [ ] Loading states use `aria-busy` and `aria-live`
- [ ] Error states use `role="alert"`
- [ ] Visual regression baselines exist for critical pages

---

## Legibility as a First-Class Design Principle

The hardest part of application legibility isn't the implementation—it's the mindset shift. Most engineering teams optimize for human readability, human debuggability, and human operability. In agent-first development, you must optimize for *machine* readability, debuggability, and operability.

This doesn't mean designing for machines at the expense of humans. The practices described in this chapter—structured logging, health checks, accessibility attributes, semantic HTML—benefit human engineers too. But they're *essential* for agents, whereas they're merely *nice* for humans.

The OpenAI team that wrote 1M lines of agent-generated code understood this implicitly. As Ryan Lopopolo described in their harness engineering blog post, every component they built was designed to be verifiable by the agent that built it.⁴ The application didn't just work—it was provably correct, because the agent could verify every aspect of its behavior through structured, machine-accessible interfaces.

Martin Fowler captured this well when he wrote that harness engineering includes "context engineering, architectural constraints, and garbage collection."⁵ To that list, I would add: **observability constraints**. The harness must require that everything it builds is observable by the agent that built it.

---

## Common Anti-Patterns

### The Silent Failure

```python
# Bad: Silent failures make debugging impossible for agents
try:
    result = risky_operation()
except Exception:
    pass  # "We'll handle this later"
```

This pattern is bad in any context but catastrophic in agent-driven development. An agent that encounters a silent failure has no signal to work with. It will either report success (incorrectly) or spend enormous resources trying to determine whether the operation succeeded.

**Fix**: Always log failures, even if you handle them:

```python
try:
    result = risky_operation()
except ExpectedError as e:
    logger.warning(
        "operation_retriable_failure",
        extra={"extra_fields": {
            "operation": "risky_operation",
            "error": str(e),
            "will_retry": True,
        }}
    )
    result = retry_with_backoff(risky_operation)
```

### The Flaky Test

Flaky tests are the enemy of agent-driven development. When a test passes sometimes and fails other times with the same code, an agent cannot determine whether a change introduced a regression. This leads to:

1. False positives: Agent "fixes" code that was working
2. False negatives: Agent ignores real regressions, assuming they're flaky
3. Trust erosion: Humans stop trusting agent verification

**Fix**: Make tests deterministic with controlled inputs:

```python
# Bad: Non-deterministic test
def test_user_list():
    users = api.get("/users")
    assert len(users) > 0  # Depends on database state

# Good: Deterministic test with fixtures
@pytest.fixture
def seeded_database(test_db):
    """Deterministic test data, same every time."""
    test_db.insert("users", [
        {"id": "user-1", "name": "Alice", "email": "alice@example.com"},
        {"id": "user-2", "name": "Bob", "email": "bob@example.com"},
    ])
    yield test_db
    test_db.truncate("users")

def test_user_list(seeded_database):
    users = api.get("/users")
    assert len(users) == 2
    assert users[0]["email"] == "alice@example.com"
```

### The Magic Number

```python
# Bad: Magic numbers hide intent
if response.status == 429:
    time.sleep(60)
    return retry()

# Good: Named constants with remediation context
RATE_LIMIT_STATUS = 429
RATE_LIMIT_BACKOFF_SECONDS = 60

if response.status == RATE_LIMIT_STATUS:
    logger.info("rate_limited", extra={"extra_fields": {
        "retry_after": RATE_LIMIT_BACKOFF_SECONDS,
        "endpoint": response.url,
        "remediation": "Consider implementing request queuing or reducing call frequency",
    }})
    time.sleep(RATE_LIMIT_BACKOFF_SECONDS)
    return retry()
```

---

## Legibility in Practice: Shopify's Roast Framework

Shopify's open-source Roast framework provides a compelling case study in application legibility for agents.¹ Roast ("Reliable Orchestration of AI-Agent Structured Tasks") breaks down complex AI workflows into discrete, deterministic steps — making the workflow itself legible to both humans and agents.

**How Roast works:** A Roast workflow is defined as a directed graph of steps, each with explicit inputs, outputs, and verification criteria. Instead of giving an agent a vague instruction like "refactor the payment module," a Roast workflow specifies:

1. **Analyze** — Read the current payment module and produce a structured dependency report
2. **Plan** — Generate a refactoring plan with specific file-level changes
3. **Validate Plan** — Verify the plan doesn't violate architectural constraints (using linter rules)
4. **Execute** — Apply the planned changes to each file
5. **Verify** — Run the test suite and compare coverage before/after
6. **Review** — Generate a structured diff summary for human review

Each step produces structured output that the next step consumes. If step 3 fails (the plan violates constraints), the workflow doesn't proceed to execution — it loops back with the constraint violation as context for the planning step.

**Why this matters for legibility:** Roast's key insight is that **workflow structure IS legibility.** By decomposing a complex task into discrete, verifiable steps, the entire process becomes observable. At any point, you can answer: What step is the agent on? What did it produce? Does it pass verification? Where did it fail?

This maps directly to the legibility principles in this chapter:
- **Boot legibility** → Workflow initialization with explicit readiness checks
- **State legibility** → Each step produces structured, queryable output
- **Behavior legibility** → Step transitions are observable and deterministic
- **Error legibility** → Failures include which step failed, what was expected, and what to try next

Shopify built Roast to make their own AI tooling more reliable, but the pattern generalizes. Any team building agent-first workflows can adopt the same principle: structure the workflow as a legible pipeline of discrete steps, not a monolithic agent invocation. The workflow becomes a testable, debuggable artifact — which is exactly what agent-first development demands.

## Security Implications of Agent Legibility

There's a tension at the heart of application legibility: the same interfaces that make your application observable to agents also make it observable to attackers. Making your application legible is essential for agent productivity, but it must be done with security as a first-class concern.

**The asymmetry principle:** Legibility should be asymmetric — legible to your agents, opaque to attackers. This means:

1. **Authentication on all debug endpoints.** Every `/debug/*` endpoint described in this chapter must require authentication. These endpoints expose internal state that would be valuable to an attacker. Use the same authentication mechanism your application already uses — don't create a separate, weaker auth system for debug endpoints.

2. **Secret masking is non-negotiable.** The `/debug/config` endpoint must mask all secrets. But masking isn't enough — you must also ensure that the masked values can't be inferred from the surrounding context. A config that shows `database_url: "***"` but also shows `database_host: "prod-db-01.internal"` and `database_port: 5432` has effectively revealed the connection string.

3. **Rate limiting on observability endpoints.** An attacker who can query `/debug/observe` at will has a powerful reconnaissance tool. Rate-limit these endpoints aggressively — agents don't need to poll them every second.

**Real-world attacks on agent legibility:** The same interfaces that help your agents can be weaponized. Two attacks from 2025–2026 illustrate the risk:

- **Comment and Control** — Johns Hopkins researchers demonstrated that a single crafted GitHub issue title could trigger Claude Code, Gemini CLI, and GitHub Copilot to exfiltrate API keys and tokens from CI/CD environments.² The agents were designed to read context (including issue comments) and act on it — making them "legible" to the attacker's crafted input. The lesson: legibility to the *agent* must not mean legibility to *untrusted inputs*.

- **Clinejection** — A supply chain attack where a crafted GitHub issue title compromised 4,000 developer machines by hijacking an AI bot that was designed to automatically process issues.³ The bot's "legibility" — its ability to read and act on issue content — was the attack vector.

**Design principle for secure legibility:** Every legibility interface should have a trust boundary. The agent can observe what's inside the trust boundary (your application, your infrastructure, your verified context). It cannot observe what's outside (untrusted user input, external APIs, public issue trackers) without sanitization. This is the same principle as input validation, applied to the observability layer.

In practice, this means:
- Debug endpoints are behind authentication and rate limiting
- Agent context is curated — the agent doesn't read raw user input as instructions
- Observability data is scoped to what the agent needs, not everything that's available
- The same linters that constrain code also constrain what the agent can observe

Legibility and security are not opposing forces — they're complementary. A well-designed legibility architecture makes security violations *more* visible, not less. When every action is logged with correlation IDs and every state change is observable, security incidents become easier to detect, diagnose, and respond to. The key is designing the legibility layer with security in mind from the start, not bolting it on afterward.

## The Bigger Picture: Legibility Enables Autonomy

Application legibility is not an end in itself. It's an enabler. As we'll see in Chapter 18 on autonomy levels, an agent's ability to act independently is directly proportional to its ability to verify the effects of its actions.

At autonomy Level 0 (full human oversight), legibility is nice to have. The human can observe the application and tell the agent whether things are working. But at Level 3 and above (autonomous with guardrails), legibility is mandatory. The agent must be able to:

1. Start the application and verify it's running
2. Execute a change and verify it didn't break anything
3. Run tests and interpret the results
4. Inspect the application state to diagnose failures
5. Verify the UI renders correctly

Without legibility, the agent is flying blind. With it, the agent becomes a reliable, scalable member of your engineering team.

The investment in legibility pays compound returns. Every structured log, every health endpoint, every `data-testid` attribute you add doesn't just help the current agent—it helps every future agent that interacts with your application, and every human who needs to debug it at 3 AM.

## The OpenAPI Spec as an Agent Contract

One of the most powerful legibility tools is a well-maintained OpenAPI (Swagger) specification. When an agent can read your API spec, it can understand every endpoint, parameter, and response without exploring the code.

Here's how to make your OpenAPI spec a first-class agent contract:

```yaml
# openapi.yaml — Key sections that maximize agent legibility
openapi: 3.1.0
info:
  title: Order Service API
  version: 1.0.0
  description: |
    ## Agent Integration Guide
    
    This API follows these conventions:
    - All responses use ISO 8601 dates
    - Pagination is cursor-based (see Pagination section below)
    - Errors follow RFC 7807 Problem Details format
    - All endpoints require X-Correlation-ID header
    
    ## Pagination
    
    List endpoints return a pagination object:
    ```json
    {
      "data": [...],
      "pagination": {
        "next_cursor": "eyJpZCI6MTAwfQ",
        "has_more": true
      }
    }
    ```
    
    Pass `next_cursor` as the `cursor` query parameter to get the next page.
    When `has_more` is false, you've reached the end.
  
paths:
  /api/v1/orders:
    get:
      summary: List orders
      operationId: listOrders
      description: |
        Retrieve a paginated list of orders.
        
        Common patterns:
        - Get all pending orders: ?status=pending
        - Get orders for a customer: ?customer_id=cust_123
        - Get recent orders: ?limit=10 (returns newest first)
```

The spec embeds conventions directly, so any agent that reads it understands pagination, error handling, and date formatting without additional context.

### Generating Specs from Code

The most reliable way to maintain your OpenAPI spec is to generate it from code. FastAPI (Python), NestJS (TypeScript), and Spring Boot (Java) all support spec generation from decorators and type annotations.

When the spec is generated from code, it's always up to date. When it's maintained separately, it inevitably drifts from the implementation—and a stale spec is worse than no spec, because it misleads the agent.

## Agent-Aware Error Recovery

Legibility isn't just about observing the current state—it's about enabling the agent to recover from errors. A truly legible system provides error recovery pathways, not just error messages.

### The Recovery Hierarchy

When an error occurs, a legible system provides information at multiple levels:

```
Level 1: What happened
  → "Payment for order ord_123 was declined"

Level 2: Why it happened  
  → "The credit card ending in 4242 has expired"

Level 3: What the agent can try
  → "1. Retry with a different payment method"
    "2. Check if the card was recently updated"
    "3. Contact the payment gateway for details"

Level 4: What the agent should NOT try
  → "Do NOT retry with the same card — it will fail again"
    "Do NOT mark the order as paid — payment was not processed"

Level 5: Where to escalate
  → "If all payment methods fail, create a support ticket"
    "with category 'payment-declined' and attach the order ID"
```

This hierarchy gives the agent a decision tree for error recovery. Without it, the agent is left to guess at remediation steps, which leads to ineffective retries and cascading failures.

### Implementing Error Recovery Metadata

```typescript
// error-recovery.ts — Error types with built-in recovery guidance

interface RecoveryStep {
  action: string;
  automatable: boolean;
  riskLevel: 'safe' | 'caution' | 'dangerous';
  prerequisite?: string;
}

interface AgentFriendlyError {
  code: string;
  message: string;
  recoverySteps: RecoveryStep[];
  dontDo: string[];
  escalationPath?: string;
  relatedDocs?: string;
  context: Record<string, unknown>;
}

class OrderPaymentError extends Error implements AgentFriendlyError {
  code = 'PAYMENT_DECLINED';
  recoverySteps: RecoveryStep[] = [
    {
      action: 'Retry payment with a different payment method',
      automatable: true,
      riskLevel: 'safe',
      prerequisite: 'Customer must have another payment method on file',
    },
    {
      action: 'Check payment gateway status page',
      automatable: true,
      riskLevel: 'safe',
    },
    {
      action: 'Put order on hold and notify customer',
      automatable: true,
      riskLevel: 'caution',
      prerequisite: 'Order must be in pending status',
    },
  ];
  
  dontDo = [
    'Do not retry with the same payment method',
    'Do not mark the order as paid',
    'Do not cancel the order without customer confirmation',
  ];
  
  escalationPath = 'Create support ticket with category payment-declined';
  relatedDocs = 'docs/payment-errors.md#declined';
  context: Record<string, unknown>;
  
  constructor(orderId: string, reason: string, paymentMethodId: string) {
    super(`Payment for order ${orderId} was declined: ${reason}`);
    this.context = { orderId, reason, paymentMethodId };
  }
}
```

This pattern transforms errors from roadblocks into navigable decision trees. The agent knows not just what went wrong, but what it can safely try, what it should avoid, and when to escalate.

## Metrics as a Legibility Tool

Metrics provide a time-series view of application behavior that complements the point-in-time view of logs and traces. For agents, metrics answer questions like "Is the application slower than usual?", "Are error rates elevated?", or "Has throughput changed since the last deployment?"

### Agent-Queryable Metrics

Structure your metrics so agents can ask natural-language questions:

```python
# metrics_registry.py — Metrics with semantic labels
from prometheus_client import Counter, Histogram, Gauge, Info

http_requests = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code', 'user_type'],
)

request_duration = Histogram(
    'http_request_duration_seconds',
    'Request duration',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0],
)

orders_created = Counter(
    'orders_created_total',
    'Total orders created',
    ['status', 'payment_method', 'source'],
)

order_value = Histogram(
    'order_value_dollars',
    'Order value in dollars',
    ['payment_method'],
    buckets=[10, 25, 50, 100, 250, 500, 1000, 5000],
)

database_connections = Gauge(
    'database_connections',
    'Active database connections',
    ['pool', 'state'],
)

queue_depth = Gauge(
    'queue_depth',
    'Messages in processing queue',
    ['queue_name', 'priority'],
)
```

### The Metrics Summary Endpoint

For agents that can't query Prometheus directly, provide a metrics summary endpoint:

```python
@app.get("/debug/metrics-summary")
async def metrics_summary():
    """Human and agent readable metrics summary."""
    return {
        "throughput": {
            "requests_per_second": metrics.get_rate("http_requests", window="5m"),
            "orders_per_minute": metrics.get_rate("orders_created", window="5m"),
            "change_from_yesterday": metrics.get_change("http_requests", "1d"),
        },
        "latency": {
            "p50_ms": metrics.get_percentile("http_request_duration", 0.50),
            "p95_ms": metrics.get_percentile("http_request_duration", 0.95),
            "p99_ms": metrics.get_percentile("http_request_duration", 0.99),
            "slowest_endpoints": metrics.get_slowest_endpoints(limit=5),
        },
        "errors": {
            "error_rate": metrics.get_error_rate(window="5m"),
            "top_error_codes": metrics.get_top_errors(limit=5),
            "recent_incidents": metrics.get_recent_incidents(window="1h"),
        },
        "resources": {
            "database_connections": metrics.get_gauge("database_connections"),
            "queue_depth": metrics.get_gauge("queue_depth"),
            "memory_usage_mb": metrics.get_gauge("process_memory"),
            "cpu_usage_percent": metrics.get_gauge("process_cpu"),
        },
    }
```

This endpoint gives an agent a complete system health overview in a single request. It's the equivalent of a doctor's chart—everything you need to assess the patient's condition at a glance.

## Legibility in Practice: A Case Study

Let's walk through a complete example of how legibility enables agent-driven development.

**Scenario**: An agent needs to add a "gift wrapping" option to the order service.

**Without legibility**:
1. Agent reads README (partially outdated)
2. Agent searches for order-related files (slow, imprecise)
3. Agent adds a `gift_wrap` field to the Order model
4. Agent updates the API route to accept the new field
5. Agent runs tests — some pass, some fail for unclear reasons
6. Agent can't tell if the change works correctly
7. Human intervention needed

**With legibility**:
1. Agent reads AGENTS.md — learns conventions, directory structure, and testing patterns
2. Agent reads the OpenAPI spec at `/openapi.json` — understands the current order API
3. Agent adds `gift_wrap` to the Order type in `src/types/order.ts`
4. Agent adds the field to the database migration (convention: numbered files in `migrations/`)
5. Agent updates the repository mapper (convention: files in `src/data/`)
6. Agent updates the service layer (convention: files in `src/services/`)
7. Agent updates the API route and OpenAPI spec
8. Agent runs `scripts/setup.sh` to ensure a clean environment
9. Agent runs `pytest` — structural tests verify the type was added to all required layers
10. Agent hits `/ready` to verify the service is healthy
11. Agent calls the API with the new field and verifies the response
12. Agent checks the accessibility tree to verify UI changes
13. Agent submits PR with confidence

The legible path takes minutes and produces a correct, well-tested PR. The illegible path takes hours and may still require human intervention.

This difference compounds at scale. When your agent makes 15-20 PRs per day, the difference between a 10-minute cycle and a 2-hour cycle is the difference between productive agent-first development and frustrating assisted development.

## Legibility and the Wix AirBot Example

The Wix AirBot (the full case study is in Chapter 16) provides a real-world validation of these principles — saving 675 engineering hours per month by operating as an AI on-call teammate across Wix's massive infrastructure (250 million users, 4 billion HTTP transactions per day).⁶ What enabled this level of automation was not just the AI model—it was the legibility of Wix's infrastructure.

The key legibility investments Wix made:
1. **Structured logging** with consistent formats across all services
2. **Correlation IDs** linking related events across the distributed system
3. **Health check standardization** so AirBot can assess the status of any service
4. **Runbook automation** with structured remediation steps
5. **Metric dashboards** that AirBot can query programmatically

These investments didn't just help AirBot—they helped every human engineer at Wix debug issues faster. Legibility is a rising tide that lifts all boats.

---

## Distributed Tracing for Agent Debugging

When an agent is debugging a failure in a microservices architecture, it needs to trace the request path across multiple services. Distributed tracing provides this capability, but only if the tracing is structured for agent consumption.

### The Three Questions of Agent Tracing

When an agent investigates a failure, it asks three questions:

1. **Where did the failure occur?** — Which service, which operation, which line of code?
2. **What was the context?** — What were the inputs, what was the state, what were the dependencies?
3. **What caused it?** — Was it a timeout, a data error, a configuration issue?

A well-instrumented trace answers all three:

```json
{
  "trace_id": "abc123def456",
  "spans": [
    {
      "span_id": "span-001",
      "operation": "POST /api/v1/orders",
      "service": "api-gateway",
      "status": "error",
      "error": {
        "type": "UpstreamTimeout",
        "message": "Payment service did not respond within 5s",
        "remediation": "Check payment service health. Verify network connectivity. Consider increasing timeout."
      },
      "attributes": {
        "http.method": "POST",
        "http.url": "/api/v1/orders",
        "http.status_code": 504,
        "customer_id": "cust-789",
        "order_total": 150.00
      }
    },
    {
      "span_id": "span-002",
      "parent_id": "span-001",
      "operation": "charge_payment",
      "service": "payment-service",
      "status": "error",
      "error": {
        "type": "ConnectionRefused",
        "message": "Could not connect to Stripe API",
        "remediation": "Verify STRIPE_API_KEY is set. Check if Stripe is accessible from this environment. Test with: curl https://api.stripe.com/v1/balance"
      }
    }
  ]
}
```

The agent can read this trace and immediately understand: the payment service failed because it couldn't connect to Stripe. The remediation field tells the agent to check the API key and network connectivity. This is debugging at machine speed.

### Trace-Based Testing

Traces aren't just for debugging—they can also be used for testing. Trace-based testing verifies that a request produces the expected trace structure:

```typescript
// tests/trace/order-creation-trace.test.ts
describe("Trace structure: Order creation", () => {
  it("should produce a complete trace with expected spans", async () => {
    const response = await api.post("/api/v1/orders", {
      customerId: "cust-001",
      items: [{ productId: "prod-001", quantity: 1 }],
    });
    
    expect(response.status).toBe(201);
    
    const trace = await getTrace(response.headers["x-trace-id"]);
    
    // Verify expected span structure
    const spans = trace.spans;
    
    // Should have a root span for the HTTP request
    const rootSpan = spans.find(s => !s.parent_id);
    expect(rootSpan.operation).toBe("POST /api/v1/orders");
    expect(rootSpan.status).toBe("ok");
    
    // Should have a child span for order creation
    const orderSpan = spans.find(s => s.operation === "create_order");
    expect(orderSpan).toBeDefined();
    expect(orderSpan.parent_id).toBe(rootSpan.span_id);
    
    // Should have a child span for payment
    const paymentSpan = spans.find(s => s.operation === "charge_payment");
    expect(paymentSpan).toBeDefined();
    expect(paymentSpan.attributes["payment.amount"]).toBe(10.00);
    
    // Every span should have a service name
    for (const span of spans) {
      expect(span.service).toBeDefined();
    }
  });
});
```

This test verifies that the order creation flow produces the expected trace structure. If a span is missing or has unexpected attributes, the test fails—and the failure message tells the agent exactly what's wrong.

## The Meta-Observability Pattern

The most advanced form of legibility is meta-observability: the ability to observe the observation system itself. If your logging pipeline is broken, your agent can't debug anything. If your metrics endpoint is down, your agent can't assess system health.

```python
# meta_observability.py
@app.get("/debug/observability-health")
async def observability_health():
    """Is the observability stack itself working?"""
    checks = {
        "logging": await check_logging_pipeline(),
        "metrics": await check_metrics_endpoint(),
        "tracing": await check_trace_collector(),
        "alerts": await check_alert_manager(),
    }
    
    return {
        "status": "healthy" if all(c["healthy"] for c in checks.values()) else "degraded",
        "checks": checks,
        "note": (
            "If any check is unhealthy, the agent may not have complete "
            "visibility into the application. Proceed with caution and "
            "verify findings through direct API calls."
        ),
    }
```

This endpoint answers the question: "Can I trust what I'm seeing?" If the observability stack is degraded, the agent knows to verify its findings through alternative channels (direct API calls, database queries) rather than relying solely on logs and metrics.

## Legibility Across the SDLC

Legibility isn't just for running applications. It applies at every stage of the software development lifecycle:

### Build Legibility

The build process should produce structured output that an agent can parse:

```json
{
  "build_id": "build-12345",
  "status": "failed",
  "duration_seconds": 45,
  "steps": [
    { "name": "install", "status": "passed", "duration_s": 12 },
    { "name": "compile", "status": "passed", "duration_s": 8 },
    { "name": "lint", "status": "failed", "duration_s": 3,
      "error": {
        "rule": "custom-rules/layer-dependency-direction",
        "file": "src/domain/order.ts",
        "line": 3,
        "message": "Layer 'domain' cannot import from 'services'",
        "remediation": "Move shared code to types layer or use dependency inversion"
      }
    },
    { "name": "test", "status": "skipped", "duration_s": 0 }
  ]
}
```

### Deployment Legibility

Deployments should produce structured events:

```json
{
  "deployment_id": "deploy-67890",
  "service": "order-service",
  "version": "1.2.3",
  "commit": "abc1234",
  "status": "rolling_out",
  "strategy": "canary",
  "canary_percentage": 10,
  "rollback_trigger": {
    "error_rate_threshold": 0.01,
    "latency_p99_threshold_ms": 500,
    "check_interval_seconds": 30
  },
  "next_steps": [
    "Monitor metrics at /debug/metrics-summary for 10 minutes",
    "If error rate < 1%, proceed to 50% rollout",
    "If error rate > 1%, trigger automatic rollback"
  ]
}
```

The `next_steps` field gives the agent an explicit decision tree for the deployment. It doesn't need to guess when to proceed or rollback—the criteria are encoded in the deployment metadata.

### Production Legibility

In production, legibility extends to incident management:

```python
@app.get("/debug/incident-context")
async def incident_context():
    """Current incident context for agent-driven diagnosis."""
    return {
        "active_incidents": await get_active_incidents(),
        "recent_deployments": await get_recent_deployments(window="1h"),
        "current_error_budget": await get_error_budget_remaining(),
        "oncall_engineer": await get_current_oncall(),
        "runbooks": [
            {
                "trigger": "error_rate > 1%",
                "url": "docs/runbooks/high-error-rate.md",
                "automated_steps": [
                    "Check /debug/metrics-summary for top error codes",
                    "Check /debug/deployments for recent changes",
                    "If recent deployment, consider rollback",
                ],
            },
        ],
    }
```

This endpoint gives an agent the complete context it needs to diagnose and respond to production incidents. It's the equivalent of a senior engineer's mental model, encoded in a queryable API.

---

## Summary

- **Application legibility** means every meaningful behavior can be programmatically observed and evaluated
- The five dimensions are: boot, state, behavior, error, and visual legibility
- **Health checks** (`/health` for liveness, `/ready` for readiness) are the foundation
- **Structured logging** with JSON, correlation IDs, and remediation hints enables agent debugging
- **UI legibility** requires semantic HTML, `data-testid` attributes, and accessibility labels
- **Visual regression testing** at three layers: DOM structure, pixel comparison, AI-powered semantic comparison
- **Agent test harnesses** produce structured output with remediation guidance, not just pass/fail
- Legibility is a **prerequisite for agent autonomy**, not an optional quality attribute

---


---

## Footnotes

¹ Shopify Engineering, "Introducing Roast," shopify.engineering, 2025. https://shopify.engineering/introducing-roast

² OddGuan Research, "Comment and Control: Prompt Injection for Credential Theft," oddguan.com, 2025. https://oddguan.com/blog/comment-and-control-prompt-injection-credential-theft

³ SecuringAgents, "Clinejection: How a GitHub Issue Title Compromised 4,000 Developer Machines," securingagents.com, 2025. https://securingagents.com/articles/clinejection-how-a-github-issue-title-compromised-4000-developer-machines

⁴ Ryan Lopopolo, "Harness Engineering: Leveraging Codex in an Agent-First World," OpenAI Blog, February 2026. https://openai.com/blog/harness-engineering-leveraging-codex

⁵ Martin Fowler, LinkedIn post on Harness Engineering, 2026. [Citation needed — verify URL before publication]

⁶ Wix Engineering, "AirBot: Our AI On-Call Teammate," Wix Engineering Blog, 2025. [Citation needed — verify before publication]

---

## Key Takeaways

- **Application legibility** means every meaningful behavior can be programmatically observed and evaluated. Without it, agents are flying blind.
- The **five dimensions** of legibility are: boot, state, behavior, error, and visual legibility. Address them all.
- **Health checks** (`/health` for liveness, `/ready` for readiness with deep dependency checking) are the foundation of boot legibility. Deep health checks verify function, not just connectivity.
- **Structured logging** with JSON, correlation IDs, remediation hints, and error envelopes enables agents to debug without human intervention.
- **UI legibility** requires semantic HTML, `data-testid` attributes, `aria-label` attributes, and explicit loading/error states.
- **Visual regression testing** operates at three layers: DOM structure, pixel comparison, and AI-powered semantic comparison.
- **Agent test harnesses** produce structured output with remediation guidance — not just pass/fail, but "what to do about it."
- **Headless browser automation** patterns (deterministic page states, page maps, visual diff pipelines) make UI testing reliable for agents.
- **The observability stack** (logging, metrics, tracing, profiling) must be queryable through structured interfaces that agents can parse.
- **The unified observe endpoint** gives agents a single query interface for all observability data, with built-in guidance.
- **Error recovery metadata** transforms errors from roadblocks into navigable decision trees with recovery steps, don't-do lists, and escalation paths.
- **The phased implementation guide** (5 weeks) provides a practical roadmap for achieving full legibility.
- **The ROI is clear:** legibility investments pay for themselves within the first month through time savings and quality improvements, with compound returns over time.
- **Document your observability interfaces in AGENTS.md** so agents know what's available and how to use it.
- **The OpenAPI specification** serves as a machine-readable contract between your application and the agent.

The next chapter builds on these legibility foundations to create agent-friendly infrastructure — the conventions, patterns, and self-documenting systems that make agents productive from day one.

---

## Legibility in the OpenAI Harness: Lessons from 1M Lines

The OpenAI team's achievement — producing 1M lines of code with zero human-written lines — relied heavily on legibility.⁴ Ryan Lopopolo described how every component the agents built was designed to be verifiable by the agents themselves. Let's examine the specific legibility investments that made this possible.

### Ephemeral Observability Per Agent

Each Codex agent worked in its own isolated git worktree with its own ephemeral observability stack. When the agent started a task, it also started a lightweight monitoring instance that collected logs, metrics, and traces from the agent's work. When the task was complete, the observability data was archived and the stack was torn down.

This pattern ensured that every agent had complete visibility into its own work, without interference from other agents. The agent could verify that its changes didn't break the application by checking its own observability data.

### Self-Verifying Build Artifacts

The OpenAI team designed their build system to produce self-verifying artifacts. Every build output included a manifest with checksums, dependency versions, and test results. An agent could verify that a build was correct by checking the manifest — no manual verification needed.

### The Legibility Flywheel

The OpenAI team discovered a positive feedback loop: as they invested more in legibility, the agents became more effective, which reduced the need for human intervention, which freed up more time for legibility investments. This flywheel accelerated their progress:

```
More legibility → Agents more effective → Less human intervention → More time for legibility → (repeat)
```

This flywheel is the key insight for any team starting their legibility journey. Start small — a `/health` endpoint, a structured log format, a few `data-testid` attributes. As the agents become more effective, the returns from additional legibility investments grow, justifying further investment.

The teams that start this flywheel early will have a compounding advantage over teams that delay. Every day you wait to invest in legibility is a day your agents are less effective than they could be. The best time to start was yesterday. The second best time is today.

---

## Headless Browser Automation Patterns for Agents

Modern coding agents can drive browsers using tools like Playwright and Puppeteer. Designing your application for headless browser automation is a superpower for agent-driven testing and verification. Here are the key patterns.

### Pattern: Deterministic Page States

The biggest challenge in headless browser automation is waiting for asynchronous content to load. Make this deterministic by exposing state through data attributes:

```html
<!-- Instead of hoping content has loaded -->
<div class="order-list" data-loading-state="complete" data-item-count="3">
  <div class="order-item" data-testid="order-card" data-order-status="pending">
    <span data-testid="order-id">ORD-001</span>
    <span data-testid="order-total">$125.00</span>
  </div>
  <!-- more orders -->
</div>
```

The agent can now assert on `data-loading-state="complete"` and `data-item-count="3"` — no timing-dependent waits, no flaky assertions.

### Pattern: Agent-Friendly Navigation

Provide a sitemap-like endpoint that tells agents which pages exist and how to navigate to them:

```typescript
// GET /debug/page-map
{
  "pages": [
    {
      "name": "Dashboard",
      "path": "/dashboard",
      "requiresAuth": true,
      "testIds": {
        "root": "dashboard-page",
        "loadState": "dashboard-loading"
      }
    },
    {
      "name": "Order List",
      "path": "/orders",
      "requiresAuth": true,
      "testIds": {
        "root": "orders-page",
        "loadState": "orders-loading",
        "createButton": "create-order-btn"
      }
    },
    {
      "name": "Order Detail",
      "path": "/orders/:id",
      "requiresAuth": true,
      "testIds": {
        "root": "order-detail-page",
        "loadState": "order-detail-loading"
      },
      "params": {
        "id": "Use any valid order ID from /orders page"
      }
    }
  ],
  "authFlow": {
    "loginPage": "/login",
    "testCredentials": {
      "email": "test-agent@example.com",
      "password": "available in seed data only"
    },
    "testIds": {
      "emailInput": "login-email",
      "passwordInput": "login-password",
      "submitBtn": "login-submit"
    }
  }
}
```

This endpoint is a map for agents. It tells them every page in the application, how to get there, and what test IDs to use for verification. An agent reading this endpoint can navigate the entire application without exploring the DOM.

### Pattern: Screenshot Diffing Pipeline

Automated visual regression becomes a CI gate when you integrate it into your agent workflow:

```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression
on: [pull_request]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install and build
        run: npm ci && npm run build
      - name: Start application
        run: npm run start &
      - name: Wait for readiness
        run: npx wait-on http://localhost:3000/ready --timeout 30000
      - name: Run visual regression tests
        run: npx playwright test --project=visual-regression
        env:
          UPDATE_BASELINE: false  # Set true to update baselines
      - name: Upload diff images
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-diffs
          path: tests/visual/__diffs__/
```

When this CI job fails, the agent can download the diff images, analyze them with a vision model, and determine whether the visual changes are intentional (part of the feature) or unintentional (a regression).

---

## Structured Logging Deep Dive

Structured logging deserves a deeper treatment than the introduction above. Let's explore the patterns that make logging truly useful for agents.

### The Five Fields Every Log Must Have

Every structured log entry should include these five fields at minimum:

1. **timestamp** — ISO 8601, including timezone
2. **level** — One of: DEBUG, INFO, WARN, ERROR, FATAL
3. **correlation_id** — Links related events
4. **message** — Human-readable description of the event
5. **context** — Structured data relevant to the event

```json
{
  "timestamp": "2025-06-15T14:30:00.123Z",
  "level": "ERROR",
  "correlation_id": "corr-abc-123",
  "message": "Payment processing failed",
  "context": {
    "order_id": "ord-456",
    "payment_method": "credit_card",
    "error_code": "CARD_DECLINED",
    "gateway_response": "insufficient_funds",
    "remediation": "Retry with different payment method or contact customer"
  },
  "span_id": "span-789",
  "trace_id": "trace-def-456",
  "service": "payment-service",
  "version": "1.2.3"
}
```

### Log Levels for Agents

The standard log levels (DEBUG, INFO, WARN, ERROR, FATAL) work well for agents, but agents interpret them differently than humans:

- **DEBUG**: Agent ignores these unless actively debugging a specific issue
- **INFO**: Agent reads these to understand the normal flow of operations
- **WARN**: Agent notes these as potential issues that don't require immediate action
- **ERROR**: Agent treats these as actionable failures requiring investigation
- **FATAL**: Agent immediately escalates to a human

### Error Context Envelope

Wrap all error logs in a standard envelope that includes remediation:

```python
# error_logging.py
class ErrorEnvelope:
    """Standard error context for agent-consumable logs."""
    
    def __init__(self, error: Exception, context: dict, remediation: str):
        self.error_type = type(error).__name__
        self.error_message = str(error)
        self.context = context
        self.remediation = remediation
        self.stack_trace = traceback.format_exc()
    
    def to_log(self) -> dict:
        return {
            "error_type": self.error_type,
            "error_message": self.error_message,
            "context": self.context,
            "remediation": self.remediation,
            "stack_trace": self.stack_trace,
            "automated_actions": self._suggest_actions(),
        }
    
    def _suggest_actions(self) -> list:
        """Map error types to automated remediation actions."""
        actions = {
            "ConnectionError": ["Check network connectivity", "Verify target service is running"],
            "TimeoutError": ["Increase timeout", "Check downstream service health"],
            "ValidationError": ["Check input against schema", "Review field constraints"],
            "AuthenticationError": ["Check credentials", "Verify token expiry"],
            "RateLimitError": ["Implement backoff", "Reduce request frequency"],
        }
        return actions.get(self.error_type, ["Investigate manually"])
```

### Log Aggregation for Agents

Provide an endpoint that lets agents query logs directly:

```python
@app.get("/debug/logs")
async def query_logs(
    correlation_id: Optional[str] = None,
    level: Optional[str] = None,
    service: Optional[str] = None,
    since: Optional[str] = None,  # ISO 8601 timestamp
    limit: int = 100,
):
    """Query structured logs — for agent debugging."""
    query = {}
    if correlation_id:
        query["correlation_id"] = correlation_id
    if level:
        query["level"] = level
    if service:
        query["service"] = service
    if since:
        query["timestamp"] = {"$gte": since}
    
    logs = await log_store.query(query, limit=limit)
    
    return {
        "total": len(logs),
        "logs": logs,
        "query": query,
        "hint": (
            "Use correlation_id to trace a request across services. "
            "Filter by level=ERROR to find failures. "
            "Use since parameter for time-range queries."
        ),
    }
```

The `hint` field is a meta-legibility pattern — it tells the agent how to use the endpoint effectively.

---

## Health Check Patterns Deep Dive

Beyond the basic liveness and readiness endpoints, there are several advanced health check patterns that significantly improve agent legibility.

### Deep Health Checks

A deep health check verifies not just that a dependency is reachable, but that it's functioning correctly:

```python
@app.get("/ready")
async def readiness():
    """Deep readiness check — verifies all dependencies are functional."""
    checks = {}
    
    # Database: can we read and write?
    try:
        test_id = str(uuid.uuid4())
        await db.execute("INSERT INTO health_checks (id) VALUES (?)", test_id)
        result = await db.fetch_one("SELECT id FROM health_checks WHERE id = ?", test_id)
        await db.execute("DELETE FROM health_checks WHERE id = ?", test_id)
        checks["database"] = {
            "status": "healthy",
            "latency_ms": db_latency,
            "details": "Read/write test passed",
        }
    except Exception as e:
        checks["database"] = {
            "status": "unhealthy",
            "error": str(e),
            "remediation": "Check database connectivity and credentials",
        }
    
    # Cache: can we set and get?
    try:
        await cache.set("health_check", "ok", ttl=10)
        value = await cache.get("health_check")
        checks["cache"] = {
            "status": "healthy" if value == "ok" else "degraded",
            "latency_ms": cache_latency,
        }
    except Exception as e:
        checks["cache"] = {
            "status": "unhealthy",
            "error": str(e),
            "remediation": "Check Redis connectivity",
        }
    
    # External API: can we reach it?
    try:
        response = await http_client.get("https://api.payment-gateway.com/health",
                                           timeout=5.0)
        checks["payment_gateway"] = {
            "status": "healthy" if response.status == 200 else "degraded",
            "latency_ms": gateway_latency,
        }
    except Exception as e:
        checks["payment_gateway"] = {
            "status": "degraded",  # Not unhealthy — we can still serve cached data
            "error": str(e),
            "impact": "New payments will fail, but existing data is accessible",
            "remediation": "Check payment gateway status page",
        }
    
    overall_status = _calculate_overall_status(checks)
    
    return HealthStatus(
        status=overall_status,
        checks=checks,
        version=os.environ.get("APP_VERSION"),
        uptime_seconds=time.time() - START_TIME,
    )
```

### Startup Dependency Ordering

For applications with many dependencies, the health check should communicate which dependencies are required vs. optional:

```python
DEPENDENCY_CONFIG = {
    "database": {"required": True, "critical": True},
    "cache": {"required": False, "critical": False, "degraded_ok": True},
    "payment_gateway": {"required": False, "critical": True},  # Must be healthy for payments
    "email_service": {"required": False, "critical": False, "degraded_ok": True},
    "analytics": {"required": False, "critical": False, "degraded_ok": True},
}

def calculate_readiness(checks: dict) -> str:
    """Determine readiness based on dependency criticality."""
    for name, config in DEPENDENCY_CONFIG.items():
        check = checks.get(name, {})
        if config["required"] and check["status"] != "healthy":
            return "not_ready"
        if config["critical"] and check["status"] == "unhealthy":
            return "degraded"
    return "ready"
```

This pattern lets the agent understand *why* the application reports as degraded, and which functionality is affected. An agent can decide: "The payment gateway is down, so I'll skip payment-related tests and focus on non-payment features."

### Graceful Degradation Communication

When the application is in a degraded state, it should communicate what functionality is available:

```python
@app.get("/ready")
async def readiness():
    checks = await run_all_checks()
    status = calculate_readiness(checks)
    
    response = {
        "status": status,
        "checks": checks,
        "available_features": _calculate_available_features(checks),
        "degraded_features": _calculate_degraded_features(checks),
    }
    
    if status == "degraded":
        response["agent_guidance"] = (
            "Some features are unavailable. Focus testing on available_features. "
            "Skip tests that depend on degraded_features. "
            "Report degraded state in PR description."
        )
    
    return response
```

This is the highest level of health check legibility: not just "is it working?" but "what's working, what's not, and what should I do about it?"

---

## The Complete Observability Stack for Agents

Let's tie together logging, metrics, tracing, and profiling into a unified observability architecture designed for agent consumption.

### The Agent Observability Query Interface

Instead of forcing agents to learn Prometheus query language, Grafana dashboards, and Jaeger UI, provide a single query interface:

```python
@app.get("/debug/observe")
async def observe(
    query_type: str,  # "logs" | "metrics" | "traces" | "overview"
    correlation_id: Optional[str] = None,
    time_range: Optional[str] = "1h",  # "5m", "1h", "24h", "7d"
    service: Optional[str] = None,
    endpoint: Optional[str] = None,
    error_only: bool = False,
):
    """
    Unified observability endpoint for agent consumption.
    
    Usage patterns:
    - /debug/observe?query_type=overview — System health overview
    - /debug/observe?query_type=logs&correlation_id=X — Trace a request
    - /debug/observe?query_type=metrics&endpoint=/api/orders — Endpoint metrics
    - /debug/observe?query_type=traces&correlation_id=X — Distributed trace
    """
    if query_type == "overview":
        return await get_system_overview(time_range)
    elif query_type == "logs":
        return await query_logs(correlation_id, service, error_only, time_range)
    elif query_type == "metrics":
        return await get_endpoint_metrics(endpoint, time_range)
    elif query_type == "traces":
        return await get_trace(correlation_id)
    else:
        return {"error": f"Unknown query_type: {query_type}", 
                "valid_types": ["logs", "metrics", "traces", "overview"]}

async def get_system_overview(time_range: str) -> dict:
    """Complete system health overview."""
    return {
        "summary": {
            "status": await calculate_system_status(),
            "active_incidents": await count_active_incidents(),
            "recent_deployments": await count_recent_deployments(time_range),
            "error_rate": await get_error_rate(time_range),
            "p99_latency_ms": await get_p99_latency(time_range),
            "throughput_rps": await get_throughput(time_range),
        },
        "trends": {
            "error_rate_trend": await get_error_rate_trend(time_range),
            "latency_trend": await get_latency_trend(time_range),
            "throughput_trend": await get_throughput_trend(time_range),
        },
        "top_issues": await get_top_issues(time_range, limit=5),
        "agent_guidance": _generate_guidance(await calculate_system_status()),
    }

def _generate_guidance(status: str) -> str:
    if status == "healthy":
        return "System is healthy. Proceed with normal testing and deployment."
    elif status == "degraded":
        return ("System is degraded. Check top_issues for details. "
                "Consider postponing non-critical changes. "
                "Focus testing on unaffected areas.")
    else:
        return ("System is unhealthy. Do NOT deploy changes. "
                "Investigate top_issues and resolve before proceeding. "
                "Consider rollback if recent deployment.")
```

This unified interface lets an agent ask "what's going on?" and get a complete, actionable answer in a single request. It's the observability equivalent of a doctor's diagnosis — not a list of raw measurements, but an interpretation with guidance.

### The Observability Contract in AGENTS.md

Document your observability interfaces in AGENTS.md so the agent knows what's available:

```markdown
## Observability

### Health Endpoints
- `GET /health` — Liveness probe (is the process alive?)
- `GET /ready` — Readiness probe (can we serve traffic?)
  - Returns: `{ status, checks, available_features, degraded_features }`
  - Check `degraded_features` before running tests that depend on external services

### Debug Endpoints (require admin auth)
- `GET /debug/stats` — Current application statistics
- `GET /debug/config` — Effective configuration (secrets masked)
- `GET /debug/observe` — Unified observability query interface
  - query_type: overview | logs | metrics | traces
  - Always start with `?query_type=overview` to assess system health

### Logging
- All logs are JSON-structured with fields: timestamp, level, correlation_id, message, context
- Query logs: `GET /debug/observe?query_type=logs&correlation_id=X`
- Error logs include `remediation` field with suggested fix

### Testing
- All UI elements use `data-testid` attributes
- Page map: `GET /debug/page-map`
- Test credentials: Use `test-agent@example.com` (seed data)
- Visual regression baselines: `tests/visual/__baselines__/`
```

This section in AGENTS.md gives the agent a complete map of your application's observability surface. It knows where to look, what to expect, and how to interpret what it finds.

---

## Practical Implementation Guide

Implementing full legibility can feel overwhelming. Here's a phased approach:

### Phase 1: Boot and Health (Week 1)

Start with the fundamentals:
1. Add `/health` and `/ready` endpoints to every service
2. Ensure startup emits a structured `startup_complete` log
3. Add readiness polling to your agent test harness
4. Verify the agent can start and stop your application reliably

**Verification:** Run your agent through this loop 10 times:
```
1. Start application
2. Poll /ready until status=healthy
3. Make one API call
4. Stop application
5. Verify clean shutdown in logs
```
If this loop passes all 10 times, your boot legibility is solid.

### Phase 2: Structured Logging (Week 2)

1. Implement JSON logging with correlation IDs
2. Add `remediation` fields to error logs
3. Ensure every request logs at entry and exit with timing
4. Add a `/debug/logs` query endpoint

**Verification:** Have your agent debug a known error. Can it find the relevant logs, understand the error, and identify the remediation? If yes, logging is solid.

### Phase 3: Observability Stack (Week 3)
1. Add Prometheus metrics with semantic labels
2. Implement OpenTelemetry distributed tracing
3. Add `/metrics` and `/debug/metrics-summary` endpoints
4. Create the unified `/debug/observe` interface

**Verification:** Have your agent answer these questions programmatically:
- What's the current error rate?
- What's the p99 latency?
- Are there any active incidents?
- What are the top 5 slowest endpoints?

### Phase 4: UI Legibility (Week 4)
1. Add `data-testid` attributes to all interactive elements
2. Add `aria-label` to elements that need it
3. Create visual regression baselines for critical pages
4. Implement the `/debug/page-map` endpoint

**Verification:** Have your agent navigate the application using only the page map and test IDs. Can it complete a critical user journey without any CSS selectors or XPath?

### Phase 5: Error Recovery (Week 5)
1. Implement error envelopes with remediation guidance
2. Add `dontDo` fields to prevent unsafe agent actions
3. Create the `/debug/incident-context` endpoint
4. Document error codes and their meanings

**Verification:** Introduce a known error (e.g., disconnect the database). Can your agent identify the error, understand the remediation, and take the correct action?

Each phase builds on the previous one. By the end of five weeks, your application is fully legible — and your agent can operate with high confidence.

---

## The Legibility ROI: Measuring What You Gain

Investing in legibility takes time. How do you justify the investment? Here's the ROI framework:

### Time Saved in Agent Cycles

Without legibility, an agent spends significant time on each task trying to understand whether the application is working correctly:

| Activity | Without Legibility | With Legibility | Savings |
|---|---|---|---|
| Verify application started | 30–60s (guesswork + retries) | 5s (poll /ready) | 25–55s per cycle |
| Debug a test failure | 5–10 min (manual investigation) | 30s (read structured error + remediation) | 4.5–9.5 min per failure |
| Verify UI changes | Manual screenshot review | 10s (automated visual regression) | 5–10 min per change |
| Navigate to a page | 30s (explore DOM) | 5s (use page map) | 25s per navigation |
| Understand an error | 2–5 min (read stack trace, search logs) | 15s (read error envelope) | 1.75–4.75 min per error |

For a team making 20 agent-driven PRs per day, with an average of 3 test cycles per PR and 2 failures per cycle that need debugging, the daily time savings from legibility amount to:

```
20 PRs × 3 cycles × (25s boot check + 30s error debugging) = 55 minutes/day saved
20 PRs × 2 failures × 5 min debugging = 200 minutes/day saved
Total: ~255 minutes/day = ~4.25 hours/day
```

At $100/hour fully loaded engineer cost, that's $425/day or $8,500/month in recovered engineering time. The legibility investment pays for itself within the first month.

### Quality Improvements

Beyond time savings, legibility improves the quality of agent output:

- **Fewer false negatives**: The agent doesn't miss bugs because it can observe every aspect of the application
- **Fewer false positives**: The agent doesn't "fix" things that aren't broken because it can verify behavior precisely
- **Faster root cause analysis**: When failures occur, the agent can diagnose them in seconds instead of minutes
- **Higher confidence PRs**: The agent submits PRs with evidence that they work, not just "the tests passed"

### The Compound Effect

The most important ROI is the compound effect. Every legibility investment you make benefits not just the current agent, but every future agent and every human engineer who works with your application. A well-designed `/ready` endpoint written today will serve every agent interaction for the lifetime of the service. A structured error envelope saved a debugging session today will save hundreds more in the future.

This compound effect is why the most successful agent-first teams invest heavily in legibility early. They understand that the cost of building legibility is paid once, but the benefit accrues forever.
