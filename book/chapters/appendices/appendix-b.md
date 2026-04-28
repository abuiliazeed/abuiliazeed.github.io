# Appendix B: AGENTS.md Templates

*Copy-paste ready templates for common project types. Adapt to your specific needs.*

---

## Template 1: TypeScript API Service

```markdown
# Project Overview

[SERVICE_NAME] is a TypeScript API service that [DESCRIPTION].
Built with Express, PostgreSQL, and Redis.

# Architecture

## Dependency Layers (enforced by linter)
- `src/types/` — Shared type definitions (no imports from other src/ dirs)
- `src/config/` — Configuration and environment (imports from types only)
- `src/data/` — Data access layer (imports from types, config)
- `src/services/` — Business logic (imports from types, config, data)
- `src/runtime/` — Server setup, middleware (imports from all layers)
- `src/routes/` — API route handlers (imports from services, types)

## Rules
- Dependencies flow inward: routes → services → data → config → types
- No circular dependencies (enforced by structural test)
- All API responses follow: `{ data: T | null, error: ErrorBody | null, meta: Meta }`

# Commands

- `npm test` — Run all tests (required before PR)
- `npm run test:watch` — Run tests in watch mode
- `npm run lint` — Run ESLint (must pass with zero errors)
- `npm run lint:fix` — Auto-fix linting issues
- `npm run build` — Compile TypeScript (must succeed)
- `npm run dev` — Start dev server with hot reload
- `npm run db:migrate` — Run pending migrations
- `npm run db:seed` — Seed development data

# Code Style

- TypeScript strict mode enabled (no `any` types)
- All functions have explicit return types
- Use async/await, not raw Promises
- Named exports preferred over default exports
- Use `const` over `let` when possible

# Error Handling

- All errors use custom AppError class with error code and remediation
- Never catch and swallow errors silently
- All catch blocks log structured error with context
- API errors return RFC 7807 Problem Details format

# Testing

- Test files live in `tests/` mirroring `src/` structure
- Use Jest with describe/it pattern
- Every service function has at least one test
- API endpoints have integration tests
- Use test fixtures from `tests/fixtures/`
- Mock external services, never real network calls in tests

# PR Conventions

- Title: `[area] description` (e.g., `[auth] add JWT refresh token rotation`)
- Description must include: What, Why, How to verify
- All linters and tests must pass
- No direct pushes to main
- Minimum one reviewer for non-trivial changes

# Security

- Never commit secrets or credentials
- Use environment variables for all configuration
- All user inputs validated with zod schemas
- SQL queries use parameterized statements only
- See docs/security.md for detailed guidelines
```

---

## Template 2: Python Data Pipeline

```markdown
# Project Overview

[PROJECT_NAME] is a data pipeline that [DESCRIPTION].
Built with Python 3.12, Apache Airflow, and PySpark.

# Architecture

## Module Structure
- `dags/` — Airflow DAG definitions
- `pipelines/` — Pipeline implementations
- `transforms/` — Data transformation functions
- `models/` — Data models (Pydantic)
- `utils/` — Shared utilities
- `tests/` — Test suite

## Rules
- DAGs define orchestration only, no business logic
- Business logic lives in pipelines/ and transforms/
- All data models use Pydantic for validation
- No direct SQL in pipeline code — use data access layer

# Commands

- `pytest` — Run all tests
- `pytest tests/test_pipelines/` — Run pipeline tests only
- `ruff check .` — Run linter
- `ruff check --fix .` — Auto-fix linting issues
- `mypy .` — Type checking
- `python -m dags.validate` — Validate DAG definitions

# Code Style

- Python 3.12+ features encouraged (type hints, dataclasses, match)
- Use type hints for all function signatures
- Docstrings on all public functions (Google style)
- f-strings for formatting (not .format() or %)
- Line length: 100 characters max

# Data Handling

- All data validated at ingestion boundaries (Pydantic models)
- No silent data dropping — log and alert on validation failures
- Immutable data frames — never modify in-place
- Use explicit column selections (no `select *`)

# Testing

- Test files mirror source: `tests/pipelines/test_xxx.py`
- Use pytest fixtures for test data
- Mock external data sources
- Every pipeline has at least one integration test
- DAG validation tests ensure DAGs parse correctly

# PR Conventions

- Title: `[area] description` (e.g., `[etl] add customer aggregation pipeline`)
- Include data lineage documentation for new pipelines
- All linters, type checks, and tests must pass
```

