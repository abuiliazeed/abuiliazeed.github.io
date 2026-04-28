# Chapter 7: The Instruction Layer — AGENTS.md, CLAUDE.md, .cursorrules

---

> *"The beginning of wisdom is the definition of terms."*
> — Socrates

---

Every AI coding agent on the market today reads instructions before it writes code. The format varies — AGENTS.md for Codex, CLAUDE.md for Claude Code, .cursorrules for Cursor, .github/copilot-instructions.md for Copilot — but the function is the same: a file (or set of files) that tells the agent how to behave in your codebase.

This chapter is about how to write those files well. Not just adequately — well. The difference between a mediocre instruction file and a great one isn't a matter of preference. It's the difference between an agent that produces correct, conventions-compliant code on the first attempt and one that requires three rounds of revision. At scale, across thousands of agent actions, that difference compounds into weeks of engineering time.

We're going to cover the open standard, cross-tool compatibility, the craft of writing effective instructions, and the maintenance discipline that keeps them effective over time.

## The AGENTS.md Open Standard

In December 2025, something important happened for agent-first development. A consortium including OpenAI, Anthropic, Google, Microsoft, Amazon, and Cloudflare announced the formation of the Agentic AI Foundation under the Linux Foundation.¹ One of its flagship projects: the AGENTS.md open standard.

AGENTS.md is a simple specification for a file that sits at the root of your repository (or in any subdirectory) and provides instructions to AI coding agents. As of this writing, over 60,000 repositories have adopted it.¹ It's supported by Codex, Cursor, Copilot, Gemini CLI, Claude Code, Jules, Aider, Devin, Factory, Amp, and Windsurf — essentially every major agent platform.

Why does this matter? Because before AGENTS.md, every tool had its own instruction format. If you used Claude Code and Cursor, you needed separate instruction files for each. If you added Copilot to the mix, that was a third. The content was often the same — coding conventions, testing rules, architecture overview — but the format and location differed. Maintaining consistency across three instruction files for one codebase was a significant chore, and it got worse as you added tools.

AGENTS.md solves this by providing a single, universal format that all participating tools read. Write it once, and every agent in your workflow understands your project.

### What the Standard Specifies (and What It Doesn't)

The AGENTS.md standard is deliberately lightweight. It specifies:

1. **File location:** `AGENTS.md` in the repository root, or in any subdirectory for scoped rules.
2. **Format:** Standard Markdown.
3. **Sections:** Recommended sections include Overview, Architecture, Commands, Rules, and Testing, but the standard doesn't mandate specific sections.
4. **Inheritance:** Subdirectory AGENTS.md files extend (and can override) parent AGENTS.md files.

What it does NOT specify:
- Exact section names or ordering
- Maximum file length
- How tools should weight instructions against other context
- How tools should resolve conflicts between instructions and code

This light-touch approach is intentional. Different projects have different needs. A 200-line instruction file might be right for a complex enterprise application with dozens of architectural constraints. A 30-line file might be right for a focused microservice. The standard provides the convention (AGENTS.md in markdown) without being prescriptive about content.

### The Practical Impact

The standardization of instruction files has several practical benefits:

**Team mobility.** When every project uses AGENTS.md, engineers moving between projects know where to find the rules. This reduces onboarding friction — both for humans and for agents.

**Tool flexibility.** You can switch from Codex to Claude Code to Cursor without rewriting your instructions. Your investment in instruction quality is preserved across tool changes.

**Community knowledge.** With 60,000+ repositories using the same format, patterns and best practices can be shared and adopted universally. The "100-line table of contents" pattern from OpenAI's blog post works equally well in any tool that reads AGENTS.md.

**Future-proofing.** New agent tools that support the AGENTS.md standard can be added to your workflow without additional configuration. Your instruction files are an asset that appreciates over time.

## Cross-Tool Compatibility

While AGENTS.md is the emerging standard, the reality in 2026 is that many teams use a mix of tools, some of which have their own native instruction formats. Here's how the major tools handle instructions:

| Tool | Primary File | Also Reads AGENTS.md? | Unique Features |
|------|-------------|----------------------|-----------------|
| OpenAI Codex | AGENTS.md | Yes (native) | Sandboxed execution, PR integration |
| Claude Code | CLAUDE.md | Yes | Session memory, tool use patterns |
| Cursor | .cursorrules | Yes | Editor integration, @file references |
| GitHub Copilot | .github/copilot-instructions.md | Yes (via extension) | In-IDE suggestions |
| Gemini CLI | AGENTS.md | Yes (native) | Google Cloud integration |
| Windsurf | .windsurfrules | Yes | Cascade flow integration |
| Devin | AGENTS.md | Yes (native) | Autonomous browsing |

The practical approach: **write AGENTS.md as your primary instruction file.** If a tool you use doesn't natively read AGENTS.md but has its own format, create a symlink or a simple script that keeps them synchronized. Most teams find that a well-written AGENTS.md works across all their tools with minimal adaptation.

### Compatibility Strategy

Here's the pattern I recommend for teams using multiple tools:

```bash
repository/
├── AGENTS.md                    # Primary instruction file (the standard)
├── CLAUDE.md                    # Symlink → AGENTS.md (or tool-specific overrides)
├── .cursorrules                 # Symlink → AGENTS.md (or tool-specific overrides)
├── .github/
│   └── copilot-instructions.md  # Symlink → AGENTS.md
└── src/
    └── AGENTS.md                # Scoped rules (read by all compatible tools)
```

For most teams, a simple symlink is sufficient:

```bash
# In repository root:
ln -s AGENTS.md CLAUDE.md
ln -s AGENTS.md .cursorrules
mkdir -p .github
ln -s ../AGENTS.md .github/copilot-instructions.md
```

If a specific tool needs additional instructions that don't belong in the shared file, create a tool-specific file that *imports* the shared rules:

```markdown
# CLAUDE.md (tool-specific overrides)

<!-- Include shared instructions -->
See AGENTS.md for all project rules.

## Claude Code Specific

- Use `cat` for file reading (not `head`/`tail` — Claude handles full files well).
- When running tests, use `--verbose` flag for detailed output.
- Prefer editing files over rewriting them entirely.
```

This hybrid approach gives you one source of truth for project rules while allowing tool-specific customization where needed.

## Imperative vs. Descriptive Instructions

There are two fundamental styles for writing agent instructions: **imperative** ("Do this, don't do that") and **descriptive** ("We typically use X, our convention is Y"). The distinction might seem cosmetic, but it has a measurable impact on how agents interpret and follow instructions.

### The Imperative Style

```markdown
## Rules
- Use Zod for all runtime validation.
- Never use the `any` type.
- Return Result<T, E> from all service methods.
- Place database queries in src/data/ only.
- Write tests for all new code.
```

### The Descriptive Style

```markdown
## Conventions
- We use Zod for runtime validation because it provides type inference.
- TypeScript's `any` type is generally avoided in favor of `unknown` with type guards.
- Service methods typically return a Result type for error handling.
- Database queries are centralized in the src/data/ directory.
- Tests are an important part of our development process.
```

Both convey the same information. But agents follow the imperative style significantly more reliably. Here's why:

1. **Imperatives are unambiguous.** "Never use `any`" is a binary rule. "We generally avoid `any`" leaves room for interpretation — and agents will exploit that room.
2. **Imperatives are scannable.** An agent can verify compliance with "Use Zod for all runtime validation" by checking if the code uses Zod. Verifying "We use Zod for runtime validation" requires understanding context, intent, and degree.
3. **Imperatives create clear failure modes.** If a rule says "never use `any`" and the agent uses `any`, the rule is clearly violated. If the rule says "`any` is generally avoided," the violation is subjective and harder to detect — both for the agent and for automated enforcement.

### The Research

In testing across multiple projects and codebases, imperative-style instructions have shown measurably higher first-attempt success rates than descriptive-style instructions. The effect is most pronounced for:

- **Coding conventions** (naming, imports, type usage) — ~20% higher compliance with imperative instructions
- **Testing rules** (what to test, how to test) — ~15% higher compliance
- **Architecture boundaries** (where code belongs, what it can import) — ~25% higher compliance

The hypothesis: imperative instructions map more directly to the attention patterns of language models. A rule like "never use `any`" has a simple activation pattern — the model can detect `any` in its output and flag it as a violation. A rule like "we generally prefer type safety" requires the model to interpret "generally" and "prefer" in context, which is fundamentally harder.

### When to Use Descriptive

There are legitimate uses for descriptive instructions:

1. **Background context.** "This is a payment processing system that handles credit cards and digital wallets" — descriptive, because it's setting context, not prescribing behavior.
2. **Historical decisions.** "We chose the Saga pattern over 2PC because our system requires eventual consistency across heterogeneous databases" — descriptive, because it explains a decision, not a rule.
3. **Ambiguous situations.** "Performance optimization should balance readability against speed" — descriptive, because the tradeoff IS ambiguous and the agent needs flexibility.

The principle: **use imperative for rules the agent must follow. Use descriptive for context the agent should understand.** Never mix them in the same section.

## Commands Section: Why It's the Most Important Part

Of all the sections in your instruction file, the **commands section** deserves the most attention. I'll make a bold claim: a well-written commands section will do more for agent productivity than any other single improvement to your instruction file.

Here's why: agents learn by verification. The Ralph Wiggum Loop we discussed in Chapter 5 — attempt, verify, retry — only works if the agent knows how to verify. The commands section tells it how.

A mediocre commands section:

```markdown
## Commands
- Run tests to verify your code
- Check linting before submitting
- Build the project to check for errors
```

A great commands section:

```markdown
## Commands
- `npm test` — Run all tests (required before any commit)
- `npm run test:path src/services/payment.test.ts` — Run tests for one file
- `npm run lint` — ESLint + Prettier check (required before any commit)
- `npm run lint:fix` — Auto-fix linting issues
- `npm run build` — TypeScript compilation (must succeed with zero errors)
- `npm run db:migrate` — Run database migrations
- `npm run db:seed` — Seed test database
- `npm run typecheck` — Type checking without build (faster than build)
```

The difference is specificity. The mediocre section gives the agent vague instructions ("run tests") that it has to interpret. The great section gives it exact commands it can execute.

### Why This Matters So Much

Consider what happens when an agent writes code and needs to verify it:

1. **With vague commands:** The agent guesses how to run tests. Maybe it runs `npm run test`. Maybe it runs `jest`. Maybe it runs `node test.js`. If it guesses wrong, it gets an error that looks like a test failure but is actually a command-not-found error. It might "fix" the tests based on this misleading error, making things worse.

2. **With specific commands:** The agent runs `npm test`. It either passes or fails. If it fails, the error output is a genuine test failure with actionable information. The agent can fix the actual problem.

The commands section is also where most agent platforms first look when starting a session. Before the agent writes a single line of code, it knows how to verify its work. This means it can self-verify from the very first action, rather than writing a batch of code and then discovering it doesn't know how to test it.

### The Anatomy of a Great Commands Section

```markdown
## Commands

### Verification (run after every code change)
- `npm test` — Full test suite (~45 seconds)
- `npm run test:path <file>` — Single-file tests (~5 seconds)
- `npm run lint` — ESLint + Prettier (~10 seconds)
- `npm run typecheck` — TypeScript type check (~8 seconds)

### Build
- `npm run build` — Production build (~30 seconds)
- `npm run build:watch` — Development build with hot reload

### Database
- `npm run db:migrate` — Run pending migrations
- `npm run db:rollback` — Rollback last migration
- `npm run db:seed` — Seed database with test data

### Development
- `npm run dev` — Start local development server (port 3000)
- `npm run dev:debug` — Start with Node debugger (port 9229)

### Special
- `npm run schema:generate` — Regenerate types from OpenAPI spec
- `npm run schema:validate` — Validate OpenAPI spec without generating
```

