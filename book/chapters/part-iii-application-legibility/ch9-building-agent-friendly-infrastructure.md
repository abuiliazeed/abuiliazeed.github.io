# Chapter 9: Building Agent-Friendly Infrastructure

> "The best infrastructure for agent-first development is infrastructure the agent never has to think about."

When the Affirm engineering team retrained 800 engineers for agentic software development in a single week, they made three critical decisions.¹ The first was a single default toolchain—every engineer would use the same agent, configured the same way. The second was local-first development—agents would run against local environments, not shared staging servers. The third, and most important for our purposes, was explicit human checkpoints at meaningful boundaries.

What enabled all three decisions was infrastructure designed from the ground up to be agent-friendly. Not agent-*capable*—any infrastructure can be operated by a sufficiently determined agent—but agent-*friendly*, meaning the infrastructure reduces the cognitive load on the agent, eliminates ambiguity, and makes the right thing the easy thing.

This chapter covers the concrete infrastructure patterns that make agent-first development productive at scale.

---

## Convention Over Configuration

The single most impactful infrastructure decision you can make for agent-first development is adopting strict conventions. When an agent knows that *all* services expose health checks at `/healthz`, *all* APIs return errors in a standard format, and *all* configuration is loaded from environment variables, it doesn't need to discover these properties for each service. It can rely on the convention and operate with less context.

### Directory Structure Conventions

A conventional directory structure is the skeleton of your application. It tells the agent where to find things without requiring documentation:

```
service-template/
├── src/
│   ├── api/                    # HTTP handlers and routes
│   │   ├── routes/
│   │   │   ├── __tests__/
│   │   │   │   └── orders.test.ts
│   │   │   └── orders.ts
│   │   └── middleware/
│   ├── domain/                 # Business logic (no external dependencies)
│   │   ├── __tests__/
│   │   └── orders.ts
│   ├── infrastructure/         # External service integrations
│   │   ├── database/
│   │   ├── cache/
│   │   └── messaging/
│   └── config/                 # Configuration and environment
├── tests/
│   ├── fixtures/               # Deterministic test data
│   ├── e2e/                    # End-to-end tests
│   └── integration/            # Integration tests
├── scripts/
│   ├── setup.sh                # One-command local setup
│   ├── seed.sh                 # Seed database with test data
│   └── health-check.sh         # Verify service is running
├── migrations/                 # Database migrations (numbered)
├── AGENTS.md                   # Agent instructions
├── docker-compose.yml          # Local development environment
├── Dockerfile
└── README.md
```

This structure is opinionated, and that's the point. An agent landing in this repository knows immediately:
- API routes live in `src/api/routes/`
- Tests live next to the code they test in `__tests__/`
- Integration tests are in `tests/integration/`
- Test fixtures are in `tests/fixtures/`
- Database migrations are in `migrations/`

No ambiguity. No discovery. No wasted tokens.

### Naming Conventions

Names are API boundaries for agents. When you name things consistently, the agent can predict the name of something it's never seen:

```python
# Convention: Resource CRUD follows a naming pattern
# GET    /api/v1/{resource}          → list_{resource}
# GET    /api/v1/{resource}/{id}     → get_{resource}
# POST   /api/v1/{resource}          → create_{resource}
# PUT    /api/v1/{resource}/{id}     → update_{resource}
# DELETE /api/v1/{resource}/{id}     → delete_{resource}

# This means if the agent knows "orders" exist, it can predict:
# - The list endpoint is GET /api/v1/orders
# - The handler is in src/api/routes/orders.ts
# - The domain logic is in src/domain/orders.ts
# - The tests are in src/api/routes/__tests__/orders.test.ts
# - The fixtures are in tests/fixtures/orders.json
```

Enforce naming conventions with linters:

```javascript
// eslint-rules/enforce-route-naming.js
/**
 * Enforces REST API naming convention:
 * Route files must export handlers named after HTTP methods.
 * Route paths must follow /api/v1/{resource} pattern.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce REST API route naming conventions",
      category: "Architecture",
    },
    messages: {
      invalidRoutePath: "Route path '{{path}}' must follow /api/v1/{resource} pattern",
      missingHandler: "Route handler for {{method}} {{path}} must be named '{{expectedName}}'",
      invalidMethod: "HTTP method '{{method}}' is not allowed. Use GET, POST, PUT, PATCH, or DELETE.",
    },
  },
  
  create(context) {
    return {
      CallExpression(node) {
        // Detect express.Router() or fastify route definitions
        if (!isRouteDefinition(node)) return;
        
        const method = node.callee.property?.name?.toUpperCase();
        const path = node.arguments[0]?.value;
        
        if (!method || !path) return;
        
        // Validate method
        const validMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
        if (!validMethods.includes(method)) {
          context.report({
            node,
            messageId: "invalidMethod",
            data: { method },
          });
        }
        
        // Validate path pattern
        const validPath = /^\/api\/v\d+\/[a-z-]+(\/:[a-z-]+)?$/;
        if (!validPath.test(path)) {
          context.report({
            node,
            messageId: "invalidRoutePath",
            data: { path },
          });
        }
        
        // Validate handler name
        const resource = path.split("/")[3]?.replace(/[:-]/g, "_");
        const expectedNames = {
          GET: path.includes("/:") ? `get_${resource}` : `list_${resource}s`,
          POST: `create_${resource}`,
          PUT: `update_${resource}`,
          PATCH: `update_${resource}`,
          DELETE: `delete_${resource}`,
        };
        
        const handler = node.arguments[1];
        if (handler && expectedNames[method]) {
          const handlerName = handler.name || handler.callee?.name;
          if (handlerName && handlerName !== expectedNames[method]) {
            context.report({
              node: handler,
              messageId: "missingHandler",
              data: {
                method,
                path,
                expectedName: expectedNames[method],
              },
            });
          }
        }
      },
    };
  },
};
```

---

## Self-Documenting APIs

An API that requires external documentation for an agent to use it is a friction point. Self-documenting APIs carry their own specification within their implementation, making them immediately usable by any agent that can read OpenAPI, gRPC protobuf definitions, or GraphQL schemas.

### OpenAPI/Swagger Integration

```python
# api_spec.py — Self-documenting API with FastAPI
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

app = FastAPI(
    title="Order Service",
    version="1.0.0",
    description="""
    Order management service.
    
    ## Conventions
    - All endpoints require `X-Correlation-ID` header
    - Errors follow RFC 7807 (Problem Details)
    - Pagination uses cursor-based navigation
    - Dates are ISO 8601
    """,
)

class OrderStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"

class OrderItem(BaseModel):
    product_id: str = Field(..., description="Unique product identifier")
    quantity: int = Field(..., gt=0, description="Number of units")
    unit_price: float = Field(..., gt=0, description="Price per unit in USD")

class Order(BaseModel):
    id: str = Field(..., description="Unique order identifier (UUID)")
    customer_id: str = Field(..., description="Customer reference")
    items: List[OrderItem]
    status: OrderStatus = Field(default=OrderStatus.pending)
    total: float = Field(..., description="Total order value in USD")
    created_at: str = Field(..., description="ISO 8601 timestamp")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "ord_abc123",
                "customer_id": "cust_xyz789",
                "items": [
                    {"product_id": "prod_001", "quantity": 2, "unit_price": 29.99}
                ],
                "status": "pending",
                "total": 59.98,
                "created_at": "2025-06-15T10:30:00Z",
            }
        }

class ErrorResponse(BaseModel):
    """RFC 7807 Problem Details response."""
    type: str = Field(..., description="Error type URI")
    title: str = Field(..., description="Human-readable error title")
    status: int = Field(..., description="HTTP status code")
    detail: str = Field(..., description="Specific error details")
    instance: Optional[str] = Field(None, description="Request path that caused the error")
    remediation: Optional[str] = Field(None, description="Suggested fix for the agent")

@app.get(
    "/api/v1/orders",
    response_model=List[Order],
    summary="List orders",
    description="Retrieve a paginated list of orders, optionally filtered by status or customer.",
    responses={
        200: {"description": "List of orders"},
        400: {"model": ErrorResponse, "description": "Invalid query parameters"},
    },
)
async def list_orders(
    status: Optional[OrderStatus] = Query(None, description="Filter by order status"),
    customer_id: Optional[str] = Query(None, description="Filter by customer ID"),
    cursor: Optional[str] = Query(None, description="Pagination cursor from previous response"),
    limit: int = Query(50, ge=1, le=100, description="Maximum results to return"),
):
    """
    List orders with optional filtering and pagination.
    
    **For agents**: Use cursor-based pagination. Each response includes a 
    `next_cursor` field. Pass its value as the `cursor` parameter to get 
    the next page. When `next_cursor` is null, you've reached the end.
    """
    ...

@app.get(
    "/api/v1/orders/{order_id}",
    response_model=Order,
    responses={
        200: {"description": "Order details"},
        404: {"model": ErrorResponse, "description": "Order not found"},
    },
)
async def get_order(order_id: str):
    """Retrieve a single order by ID."""
    ...
```

Every endpoint carries:
- A human-readable summary
- A detailed description
- Typed request parameters with descriptions
- Response schemas with examples
- Error responses with `remediation` fields

An agent can read the OpenAPI spec at `/openapi.json` and immediately understand every endpoint, its parameters, and its responses. No separate documentation needed.

### Error Response Convention

Standardize error responses so agents always know where to find key information:

```python
# errors.py — Standardized error responses
from fastapi import Request
from fastapi.responses import JSONResponse
import uuid

class AppError(Exception):
    """Base application error with machine-readable context."""
    
    def __init__(
        self,
        error_code: str,
        message: str,
        status_code: int = 500,
        remediation: str = None,
        details: dict = None,
    ):
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        self.remediation = remediation
        self.details = details or {}
        super().__init__(message)

@app.exception_handler(AppError)
async def app_error_handler(request: Request, error: AppError):
    """Return RFC 7807 Problem Details with remediation."""
    return JSONResponse(
        status_code=error.status_code,
        content={
            "type": f"https://api.example.com/errors/{error.error_code}",
            "title": error.error_code,
            "status": error.status_code,
            "detail": error.message,
            "instance": str(request.url),
            "correlation_id": request.headers.get(
                "X-Correlation-ID", str(uuid.uuid4())
            ),
            "remediation": error.remediation,
            "details": error.details,
        },
    )

# Usage in application code
class OrderNotFoundError(AppError):
    def __init__(self, order_id: str):
        super().__init__(
            error_code="ORDER_NOT_FOUND",
            message=f"Order {order_id} does not exist",
            status_code=404,
            remediation=(
                "Verify the order ID is correct. "
                "Use GET /api/v1/orders to list existing orders. "
                "Check if the order was recently deleted."
            ),
            details={"order_id": order_id},
        )

class PaymentDeclinedError(AppError):
    def __init__(self, order_id: str, reason: str):
        super().__init__(
            error_code="PAYMENT_DECLINED",
            message=f"Payment for order {order_id} was declined: {reason}",
            status_code=402,
            remediation=(
                "Check the customer's payment method status. "
                "Verify the card has not expired and the billing address matches. "
                "Consider retrying with a different payment method."
            ),
            details={"order_id": order_id, "decline_reason": reason},
        )
```

The `remediation` field is worth its weight in gold for agents. Instead of just knowing that something went wrong, the agent knows what to try next. This is the difference between "Payment declined" (useless) and "Payment declined. Check the card expiration date. Consider retrying with a different payment method" (actionable).

---

## Deterministic Test Fixtures and Seed Data

Tests are only as reliable as their inputs. In agent-first development, where the agent may run hundreds of test cycles per day, flaky tests caused by non-deterministic data are unacceptable.

### Fixture Design Principles

1. **Explicit over implicit**: Every piece of test data is declared, not inherited from shared state
2. **Isolated over shared**: Each test gets its own data, independent of other tests
3. **Deterministic over random**: Same fixture always produces the same result
4. **Minimal over realistic**: Include only the data needed for the test scenario

```python
# fixtures/orders.py — Deterministic test fixtures
"""
Test fixtures for the order service.

Each fixture creates a complete, valid entity with sensible defaults.
Override specific fields for custom scenarios.
"""
from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class OrderFixture:
    """A complete, valid order for testing."""
    id: str = "ord_test_001"
    customer_id: str = "cust_test_001"
    items: List[dict] = field(default_factory=lambda: [
        {"product_id": "prod_001", "quantity": 1, "unit_price": 10.00},
    ])
    status: str = "pending"
    total: float = 10.00
    
    def with_items(self, count: int) -> "OrderFixture":
        """Add N items to the order."""
        self.items = [
            {"product_id": f"prod_{i:03d}", "quantity": 1, "unit_price": 10.00}
            for i in range(count)
        ]
        self.total = count * 10.00
        return self
    
    def with_status(self, status: str) -> "OrderFixture":
        """Set the order status."""
        self.status = status
        return self
    
    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "items": self.items,
            "status": self.status,
            "total": self.total,
        }

# Pre-built scenarios
def pending_order() -> OrderFixture:
    return OrderFixture()

def shipped_order() -> OrderFixture:
    return OrderFixture(status="shipped")

def large_order() -> OrderFixture:
    return OrderFixture().with_items(100)

def multi_customer_orders() -> List[OrderFixture]:
    return [
        OrderFixture(id="ord_test_001", customer_id="cust_test_001"),
        OrderFixture(id="ord_test_002", customer_id="cust_test_001"),
        OrderFixture(id="ord_test_003", customer_id="cust_test_002"),
    ]
```

### Database Seeding

Every environment should be seedable with a single command:

```bash
#!/bin/bash
# scripts/seed.sh — Deterministic database seeding
set -euo pipefail

SEED_VERSION="2025.01.001"
SEED_HASH=$(md5sum tests/fixtures/seed_data.json | cut -d' ' -f1)

echo "Seeding database with fixtures v${SEED_VERSION} (hash: ${SEED_HASH})"

# Verify seed data integrity
if [ "$SEED_HASH" != "$(cat .seed-hash 2>/dev/null)" ]; then
    echo "Seed data changed, applying fresh fixtures..."
    
    # Truncate all tables (in dependency order)
    psql "$DATABASE_URL" -c "TRUNCATE order_items, orders, customers, products CASCADE;"
    
    # Apply fixtures
    psql "$DATABASE_URL" -c "\copy customers FROM 'tests/fixtures/customers.csv' CSV HEADER"
    psql "$DATABASE_URL" -c "\copy products FROM 'tests/fixtures/products.csv' CSV HEADER"
    psql "$DATABASE_URL" -c "\copy orders FROM 'tests/fixtures/orders.csv' CSV HEADER"
    psql "$DATABASE_URL" -c "\copy order_items FROM 'tests/fixtures/order_items.csv' CSV HEADER"
    
    # Record seed hash
    echo "$SEED_HASH" > .seed-hash
    echo "Seed applied successfully."
else
    echo "Seed data unchanged, skipping."
fi
```

This script is idempotent—running it twice produces the same result. It verifies data integrity with a hash. And it's fast enough to run before every test suite.

### Snapshot Testing for APIs

Snapshot testing captures the full response from an API and compares it on subsequent runs:

```typescript
// tests/api/order-api.snapshots.test.ts
import { snapshotTest } from "../helpers/snapshot";
import { seedDatabase } from "../helpers/seed";

describe("Order API snapshots", () => {
  beforeAll(async () => {
    await seedDatabase("baseline");
  });
  
  snapshotTest("GET /api/v1/orders returns expected structure", {
    url: "/api/v1/orders",
    method: "GET",
    expectedStatus: 200,
    // Fields that may change between runs (ignore in comparison)
    ignoreFields: ["created_at", "updated_at", "id"],
  });
  
  snapshotTest("GET /api/v1/orders/ord_test_001 returns expected order", {
    url: "/api/v1/orders/ord_test_001",
    method: "GET",
    expectedStatus: 200,
    ignoreFields: ["created_at", "updated_at"],
  });
  
  snapshotTest("POST /api/v1/orders with invalid data returns validation errors", {
    url: "/api/v1/orders",
    method: "POST",
    body: { items: [] }, // Invalid: empty items
    expectedStatus: 400,
    snapshot: "order-validation-error",
  });
});
```

Snapshot tests are especially valuable for agents because they catch unintended changes without requiring the agent to understand every field. When a snapshot diff appears, the agent can compare the expected and actual responses to determine whether the change was intentional.

---

## Reproducible Environments

"Works on my machine" is unacceptable in any context. In agent-first development, it's catastrophic. An agent that can't reproduce a failure locally can't fix it.

### Docker Compose for Local Development

```yaml
# docker-compose.yml — Complete local development environment
version: "3.9"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/app_test
      - REDIS_URL=redis://cache:6379
      - RABBITMQ_URL=amqp://guest:guest@queue:5672
      - APP_ENV=development
      - LOG_LEVEL=debug
      - CORS_ORIGIN=http://localhost:3000
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_healthy
      queue:
        condition: service_healthy
    volumes:
      - .:/app  # Live code reload
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: app_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d app_test"]
      interval: 3s
      timeout: 2s
      retries: 5

  cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 3s
      timeout: 2s
      retries: 5

  queue:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "check_running"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Agent tools
  db-admin:
    image: adminer
    ports:
      - "8081:8080"
    depends_on:
      - db

volumes:
  pgdata:
```

With this single file, an agent can bring up a complete development environment:

```bash
docker compose up -d --wait
# All services healthy. Application ready at http://localhost:8080
```

The `--wait` flag ensures the agent doesn't proceed until all health checks pass. Every dependency is pinned to a specific version. Every port is documented. Every health check is explicit.

### The One-Command Setup

The ultimate test of infrastructure friendliness: can a brand new agent, with no prior knowledge of your system, get it running with a single command?

```bash
#!/bin/bash
# scripts/setup.sh — One-command local setup
set -euo pipefail

echo "🚀 Setting up development environment..."

# 1. Check prerequisites
for cmd in docker node psql; do
    if ! command -v $cmd &> /dev/null; then
        echo "❌ Missing prerequisite: $cmd"
        echo "   Install with: brew install $cmd"
        exit 1
    fi
done
echo "✅ Prerequisites met"

# 2. Start infrastructure
docker compose up -d --wait
echo "✅ Infrastructure running"

# 3. Run migrations
docker compose exec app python manage.py migrate
echo "✅ Database migrated"

# 4. Seed test data
bash scripts/seed.sh
echo "✅ Test data seeded"

# 5. Verify everything works
HEALTH=$(curl -s http://localhost:8080/ready | jq -r '.status')
if [ "$HEALTH" == "healthy" ]; then
    echo "✅ Application healthy"
    echo ""
    echo "🎉 Setup complete! Application running at http://localhost:8080"
    echo "   API docs:    http://localhost:8080/docs"
    echo "   Database:    http://localhost:8081"
    echo "   RabbitMQ:    http://localhost:15672 (guest/guest)"
    echo ""
    echo "   Run tests:   docker compose exec app pytest"
    echo "   View logs:   docker compose logs -f app"
else
    echo "❌ Application not healthy. Check logs: docker compose logs app"
    exit 1
fi
```

This script is the agent's entry point. It should:
- Complete in under 60 seconds
- Produce clear output at each step
- Exit with a non-zero code on any failure
- Print the URLs of all running services

---

## Error Context with Remediation Guidance

We've touched on this pattern throughout the chapter. Let's formalize it.

### The Remediation Pattern

Every error your application produces should include enough context for an agent to take corrective action:

```python
# remediation.py — Error messages that teach

class RemediatingError:
    """
    Errors that include remediation guidance.
    
    Structure:
    - what happened (message)
    - why it happened (cause)
    - what to do about it (remediation)
    - where to learn more (reference)
    """
    
    ERROR_REGISTRY = {
        "DB_CONNECTION_FAILED": {
            "message": "Cannot connect to database",
            "remediation": (
                "1. Check if the database container is running: docker compose ps db\n"
                "2. Verify DATABASE_URL in .env matches docker-compose.yml\n"
                "3. Check if migrations need to run: python manage.py migrate\n"
                "4. Check database logs: docker compose logs db"
            ),
            "reference": "docs/troubleshooting.md#database-connection",
        },
        "MIGRATION_CONFLICT": {
            "message": "Database migration conflict detected",
            "remediation": (
                "1. Check for pending migrations: python manage.py showmigrations\n"
                "2. If migrations conflict, rebase your branch on main and regenerate\n"
                "3. NEVER force-apply migrations on shared databases\n"
                "4. Ask in #platform-help if unsure"
            ),
            "reference": "docs/troubleshooting.md#migration-conflicts",
        },
        "RATE_LIMIT_EXCEEDED": {
            "message": "API rate limit exceeded",
            "remediation": (
                "1. Check current rate: curl localhost:8080/debug/rate-limit\n"
                "2. Implement exponential backoff: wait 2^n seconds between retries\n"
                "3. Consider batching requests\n"
                "4. For tests, use mock API (see tests/helpers/mock_api.py)"
            ),
            "reference": "docs/api-rate-limits.md",
        },
    }
    
    @classmethod
    def create(cls, error_code: str, context: dict = None) -> dict:
        template = cls.ERROR_REGISTRY.get(error_code, {
            "message": f"Unknown error: {error_code}",
            "remediation": "Report this error to the platform team.",
            "reference": None,
        })
        
        error = {
            "error_code": error_code,
            "message": template["message"],
            "remediation": template["remediation"],
        }
        
        if template.get("reference"):
            error["reference"] = template["reference"]
        
        if context:
            error["context"] = context
        
        return error
```

This pattern—error codes with pre-written remediation guidance—is one of the highest-leverage investments you can make in agent-friendly infrastructure. Every time a human debugs an error, they should write down the steps they took and add them to the registry. Over time, the registry becomes a self-service troubleshooting guide that agents can follow mechanically.

---

## Structured Logging Patterns

Let's go deeper into structured logging patterns that maximize agent readability:

### The Breadcrumb Pattern

When debugging a complex flow, agents need to trace the execution path. The breadcrumb pattern logs entry and exit points at every significant boundary:

```python
# breadcrumbs.py
import functools
import time
import logging

logger = logging.getLogger("breadcrumbs")


def safe_repr(obj, max_length: int = 200) -> str:
    """Truncate repr() output to keep log lines concise and readable."""
    try:
        text = repr(obj)
    except Exception:
        text = f"<unrepresentable {type(obj).__name__}>"
    if len(text) > max_length:
        text = text[: max_length - 3] + "..."
    return text

def breadcrumb(operation_name: str):
    """Decorator that logs entry/exit of operations with timing."""
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            corr_id = correlation_id.get("unknown")
            start = time.time()
            
            # Log entry
            logger.info(
                f"{operation_name}_started",
                extra={"extra_fields": {
                    "operation": operation_name,
                    "correlation_id": corr_id,
                    "args": safe_repr(args),
                    "kwargs": safe_repr(kwargs),
                }}
            )
            
            try:
                result = await func(*args, **kwargs)
                duration_ms = (time.time() - start) * 1000
                
                # Log success
                logger.info(
                    f"{operation_name}_completed",
                    extra={"extra_fields": {
                        "operation": operation_name,
                        "correlation_id": corr_id,
                        "duration_ms": round(duration_ms, 2),
                        "result_summary": safe_repr(result, max_length=200),
                    }}
                )
                return result
                
            except Exception as e:
                duration_ms = (time.time() - start) * 1000
                
                # Log failure with context
                logger.error(
                    f"{operation_name}_failed",
                    extra={"extra_fields": {
                        "operation": operation_name,
                        "correlation_id": corr_id,
                        "duration_ms": round(duration_ms, 2),
                        "error_type": type(e).__name__,
                        "error_message": str(e),
                    }},
                    exc_info=True,
                )
                raise
        
        return wrapper
    return decorator

# Usage
@breadcrumb("process_payment")
async def process_payment(order_id: str, amount: float):
    payment = await stripe_charge(order_id, amount)
    await update_order_status(order_id, "paid")
    return payment
```

With breadcrumbs, an agent can reconstruct the complete execution path of any request by searching for the correlation ID.

### The Context Enrichment Pattern

Structured logs are most useful when they carry rich context. Rather than passing context through every function call, use a context enrichment layer:

```python
# context_enrichment.py
from contextvars import ContextVar
from typing import Dict, Any

# Per-request context
request_context: ContextVar[Dict[str, Any]] = ContextVar(
    "request_context", default={}
)

def enrich_log(record: logging.LogRecord) -> dict:
    """Add request context to every log record."""
    ctx = request_context.get({})
    return {
        "correlation_id": ctx.get("correlation_id"),
        "user_id": ctx.get("user_id"),
        "session_id": ctx.get("session_id"),
        "request_path": ctx.get("request_path"),
        "deployment_version": os.environ.get("APP_VERSION", "unknown"),
    }
```

---

## Health Check and Readiness Patterns

Let's formalize the health check patterns introduced in Chapter 8 into reusable infrastructure:

### The Cascading Health Check

In a microservices architecture, health checks cascade: if the database is down, every service that depends on it is degraded. A well-designed health check system propagates this information:

```python
# health_checks.py
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class HealthStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"    # Functioning but with issues
    UNHEALTHY = "unhealthy"  # Cannot serve requests

@dataclass
class CheckResult:
    name: str
    status: HealthStatus
    latency_ms: float
    message: Optional[str] = None
    remediation: Optional[str] = None

class HealthChecker:
    def __init__(self):
        self.checks: List[callable] = []
    
    def register(self, name: str, check_fn: callable, critical: bool = True):
        """Register a health check.
        
        critical=True: failure makes the service unhealthy
        critical=False: failure makes the service degraded
        """
        self.checks.append({
            "name": name,
            "fn": check_fn,
            "critical": critical,
        })
    
    async def run_all(self) -> dict:
        results = []
        overall_status = HealthStatus.HEALTHY
        
        for check in self.checks:
            try:
                start = time.time()
                result = await check["fn"]()
                latency = (time.time() - start) * 1000
                
                results.append(CheckResult(
                    name=check["name"],
                    status=HealthStatus.HEALTHY,
                    latency_ms=latency,
                ))
            except Exception as e:
                latency = (time.time() - start) * 1000
                
                results.append(CheckResult(
                    name=check["name"],
                    status=HealthStatus.UNHEALTHY,
                    latency_ms=latency,
                    message=str(e),
                    remediation=getattr(e, "remediation", None),
                ))
                
                if check["critical"]:
                    overall_status = HealthStatus.UNHEALTHY
                elif overall_status == HealthStatus.HEALTHY:
                    overall_status = HealthStatus.DEGRADED
        
        return {
            "status": overall_status.value,
            "checks": [
                {
                    "name": r.name,
                    "status": r.status.value,
                    "latency_ms": round(r.latency_ms, 2),
                    "message": r.message,
                    "remediation": r.remediation,
                }
                for r in results
            ],
            "summary": {
                "total": len(results),
                "healthy": sum(1 for r in results if r.status == HealthStatus.HEALTHY),
                "degraded": sum(1 for r in results if r.status == HealthStatus.DEGRADED),
                "unhealthy": sum(1 for r in results if r.status == HealthStatus.UNHEALTHY),
            },
        }

# Registration
health = HealthChecker()

health.register(
    "database",
    lambda: db.execute("SELECT 1"),
    critical=True,
)
health.register(
    "redis",
    lambda: redis.ping(),
    critical=False,  # Can serve without cache, just slower
)
health.register(
    "payment_gateway",
    lambda: stripe.balance.retrieve(),
    critical=False,  # Can take orders, just can't charge yet
)
```

This pattern gives agents three tiers of information:
- **Healthy**: Everything is working
- **Degraded**: Working but some non-critical subsystems are down
- **Unhealthy**: Cannot serve requests, needs intervention

An agent seeing "degraded" can continue working but should flag the issue. An agent seeing "unhealthy" should stop and investigate.

---

## Designing for Headless Browser Automation

If your application has a web UI, agents will interact with it through headless browsers (Playwright, Puppeteer, Selenium). Design your UI to make this reliable:

### The Automation Layer

Add a thin automation layer to your application that provides machine-optimized access without changing the UI:

```html
<!-- In your HTML templates, add automation hooks -->
<body>
  <!-- Navigation -->
  <nav data-testid="main-nav" aria-label="Main navigation">
    <a data-testid="nav-orders" href="/orders">Orders</a>
    <a data-testid="nav-products" href="/products">Products</a>
  </nav>
  
  <!-- Loading state -->
  <div 
    data-testid="orders-loading" 
    data-state="loading"
    aria-busy="true"
    aria-live="polite"
  >
    Loading orders...
  </div>
  
  <!-- Content -->
  <table data-testid="orders-table" data-state="loaded">
    <thead>
      <tr>
        <th data-column="id">Order ID</th>
        <th data-column="customer">Customer</th>
        <th data-column="status">Status</th>
        <th data-column="total">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr data-testid="order-row" data-order-id="ord_001">
        <td data-testid="order-id">ord_001</td>
        <td data-testid="order-customer">Alice</td>
        <td data-testid="order-status">
          <span data-status="pending" class="badge">Pending</span>
        </td>
        <td data-testid="order-total">$10.00</td>
      </tr>
    </tbody>
  </table>
  
  <!-- Error state -->
  <div 
    data-testid="orders-error" 
    data-state="error"
    role="alert"
    aria-live="assertive"
    style="display: none"
  >
    <p data-testid="error-message">Failed to load orders</p>
    <button data-testid="retry-button">Retry</button>
  </div>
  
  <!-- Pagination -->
  <nav data-testid="pagination" aria-label="Pagination">
    <button data-testid="prev-page" disabled>Previous</button>
    <span data-testid="page-info">Page 1 of 5</span>
    <button data-testid="next-page">Next</button>
  </nav>
</body>
```

Every dynamic element has:
- A `data-testid` for stable selection
- A `data-state` for state transitions (loading/loaded/error)
- ARIA attributes for accessibility and agent legibility
- Semantic structure that reflects the domain model

### Agent Helpers for Common Interactions

