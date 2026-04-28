# Appendix C: Golden Principles Library

*50+ encoded rules for common codebase patterns. Each principle is stated as a linter-enforceable rule.*

---

## Architecture Principles

### GP-01: Inward-Only Dependencies
**Rule:** Source files may only import from layers at equal or lower depth.
**Rationale:** Prevents circular dependencies and keeps the dependency graph clean.
**Enforcement:** Custom ESLint rule (`harness/dependency-direction`) or structural test using `madge`. For Python: `import-linter` with custom contracts. For Go: `golangci-lint` with `depguard` plugin. See Appendix D for full implementations.

### GP-02: No File Exceeds 300 Lines
**Rule:** Source files must not exceed 300 lines (excluding comments and blank lines).
**Rationale:** Large files are hard for agents to understand and modify correctly.
**Enforcement:** Custom ESLint rule (`harness/file-size-limit`, see Appendix D). For Python: Ruff `max-file-length` or custom rule. For Go: `golangci-lint funlen` combined with file-level checks.

### GP-03: No Function Exceeds 40 Lines
**Rule:** Functions must not exceed 40 lines of logic.
**Rationale:** Long functions are hard to test, review, and maintain.
**Enforcement:** ESLint `max-lines-per-function` rule. For Python: Ruff `PLR0915` (too many statements). For Go: `golangci-lint funlen`.

### GP-04: Barrel File Exports Only
**Rule:** Each module has one `index.ts` that re-exports its public API.
**Rationale:** Creates a clear module boundary that agents can understand.
**Enforcement:** Custom ESLint rule (`harness/barrel-exports`, see Appendix D) or structural test. For Python: `__init__.py` with explicit `__all__` exports enforced by Ruff.

### GP-05: No Circular Dependencies
**Rule:** The dependency graph must be a directed acyclic graph (DAG).
**Rationale:** Circular dependencies create confusion for both agents and humans.
**Enforcement:** `madge` structural test (TypeScript). For Python: `import-linter` or `pylint` cyclic-import check. For Go: `go vet` catches most cases; supplement with `golangci-lint gocyclo`.

---

## Type Safety Principles

### GP-06: No Any Types
**Rule:** TypeScript `any` type is prohibited in source code.
**Rationale:** `any` bypasses type checking, making the codebase less legible to agents.
**Enforcement:** ESLint `@typescript-eslint/no-explicit-any` rule. Semgrep rule `no-any-type` (see Appendix D). For Python: `mypy --disallow-any-generics` + Ruff `ANN` rules.

### GP-07: Explicit Return Types
**Rule:** All exported functions must declare their return type.
**Rationale:** Makes the codebase self-documenting and easier for agents to understand.
**Enforcement:** ESLint `@typescript-eslint/explicit-function-return-type`. For Python: Ruff `ANN201` (missing return type annotation). For Go: `golint` / `go doc` convention (doc comments required on exported functions).

### GP-08: Branded Types for Domain Concepts
**Rule:** Domain identifiers (UserID, OrderID) use branded types, not raw strings.
**Rationale:** Prevents agents from accidentally mixing up identifiers.
**Enforcement:** Code review + Semgrep custom rule matching raw-string ID parameters in service constructors.

---

## Error Handling Principles

### GP-09: All Errors Include Remediation
**Rule:** Every thrown error must include a message explaining how to fix it.
**Rationale:** Errors that tell the agent (or human) what to do reduce debugging time.
**Enforcement:** Custom ESLint rule (`harness/error-remediation`, see Appendix D). For Python: custom Ruff rule checking `raise` statements for message structure.

### GP-10: No Silent Error Swallowing
**Rule:** Empty catch blocks are prohibited. All caught errors must be logged or re-thrown.
**Rationale:** Silent failures hide bugs that agents can't detect.
**Enforcement:** ESLint `no-empty` rule. For Python: Ruff `B022` (useless contextlib.suppress) + `PLE1300` (bare except). Semgrep `no-silent-catch` rule.

### GP-11: Structured Error Format
**Rule:** All API errors follow RFC 7807 Problem Details format.
**Rationale:** Consistent error format makes the codebase legible to agents.
**Enforcement:** Response schema validation in tests. Semgrep `consistent-error-response` rule (see Appendix D).