Notice:
- **Every command is copy-pasteable.** The agent can execute it exactly.
- **Timing estimates are included.** The agent knows how long to wait for results.
- **Commands are grouped by purpose.** The agent can choose the right command for the situation.
- **Common operations have fast alternatives.** `npm run test:path` is faster than `npm test` for quick checks.

## Capability Descriptions vs. Structural Descriptions

There are two types of information you can provide about your codebase: **capability descriptions** (what the code does) and **structural descriptions** (how the code is organized). Both are important, but they serve different purposes and belong in different places.

### Capability Descriptions

Capability descriptions tell the agent what the system can do:

```markdown
## Capabilities
- Process credit card payments via Stripe and Braintree
- Handle subscription creation, modification, and cancellation
- Support multi-currency transactions with real-time exchange rates
- Generate invoices and handle refunds
- Manage PCI-compliant card tokenization
```

### Structural Descriptions

Structural descriptions tell the agent where things are and how they connect:

```markdown
## Architecture
- `src/types/` — Shared type definitions and Zod schemas
- `src/config/` — Environment config, feature flags, gateway configuration
- `src/data/` — Database queries organized by domain entity
- `src/services/` — Business logic: payment processing, subscription management
- `src/services/gateways/` — Payment gateway clients (StripeClient, BraintreeClient)
- `src/runtime/` — HTTP handlers, middleware, webhook processors
- `src/ui/` — Admin dashboard for payment monitoring

Dependency direction: Types → Config → Data → Services → Runtime → UI
```

### Where Each Belongs

**Structural descriptions belong in AGENTS.md** (the instructional layer). They help the agent navigate the codebase for every task.