---

## Template 3: Monorepo (with subdirectory AGENTS.md)

### Root AGENTS.md

```markdown
# Monorepo Overview

This monorepo contains multiple packages and services.

# Structure
- `packages/shared/` — Shared libraries
- `services/api/` — API service (see services/api/AGENTS.md)
- `services/web/` — Web frontend (see services/web/AGENTS.md)
- `infra/` — Infrastructure as code

# Commands
- `npm run build` — Build all packages
- `npm test` — Run all tests
- `npm run lint` — Lint all packages
- `npm run changeset` — Create a changeset for versioning

# Rules
- Packages must not have circular dependencies
- Breaking changes require a changeset and migration guide
- All packages follow the same linting rules
```

### services/api/AGENTS.md

```markdown
# API Service

[Additional instructions specific to the API service]

# Commands
- `npm run dev:api` — Start API dev server
- `npm test -- --project=api` — Run API tests only

# Patterns
- All endpoints documented with OpenAPI annotations
- Use shared types from packages/shared/
- Follow REST conventions for endpoint naming
```

---

## Template 4: Minimal (for prototypes and experiments)

```markdown
# [Project Name]

[One-line description]

# Commands
- `npm test` — Run tests
- `npm run dev` — Start dev server
- `npm run build` — Build for production

# Rules
- Write tests for new features
- Use TypeScript strict mode
- Keep functions under 40 lines
```

---

## Template 5: Microservice (Go)

```markdown
# Project Overview

[SERVICE_NAME] is a Go microservice that [DESCRIPTION].
Built with Go 1.22, gRPC, and PostgreSQL.
Part of the [PLATFORM] distributed system.

# Architecture

## Dependency Layers (enforced by linter)
- `internal/domain/` — Domain types and interfaces (no external imports)
- `internal/config/` — Configuration loading (imports domain only)
- `internal/store/` — Data access / repository layer (imports domain, config)
- `internal/service/` — Business logic (imports domain, store)
- `internal/transport/` — gRPC/HTTP handlers (imports service, domain)
- `cmd/` — Entrypoint (imports all layers)

## Rules
- Dependencies flow inward: transport → service → store → config → domain
- No circular dependencies (enforced by `go vet` + custom check)
- All gRPC responses follow standard error wrapping with codes
- Domain layer has ZERO external dependencies

# Commands

- `go test ./...` — Run all tests (required before PR)
- `go test -race ./...` — Run tests with race detector
- `golangci-lint run` — Run all linters (must pass with zero errors)
- `buf generate` — Generate gRPC/Protobuf code
- `go build ./cmd/service` — Build the service binary
- `docker build -t service .` — Build Docker image
- `go run ./cmd/service` — Run locally with defaults
- `make migrate-up` — Run database migrations
- `make migrate-down` — Rollback last migration

# Code Style

- Follow Effective Go guidelines
- All exported functions have doc comments
- Use structured errors with `fmt.Errorf("functionName: %w", err)` wrapping
- Context passed as first parameter to all functions that do I/O
- Interfaces defined by consumers, not producers
- Return structs, accept interfaces
- No `init()` functions
- No package-level mutable state

# Error Handling

- All errors use structured error wrapping
- gRPC errors use standard status codes
- Never log and return an error (pick one)
- Internal errors include remediation hints in structured fields
- Error codes defined in `internal/domain/errors.go`

# Testing

- Test files live alongside source: `user_test.go` next to `user.go`
- Use table-driven tests for all functions with multiple cases
- Every gRPC method has an integration test
- Mock external services using interfaces + generated mocks
- Test fixtures in `testdata/` directories
- Target >80% coverage on service and store layers

# gRPC Conventions

- All proto files in `api/proto/`
- Proto field names use snake_case
- Go field names are generated as CamelCase
- All services have a corresponding health check
- Use streaming for list operations exceeding 100 items

# PR Conventions

- Title: `area: description` (e.g., `store: add connection pooling`)
- All linters and tests must pass
- gRPC changes require proto file review
- Database changes require migration review
- No direct pushes to main

# Security

- Never commit secrets (use Vault or env vars)
- All inter-service communication uses mTLS
- Input validation at transport layer
- SQL queries use sqlc or parameterized queries only
- See docs/security.md for threat model
```