### GP-12: Error Codes Are Enums
**Rule:** Error codes are defined in a central enum, not magic strings.
**Rationale:** Agents can discover and use all error codes from one location.
**Enforcement:** Custom ESLint rule or Semgrep rule matching string literals in `throw` / `new Error()` contexts. For Python: Ruff `RUF001` + custom check for string error codes outside enums.

---

## Logging Principles

### GP-13: Structured Logging Only
**Rule:** All log calls use structured format (JSON objects, not string concatenation).
**Rationale:** String-based logs are hard to query and analyze.
**Enforcement:** Custom ESLint rule (`harness/structured-logging`, see Appendix D). For Python: custom Ruff rule `SL001` (see Appendix D).

### GP-14: Correlation IDs on All Requests
**Rule:** Every request logs a correlation ID that flows through all downstream calls.
**Rationale:** Enables tracing agent actions across service boundaries.
**Enforcement:** Middleware integration test + Semgrep rule verifying correlation-ID header forwarding in fetch/HTTP calls.

### GP-15: No Sensitive Data in Logs
**Rule:** Passwords, tokens, PII, and secrets must not appear in log output.
**Rationale:** Prevents credential exposure through agent-accessible logs.
**Enforcement:** Semgrep `no-hardcoded-secrets` rule (see Appendix D) + log scanning in CI. For Python: `detect-secrets` pre-commit hook.

---

## Testing Principles

### GP-16: Test File Mirrors Source File
**Rule:** Every source file has a corresponding test file.
**Rationale:** Ensures comprehensive test coverage.
**Enforcement:** Structural test verifying file pairing (see Appendix D for implementation).

### GP-17: Test the Error Path
**Rule:** Every function with error handling has at least one test for the error case.
**Rationale:** Error paths are where agent-generated bugs hide.
**Enforcement:** Coverage tool branch-coverage check (target >85% branch coverage). Custom script grepping for `catch`/`except` and verifying corresponding test assertions.

### GP-18: No Test Interdependence
**Rule:** Tests must be independent and pass in any order.
**Rationale:** Agent-generated test suites that depend on execution order are fragile.
**Enforcement:** Jest `--randomize` or `pytest-randomly` plugin. For Go: `go test -count=1 -shuffle=on`.

### GP-19: Meaningful Test Names
**Rule:** Test descriptions describe the expected behavior, not the implementation.
**Rationale:** Makes test failures legible to agents and humans.
**Enforcement:** Custom ESLint rule (`harness/descriptive-test-names`, see Appendix D). For Python: `pytest` naming convention enforced by Ruff `test-name-pattern`.

---

## API Design Principles

### GP-20: Consistent Response Schema
**Rule:** All API endpoints return `{ data, error, metadata }`.
**Rationale:** Predictable responses make the API legible to agents.
**Enforcement:** Response schema validation middleware + Semgrep `consistent-error-response` rule.

### GP-21: Input Validation at Boundary
**Rule:** All API inputs are validated with schema validators (zod, Pydantic) at the route level.
**Rationale:** Prevents invalid data from reaching business logic.
**Enforcement:** Semgrep `no-unvalidated-user-input` rule (see Appendix D). For Python: custom Ruff rule checking FastAPI endpoint signatures for Pydantic types.

### GP-22: No Business Logic in Route Handlers
**Rule:** Route handlers extract, validate, delegate to services, and return.
**Rationale:** Keeps route handlers thin and business logic testable.
**Enforcement:** Semgrep `no-business-logic-in-ui` rule (see Appendix D for language-agnostic implementation). File size limit + import pattern check.

---

## Security Principles

### GP-23: No Hardcoded Secrets
**Rule:** No secrets, API keys, or credentials in source code.
**Rationale:** Prevents credential exposure through agent-generated code.
**Enforcement:** GitLeaks or `gitleaks-action` in CI. Semgrep `no-hardcoded-secrets` rule (see Appendix D). For Python: `detect-secrets` pre-commit hook.

### GP-24: Parameterized Queries Only
**Rule:** All SQL queries use parameterized statements, never string concatenation.
**Rationale:** Prevents SQL injection in agent-generated data access code.
**Enforcement:** Semgrep `parameterized-query` rule (see Appendix D). For Python: `sqlfluff` + Bandit `S608` (SQL injection).