```typescript
// tests/helpers/ui-helpers.ts
// Reusable helpers that abstract common UI interactions

export class PageObject {
  constructor(private page: Page) {}
  
  async waitForReady(): Promise<void> {
    // Wait for the main content area to be loaded
    await this.page.waitForSelector('[data-state="loaded"]', {
      timeout: 10_000,
    });
  }
  
  async getOrders(): Promise<OrderRow[]> {
    const rows = await this.page.locator('[data-testid="order-row"]').all();
    return Promise.all(rows.map(async (row) => ({
      id: await row.locator('[data-testid="order-id"]').textContent(),
      customer: await row.locator('[data-testid="order-customer"]').textContent(),
      status: await row.locator('[data-testid="order-status"] [data-status]').getAttribute('data-status'),
      total: await row.locator('[data-testid="order-total"]').textContent(),
    })));
  }
  
  async clickNextPage(): Promise<void> {
    const nextButton = this.page.locator('[data-testid="next-page"]');
    if (await nextButton.isDisabled()) {
      throw new Error("Already on last page");
    }
    await nextButton.click();
    await this.waitForReady();
  }
  
  async getError(): Promise<string | null> {
    const errorEl = this.page.locator('[data-testid="orders-error"][data-state="error"]');
    if (!(await errorEl.isVisible())) return null;
    return errorEl.locator('[data-testid="error-message"]').textContent();
  }
}
```

---

## The Infrastructure as Code Pattern

All of the patterns in this chapter should be encoded in infrastructure as code, not documented in wikis. If a convention isn't enforced by code, it doesn't exist.

### Template Repository

Create a template repository that serves as the starting point for every new service:

```
service-template/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # Standard CI pipeline
│   │   └── deploy.yml          # Standard deployment
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
├── src/                         # Standard directory structure
├── tests/
│   ├── fixtures/                # Seed data
│   ├── e2e/                     # E2E tests
│   └── integration/
├── scripts/
│   ├── setup.sh                 # One-command setup
│   ├── seed.sh                  # Database seeding
│   └── health-check.sh
├── .eslintrc.js                 # With custom architecture rules
├── .semgrep.yml                 # Security and architecture patterns
├── AGENTS.md                    # Agent instructions
├── docker-compose.yml           # Local development environment
├── Dockerfile
├── Makefile                     # Common commands
└── README.md                    # Generated from template
```

The template repository ensures that every new service starts with:
- The correct directory structure
- The correct health check endpoints
- The correct logging configuration
- The correct error handling patterns
- The correct test fixtures
- The correct agent instructions

An agent creating a new service doesn't need to remember these conventions. It just copies the template and modifies the domain-specific parts.

---

## The Cost of Not Being Agent-Friendly

Let me illustrate the cost of neglecting agent-friendly infrastructure with a concrete scenario:

**Scenario**: An agent needs to add a new field to the order response.