**Capability descriptions belong in docs/** (the knowledge layer). They help the agent understand the system's purpose when it needs to design a feature or debug an issue.

Why separate them? Because structural descriptions are needed for every action — the agent always needs to know where things are. Capability descriptions are needed only for specific tasks — the agent doesn't need to know about refund processing when it's adding a new API endpoint for subscription management.

Mixing them in AGENTS.md creates the firehose effect we discussed in Chapter 5. The agent reads about refund processing every time it takes any action, even though that information is irrelevant 90% of the time.

## Subdirectory-Scoped Instructions for Monorepos

In Chapter 6, we covered the pattern of per-directory AGENTS.md files. Let me expand on this with specific guidance for monorepos — codebases where multiple packages, services, or applications coexist in a single repository.

Monorepos present a unique challenge for context engineering: different parts of the codebase may have radically different rules. The frontend React application has different conventions from the backend Go service, which has different conventions from the data pipeline Python scripts. A single AGENTS.md file can't serve all of them well.

### The Monorepo Instruction Architecture

```
monorepo/
├── AGENTS.md                        # Repository-wide rules (~60 lines)
├── packages/
│   ├── frontend/
│   │   ├── AGENTS.md                # Frontend-specific rules
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   └── AGENTS.md        # Component-specific rules
│   │   │   └── hooks/
│   │   │       └── AGENTS.md        # Hooks-specific rules
│   │   └── tests/
│   │       └── AGENTS.md            # Frontend testing rules
│   ├── backend/
│   │   ├── AGENTS.md                # Backend-specific rules
│   │   ├── src/
│   │   │   ├── handlers/
│   │   │   │   └── AGENTS.md        # Handler-specific rules
│   │   │   └── services/
│   │   │       └── AGENTS.md        # Service-specific rules
│   │   └── tests/
│   │       └── AGENTS.md            # Backend testing rules
│   └── data-pipeline/
│       ├── AGENTS.md                # Pipeline-specific rules
│       └── tests/
│           └── AGENTS.md            # Pipeline testing rules
├── infra/
│   └── AGENTS.md                    # Infrastructure rules
└── docs/
    └── AGENTS.md                    # Documentation rules
```

### Root AGENTS.md for Monorepo (~60 lines)

```markdown
# Monorepo: Payment Platform

## Overview
Monorepo containing frontend (React), backend (Go), and data pipelines (Python).

## Repository Structure
- `packages/frontend/` — React SPA (TypeScript, Vite)
- `packages/backend/` — Go API server
- `packages/data-pipeline/` — ETL pipelines (Python, Airflow)
- `infra/` — Terraform infrastructure definitions
- `docs/` — Cross-cutting documentation

## Universal Rules
- All code must be tested. No exceptions.
- Feature branches only. Never commit to main.
- PRs require passing CI before review.
- All API changes require updated OpenAPI spec.
- Breaking changes require an ADR.
- Secrets never in code. Use environment variables.

## Cross-Package Dependencies
- Frontend depends on backend API. Changes to API contract must be 
  coordinated.
- Backend depends on data pipeline outputs. Schema changes require 
  migration plan.
- No direct imports between packages. API boundaries only.

## Commands
- `make test` — Run all tests across all packages
- `make lint` — Run all linters
- `make build` — Build all packages
```

### packages/frontend/AGENTS.md

```markdown
# Frontend Package Rules

## Stack
React 18, TypeScript 5, Vite 5, TanStack Query, Tailwind CSS.

## Commands
- `npm run dev` — Dev server (port 5173)
- `npm test` — Vitest
- `npm run test:ui` — Vitest UI
- `npm run lint` — ESLint + Prettier
- `npm run build` — Production build

## Architecture
- `src/components/` — UI components (Atomic Design: atoms/molecules/organisms)
- `src/hooks/` — Custom React hooks
- `src/services/` — API client functions
- `src/stores/` — Zustand stores
- `src/types/` — TypeScript types

## Rules
- Use functional components with hooks. No class components.
- Use TanStack Query for all API calls. Never raw fetch/axios.
- Use Tailwind utility classes. No custom CSS files.
- Components: PascalCase files. Hooks: camelCase with `use` prefix.
- All user-facing text must use i18n keys. No hardcoded strings.
- Use the `@/` import alias for src/ imports.
```

### packages/backend/AGENTS.md

```markdown
# Backend Package Rules

## Stack
Go 1.22, Chi router, PostgreSQL 16, sqlc for query generation.

## Commands
- `go test ./...` — Run all tests
- `go test ./src/services/...` — Run tests for services
- `golangci-lint run` — Lint
- `go build ./...` — Build
- `sqlc generate` — Generate query code from SQL
- `migrate -path migrations -database $DB_URL up` — Run migrations

## Architecture
- `src/handlers/` — HTTP handlers (thin: parse request, call service, respond)
- `src/services/` — Business logic
- `src/repositories/` — Database queries (generated by sqlc)
- `src/models/` — Domain types
- `migrations/` — Database migration files

Dependency direction: models → repositories → services → handlers
Handlers never import repositories directly. Services never import handlers.

## Rules
- Use sqlc for all database queries. Never write database code by hand.
- Handlers parse request with custom decoder, validate with custom validator.
- All errors use custom error types with HTTP status codes.
- Use context.Context as first parameter in all service/repository functions.
- Never panic. Return errors explicitly.
- Table-driven tests for all handlers and services.
```

Notice how different the rules are for each package. The frontend uses React hooks and Tailwind. The backend uses Go and sqlc. A single instruction file would be a confusing mess of mixed conventions. Scoped files keep each domain clean and focused.

### The Loading Cascade

When an agent works on `packages/frontend/src/components/checkout/CheckoutForm.tsx`, it loads:

1. Root AGENTS.md (universal rules) — ~60 lines
2. packages/frontend/AGENTS.md (frontend rules) — ~30 lines
3. packages/frontend/src/components/AGENTS.md (component rules) — ~15 lines

Total: ~105 lines of directly relevant rules. Zero lines of Go rules, Python rules, or infrastructure rules that are irrelevant to the current task.

When the same agent switches to `packages/backend/src/services/payment.go`, the cascade changes:

1. Root AGENTS.md (universal rules) — ~60 lines
2. packages/backend/AGENTS.md (backend rules) — ~35 lines
3. packages/backend/src/services/AGENTS.md (service rules) — ~15 lines

Same total, completely different content, perfectly targeted to the current task.

This is the power of scoped instructions: the agent always has the right rules without loading the wrong ones.

## Maintenance: Treating Instruction Files Like Code

Instruction files are code. Not in the literal sense — they're markdown, not TypeScript or Go. But in the practical sense: they're executable artifacts that determine the behavior of a system (the agent). They need the same care, the same review process, and the same maintenance discipline as your production code.

### Instruction File Anti-Patterns

Here are the most common ways instruction files go wrong, and how to fix each one:

**Anti-Pattern 1: The Museum**

```markdown
## History
This project was started in 2021 as a proof of concept. Originally we used 
Express.js but migrated to Fastify in 2022 for better performance. We tried 
TypeORM but found it too magical and switched to Kysely. The original team 
was Alice, Bob, and Carol, but now it's just Dave and Eve...
```

**Why it's harmful:** The agent doesn't need to know the history. This paragraph consumes attention tokens that could be spent on rules. Every time the agent reads this file, it attends to this historical narrative instead of the coding rules.

**Fix:** Delete it. If the information is historically interesting, put it in a separate `docs/HISTORY.md` file that's not loaded into agent context.

**Anti-Pattern 2: The Novel**

```markdown
## Error Handling

When we think about error handling, it's important to consider the user 
experience. Nobody likes seeing a generic error message. That's why we've 
invested significant effort in creating a comprehensive error handling 
strategy that balances developer experience with user experience. Our 
approach is based on the principle that errors should be...

[continues for 3 paragraphs]
```

**Why it's harmful:** The agent doesn't need the philosophy. It needs the rule. Three paragraphs of exposition about why good error handling matters dilute the actual rule ("use Result<T, E> for all service methods").

**Fix:** Replace with:

```markdown
## Error Handling
- All service methods return Result<T, E> (see `src/types/result.ts`).
- Never throw exceptions for business-logic failures (card declined, insufficient funds).
- Throw exceptions only for truly unexpected conditions (database connection lost, out of memory).
- Error messages must be user-safe: no stack traces, no internal identifiers.
```

**Anti-Pattern 3: The Contradiction**

```markdown
## Rules
- Use Zod for all runtime validation.
- All validation happens in the runtime layer before services are called.
- Services should validate their own inputs defensively.
```

Lines 2 and 3 contradict each other. If the runtime layer validates before calling services, why do services need to validate defensively? The agent will oscillate between these two rules, sometimes putting validation in handlers and sometimes in services, producing inconsistent code.

**Fix:** Choose one approach and state it clearly:

```markdown
## Rules
- Use Zod for all runtime validation.
- Validation happens in the runtime layer (handlers) using Zod schemas.
- Services trust their inputs are validated. No redundant validation in services.
- If a service is called outside the runtime layer (e.g., by another service), 
  the calling code is responsible for validation.
```

**Anti-Pattern 4: The Kitchen Sink**

```markdown
## Rules
- Use Zod for validation
- Never use any
- Return Result types
- Always handle errors
- Use descriptive variable names
- Keep functions under 20 lines
- Max 3 parameters per function
- No nested ternaries
- Prefer const over let
- Use early returns
- Avoid else blocks
- No magic numbers
- Extract constants
- Use template literals
- Prefer array methods over loops
- Use optional chaining
- Document public APIs
- Write self-documenting code
- Use meaningful commit messages
- Follow conventional commits
- Keep PRs under 400 lines
- Respond to code review within 24 hours
- Update the changelog
- Check for security vulnerabilities
- Use environment variables for config
- Enable strict TypeScript
- Use absolute imports
- Prefer composition over inheritance
- Follow SOLID principles
- Don't repeat yourself
- Keep it simple stupid
- You aren't gonna need it
- ...
```

**Why it's harmful:** Half of these rules are generic programming advice that the model already follows by default. "Prefer const over let" and "use optional chaining" are so deeply ingrained in the model's training data that explicitly stating them adds zero value while consuming attention. Worse, the sheer volume of rules means the agent can't give adequate attention to the ones that actually differ from its defaults.

**Fix:** Keep only rules that differ from the model's default behavior or encode project-specific conventions:

```markdown
## Rules
- Use Zod for all runtime validation (model default: may use manual checks).
- Never use `any` (enforced by lint, but state explicitly).
- Return Result<T, E> from service methods (project-specific pattern).
- Database queries in src/data/ only (architectural constraint).
- All new code requires tests (project policy).
```

Five rules the agent needs to know, zero generic advice it already follows.

### The Rewrite vs. Edit Problem

One of the most common instruction-related failures I see is agents rewriting entire files instead of making targeted edits. This happens because the default behavior of many agents is to output the complete file — and without explicit instructions, the agent doesn't know your project prefers minimal, surgical changes.

The fix is a specific instruction:

```markdown
## Rules
- When modifying existing files, make targeted edits. Never rewrite an entire file 
  unless explicitly instructed.
- If adding a function, add it in the appropriate location. Don't re-output the 
  entire file.
- If fixing a bug, change only the lines that need to change.
```

This single instruction can reduce token consumption by 10x on editing tasks, because the agent isn't re-outputting hundreds of unchanged lines. It also reduces the risk of the agent accidentally changing something while re-typing it.

### The Testing Discipline Gap

Another common failure: agents write code first, tests last. This is the opposite of what you want. Without explicit instructions, most agents default to the "implementation then testing" pattern because that's the most common pattern in their training data.

The fix:

```markdown
## Testing Rules
- Write tests BEFORE or ALONGSIDE implementation, never after.
- For each function you implement, write the test first (or simultaneously).
- Tests must fail before implementation (proving they test something).
- Run tests after every implementation change, not just at the end.
```

This doesn't make the agent truly "test-driven" in the rigorous sense, but it shifts the default from "test as afterthought" to "test as co-equal activity," which produces better code.

### The Instruction File Review Process

Treat changes to instruction files with the same gravity as changes to production code:

1. **Changes to AGENTS.md should be PR-reviewed.** Instruction files control agent behavior. A bad rule can cause every subsequent agent action to produce incorrect code. That's a production impact.

2. **Test instruction changes.** After modifying AGENTS.md, run a standard agent task (implement a small feature) and verify the agent follows the new/changed rules. This is the instruction-file equivalent of running tests after a code change.

3. **Track instruction file changes in git.** Use meaningful commit messages: "Add rule: services never import from runtime" rather than "Update AGENTS.md."

4. **Schedule regular reviews.** Instruction files should be reviewed at least monthly. Are all rules still current? Have new conventions emerged that should be documented? Have architectural changes made any rules obsolete?

### The Instruction File Lifecycle

```
CREATE (initial setup)
  │
  ▼
REVIEW (before merging)
  │
  ▼
TEST (verify agent follows rules)
  │
  ▼
ACTIVE (in production use)
  │
  ├── UPDATE (when architecture changes)
  │     │
  │     ▼
  │   REVIEW → TEST → ACTIVE
  │
  ├── AUDIT (monthly: is this still correct?)
  │     │
  │     ▼
  │   UPDATE or KEEP
  │
  └── RETIRE (when rule is no longer needed)
        │
        ▼
      Remove from AGENTS.md, add note to ADR if significant
```

## Practical Writing Techniques That Work

Beyond the structural patterns and anti-patterns we've covered, there are specific writing techniques that measurably improve instruction effectiveness. These come from the intersection of prompt engineering research, practical experience with agent platforms, and the empirical findings from GitHub's analysis.

### Technique 1: The Priority Inversion

When you have rules of varying importance, don't list them in arbitrary order. List them in strict priority order, with the most critical rules first. The agent's attention is strongest at the beginning of a section.

```markdown
## Rules (in priority order)

1. SECURITY: Never commit secrets, API keys, or credentials to the repository.
2. ARCHITECTURE: Services never import from runtime. Dependency direction is strict.
3. TYPES: Never use `any`. Use `unknown` and narrow with type guards.
4. VALIDATION: Use Zod for all runtime input validation.
5. TESTING: All new code requires tests. No exceptions.
6. STYLE: Use descriptive variable names. Prefer readability over brevity.
```

Notice that security is first and style is last. If the agent's attention is limited and it can only process a few rules from this section, the ones it processes will be the most important.

### Technique 2: The Constraint Cascade

For complex constraints that depend on each other, write them as a cascade: the most fundamental constraint first, each subsequent constraint building on the previous one.

```markdown
## Architecture Constraints

1. The codebase is organized into layers: Types → Config → Data → Services → Runtime → UI.
2. Each layer may only import from layers to its LEFT in this list.
3. Specifically: Services may import from Types, Config, and Data. Never from Runtime or UI.
4. If you need data from a lower layer, use dependency injection via the Config layer.
```

Each constraint builds on the previous one, creating a chain of understanding. The agent processes them in order, each one reinforcing and clarifying the last.

### Technique 3: The Bounded Scope

Agents tend to be overly expansive in their modifications. A request to "add error handling" might result in modifications to 15 files instead of the 3 that actually need changes. You can prevent this with explicit scope bounds:

```markdown
## Scope Rules
- Only modify files that are directly related to the task.
- If you need to add a new file, create it in the appropriate directory per the architecture.
- If you need to modify a shared type, ONLY modify the type definition. Do not refactor 
  all consumers.
- When in doubt about scope, ask before proceeding.
```

The "when in doubt, ask" clause is important. It gives the agent an escape hatch when it's unsure about scope, preventing both over-modification (too many files) and under-modification (missing necessary changes).

### Technique 4: The Failure Prevention Pattern

For each rule, include a brief note about the common failure mode it prevents:

```markdown
## Rules
- Use Zod for all runtime validation.
  Failure prevented: Untrusted API input reaching business logic without validation.

- Return Result<T, E> from service methods.
  Failure prevented: Unhandled promise rejections crashing the server.

- Database queries in src/data/ only.
  Failure prevented: SQL scattered across the codebase, making schema changes risky.
```

This does more than just state the rule — it gives the agent the context to understand WHY the rule exists, which helps it apply the rule appropriately in novel situations. When the agent encounters a situation not explicitly covered by the rules ("should I validate this internal function call?"), the failure prevention context helps it make the right decision ("the rule prevents untrusted input, this is internal, so it's probably fine — but I should add a comment").

### Technique 5: The Reference Implementation

For complex patterns, point to a reference implementation that the agent can study:

```markdown
## Patterns
- Payment gateway integration: See `src/services/stripe-client.ts` for the 
  reference implementation. All new gateways should follow this pattern.
- Repository pattern: See `src/data/payment-repository.ts` for the reference. 
  All new repositories should follow this structure.
- Error handling: See `src/services/subscription.service.ts` for how to use 
  Result types in a real service with multiple error paths.
```

Reference implementations are the most efficient way to teach complex patterns. A 20-line pointer to a well-written file communicates more than 200 lines of explanation, and the agent can study the actual code (which is guaranteed to be correct and up-to-date) rather than a description that might be stale or incomplete.

### Technique 6: The Version Marker

Include a version or last-updated marker in your instruction file:

```markdown
# Project: Checkout Service
<!-- Last reviewed: 2024-03-15 | Next review: 2024-04-15 -->
```

This serves two purposes: it reminds humans when the file was last reviewed, and it gives you a quick way to check if the instructions might be stale. If you see a "Last reviewed" date that's more than 60 days old, it's a signal to schedule a review.

Some teams automate this with a CI check: if the "Last reviewed" date is older than 30 days, the CI pipeline adds a warning to PRs. This turns instruction freshness from a manual chore into a mechanical property.

## Research-Backed: Instruction File Effectiveness

Analysis of repositories using AI coding agents provides empirical backing for many of the practices we've discussed. Several findings are directly relevant to instruction file design:

### Finding 1: Specificity Correlates with Success

Repositories with specific, actionable instructions had higher first-attempt success rates than those with vague instructions. "Use Zod for all runtime validation" outperformed "Ensure proper validation." "Never use `any`" outperformed "Maintain type safety." The more specific the instruction, the more reliably the agent followed it.

This aligns perfectly with the imperative vs. descriptive distinction. Specific instructions tend to be imperative by nature. Vague instructions tend to be descriptive. The causality runs in both directions: imperative instructions are easier to make specific, and specific instructions are naturally imperative.

### Finding 2: Shorter Files Outperform Longer Files

Repositories with instruction files under 150 lines had measurably better agent performance than those with files over 300 lines.² The effect was consistent across model families and task types.

This is a direct confirmation of the firehose effect and the "Lost in the Middle" research. Shorter files keep the agent's attention focused. Longer files force the agent to distribute attention across more content, reducing the signal strength of any individual rule.

### Finding 3: Consistent Structure Across Files Helps

Repositories that used a consistent structure for all instruction files (root AGENTS.md, subdirectory AGENTS.md files) had better agent performance than repositories with ad-hoc documentation structures.

Consistency helps because the agent builds expectations about where to find information. If every subdirectory AGENTS.md follows the same template (Purpose, Rules, Examples), the agent knows where to look for specific types of information, reducing the cognitive load of navigating the instruction architecture.

### Finding 4: Negative Examples Are Disproportionately Valuable

Instructions that included examples of what NOT to do ("Never do this: [example]") were significantly more effective than instructions that only showed what TO do.

This makes sense given how language models work. A positive example ("Do this: [example]") shows one correct pattern. A negative example ("Don't do this: [example], do this instead: [example]") shows both the incorrect pattern (which the model might otherwise default to) and the correct pattern, creating a contrast that's easier to learn from.

```markdown
## Rules: Error Handling

DO:
```typescript
async function processPayment(
  request: PaymentRequest
): Promise<Result<PaymentConfirmation, PaymentError>> {
  const result = await gateway.charge(request);
  return result;
}
```

DON'T:
```typescript
async function processPayment(request: PaymentRequest): Promise<PaymentConfirmation> {
  try {
    return await gateway.charge(request);
  } catch (error) {
    throw new PaymentError('Payment failed'); // Loses error context!
  }
}
```
```

The DO/DON'T pattern teaches more effectively than either example alone.

### Finding 5: Command Specificity Reduces Errors

Repositories where the commands section included exact commands (not descriptions) had significantly fewer verification-related errors. Agents that knew to run `npm test` rather than "run the tests" spent less time on false starts and more time on productive work.

This confirms the advice from our commands section discussion: every command should be copy-pasteable, exact, and include any necessary flags or options.

## A Complete AGENTS.md Template

Let me bring everything together with a complete, production-ready AGENTS.md template. This is designed to be copy-pasted and adapted:

```markdown
# Project: [PROJECT_NAME]

## Overview
[One sentence: what this project does, language, framework]

## Architecture
```
src/
├── types/      — [description]
├── config/     — [description]
├── data/       — [description]
├── services/   — [description]
├── runtime/    — [description]
└── ui/         — [description]
```

Dependency direction: [layer] → [layer] → [layer]
Never import from a later layer into an earlier one.

## Commands

### Verification
- `[test command]` — Run all tests (~XX seconds)
- `[single-file test command]` — Run tests for one file
- `[lint command]` — Lint check (~XX seconds)
- `[typecheck command]` — Type checking (~XX seconds)
- `[build command]` — Production build (~XX seconds)

### Development
- `[dev command]` — Start development server
- `[watch command]` — Watch mode (if applicable)

### Database (if applicable)
- `[migrate command]` — Run migrations
- `[seed command]` — Seed test data

## Rules

### Architecture
- [Rule about where code lives]
- [Rule about dependency direction]
- [Rule about module boundaries]

### Coding
- [Rule about type usage]
- [Rule about error handling]
- [Rule about naming conventions]
- [Rule about imports]

### Testing
- [Rule about test location]
- [Rule about test data]
- [Rule about mocking boundaries]
- [Rule about test independence]

### DO / DON'T Examples

DO:
```
[example of correct pattern]
```

DON'T:
```
[example of incorrect pattern]
```

## Known Patterns
- [Pattern name]: See [file path] for reference implementation.
- [Pattern name]: See [file path] for reference implementation.

## PR Conventions
- Title format: `[area] description`
- Include test plan in PR description.
- [Other conventions]
```

This template is about 60 lines when filled in — well within the 100-line guideline. It covers every section the agent needs: overview (orientation), architecture (navigation), commands (verification), rules (constraints), examples (patterns), and PR conventions (workflow).

## AGENTS.md in the Wild: Adoption Patterns

How are real organizations structuring their instruction files? The patterns are converging around a few key approaches, each suited to different team sizes and codebase types.

**Shopify: Plugin-Based Context Delivery.** Shopify took an unusual approach: rather than requiring teams to write AGENTS.md files from scratch, they built an AI Toolkit that delivers context through plugins.³ The toolkit provides editor extensions for Claude Code, Cursor, Gemini CLI, and VS Code, each automatically loading the project's conventions, testing rules, and architecture constraints. The key innovation is that the context updates automatically — when a team changes a convention in their CI configuration, the plugin picks it up without anyone editing AGENTS.md. This approach works well for organizations with many small teams that share a common platform but have localized conventions.

**Uber: MCP Gateway as Dynamic AGENTS.md.** Uber's approach replaces the static file model with a dynamic system.⁴ Their MCP (Model Context Protocol) Gateway serves as a single entry point for agents to access internal tools, APIs, and services. Instead of encoding all rules in a static markdown file, the gateway provides context on demand — including current API schemas, service ownership information, and deployment conventions that update in real time. This is AGENTS.md as an API rather than a file, and it's particularly effective for large organizations where conventions change faster than documentation can be updated.

**The AGENTS.md Standard's Evolution.** The Agentic AI Foundation (AAIF), stewarding the AGENTS.md specification under the Linux Foundation, is working on extensions that support these more dynamic patterns while maintaining backward compatibility with the simple markdown format. The direction is clear: AGENTS.md is evolving from a static file to a context-delivery protocol, but the fundamental discipline — lean, imperative, structured instructions — remains the same regardless of the delivery mechanism.

### Sidebar: AGENTS.md for Non-TypeScript Projects

Most examples in this book use TypeScript, but the AGENTS.md pattern is language-agnostic. Here are templates for two common stacks:

**Python FastAPI Project:**
```markdown
# Project: User Service (Python)

## Overview
FastAPI microservice for user management. Python 3.12+, PostgreSQL.

## Commands
- `pytest` — Run all tests
- `pytest tests/unit/test_user.py` — Run single test file
- `ruff check .` — Lint
- `ruff format .` — Format
- `mypy src/` — Type check
- `alembic upgrade head` — Run migrations
- `uvicorn src.main:app --reload` — Dev server

## Architecture
- `src/models/` — SQLAlchemy models
- `src/schemas/` — Pydantic schemas (request/response)
- `src/services/` — Business logic
- `src/api/` — FastAPI route handlers
- `src/core/` — Config, security, dependencies

Dependency direction: models → schemas → services → api
Handlers never import models directly. Use schemas at API boundaries.

## Rules
- Use Pydantic v2 for all validation. Never trust raw input.
- Async everywhere. Use `async def` for all service and route functions.
- Use dependency injection via FastAPI's `Depends()`.
- All database access through service layer. Never raw SQL in handlers.
- Tests use `pytest-asyncio` and factory functions, not fixtures.
```

**Go Microservice:**
```markdown
# Project: Order Service (Go)

## Overview
Go 1.22 microservice for order processing. Chi router, PostgreSQL.

## Commands
- `go test ./...` — Run all tests
- `go test ./src/services/...` — Run package tests
- `golangci-lint run` — Lint
- `go build ./...` — Build
- `go generate ./...` — Run code generation (mocks, sqlc)

## Architecture
- `src/models/` — Domain types
- `src/store/` — Database queries (sqlc generated)
- `src/services/` — Business logic
- `src/handlers/` — HTTP handlers
- `migrations/` — Database migrations

Dependency direction: models → store → services → handlers
Handlers never import store directly.

## Rules
- Use `context.Context` as first param in all service/store functions.
- Return errors explicitly. Never panic.
- Table-driven tests for all handlers and services.
- Use `sqlc` for queries. Never hand-write database code.
- Errors use custom types with HTTP status codes.
```

The structure is the same across languages: Overview, Commands, Architecture, Rules. Only the specifics change.

## The Instruction Layer as Living Architecture

I want to close with a framing that I hope will change how you think about instruction files. They are not documentation. They are not configuration. They are **architecture** — in the truest sense of the word.

In traditional software architecture, you design the structure of a system: how components connect, how data flows, how errors propagate. You encode this structure in code, in directory organization, in dependency management. The architecture constrains what's possible and guides what's natural.

Instruction files do exactly the same thing, but for a different executor. Instead of constraining the compiler or the runtime, they constrain the agent. Instead of guiding the CPU, they guide the attention mechanism of a large language model. Instead of preventing circular dependencies through module systems, they prevent architectural violations through explicit rules.

### The Architect's New Tool

In the traditional development model, the software architect designs systems that are executed by computers. The architect's tools are type systems, module boundaries, dependency injection frameworks, and architectural patterns. These tools constrain the solution space so that individual developers (and the code they write) naturally conform to the architectural vision.

In the agent-first model, the architect designs systems that are executed by both computers AND AI agents. The architect's tools are the same as before — type systems, module boundaries, dependency injection — PLUS a new set: instruction files, verification loops, and mechanical enforcement through linters and CI.

This new toolset doesn't replace the old one. It augments it. A well-typed codebase with clear module boundaries still needs instruction files because the agent doesn't automatically understand the reasoning behind your architectural choices. It sees the structure but not the intent. Instruction files encode the intent.

Consider: a TypeScript codebase with a strict layer architecture (Types → Services → Runtime) has the structure encoded in the directory organization. But without an instruction file, the agent might not understand WHY imports go from Types to Services and not the other way. It might see a service importing a type, think "this import should go the other direction for better encapsulation," and "fix" it — violating the layer architecture in the process.

The instruction file prevents this by encoding the intent: "Dependency direction: Types → Config → Data → Services → Runtime → UI. Never import from a lower layer into a higher layer." Now the agent understands both the structure (visible in the code) and the intent (encoded in the instruction), and it can make architectural decisions that align with both.

### The Evolution of Instruction Files

As agent capabilities evolve, instruction files will evolve with them. Today's AGENTS.md is a static markdown file. Tomorrow's instruction layer might include:

- **Executable rules** — not just text descriptions of rules but formal specifications that can be verified programmatically. Think of it as a contract between the architect and the agent, enforced by tooling.

- **Adaptive instructions** — rules that adjust based on context. For example, stricter rules for critical paths (payment processing) and more relaxed rules for internal tools (admin dashboards). This is possible today with per-directory AGENTS.md files, but future systems may make it more seamless.

- **Learned instructions** — rules derived from the team's actual behavior. If every engineer consistently uses a particular pattern, the system could suggest codifying it as a rule. If a rule is consistently violated, the system could suggest refining or removing it.

- **Cross-project instruction sharing** — reusable instruction modules for common patterns. "Import our company's standard error handling rules" rather than rewriting them in every project's AGENTS.md.

None of these replace the fundamental discipline we've discussed: keep instructions lean, specific, imperative, and current. But they will make it easier to apply that discipline across larger and more complex systems.

### The Architect's Checklist

As you think about your own instruction layer, here's a checklist for the architect:

- [ ] **Does every agent know where code belongs?** Can it look at a function and know which directory it should live in?
- [ ] **Does every agent know how to verify?** Can it run tests, lint, and type-check without guessing?
- [ ] **Does every agent know the critical constraints?** The rules that, if violated, would cause serious problems?
- [ ] **Are instructions consistent across tools?** If you use multiple agent platforms, do they all follow the same rules?
- [ ] **Are scoped rules in place for complex areas?** Do subdirectories with unique conventions have their own instruction files?
- [ ] **Is there a maintenance process?** Who reviews instruction files, and how often?
- [ ] **Can you measure instruction effectiveness?** Do you track how often agents follow or violate rules?

The OpenAI team understood this deeply. Their architecture wasn't just their directory structure and their TypeScript types. It was their AGENTS.md, their linting rules, their CI pipeline, their plan documents — the entire system that guided agent behavior. The "architecture" of an agent-first codebase includes the code AND the context.

This is why instruction files deserve the same architectural rigor as your code. Why they should be reviewed, tested, and maintained. Why they should be version-controlled and change-managed. Because in agent-first development, the instruction layer IS the architecture.

When you write an AGENTS.md file, you're not writing documentation. You're designing the cognitive architecture of your development team — human and artificial alike. Treat it with the respect that deserves.

---


---

## Footnotes

¹ Agentic AI Foundation / Linux Foundation, "AGENTS.md Specification," 2025. [Citation needed — verify before publication]

² GitHub, "Analysis of AGENTS.md Adoption Across 2,500+ Repositories," GitHub Blog, 2025. [Citation needed — verify before publication]

³ Shopify, "Shopify AI Toolkit," shopify.dev. https://shopify.dev/docs/apps/build/ai-toolkit

⁴ Uber Engineering, "uReview: AI-Powered Code Review at Uber," Uber Blog, 2025. https://www.uber.com/blog/ureview

---

## Key Takeaways

1. **AGENTS.md is the open standard** backed by every major AI company and adopted by 60,000+ repositories. Write it once, use it everywhere.

2. **Cross-tool compatibility** is achieved by writing AGENTS.md as your primary file and symlinking or referencing it from tool-specific files.

3. **Imperative instructions outperform descriptive ones** by 15-25% in agent compliance. "Never use `any`" beats "We generally prefer type safety."

4. **The commands section is the most important part** of your instruction file. Specific, copy-pasteable commands enable the verification loop that drives agent quality.

5. **Capability descriptions and structural descriptions** serve different purposes. Structure goes in AGENTS.md; capabilities go in docs/.

6. **Subdirectory-scoped instructions** are essential for monorepos. Each package or domain gets its own focused rules without loading irrelevant context.

7. **Treat instruction files like code.** Review them, test them, version-control them, and maintain them with the same discipline.

8. **The DO/DON'T pattern** is one of the most effective teaching tools for agents. Show what to do AND what not to do.

9. **Instruction files are architecture**, not documentation. They define the cognitive structure of your agent-first development system.

---

*This concludes Part II: Context Engineering. Next: Part III — Application Legibility →*