### GP-25: HTTPS Only
**Rule:** All external URLs use HTTPS.
**Rationale:** Prevents data exposure through unencrypted channels.
**Enforcement:** Semgrep `no-http-urls` rule (see Appendix D). Custom Ruff rule matching `http://` string literals.

---

## Documentation Principles

### GP-26: Comments Describe Why, Not What
**Rule:** Code comments explain design decisions and rationale, not what the code does.
**Rationale:** "What" should be self-documenting; "why" is the valuable information.
**Enforcement:** Code review. Semgrep can flag comments matching re-statement patterns (e.g., `// increment i` above `i++`).

### GP-27: API Documentation is Auto-Generated
**Rule:** API docs are generated from annotations (OpenAPI/Swagger), not manually written.
**Rationale:** Prevents documentation drift.
**Enforcement:** CI check verifying doc generation succeeds. For Python: FastAPI auto-generates OpenAPI; CI checks `/docs` endpoint returns valid spec.

### GP-28: README has Working Quick Start
**Rule:** The README quick start guide must work when followed verbatim.
**Rationale:** The first thing an agent (or human) reads should be accurate.
**Enforcement:** CI test that runs the quick start commands (e.g., `markdown-code-runner` or custom shell script in CI).

---

## Import and Dependency Principles

### GP-29: No Wildcard Imports
**Rule:** Import specific symbols, not entire modules (`import { x }` not `import *`).
**Rationale:** Makes dependencies explicit and easier to audit.
**Enforcement:** ESLint `no-restricted-imports`. For Python: Ruff `F403` (undefined-local-with-import-star) + `F405`. For Go: not idiomatic; enforced by convention.

### GP-30: New Dependencies Require Approval
**Rule:** Adding new runtime dependencies requires human review.
**Rationale:** Prevents agent from introducing unnecessary or insecure dependencies.
**Enforcement:** CI check comparing `package.json` / `pyproject.toml` / `go.mod` changes. `renovatebot` or `dependabot` with auto-merge disabled for new deps.

---

## Naming Principles

### GP-31: Descriptive Variable Names
**Rule:** Variables have descriptive names (no single-letter variables except loop counters).
**Rationale:** Makes code self-documenting for agents and humans.
**Enforcement:** ESLint `id-length` rule. For Python: Ruff `E741` (ambiguous variable name). For Go: `golangci-lint govarnames`.

### GP-32: Boolean Variables Use Is/Has/Should Prefix
**Rule:** Boolean variables and functions start with is/has/should/can/will.
**Rationale:** Makes boolean semantics clear.
**Enforcement:** Custom ESLint rule. For Python: custom Ruff rule matching `bool`-typed variables without standard prefixes.

### GP-33: Consistent File Naming
**Rule:** Files use kebab-case, classes use PascalCase, functions use camelCase.
**Rationale:** Predictable naming makes the codebase navigable.
**Enforcement:** ESLint `@typescript-eslint/naming-convention`. For Python: Ruff `N801`–`N818` naming rules. For Go: enforced by compiler (exported = PascalCase).

---

## Performance Principles

### GP-34: No N+1 Queries
**Rule:** Data access must not make one query per item in a loop.
**Rationale:** Performance anti-pattern that agents frequently introduce.
**Enforcement:** Semgrep `n-plus-one-query-pattern` rule (see Appendix D). Integration test checking query count per request.

### GP-35: Pagination on All List Endpoints
**Rule:** Endpoints that return lists must support pagination with a default limit.
**Rationale:** Prevents unbounded memory usage.
**Enforcement:** API schema validation + Semgrep `no-unbounded-array-creation` rule (see Appendix D).

---

## Database Principles

### GP-36: Migrations Are Reversible
**Rule:** Every migration has an `up` and a `down` path.
**Rationale:** Enables rollback of agent-introduced schema changes.
**Enforcement:** Migration file structure check (structural test verifying `down` method exists). For Go: `golangci-migrate` convention check.

### GP-37: No Raw SQL Outside Data Layer
**Rule:** SQL queries only exist in the data access layer.
**Rationale:** Centralizes data access patterns and prevents leakage.
**Enforcement:** Semgrep `no-database-access-in-routes` rule (see Appendix D). Custom linter checking import patterns.

---

## Concurrency Principles