---

## Template 6: Open-Source Library (TypeScript)

```markdown
# Project Overview

[LIBRARY_NAME] is a TypeScript library that [DESCRIPTION].
Published on npm as `@[scope]/[name]`.

# Architecture

## Structure
- `src/index.ts` — Main entry point and public API
- `src/core/` — Core implementation (no side effects)
- `src/utils/` — Internal utilities (not exported)
- `src/types/` — Public type definitions
- `tests/` — Test suite
- `docs/` — API documentation
- `examples/` — Usage examples

## Rules
- Public API is only what's exported from `src/index.ts`
- No side effects in core functions (pure functions preferred)
- Zero runtime dependencies (dev dependencies only)
- Bundle size budget: <10KB gzipped
- All exported types are documented

# Commands

- `npm test` — Run all tests (required before PR)
- `npm run test:watch` — Run tests in watch mode
- `npm run lint` — Run ESLint (must pass)
- `npm run build` — Build with rollup/vite
- `npm run check:types` — Type checking without emit
- `npm run check:size` — Verify bundle size budget
- `npm run docs:build` — Generate API docs

# Code Style

- TypeScript strict mode (no `any` types)
- All public functions have JSDoc with `@example`
- Use generic constraints for type safety
- Prefer composition over inheritance
- Named exports only (no default exports)
- All async functions return Promise<T>

# API Design

- Functions accept a single options object (not positional params)
- Options objects have readonly properties
- All options have sensible defaults
- Throw typed errors with error codes
- Never mutate input arguments

# Testing

- Test files in `tests/` directory
- Use vitest with describe/it pattern
- Every exported function has at least 3 tests (happy path, edge case, error)
- Test bundle output with integration test
- No test-only dependencies in production code

# PR Conventions

- Title: conventional commit format (`feat:`, `fix:`, `docs:`, `chore:`)
- Breaking changes require `feat!:` and a migration guide
- All exported changes update `docs/` accordingly
- CI must pass (lint, test, build, size check)
- Squash merge preferred

# Publishing

- Semantic versioning (semver) strictly followed
- Changesets used for version tracking
- Changelog auto-generated from PR titles
- npm publish via CI only (never manual)
```

---

## Template 7: Startup MVP (Full-Stack TypeScript)

```markdown
# Project Overview

[PRODUCT_NAME] is a full-stack TypeScript application.
Frontend: Next.js 14 (App Router). Backend: Next.js API routes + Supabase.
Shipping fast, paying down technical debt weekly.

# Architecture

## Structure
- `app/` — Next.js App Router pages and API routes
- `app/(auth)/` — Auth-related pages
- `app/(dashboard)/` — Main application pages
- `app/api/` — API route handlers
- `lib/` — Shared utilities and helpers
- `lib/db/` — Database queries and types
- `lib/auth/` — Authentication helpers
- `components/` — React components
- `components/ui/` — Base UI components (shadcn)
- `hooks/` — Custom React hooks
- `types/` — Shared TypeScript types

## Rules
- API routes are thin: validate → call lib function → return
- All database queries in `lib/db/` (never inline SQL in routes)
- Server components by default, client only when needed
- Keep bundle small — dynamic import heavy components

# Commands

- `npm run dev` — Start dev server (http://localhost:3000)
- `npm run build` — Production build (must succeed)
- `npm run lint` — Run ESLint and Next.js lint
- `npm test` — Run tests
- `npm run db:types` — Generate types from Supabase schema
- `npm run db:reset` — Reset local database

# Code Style

- TypeScript strict mode
- Use Server Actions for mutations
- Prefer `const` and immutable patterns
- Use Zod for all form and API validation
- Tailwind CSS for styling (no custom CSS files)
- Colocate related files (component + test + stories together)

# Authentication

- Supabase Auth for all authentication
- Server-side session validation on every protected route
- Role-based access control in `lib/auth/roles.ts`
- Never trust client-side role checks alone

# Testing

- Vitest for unit tests
- Playwright for E2E tests (critical paths only)
- Every lib function has a unit test
- API routes have integration tests

# PR Conventions

- Title: brief description of change
- Deploy previews auto-generated
- Fix forward preferred over revert (we can always revert)
- Ship it, measure it, fix it

# Speed Rules

- Favor shipping over perfection
- Add tests for critical paths, not every path
- Lint rules are suggestions during sprint, enforcement before release
- Document decisions in PR description, not separate docs
- Pay down debt every Friday (2-hour scheduled cleanup)
```