**With agent-friendly infrastructure** (this chapter's patterns):
1. Agent reads AGENTS.md, learns the conventions
2. Agent opens `src/domain/orders.ts`, adds the field to the model
3. Agent opens `src/api/routes/orders.ts`, the linter reminds it to update the OpenAPI spec
4. Agent updates the test fixture in `tests/fixtures/orders.json`
5. Agent runs `scripts/setup.sh` to ensure local environment is ready
6. Agent runs `pytest` — all tests pass
7. Agent submits PR

**Without agent-friendly infrastructure**:
1. Agent reads a partially outdated README
2. Agent adds the field but puts it in the wrong layer
3. No linter catches the architecture violation
4. Tests use shared, non-deterministic data and fail unpredictably
5. Agent spends 10 minutes debugging a flaky test
6. Agent can't start the local environment (missing dependency, unclear docs)
7. Agent guesses at the fix, introduces a subtle bug
8. Human reviewer catches the bug in PR review, iteration continues

The agent-friendly path takes minutes. The unfriendly path takes hours—or fails entirely. The difference isn't the agent's capability. It's the infrastructure's legibility.

## Infrastructure Patterns for Specific Scenarios

### Pattern: The Feature Flag Infrastructure

Feature flags are critical for agent-first development because they decouple deployment from release. An agent can merge code that's behind a feature flag without fear—it won't affect production until the flag is explicitly enabled.

```python
# feature_flags.py — Agent-friendly feature flag system
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Callable


class FlagState(Enum):
    ON = "on"
    OFF = "off"
    PERCENTAGE = "percentage"
    VARIANT = "variant"


@dataclass
class FeatureFlag:
    name: str
    description: str
    default_state: FlagState
    owner_team: str
    created_date: str
    expiry_date: Optional[str] = None
    metrics_impact: Optional[str] = None
    
    def is_enabled(self, context: dict = None) -> bool:
        """Evaluate the flag for the given context."""
        if self.default_state == FlagState.ON:
            return True
        if self.default_state == FlagState.OFF:
            return False
        if self.default_state == FlagState.PERCENTAGE:
            return self._percentage_rollout(context)
        return False
    
    def _percentage_rollout(self, context: dict) -> bool:
        user_id = context.get("user_id", "")
        rollout_pct = self._get_rollout_percentage()
        # Deterministic hash ensures same user always gets same result
        # Note: uses hashlib.sha256 instead of built-in hash(), which is
        # randomized per process (PYTHONHASHSEED) and non-deterministic
        import hashlib
        hash_val = int(hashlib.sha256(f"{self.name}:{user_id}".encode()).hexdigest(), 16) % 100
        return hash_val < rollout_pct


# Flag registry — queryable by agents
FLAGS = {
    "gift_wrapping": FeatureFlag(
        name="gift_wrapping",
        description="Enable gift wrapping option on checkout",
        default_state=FlagState.OFF,
        owner_team="commerce",
        created_date="2025-06-01",
        metrics_impact="order_value, checkout_conversion",
    ),
    "new_payment_flow": FeatureFlag(
        name="new_payment_flow",
        description="Use updated payment processing pipeline",
        default_state=FlagState.PERCENTAGE,
        owner_team="payments",
        created_date="2025-05-15",
        expiry_date="2025-08-01",
        metrics_impact="payment_success_rate, checkout_latency",
    ),
}


@app.get("/debug/feature-flags")
async def list_feature_flags():
    """Agent-queryable list of all feature flags."""
    return {
        "flags": {
            name: {
                "description": flag.description,
                "state": flag.default_state.value,
                "owner": flag.owner_team,
                "expiry": flag.expiry_date,
                "metrics_impact": flag.metrics_impact,
            }
            for name, flag in FLAGS.items()
        },
        "total": len(FLAGS),
        "expired": sum(
            1 for f in FLAGS.values()
            if f.expiry_date and f.expiry_date < datetime.now().isoformat()
        ),
    }
```

### Pattern: The Configuration Validation Layer

Configuration errors are among the most common deployment failures. An agent-friendly configuration system validates all settings at startup and provides clear remediation guidance:

```python
# config_validation.py
from pydantic import BaseSettings, Field, validator
from typing import Optional


class AppConfig(BaseSettings):
    """Application configuration with validation and defaults."""
    
    # Database
    database_url: str = Field(
        ...,
        description="PostgreSQL connection string",
        env="DATABASE_URL",
    )
    database_pool_size: int = Field(
        default=10,
        description="Connection pool size",
        env="DB_POOL_SIZE",
    )
    
    # Redis
    redis_url: str = Field(
        ...,
        description="Redis connection string",
        env="REDIS_URL",
    )
    
    # Application
    app_env: str = Field(
        default="development",
        description="Application environment",
        env="APP_ENV",
    )
    log_level: str = Field(
        default="info",
        description="Logging level",
        env="LOG_LEVEL",
    )
    
    # Feature flags
    enable_gift_wrapping: bool = Field(
        default=False,
        description="Enable gift wrapping feature",
        env="ENABLE_GIFT_WRAPPING",
    )
    
    @validator("database_url")
    def validate_database_url(cls, v):
        if not v.startswith("postgresql://"):
            raise ValueError(
                "DATABASE_URL must start with postgresql://. "
                "Example: postgresql://user:pass@host:5432/dbname"
            )
        return v
    
    @validator("app_env")
    def validate_app_env(cls, v):
        valid = ["development", "staging", "production", "test"]
        if v not in valid:
            raise ValueError(
                f"APP_ENV must be one of {valid}. Got: {v}"
            )
        return v
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def load_and_validate_config() -> AppConfig:
    """Load configuration with clear error messages."""
    try:
        return AppConfig()
    except Exception as e:
        # Provide agent-friendly error with remediation
        print(f"Configuration error: {e}")
        print()
        print("Remediation:")
        print("1. Check that all required environment variables are set")
        print("2. Verify .env file exists and is not empty")
        print("3. See .env.example for required variables")
        print("4. Run: cp .env.example .env && edit .env")
        raise SystemExit(1)
```

### Pattern: The Test Environment Factory

For agents that need to run tests in isolation, provide a factory that creates complete, self-contained test environments:

```python
# test_environment.py
import tempfile
import subprocess
from contextlib import contextmanager


@contextmanager
def create_test_environment():
    """
    Create a complete, isolated test environment.
    
    Yields a TestEnv object with:
    - A temporary database
    - A running application instance
    - Seeded test data
    - Cleanup on exit
    """
    env = TestEnvironment()
    try:
        env.setup()
        yield env
    finally:
        env.teardown()


class TestEnvironment:
    def __init__(self):
        self.db_url = None
        self.app_url = None
        self.process = None
    
    def setup(self):
        # 1. Create temporary database
        self.db_url = self._create_temp_database()
        
        # 2. Run migrations
        self._run_migrations()
        
        # 3. Seed test data
        self._seed_data()
        
        # 4. Start application
        self.app_url = self._start_app()
        
        # 5. Wait for readiness
        self._wait_for_ready()
    
    def teardown(self):
        if self.process:
            self.process.terminate()
            self.process.wait(timeout=5)
        if self.db_url:
            self._drop_temp_database()
    
    def _create_temp_database(self) -> str:
        db_name = f"test_{os.getpid()}_{int(time.time())}"
        # ... create database ...
        return f"postgresql://localhost/{db_name}"
    
    def _run_migrations(self):
        result = subprocess.run(
            ["python", "manage.py", "migrate", "--database", self.db_url],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"Migration failed: {result.stderr}\n"
                "Remediation: Check for pending migrations in migrations/ directory"
            )
    
    def _wait_for_ready(self, timeout=30):
        start = time.time()
        while time.time() - start < timeout:
            try:
                resp = requests.get(f"{self.app_url}/ready", timeout=2)
                if resp.json()["status"] == "healthy":
                    return
            except requests.ConnectionError:
                time.sleep(1)
        raise RuntimeError(
            f"Application did not become ready within {timeout}s. "
            "Check application logs for startup errors."
        )
```

This factory pattern ensures every test runs in a pristine environment with no shared state. Agents can run tests in parallel without interference because each test gets its own database, application instance, and port.

### Pattern: The Migration Framework

Database migrations are a common source of agent errors. A well-designed migration framework prevents the most common mistakes:

```python
# migrations/framework.py
"""
Migration conventions for agent-first development:
1. Every migration is numbered sequentially
2. Every migration has an up() and down()
3. Migrations are idempotent (safe to run twice)
4. Data migrations include rollback logic
5. Schema changes are validated before applying
"""

import os
from datetime import datetime


def create_migration(name: str) -> str:
    """Generate a new migration file with the correct template."""
    # Get next sequence number
    existing = [f for f in os.listdir("migrations") if f.endswith(".py")]
    next_num = max(
        int(f.split("_")[0]) for f in existing if f[0].isdigit()
    ) + 1 if existing else 1
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"{next_num:04d}_{timestamp}_{name}.py"
    filepath = os.path.join("migrations", filename)
    
    template = f'''"""
Migration: {name}
Created: {datetime.now().isoformat()}
"""

def up(connection):
    """Apply the migration."""
    # TODO: Add schema changes here
    # Example:
    # connection.execute("""
    #     ALTER TABLE orders 
    #     ADD COLUMN gift_wrap BOOLEAN DEFAULT FALSE
    # """)
    pass


def down(connection):
    """Rollback the migration."""
    # TODO: Add rollback logic here
    # Example:
    # connection.execute("ALTER TABLE orders DROP COLUMN gift_wrap")
    pass


def validate_up(connection):
    """Pre-flight validation before applying."""
    # Check that the table exists and the column doesn't
    # result = connection.execute(
    #     "SELECT column_name FROM information_schema.columns "
    #     "WHERE table_name='orders' AND column_name='gift_wrap'"
    # )
    # if result.fetchone():
    #     raise ValueError("Column gift_wrap already exists in orders table")
    pass
'''
    
    with open(filepath, 'w') as f:
        f.write(template)
    
    print(f"Created migration: {filepath}")
    print("Next steps:")
    print(f"  1. Edit the up() function to add schema changes")
    print(f"  2. Edit the down() function to add rollback logic")
    print(f"  3. Run: python manage.py migrate")
    print(f"  4. Run: python manage.py migrate --rollback {filename}")
    
    return filepath
```

The template includes comments that guide the agent through the migration creation process. It doesn't just create a blank file—it creates a file with instructions.

## The Infrastructure Maturity Model

Infrastructure friendliness exists on a spectrum. Here's a maturity model you can use to assess your current state and plan improvements:

### Level 1: Ad Hoc (Most Teams Today)
- No standardized directory structure
- API documentation is manual and often outdated
- Test data is shared and non-deterministic
- Setup requires tribal knowledge
- Errors are strings without remediation guidance

### Level 2: Documented
- Directory structure is documented in README
- API has OpenAPI spec (maintained separately)
- Test fixtures exist but may not be deterministic
- Setup script exists but may have prerequisites
- Error messages include some guidance

### Level 3: Conventional
- Directory structure is enforced by linters
- OpenAPI spec is generated from code
- Test fixtures are deterministic and seedable
- One-command setup works reliably
- Errors include remediation and error codes

### Level 4: Mechanically Enforced
- All conventions are enforced by CI
- API contracts are verified by tests
- Test environments are fully isolated
- Setup is idempotent and fast
- Error recovery paths are automated

### Level 5: Agent-Native
- Agents can create new services from templates
- API evolution is governed by contract tests
- Test environments are created per-test
- Infrastructure self-heals on common errors
- Error patterns trigger automated remediation

Most teams implementing harness engineering should target Level 3-4. Level 5 is aspirational and represents the cutting edge of agent-first infrastructure.

## Convention Discovery: Teaching Agents Your Patterns

Conventions work best when they're discoverable. An agent encountering your codebase for the first time should be able to learn your conventions by reading the code itself, not by consulting external documentation.

### The Pattern Library

Create a pattern library that shows agents exactly how to implement common operations:

```markdown
# docs/patterns.md — Agent-readable pattern library

## Adding a New API Endpoint

### Steps
1. Create route file: `src/api/routes/{resource-name}.ts`
2. Define request/response types in: `src/types/{resource-name}.ts`
3. Implement service logic in: `src/services/{resource-name}/{resource-name}.service.ts`
4. Add repository methods in: `src/data/{resource-name}/{resource-name}.repository.ts`
5. Create test fixture in: `tests/fixtures/{resource-name}.json`
6. Write tests in: `src/api/routes/__tests__/{resource-name}.test.ts`
7. Update barrel exports in each layer's `index.ts`

### Example: Adding a "products" endpoint

```typescript
// src/types/product.ts
export interface Product {
  id: ProductId;
  name: string;
  price: Money;
  category: string;
}

export interface ProductRepository {
  findById(id: ProductId): Promise<Product | null>;
  findAll(filter?: ProductFilter): Promise<Product[]>;
  save(product: Product): Promise<void>;
}

// src/api/routes/products.ts
import { ProductService } from "../../services/products";
import { CreateProductSchema } from "../../types/product";

router.get("/api/v1/products", async (req, res) => {
  const products = await productService.findAll(req.query);
  res.json({ data: products, pagination: paginate(products, req.query.cursor) });
});

router.post("/api/v1/products", validate(CreateProductSchema), async (req, res) => {
  const product = await productService.create(req.body);
  res.status(201).json(product);
});
```

## Adding a New Database Migration

### Steps
1. Run: `python scripts/create-migration.py {description}`
2. Edit the generated file in `migrations/`
3. Implement `up()` for schema changes
4. Implement `down()` for rollback
5. Test: `python manage.py migrate && python manage.py migrate --rollback`

## Adding a New Feature Flag

### Steps
1. Add flag definition in `src/config/feature-flags.ts`
2. Wrap new code in `if (flags.isEnabled('flag_name'))`
3. Add flag to test fixtures
4. Document in `docs/feature-flags.md`
```

This pattern library is the bridge between your conventions and your agents. It doesn't just describe the rules—it shows concrete examples of how to follow them.

## The API Versioning Strategy

API versioning is a critical infrastructure pattern for agent-first development. When an agent modifies an API, it needs to know which version it's modifying and what backwards compatibility constraints apply.

### Versioned Endpoint Pattern

```python
# api_versioning.py
from fastapi import FastAPI, APIRouter
from typing import List

# Each API version is a separate router
v1_router = APIRouter(prefix="/api/v1")
v2_router = APIRouter(prefix="/api/v2")

# V1: Original implementation
@v1_router.get("/orders")
async def list_orders_v1(
    status: Optional[str] = None,
    limit: int = 50,
):
    """V1 order list — maintained for backwards compatibility."""
    orders = await order_service.list_orders(status=status, limit=limit)
    return {"orders": orders}  # V1 response format

# V2: Enhanced implementation with pagination
@v2_router.get("/orders")
async def list_orders_v2(
    status: Optional[str] = None,
    cursor: Optional[str] = None,
    limit: int = 50,
):
    """V2 order list — cursor-based pagination, richer response."""
    result = await order_service.list_orders_paginated(
        status=status, cursor=cursor, limit=limit
    )
    return {
        "data": result.items,
        "pagination": {
            "next_cursor": result.next_cursor,
            "has_more": result.has_more,
        },
    }

# Version negotiation via header
@app.middleware("http")
async def version_negotiation(request, call_next):
    version = request.headers.get("X-API-Version", "2")
    request.state.api_version = version
    response = await call_next(request)
    response.headers["X-API-Version"] = version
    return response
```

### The API Changelog

Maintain a machine-readable changelog that agents can consult before modifying APIs:

```yaml
# docs/api-changelog.yaml
changes:
  - version: "2.0.0"
    date: "2025-05-01"
    breaking: true
    changes:
      - description: "Order list now uses cursor-based pagination"
        old: "GET /api/v1/orders returns { orders: [...] }"
        new: "GET /api/v2/orders returns { data: [...], pagination: {...} }"
        migration: "Use pagination.next_cursor instead of offset-based page numbers"
    
  - version: "2.1.0"
    date: "2025-06-15"
    breaking: false
    changes:
      - description: "Added gift_wrap field to order response"
        new_field: "gift_wrap: boolean"
        default: false
```

This changelog helps agents understand the API's evolution and avoid reintroducing patterns that were intentionally changed.

## The Contract Testing Approach

Contract testing verifies that services communicate correctly by checking that each service's expectations about its dependencies are met. This is especially valuable in agent-first development, where agents may modify both the consumer and provider of an API.

```typescript
// tests/contracts/order-api-consumer.pact.ts
import { Pact } from "@pact-foundation/pact";

describe("Order API Consumer Contract", () => {
  const provider = new Pact({
    consumer: "order-ui",
    provider: "order-service",
  });

  it("should return a list of orders", async () => {
    await provider.addInteraction({
      state: "orders exist for customer cust-001",
      uponReceiving: "a request for customer orders",
      withRequest: {
        method: "GET",
        path: "/api/v2/orders",
        query: { customer_id: "cust-001" },
        headers: { "X-Correlation-ID": like("corr-123") },
      },
      willRespondWith: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: {
          data: eachLike({
            id: like("ord-001"),
            customer_id: like("cust-001"),
            status: term({ matcher: "pending|confirmed|shipped", generate: "pending" }),
            total: { amount: like(10.00), currency: like("USD") },
          }),
          pagination: {
            next_cursor: like(null),
            has_more: like(false),
          },
        },
      },
    });

    // Verify consumer expectations
    const orders = await orderClient.listOrders({ customer_id: "cust-001" });
    expect(orders.data).toBeInstanceOf(Array);
    expect(orders.pagination).toBeDefined();
  });
});
```

Contract tests catch a specific class of bug that's common in agent-driven development: an agent modifies the provider's response format without updating all consumers. The contract test fails, telling the agent that its change broke a consumer's expectations.

## Infrastructure Cost Visibility

Agent-friendly infrastructure includes cost visibility. When agents create resources (database instances, cache clusters, message queues), they should be able to see the cost implications:

```python
@app.get("/debug/cost-estimate")
async def cost_estimate():
    """Current infrastructure cost breakdown."""
    return {
        "compute": {
            "instances": 3,
            "monthly_cost_usd": 450.00,
            "cost_per_request": 0.001,
        },
        "database": {
            "instances": 1,
            "storage_gb": 50,
            "monthly_cost_usd": 120.00,
            "cost_per_query": 0.0001,
        },
        "cache": {
            "instances": 1,
            "memory_gb": 4,
            "monthly_cost_usd": 35.00,
        },
        "total_monthly_usd": 605.00,
        "cost_per_order": 0.02,
        "note": (
            "Adding a new database index costs approximately $0.50/month per GB. "
            "Consider the cost impact before adding indexes to large tables."
        ),
    }
```

This transparency helps agents (and humans) make informed decisions about infrastructure changes. It transforms cost from an invisible consequence to an explicit consideration.

---

## Service Template Repository

The fastest way to ensure every new service in your organization is agent-friendly is to maintain a service template repository. When a team creates a new service, they start from the template — which already includes all the patterns described in this chapter.

### Template Structure

```
service-template/
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Pre-configured CI pipeline
│       └── security-scan.yml       # Security scanning
├── src/
│   ├── api/                       # HTTP handlers
│   ├── domain/                    # Business logic
│   ├── infrastructure/            # External integrations
│   └── config/                    # Configuration
├── tests/
│   ├── fixtures/                  # Deterministic test data
│   ├── e2e/                       # E2E tests
│   └── integration/               # Integration tests
├── scripts/
│   ├── setup.sh                   # One-command setup
│   ├── seed.sh                    # Seed test data
│   └── health-check.sh            # Verify running state
├── migrations/                    # DB migrations
├── AGENTS.md                      # Agent instructions (pre-filled)
├── docker-compose.yml             # Local dev environment
├── Dockerfile                     # Production container
├── Makefile                       # Common commands
├── .env.example                   # Required env vars (with descriptions)
└── README.md                      # Getting started guide
```

### The Makefile as Agent Interface

A well-structured Makefile serves as a menu of available operations for agents:

```makefile
.PHONY: help setup test lint build run seed clean

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## First-time setup: install deps, create .env, build containers
	cp .env.example .env
	docker-compose build
	docker-compose up -d db redis
	./scripts/setup.sh
	@echo "Setup complete. Run 'make seed' to load test data."

seed: ## Seed database with deterministic test data
	./scripts/seed.sh
	@echo "Test data loaded. Run 'make test' to verify."

test: ## Run all tests
	docker-compose exec app pytest --tb=short -q

test-watch: ## Run tests in watch mode (for development)
	docker-compose exec app pytest-watch --clear

lint: ## Run all linters
	docker-compose exec app npx eslint src/
	docker-compose exec app npx tsc --noEmit
	@echo "All linters passed."

build: ## Build for production
	docker build -t ${SERVICE_NAME}:${VERSION} .

run: ## Start local development server
	docker-compose up -d
	./scripts/health-check.sh
	@echo "Server running at http://localhost:3000"

clean: ## Remove all containers, volumes, and build artifacts
	docker-compose down -v
	rm -rf dist/ node_modules/
	@echo "Clean complete. Run 'make setup' to start fresh."
```

When the agent reads AGENTS.md and finds "Run `make help` to see available commands," it has immediate access to the full development workflow without exploring the filesystem.

### The .env.example Pattern

The `.env.example` file documents every environment variable the service needs, with descriptions:

```bash
# .env.example — Required environment variables
# Copy this file to .env and fill in the values
# For local development, most values have sensible defaults

# Server
PORT=3000                          # HTTP server port
NODE_ENV=development               # development | staging | production
LOG_LEVEL=debug                    # debug | info | warn | error

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/service_db
DATABASE_POOL_SIZE=10              # Connection pool size
DATABASE_SSL=false                 # Enable SSL (required in production)

# Cache
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=300              # Default cache TTL

# External Services
PAYMENT_GATEWAY_URL=https://sandbox.payment.com
PAYMENT_GATEWAY_KEY=               # API key (required for payment features)
NOTIFICATION_SERVICE_URL=http://localhost:3001

# Feature Flags
ENABLE_NEW_ORDER_FLOW=false        # Enable redesigned order flow
ENABLE_ANALYTICS=true              # Enable analytics tracking
```

An agent reading this file knows exactly what configuration the service needs, which values are optional, and what each value controls. This is documentation that never goes stale because it's the source of truth.

---

## Agent-Friendly Database Patterns

Database interactions are a common source of friction for agents. Here are patterns that make databases agent-friendly.

### Migration Naming and Ordering

Use numbered migrations with descriptive names:

```
migrations/
├── 001_create_users_table.sql
├── 002_create_orders_table.sql
├── 003_add_email_to_users.sql
├── 004_create_order_items_table.sql
├── 005_add_status_index_to_orders.sql
└── current_schema.sql    # Auto-generated: current state of all tables
```

The `current_schema.sql` file is critical. It's auto-generated after each migration and shows the current state of every table. An agent can read this single file to understand the entire database schema without reading individual migrations.

```sql
-- current_schema.sql (auto-generated)
-- Last migration: 005_add_status_index_to_orders.sql

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_cents INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_status ON orders(status);

-- For the full schema, see: migrations/current_schema_full.sql
```

### Seed Data Pattern

Seed data should be deterministic and documented. Include a seed data manifest:

```json
{
  "version": "2025-06-15",
  "description": "Standard development seed data",
  "records": {
    "users": [
      {"id": "user-001", "email": "test-agent@example.com", "name": "Test Agent", "role": "admin"},
      {"id": "user-002", "email": "alice@example.com", "name": "Alice Chen", "role": "user"},
      {"id": "user-003", "email": "bob@example.com", "name": "Bob Smith", "role": "user"}
    ],
    "orders": [
      {"id": "order-001", "user_id": "user-002", "status": "pending", "total_cents": 5000},
      {"id": "order-002", "user_id": "user-002", "status": "shipped", "total_cents": 12500},
      {"id": "order-003", "user_id": "user-003", "status": "delivered", "total_cents": 3200}
    ]
  },
  "relationships": {
    "user-002 has 2 orders (1 pending, 1 shipped)": "Useful for testing order listing and status transitions",
    "user-003 has 1 delivered order": "Useful for testing re-order flow"
  },
  "agent_guidance": {
    "test_user": "user-001 (test-agent@example.com) has admin role and no orders",
    "order_testing": "Use user-002 for order lifecycle tests",
    "payment_testing": "All orders have payment_method=credit_card in fixtures"
  }
}
```

The `agent_guidance` field tells agents which test data to use for specific scenarios. This eliminates the guesswork of "which user should I use for this test?"

---

## Agent-Friendly Configuration Management

Configuration management is another area where conventions dramatically reduce agent friction.

### The Configuration Hierarchy

Adopt a clear hierarchy for configuration sources:

1. **Environment variables** — Production values, secrets, deployment-specific settings
2. **Config files** — Default values, non-sensitive settings
3. **Feature flags** — Runtime-toggleable behavior
4. **Database configuration** — Dynamic settings that can be changed without redeployment

Document this hierarchy in AGENTS.md:

```markdown
## Configuration

### Hierarchy (highest priority first):
1. Environment variables (`.env` for local, injected in production)
2. Feature flags (queryable at /debug/feature-flags)
3. Config files (config/default.yaml, config/{NODE_ENV}.yaml)
4. Database configuration (admin_config table)

### Adding a new configuration value:
1. Add to .env.example with a comment describing the value
2. Add to config/default.yaml with the default value
3. Document in README.md under "Configuration"
4. Do NOT hardcode configuration values in source code
```

### Configuration Validation

Validate configuration at startup and provide clear error messages:

```python
from pydantic import BaseSettings, Field, validator

class ServiceConfig(BaseSettings):
    # Server
    port: int = Field(3000, description="HTTP server port")
    log_level: str = Field("info", description="Logging level")
    
    # Database
    database_url: str = Field(..., description="Database connection string")
    database_pool_size: int = Field(10, description="Connection pool size")
    
    # External services
    payment_gateway_url: str = Field(..., description="Payment gateway base URL")
    payment_gateway_key: str = Field(..., description="Payment gateway API key")
    
    @validator("database_url")
    def validate_database_url(cls, v):
        if not v.startswith(("postgres://", "postgresql://")):
            raise ValueError("database_url must be a PostgreSQL connection string")
        return v
    
    @validator("payment_gateway_url")
    def validate_gateway_url(cls, v):
        if not v.startswith("https://"):
            raise ValueError("payment_gateway_url must use HTTPS")
        return v
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
```

When the agent starts the service with missing or invalid configuration, the startup fails with a clear message: "configuration error: payment_gateway_key is required. Add it to your .env file." The agent knows exactly what to do.

---

## Summary

- **Convention over configuration** eliminates ambiguity for agents; adopt strict, enforced conventions for directory structure, naming, and API design
- **Self-documenting APIs** carry their own specification; use OpenAPI/protobuf/GraphQL schemas with rich descriptions and examples
- **Deterministic test fixtures** ensure reproducible tests; every test should start from a known, seedable state
- **Reproducible environments** via Docker Compose and one-command setup scripts make it possible for any agent to spin up a complete local environment
- **Error context with remediation** transforms errors from diagnostic reports into action plans
- **Structured logging** with correlation IDs, breadcrumbs, and context enrichment gives agents the traceability they need
- **Health check cascading** with healthy/degraded/unhealthy tiers gives agents accurate system state
- **UI automation hooks** (`data-testid`, `data-state`, ARIA attributes) make the UI inspectable by headless browsers
- **Infrastructure as code** through template repositories ensures conventions are enforced, not just documented

The infrastructure patterns in this chapter and the legibility patterns in Chapter 8 form the foundation upon which everything else in this book is built. Without legibility and friendly infrastructure, agents operate in the dark. With them, agents become reliable, productive members of your engineering team.

In Part IV, we'll move from making applications observable to making architecture enforceable—encoding taste, dependency rules, and governance into mechanical constraints that agents cannot violate.

---

## Infrastructure as Agent Harness: Stripe's Devbox Architecture

The patterns described in this chapter — conventions, deterministic environments, structured errors — are not merely theoretical. Stripe's "Minions" system, which produces over 1,000 merged pull requests per week with humans reviewing code but writing none of it, demonstrates what agent-friendly infrastructure looks like at the highest level of sophistication.² The key insight from Stripe is not the agent model itself, but the infrastructure substrate that makes autonomous coding safe.

### The Devbox: Disposable, Pre-Warmed Sandboxes

Every Minion run executes inside an isolated AWS EC2 instance called a **Devbox**. This is the same development environment that human Stripe engineers use every day — they connect to Devboxes over SSH from their IDE and write code there. The design philosophy is "cattle, not pets": each Devbox is standardized and disposable. A single engineer typically runs about half a dozen in parallel and assigns one per task.

What makes Devboxes remarkable is their provisioning speed. Behind Stripe's "Hot and Ready" 10-second boot target is a pool of pre-warmed instances where everything is already done:

- Clone of the massive git repository
- Bazel and type-check caches warmed
- A code-generation service kept running
- Checked out to the latest copy of master

Within 10 seconds, an agent can open a REPL, run tests, change code and run type checks, or start web services immediately. This is not a container or a VM snapshot — it is a full EC2 instance with the developer shell's complete power, appropriately constrained.

### Infrastructure Isolation as a Harness

Devboxes run inside Stripe's QA environment. They have access to production data and production services, but arbitrary external networks are blocked. No internet access. No production write connectivity. Each Devbox is destroyed after its agent run completes.

This is the deepest lesson from Stripe: **infrastructure isolation IS a form of harness**. Stripe did not build a new isolation substrate for agents. The existing human-oriented infrastructure — designed so that engineers could experiment safely — became the agent sandbox automatically. The blast radius of any single agent is confined to one disposable Devbox. Compared to approaches where agents run on developer laptops with unconstrained network access, this is a fundamentally different security posture.

As one analysis of the architecture noted: "By building an environment where human engineers can experiment safely, that environment also became safe for agents. Stripe did not create a new isolation substrate for agents; the existing human-oriented infrastructure could be reused as-is."

### The Multi-Ring Governance Model

Stripe's infrastructure implements what external analysts have described as a multi-ring containment model:

| Ring | Purpose | Stripe Implementation |
|------|---------|---------------------|
| 1: Constrain Inputs | Curated tool access, scoped context | Toolshed (curated MCP subsets), directory-scoped rule files, pre-hydrated context |
| 2: Constrain Environment | Isolated, disposable execution | Devboxes (pre-warmed EC2, no internet, destroyed after use) |
| 3: Validate Outputs | Layered verification | Local lint (seconds) + selective CI (minutes) + capped retry (one attempt) |
| 4: Gate Promotion | Human review as structural gate | Every PR goes to a human reviewer; agents never self-merge |

Ring 2 — the Devbox — is the strongest constraint. The isolation is binary: the agent either cannot reach production, or the ring does not exist. There is no partial isolation. Stripe chose infrastructure over policy.

### Lessons for Your Team

You do not need Stripe's scale to apply these lessons:

1. **Reuse your existing environments.** If you have a staging or QA environment that engineers use for safe experimentation, that environment is already a candidate for agent execution. Don't build a parallel infrastructure.

2. **Make environments disposable.** Whether you use Docker containers, cloud instances, or ephemeral namespaces, agents should operate in environments that can be destroyed and recreated in seconds. This makes agent runs reproducible and eliminates state leakage between tasks.

3. **Pool and pre-warm.** Stripe's 10-second spin-up is not magic — it's a pool of ready instances. Even at small scale, keeping a warm Docker Compose stack or a pre-built container image dramatically reduces the feedback loop for agent tasks.

4. **Enforce isolation structurally, not by policy.** Network restrictions, filesystem boundaries, and permission models are mechanical constraints that agents cannot circumvent. A policy document that says "agents should not access production" is a suggestion. A VPC configuration that makes production unreachable is a guarantee.

5. **Gate promotion with human review.** Agents can write code, run tests, and create PRs — but they should never self-merge. This is the simplest and most important structural gate.

Stripe's Minions demonstrate that the gap between "agent-capable" infrastructure and "agent-harnessed" infrastructure is not about AI sophistication — it is about infrastructure discipline. The same conventions, deterministic environments, and structured observability described throughout this chapter are what make autonomous coding agents productive and safe at scale.

---

## The MCP Gateway Pattern: A Single Entry Point for Agent Infrastructure

As organizations move from a single coding agent to dozens of agent-powered workflows — code review, incident response, data analysis, on-call automation — a new infrastructure challenge emerges: how do agents discover and access internal tools, APIs, and services without requiring custom integrations for each one?

The **Model Context Protocol (MCP)** provides the answer. MCP is an open standard that defines how AI agents connect to and use tools through a consistent, networked interface. But at enterprise scale, individual MCP servers per tool become unmanageable. The solution is the **MCP Gateway** — a centralized proxy that sits between agents and your entire internal service landscape.

### Uber's MCP Gateway: Config-Driven Service Exposure

Uber runs thousands of internal microservices communicating via Thrift, Protobuf, and HTTP. Before their MCP Gateway, connecting an AI agent to an internal tool meant building a custom integration — writing wrapper code, handling authentication, managing versioning. Multiply that by hundreds of services and thousands of engineers wanting AI access, and the integration burden becomes untenable.

Uber's solution was a centralized MCP Gateway with a transformative capability: it can expose any existing internal Thrift, Protobuf, or HTTP endpoint as an MCP server through configuration alone — no new code required.³ Service owners register their endpoints with the gateway, choose which tools to enable, and fine-tune descriptions. The gateway handles authentication, protocol translation, and versioning.

The architecture includes:

- **MCP Gateway and Registry** — the central proxy that translates internal service endpoints into MCP tools, with a tiered gating system for first-party vs. third-party services
- **Uber Agent Builder** — a no-code platform where teams construct AI agents by selecting MCP servers and scoping tool access without writing code
- **Uber Agent SDK** — a code-first approach for teams that need more control, with the same tool selection and parameter override capabilities
- **Coding Agent Integration** — Claude Code and Cursor integration via a single CLI command (`aifx mcp add code-mcp`) that installs local and remote MCPs the coding agent can access³

This config-driven approach means teams across Uber can create AI-powered workflows without engineering bottlenecks. An operations team can build an agent that queries incident data from PagerDuty, cross-references deployment logs, and suggests root causes — all without writing a single line of integration code.

### Stripe's Toolshed: Nearly 500 MCP Tools at Scale

Stripe's **Toolshed** takes a different but complementary approach. It is a central internal MCP server — not a gateway — that hosts nearly 500 MCP tools spanning internal systems and SaaS platforms.² Tools cover code intelligence (Sourcegraph search), documentation, ticket details, build statuses, and more.

The critical design insight from Toolshed is **scoped tool access**. Agents perform best when given a "smaller box" with a tastefully curated set of tools, so Stripe configures different agents to request only a subset of Toolshed tools relevant to their task. Minions — the autonomous coding agents — receive an intentionally small subset by default, though engineers can configure additional thematically grouped tool sets for their own agents.

Toolshed also implements a security control framework that ensures agents cannot use their tools to perform destructive actions. Combined with Devbox isolation (no access to real user data, production services, or network egress), this provides defense in depth.

### The Design Pattern

Whether you choose a gateway approach (Uber) or a central server approach (Stripe), the MCP Gateway pattern provides three critical capabilities for agent-first organizations:

1. **Discoverability.** Agents can find available tools through a registry, rather than hardcoding endpoint knowledge. An agent encountering a new service can query the MCP catalog to understand what operations are available.

2. **Governance.** Centralized tool access means centralized auditing. Every tool invocation passes through the gateway, enabling usage tracking, rate limiting, and anomaly detection. You know exactly which agents accessed which services and when.

3. **Consistency.** Instead of N×M integrations (every agent × every tool), MCP provides a single protocol. Adding a new tool makes it immediately available to all agents. Adding a new agent gives it immediate access to all registered tools.

For teams starting the MCP journey, the progression looks like this:

- **Stage 1:** Individual MCP servers for high-value tools (code search, CI, ticketing)
- **Stage 2:** A central MCP registry that agents query to discover available tools
- **Stage 3:** A full MCP gateway with config-driven service exposure, authentication, and auditing
- **Stage 4:** Agent builder platforms (no-code and code-first) that compose MCP tools into workflows

Most organizations should target Stage 2 initially. The investment pays for itself the moment a second agent needs access to the same tool — instead of building another custom integration, you point the new agent at the registry.

---

### The Affirm Blueprint in Brief

Affirm's well-documented retraining of 800+ engineers in a single week was enabled by three infrastructure decisions:¹ a single default agent toolchain (enabling shared linters, CI templates, and debugging practices), local-first agent development (isolation, speed, and limited blast radius), and explicit human checkpoints enforced mechanically through CI and deployment pipelines. These decisions are detailed in Affirm's public engineering posts; the important takeaway for this chapter is that none of Affirm's three decisions would have been possible without the infrastructure patterns described above — conventions, deterministic environments, and structurally enforced gates.

---

## Agent-Friendly Error Documentation

Beyond error context in responses and logs, maintain a machine-readable error catalog:

```yaml
# docs/errors.yaml
errors:
  - code: PAYMENT_DECLINED
    http_status: 402
    description: "Payment was declined by the payment gateway"
    causes:
      - "Insufficient funds on the payment method"
      - "Expired payment method"
      - "Payment gateway temporarily unavailable"
    remediation:
      agent:
        - "Retry with a different payment method"
        - "Check payment gateway status at /debug/observe?query_type=metrics&endpoint=payments"
        - "Do not retry more than 3 times"
      human:
        - "Contact customer to update payment method"
        - "Check payment gateway dashboard for details"
    related_errors: [PAYMENT_TIMEOUT, PAYMENT_GATEWAY_UNAVAILABLE]
    
  - code: ORDER_NOT_FOUND
    http_status: 404
    description: "The requested order does not exist"
    causes:
      - "Invalid order ID"
      - "Order was deleted"
      - "ID confusion between test and production data"
    remediation:
      agent:
        - "Verify the order ID format matches ORD-XXXX pattern"
        - "Check database for order existence: SELECT * FROM orders WHERE id = ?"
        - "Verify test data was seeded: make seed"
      human:
        - "Check if the order ID is correct"
        - "Verify you're looking at the right environment"
```

An agent encountering an error can look up the error code in this catalog and find specific, actionable remediation steps. The `agent` field gives steps the agent can take autonomously; the `human` field gives steps that require human judgment.

---

## The Infrastructure Health Dashboard for Agents

Provide an endpoint that gives agents a complete picture of infrastructure health:

```python
@app.get("/debug/infrastructure")
async def infrastructure_status():
    """Complete infrastructure status for agent consumption."""
    return {
        "services": {
            "order-service": {
                "status": "healthy",
                "version": "1.2.3",
                "last_deploy": "2025-06-15T12:00:00Z",
                "endpoint": "http://localhost:3000",
                "health_url": "http://localhost:3000/ready",
            },
            "payment-service": {
                "status": "healthy",
                "version": "2.1.0",
                "last_deploy": "2025-06-14T08:30:00Z",
                "endpoint": "http://localhost:3001",
                "health_url": "http://localhost:3001/ready",
            },
            "notification-service": {
                "status": "degraded",
                "version": "1.0.5",
                "last_deploy": "2025-06-15T10:00:00Z",
                "endpoint": "http://localhost:3002",
                "health_url": "http://localhost:3002/ready",
                "degraded_features": ["email_sending"],
                "agent_guidance": "Email sending is degraded. Skip email-related tests.",
            },
        },
        "databases": {
            "primary": {
                "status": "healthy",
                "host": "localhost:5432",
                "database": "order_db",
                "migration_version": 5,
                "agent_guidance": "Run 'make seed' to load test data",
            },
        },
        "queues": {
            "order-events": {
                "status": "healthy",
                "depth": 0,
                "consumers": 1,
            },
        },
        "agent_guidance": {
            "all_services_healthy": True,
            "skip_tests_requiring": ["email_sending"],
            "recommended_test_order": [
                "1. Run 'make test' for unit tests",
                "2. Run integration tests against local services",
                "3. Skip notification-related E2E tests (service degraded)",
            ],
        },
    }
```

This endpoint gives the agent a complete picture of the infrastructure state, including which tests to run and which to skip. It's the infrastructure equivalent of a pre-flight checklist — everything the agent needs to know before it starts working.

---

## The Agent Onboarding Flow

When an agent first encounters your codebase, it goes through an onboarding process similar to a new engineer. The infrastructure should support this flow.

### Step 1: Read AGENTS.md

The agent reads AGENTS.md to understand the project conventions, commands, and constraints. A well-written AGENTS.md for infrastructure looks like:

```markdown
## Infrastructure

### Local Development
- **Setup**: `make setup` — installs deps, creates .env, builds containers
- **Start**: `make run` — starts all services (app, db, cache, queue)
- **Test data**: `make seed` — loads deterministic test fixtures
- **Stop**: `make clean` — stops containers and removes volumes
- **Health check**: `make health` or GET /ready

### Services
- **App**: http://localhost:3000 (see /ready for health)
- **Database**: postgresql://localhost:5432/order_db (seeded by `make seed`)
- **Cache**: redis://localhost:6379
- **Queue**: RabbitMQ at localhost:5672, management UI at http://localhost:15672

### Testing
- **Unit tests**: `make test` — runs in < 10s
- **Integration tests**: `make test-integration` — requires running services
- **E2E tests**: `make test-e2e` — requires running services and seed data
- **Always seed before testing**: `make seed && make test`

### Database
- **Migrations**: `make migrate` — runs pending migrations
- **Current schema**: `migrations/current_schema.sql` — auto-generated
- **Test data manifest**: `tests/fixtures/seed-manifest.json`

### Key Conventions
- All API routes: `/api/v1/{resource}`
- All errors: RFC 7807 Problem Details format
- All dates: ISO 8601
- All IDs: UUID format
- All money: cents (integer)
```

### Step 2: Verify Infrastructure

The agent runs `make health` or calls GET /debug/infrastructure to verify all services are running and healthy. If any service is degraded, the agent adjusts its plan accordingly.

### Step 3: Understand the Domain

The agent reads the current database schema (migrations/current_schema.sql) and the API specification (openapi.yaml) to understand the domain model. These two files provide a complete picture of the data model and the operations available.

### Step 4: Execute and Verify

The agent follows the workflow: modify code → run tests → check health → verify behavior. Each step uses the infrastructure patterns described in this chapter: structured test output, health check endpoints, and self-documenting APIs.

This onboarding flow takes seconds for an agent — compared to days or weeks for a human engineer. The difference is the infrastructure. Every convention, every endpoint, every seed file reduces the time from "I'm new here" to "I'm productive."

---


---

## Footnotes

¹ Affirm Engineering, "Retooling Our Engineering Organization for Agentic Development," Affirm Engineering Blog, 2026. [Citation needed — verify before publication]

² Stripe Engineering, "Minions: Stripe's One-Shot End-to-End Coding Agents," stripe.dev, 2025. https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents

³ Uber Engineering, "uReview: AI-Powered Code Review at Uber," Uber Blog, 2025. https://www.uber.com/blog/ureview

⁴ Wix Engineering, "AirBot: Our AI On-Call Teammate," Wix Engineering Blog, 2025. [Citation needed — verify before publication]

---

## Key Takeaways

- **Convention over configuration** eliminates ambiguity. Strict, enforced conventions for directory structure, naming, and API design let agents operate with less context and fewer errors.
- **Self-documenting APIs** carry their own specification. Use OpenAPI schemas with rich descriptions, examples, and integration guides.
- **Deterministic test fixtures** ensure reproducible tests. Every test starts from a known, seedable state with a documented manifest.
- **Reproducible environments** via Docker Compose and one-command setup (`make setup`) let any agent spin up a complete environment.
- **Error context with remediation** transforms errors from diagnostic reports into action plans with both agent and human remediation steps.
- **Structured logging** with correlation IDs gives agents full traceability across service boundaries.
- **Health check cascading** with healthy/degraded/unhealthy tiers provides accurate system state.
- **UI automation hooks** make the UI inspectable by headless browsers.
- **Infrastructure as code** through template repositories ensures conventions are enforced mechanically.
- **The Makefile as agent interface** provides a menu of operations that agents can discover and use.
- **Database patterns** — numbered migrations, current schema snapshot, deterministic seed data with agent guidance — make databases legible.
- **Configuration management** — validated at startup, documented in .env.example, with a clear hierarchy — eliminates configuration confusion.
- **The service template repository** is the fastest path to agent-friendly infrastructure across an organization.
- **The agent onboarding flow** (read AGENTS.md → verify infrastructure → understand domain → execute and verify) takes seconds with good infrastructure.
- **The Affirm blueprint** demonstrates that agent-friendly infrastructure at scale is achievable: single toolchain, local-first, explicit checkpoints.
- **Stripe's Devbox architecture** proves that infrastructure isolation is a form of harness — disposable, pre-warmed environments with structural (not policy-based) constraints enable safe autonomous coding at scale.
- **The MCP Gateway pattern** (exemplified by Uber and Stripe's Toolshed) provides a centralized, auditable interface between agents and internal services — replacing N×M integrations with a single protocol.

---

## The Wix AirBot Lesson: Infrastructure Legibility at Scale

Wix's AirBot — the AI on-call teammate that saves 675 engineering hours per month (the full case study is in Chapter 16) — provides a powerful validation of agent-friendly infrastructure patterns.⁴ What enabled AirBot to operate at Wix's scale (250M users, 4B HTTP transactions per day, 3,500 Airflow pipelines) was not just the AI model, but the infrastructure legibility Wix had invested in:

**Standardized Observability**: Every service follows the same logging format, health check pattern, and metric naming convention. AirBot can diagnose any service without learning service-specific patterns.

**Structured Runbooks**: Every common failure mode has a structured runbook with clear steps. AirBot reads these and executes the automated steps, escalating only those requiring human judgment.

**Correlation Across Systems**: Correlation IDs link events across the entire stack — from HTTP request to Airflow pipeline to data lake query. AirBot can trace a user-facing error to its root cause.

**Feedback Loop**: AirBot's suggestions are tracked — engineers accept or reject them, and the feedback improves future recommendations. Of 180 candidate PRs, 28 were merged without human changes.

### What Wix Did Differently

Most organizations build infrastructure for human operators. Wix built infrastructure for both human and AI operators. The difference is subtle but important:

- **For humans**: Documentation is in wikis, runbooks are in Confluence, and metrics are in dashboards. This works because humans can navigate between tools.
- **For AI agents**: Documentation must be queryable via API, runbooks must be machine-readable, and metrics must be available through structured endpoints. Agents can't click through a Grafana dashboard.

Wix made the investment to bridge both worlds — maintaining human-friendly interfaces while adding machine-friendly alternatives. This dual investment is the hallmark of agent-friendly infrastructure, and it's the investment that this chapter has been guiding you to make.

The pattern is clear: invest in conventions, documentation-as-code, deterministic environments, and structured observability. These investments benefit both human engineers and AI agents. They reduce onboarding time, eliminate ambiguity, and enable the kind of high-throughput, high-confidence development that defines agent-first engineering.

Every convention you establish, every seed file you create, every health check endpoint you expose is not just infrastructure — it's a message to future agents (and future engineers) that says: "Here's how this system works. Here's how to verify it's working. Here's what to do when it's not." That message compounds with every agent interaction, making every future task easier than the last.