### GP-38: No Unbounded Parallelism
**Rule:** Parallel operations have explicit concurrency limits.
**Rationale:** Prevents resource exhaustion in agent-generated parallel workflows.
**Enforcement:** Code review + Semgrep pattern matching `Promise.all` / `Promise.allSettled` without explicit concurrency limiter. For Python: custom Ruff rule matching `asyncio.gather` without semaphore.

### GP-39: Timeouts on All External Calls
**Rule:** Every external API call and database query has an explicit timeout.
**Rationale:** Prevents hanging in agent-driven workflows.
**Enforcement:** Custom linter checking `fetch`/`httpx`/`net/http` call configurations for timeout parameter. Semgrep rule matching unbounded HTTP calls.

---

## Configuration Principles

### GP-40: Configuration via Environment Variables
**Rule:** All configuration comes from environment variables with defaults.
**Rationale:** Enables consistent configuration across environments.
**Enforcement:** Semgrep rule flagging hardcoded URLs and port numbers outside config files. For Python: custom Ruff rule matching `os.environ` access without fallback.

### GP-41: Configuration Validated at Startup
**Rule:** All config values are validated when the application starts.
**Rationale:** Fails fast on misconfiguration rather than at runtime.
**Enforcement:** Startup test + GP-57 (Schema-Validated Configuration) enforcement. For Python: Pydantic `BaseSettings` validation at import time.

---

## Additional Principles (GP-42 through GP-50)

### GP-42: No Console Logging in Production
**Rule:** `console.log`, `console.warn`, and `console.error` are prohibited in source code. Use the structured logger.
**Rationale:** Console output bypasses structured logging, making it invisible to monitoring and agent verification.
**Enforcement:** ESLint `no-console` rule. For Python: Ruff `T20` (print found) + `T201` (print). For Go: `golangci-lint forbidigo` banning `fmt.Println`.
```javascript
// .eslintrc.js
rules: {
  'no-console': ['error', { allow: ['warn', 'error'] }]
}
```

### GP-43: Named Constants for Magic Numbers
**Rule:** Numeric literals other than 0 and 1 must be extracted into named constants.
**Rationale:** Magic numbers are illegible to agents — they can't determine intent from `86400` but can from `SECONDS_PER_DAY`.
**Enforcement:** Custom ESLint rule `no-magic-numbers`. For Python: Ruff `PLR2004` (magic value comparison). For Go: `golangci-lint gomnd`.
```javascript
// BAD
setTimeout(refreshToken, 3600000);

// GOOD
const TOKEN_REFRESH_INTERVAL_MS = 3_600_000; // 1 hour
setTimeout(refreshToken, TOKEN_REFRESH_INTERVAL_MS);
```

### GP-44: Feature Flags for New Behavior
**Rule:** All new user-facing behavior is gated behind a feature flag.
**Rationale:** Enables rollback of agent-introduced features without redeployment.
**Enforcement:** Config validation test. Semgrep rule matching new route definitions without corresponding flag check.
```typescript
// Feature flag pattern
const flags = {
  enableNewDashboard: env.bool('ENABLE_NEW_DASHBOARD', false),
  maxExportRows: env.int('MAX_EXPORT_ROWS', 10_000),
};

// Usage in route handler
if (!flags.enableNewDashboard) {
  return legacyDashboard(req, res);
}
```

### GP-45: Graceful Degradation on Dependency Failure
**Rule:** When a non-critical dependency fails, the system degrades gracefully rather than crashing.
**Rationale:** Agent-generated code often lacks defensive handling of partial failures.
**Enforcement:** Code review + Semgrep rule matching service calls without try/catch fallback. For Go: `golangci-lint exhaustive` on error switch statements.
```typescript
// Pattern: try/catch with fallback for non-critical services
async function getRecommendations(userId: string): Promise<Product[]> {
  try {
    return await recommendationService.get(userId);
  } catch (error) {
    logger.warn({ error, userId }, 'Recommendation service unavailable, using fallback');
    return getPopularProducts(); // Graceful fallback
  }
}
```

### GP-46: Rate Limiting on Public Endpoints
**Rule:** All publicly accessible API endpoints have rate limiting configured.
**Rationale:** Prevents abuse through agent-generated API surfaces that may lack throttling.
**Enforcement:** Integration test verifying rate limit headers. Semgrep rule matching route registrations without rate-limit middleware.
```typescript
// Rate limiting middleware
app.use(rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', retryAfter: '60s' },
}));
```