---

## Template 8: Rust Service

```markdown
# Project Overview

[SERVICE_NAME] is a Rust service that [DESCRIPTION].
Built with Actix-web, SQLx, and Redis.

# Architecture

## Dependency Layers (enforced by cfg and module visibility)
- `src/domain/` — Domain types and traits (no external crate deps in types)
- `src/config/` — Configuration (imports domain)
- `src/repo/` — Repository / data access (imports domain, config)
- `src/service/` — Business logic (imports domain, repo)
- `src/handler/` — HTTP handlers (imports service, domain)
- `src/main.rs` — Entrypoint (wires everything together)

## Rules
- Domain types have no external crate dependencies
- All trait implementations are explicit (no magic derives beyond Debug/Clone)
- Error types use `thiserror` with structured variants
- Database queries use sqlx compile-time checked macros

# Commands

- `cargo test` — Run all tests (required before PR)
- `cargo test -- --nocapture` — Run tests with output
- `cargo clippy -- -D warnings` — Run linter (zero warnings allowed)
- `cargo fmt --check` — Check formatting (must pass)
- `cargo build --release` — Release build
- `cargo audit` — Check for known vulnerabilities
- `cargo sqlx prepare` — Update sqlx offline query data

# Code Style

- Follow Rust API Guidelines (https://rust-lang.github.io/api-guidelines/)
- All public items have doc comments with examples
- Use `Result<T, E>` everywhere (no unwrap in library/service code)
- Prefer `&str` parameters, return `String`
- Use `impl Trait` for return types only in handlers
- Error chain uses `.context()` or `thiserror` `#[from]`

# Error Handling

- All errors implement `std::error::Error`
- HTTP errors mapped via `actix_web::error::ResponseError`
- Error variants include context for debugging
- Never expose internal error details to clients

# Testing

- Unit tests in same file (`#[cfg(test)] mod tests`)
- Integration tests in `tests/` directory
- Every handler has at least one integration test
- Use test fixtures for database state
- Mock external services with trait-based mocks

# PR Conventions

- Title: `area: description` (e.g., `repo: add connection pooling`)
- `cargo fmt`, `cargo clippy`, `cargo test` must all pass
- Database changes require migration review
- No direct pushes to main
```

---

## Template 9: Python FastAPI Service

```markdown
# Project Overview

[SERVICE_NAME] is a Python FastAPI service that [DESCRIPTION].
Built with Python 3.12, FastAPI, SQLAlchemy, and Redis.

# Architecture

## Dependency Layers (enforced by import-linter + Ruff)
- `schemas/` — Pydantic request/response schemas (no business logic imports)
- `models/` — SQLAlchemy ORM models (imports from schemas only)
- `repositories/` — Data access layer (imports from models, schemas)
- `services/` — Business logic (imports from repositories, models, schemas)
- `routers/` — API route handlers (imports from services, schemas only)
- `core/` — Configuration, auth, middleware (imports from nothing in src/)

## Rules
- Dependencies flow inward: routers → services → repositories → models → schemas
- No circular dependencies (enforced by import-linter)
- All API responses follow: `{"data": ..., "error": ..., "meta": {...}}`
- Ruff line-length: 100 characters

# Commands

- `pytest` — Run all tests (required before PR)
- `pytest --cov=src --cov-report=term-missing` — Run tests with coverage
- `ruff check .` — Run linter (must pass with zero errors)
- `ruff check --fix .` — Auto-fix linting issues
- `mypy src/` — Type checking (strict mode)
- `uvicorn app.main:app --reload` — Start dev server
- `alembic upgrade head` — Run pending migrations
- `alembic revision --autogenerate -m "desc"` — Create new migration
- `docker compose up -d` — Start local dependencies (Postgres, Redis)