### GP-47: Request IDs on All API Calls
**Rule:** Every incoming request is assigned a unique ID that appears in all logs and responses.
**Rationale:** Enables tracing of agent actions across distributed systems.
**Enforcement:** Middleware integration test + Semgrep rule verifying request-ID propagation in downstream fetch calls.
```typescript
// Request ID middleware
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  logger.defaultMeta = { ...logger.defaultMeta, requestId };
  next();
});
```

### GP-48: Health Check Endpoints
**Rule:** Services expose `/health` (liveness) and `/ready` (readiness) endpoints.
**Rationale:** Enables automated deployment verification and agent-accessible state checks.
**Enforcement:** Integration test. For Go: `grpc_health_v1` registration check. Semgrep matching services without `/health` route.
```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/ready', async (req, res) => {
  const checks = await Promise.all([
    db.query('SELECT 1').then(() => ({ db: 'ok' })).catch(() => ({ db: 'fail' })),
    redis.ping().then(() => ({ redis: 'ok' })).catch(() => ({ redis: 'fail' })),
  ]);
  const allOk = checks.every(c => Object.values(c)[0] === 'ok');
  res.status(allOk ? 200 : 503).json({ checks });
});
```

### GP-49: Version Endpoint
**Rule:** Services expose `/version` returning build commit, version, and build time.
**Rationale:** Enables agents to verify which version is deployed without shell access.
**Enforcement:** Integration test verifying JSON fields present. Structural test matching `/version` route registration.
```typescript
app.get('/version', (req, res) => {
  res.json({
    version: process.env.APP_VERSION || 'dev',
    commit: process.env.GIT_COMMIT || 'unknown',
    buildTime: process.env.BUILD_TIME || 'unknown',
  });
});
```

### GP-50: No Stale TODO Comments
**Rule:** TODO comments older than 30 days are flagged as errors.
**Rationale:** Stale TODOs accumulate as entropy — agents read them as valid work items.
**Enforcement:** Custom linter checking comment dates. For Python: `todo-ticket` Ruff plugin. For Go: `golangci-lint godox` with custom threshold.
```javascript
// GOOD: TODO with date and owner
// TODO(2026-04-15, @alice): Replace with streaming parser for large payloads

// BAD: TODO without context
// TODO: fix this later
```

---

## Extended Principles (GP-51 through GP-60)

### GP-51: No Deeply Nested Conditionals
**Rule:** Control flow nesting must not exceed 3 levels. Use early returns and guard clauses.
**Rationale:** Deeply nested code is illegible to agents and error-prone to modify.
**Enforcement:** ESLint `max-depth` rule. For Python: Ruff `PLR0912` (too many branches) + `C901` (complexity). For Go: `golangci-lint nestif`.
```typescript
// BAD
function processOrder(order: Order) {
  if (order) {
    if (order.items.length > 0) {
      if (order.payment) {
        // 3+ levels deep
      }
    }
  }
}

// GOOD
function processOrder(order: Order) {
  if (!order) throw new AppError('ORDER_REQUIRED');
  if (order.items.length === 0) throw new AppError('ORDER_EMPTY');
  if (!order.payment) throw new AppError('PAYMENT_REQUIRED');
  // Happy path at top level
}
```

### GP-52: Immutable Data in Functions
**Rule:** Functions must not mutate their input arguments.
**Rationale:** Mutation makes agent reasoning about state changes unreliable.
**Enforcement:** ESLint `no-param-reassign`. For Python: custom Ruff rule or `pytest-mock` assertion verification. For Go: enforced by value-semantics convention + code review.
```typescript
// BAD
function addTax(order: Order) {
  order.total = order.total * 1.1; // Mutates input
  return order;
}

// GOOD
function withTax(order: Order): Order {
  return { ...order, total: order.total * 1.1 };
}
```

### GP-53: Explicit Enum for Status Fields
**Rule:** Status and state fields use string enums, not magic strings or booleans.
**Rationale:** Agents can discover all valid states from the enum definition.
**Enforcement:** Semgrep rule matching string literal comparisons on known status fields. For Python: Ruff `RUF001` + custom check. For Go: `golangci-lint exhaustive` on switch statements.
```typescript
enum OrderStatus {
  Pending = 'PENDING',
  Confirmed = 'CONFIRMED',
  Shipped = 'SHIPPED',
  Delivered = 'DELIVERED',
  Cancelled = 'CANCELLED',
}
```