# Code Style

- Python 3.12+ features encouraged (type hints, dataclasses, match)
- Use type hints for all function signatures
- Docstrings on all public functions (Google style)
- f-strings for formatting (not .format() or %)
- Line length: 100 characters max
- Use `async def` for all route handlers and I/O-bound functions
- Prefer Pydantic models over raw dicts for all data structures

# Error Handling

- All errors use custom AppError with error code and remediation hint
- Never catch and swallow exceptions silently
- All exception handlers log structured error with correlation ID
- API errors return RFC 7807 Problem Details format
- Error codes defined as enums in `core/errors.py`

# Testing

- Test files mirror source: `tests/routers/test_users.py`
- Use pytest fixtures for database and client setup
- Mock external services with `pytest-mock`
- Every service function has at least one unit test
- API endpoints have integration tests via `httpx.AsyncClient`
- Use factory_boy or similar for test data generation

# PR Conventions

- Title: `[area] description` (e.g., `[auth] add JWT refresh token rotation`)
- Description must include: What, Why, How to verify
- All linters, type checks, and tests must pass
- No direct pushes to main
- Minimum one reviewer for non-trivial changes

# Security

- Never commit secrets (use .env + python-dotenv)
- All inputs validated with Pydantic schemas at router level
- SQL queries use SQLAlchemy ORM or parameterized statements only
- CORS configured explicitly, never `*` in production
```

---

## Template 10: Go Microservice

```markdown
# Project Overview

[SERVICE_NAME] is a Go microservice that [DESCRIPTION].
Built with Go 1.22, gRPC, and PostgreSQL.
Part of the [PLATFORM] distributed system.

# Architecture

## Dependency Layers (enforced by linter)
- `internal/domain/` — Domain types and interfaces (no external imports)
- `internal/config/` — Configuration loading (imports domain only)
- `internal/store/` — Data access / repository layer (imports domain, config)
- `internal/service/` — Business logic (imports domain, store)
- `internal/transport/` — gRPC/HTTP handlers (imports service, domain)
- `cmd/` — Entrypoint (imports all layers)

## Rules
- Dependencies flow inward: transport → service → store → config → domain
- No circular dependencies (enforced by `go vet` + custom check)
- All gRPC responses follow standard error wrapping with codes
- Domain layer has ZERO external dependencies

# Commands

- `go test ./...` — Run all tests (required before PR)
- `go test -race ./...` — Run tests with race detector
- `golangci-lint run` — Run all linters (must pass with zero errors)
- `buf generate` — Generate gRPC/Protobuf code
- `go build ./cmd/service` — Build the service binary
- `docker build -t service .` — Build Docker image
- `go run ./cmd/service` — Run locally with defaults
- `make migrate-up` — Run database migrations
- `make migrate-down` — Rollback last migration

# Code Style

- Follow Effective Go guidelines
- All exported functions have doc comments
- Use structured errors with `fmt.Errorf("functionName: %w", err)` wrapping
- Context passed as first parameter to all functions that do I/O
- Interfaces defined by consumers, not producers
- Return structs, accept interfaces
- No `init()` functions
- No package-level mutable state

# Error Handling

- All errors use structured error wrapping
- gRPC errors use standard status codes
- Never log and return an error (pick one)
- Internal errors include remediation hints in structured fields
- Error codes defined in `internal/domain/errors.go`

# Testing

- Test files live alongside source: `user_test.go` next to `user.go`
- Use table-driven tests for all functions with multiple cases
- Every gRPC method has an integration test
- Mock external services using interfaces + generated mocks
- Test fixtures in `testdata/` directories
- Target >80% coverage on service and store layers

# gRPC Conventions

- All proto files in `api/proto/`
- Proto field names use snake_case
- Go field names are generated as CamelCase
- All services have a corresponding health check
- Use streaming for list operations exceeding 100 items

# PR Conventions

- Title: `area: description` (e.g., `store: add connection pooling`)
- All linters and tests must pass
- gRPC changes require proto file review
- Database changes require migration review
- No direct pushes to main

# Security