### GP-54: No Catch-All Error Types
**Rule:** Error types must be specific (not catching `Error` broadly in service code).
**Rationale:** Generic catch blocks hide specific failures that agents should handle differently.
**Enforcement:** Custom ESLint rule or Semgrep matching `catch (error)` without `instanceof` branching. For Python: Ruff `BLE001` (blind except).
```typescript
// BAD
catch (error) { /* what kind of error? */ }

// GOOD
} catch (error) {
  if (error instanceof ValidationError) { /* handle validation */ }
  else if (error instanceof DatabaseError) { /* handle DB */ }
  else { throw error; } // Unexpected error, let it propagate
}
```

### GP-55: Dependency Injection for External Services
**Rule:** External services (APIs, databases, email) are injected, not imported directly in business logic.
**Rationale:** Enables testability and prevents agents from hardcoding service dependencies.
**Enforcement:** Semgrep rule matching direct `import` of HTTP/DB clients in service files. For Go: `golangci-lint` checking interface acceptance in constructors.
```typescript
// Service accepts dependencies via constructor
class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly emailService: EmailService,
    private readonly eventBus: EventBus,
  ) {}
}
```

### GP-56: No Sleep or Fixed Waits
**Rule:** `setTimeout` with fixed delays for synchronization is prohibited. Use events, polling with backoff, or promises.
**Rationale:** Fixed waits are fragile and waste time — agents frequently introduce them as "quick fixes."
**Enforcement:** ESLint `no-restricted-syntax` banning `setTimeout` with large constants. For Python: Ruff `TDEM001` or custom rule matching `time.sleep`. For Go: `golangci-lint` custom check for `time.Sleep` in non-test code.
```typescript
// BAD
await sleep(5000); // Wait for DB to be ready

// GOOD
await waitForDatabase({ maxRetries: 10, initialDelayMs: 100, backoffMultiplier: 2 });
```

### GP-57: Schema-Validated Configuration
**Rule:** All configuration values are validated against a schema at startup.
**Rationale:** Fails fast on misconfiguration — the agent learns about config errors immediately.
**Enforcement:** Startup test. For Python: Pydantic `BaseSettings` with `model_config` validation. For Go: custom config struct with `Validate() error` method enforced by linter.
```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  databaseUrl: z.string().url(),
  jwtSecret: z.string().min(32),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const config = ConfigSchema.parse(process.env);
```

### GP-58: Timestamps on All Mutable Records
**Rule:** Every mutable database record has `createdAt` and `updatedAt` fields.
**Rationale:** Enables temporal queries and debugging of agent-introduced data issues.
**Enforcement:** Migration schema check (structural test verifying timestamp columns). Semgrep rule matching model definitions without timestamp fields.

### GP-59: No God Objects or God Functions
**Rule:** No class exceeds 10 public methods. No module exports more than 15 functions.
**Rationale:** God objects are illegible to agents — too many responsibilities to reason about.
**Enforcement:** Custom ESLint rule counting exported members. For Python: Ruff `PLR0904` (too many public methods). For Go: `golangci-lint gocognit` + custom struct method count check.

### GP-60: Composition Over Inheritance
**Rule:** Prefer composition (has-a) over inheritance (is-a). Class hierarchy depth must not exceed 2.
**Rationale:** Deep inheritance hierarchies are illegible to agents and create fragile coupling.
**Enforcement:** Custom ESLint rule checking `extends` chain depth. For Python: custom Ruff rule matching class inheritance depth > 2. For Go: enforced by lack of inheritance (composition only).

---

## How to Use This Library

1. **Select principles relevant to your project** — not all 50+ apply to every codebase
2. **Encode each selected principle as a linter rule or structural test** — if it can't be mechanically checked, it's a guideline, not a principle
3. **Start with the most impactful** — GP-01 (dependencies), GP-09 (error remediation), GP-13 (structured logging), GP-16 (test pairing), GP-23 (no secrets)
4. **Add principles incrementally** — observe agent failure modes and add rules to prevent recurrence
5. **Review quarterly** — remove rules that are no longer relevant, add new ones for emerging patterns