- Never commit secrets (use Vault or env vars)
- All inter-service communication uses mTLS
- Input validation at transport layer
- SQL queries use sqlc or parameterized queries only
- See docs/security.md for threat model
```

---

## Template 11: Rust CLI Tool

```markdown
# Project Overview

[TOOL_NAME] is a Rust CLI tool that [DESCRIPTION].
Built with Rust 1.78, Clap for argument parsing, and Tokio for async runtime.

# Architecture

## Module Structure (enforced by cfg and module visibility)
- `src/config.rs` — CLI argument parsing and configuration (no src/ deps)
- `src/domain/` — Core domain types and traits (no external crate deps)
- `src/io/` — File system and network I/O (imports domain)
- `src/transform/` — Data transformation logic (imports domain)
- `src/output/` — Formatting and output rendering (imports domain, config)
- `src/main.rs` — Entrypoint (wires modules together)

## Rules
- Domain types have no external crate dependencies
- All trait implementations are explicit (no magic derives beyond Debug/Clone)
- Error types use `thiserror` with structured variants
- No `unwrap()` in library or CLI code (tests only)

# Commands

- `cargo test` — Run all tests (required before PR)
- `cargo test -- --nocapture` — Run tests with output visible
- `cargo clippy -- -D warnings` — Run linter (zero warnings allowed)
- `cargo fmt --check` — Check formatting (must pass)
- `cargo build --release` — Release build
- `cargo run -- [args]` — Run the tool locally
- `cargo install --path .` — Install locally for testing
- `cargo audit` — Check for known vulnerabilities

# Code Style

- Follow Rust API Guidelines (https://rust-lang.github.io/api-guidelines/)
- All public items have doc comments with examples
- Use `Result<T, E>` everywhere (no unwrap in non-test code)
- Prefer `&str` parameters, return `String`
- Use `impl Trait` for return types only in handlers
- Error chain uses `.context()` or `thiserror` `#[from]`
- Prefer iterators over explicit loops

# Error Handling

- All errors implement `std::error::Error`
- CLI errors mapped to exit codes: 0=success, 1=usage, 2=runtime
- Error output goes to stderr, never stdout
- Structured error output with `--format json` flag
- Never expose internal panic messages to users

# Testing

- Unit tests in same file (`#[cfg(test)] mod tests`)
- Integration tests in `tests/` directory
- Use `assert_cmd` crate for CLI integration tests
- Use `tempfile` for file system tests
- Every public function has at least one test
- Test error paths explicitly (bad input, missing files, etc.)

# PR Conventions

- Title: `area: description` (e.g., `io: add streaming JSON parser`)
- `cargo fmt`, `cargo clippy`, `cargo test` must all pass
- No direct pushes to main
- Breaking CLI changes require major version bump discussion
```

---

## Quick Reference: AGENTS.md Sections

| Section | Required? | Typical Length |
|---|---|---|
| Project Overview | Yes | 2–3 sentences |
| Architecture | Yes | 5–10 lines |
| Commands | Yes | 5–10 commands |
| Code Style | Recommended | 5–8 rules |
| Testing | Recommended | 3–5 rules |
| PR Conventions | Recommended | 3–5 rules |
| Security | For production code | 3–5 rules |
| Domain-Specific | Optional | Varies |

---

## Customization Checklist

When adapting these templates for your project, ensure you:

1. **Replace all placeholders** — `[SERVICE_NAME]`, `[DESCRIPTION]`, `[PROJECT_NAME]` must be replaced with real values before committing.
2. **Verify all commands work** — Every command listed must be runnable from the project root. Test them manually after creating the file.
3. **Match your actual architecture** — The layer descriptions must reflect your real directory structure. If they don't match, the agent will be confused.
4. **Add domain-specific rules** — If your domain has unique constraints (financial calculations, healthcare data, game physics), add a section for them.
5. **Keep it under 100 lines** — The AGENTS.md file should be a table of contents, not a manual. Link to detailed docs for deeper information.
6. **Test with your agent** — After creating the file, prompt the agent with a task and observe whether it follows the rules. Adjust based on what it misses.
7. **Update when architecture changes** — The AGENTS.md file is a living document. Add it to your review checklist when architecture changes are proposed.
8. **Validate in CI** — Add a CI check that verifies the AGENTS.md file exists and is non-empty. Consider validating its structure with a simple parser.
