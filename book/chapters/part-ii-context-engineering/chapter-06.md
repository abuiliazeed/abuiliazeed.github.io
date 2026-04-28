# Chapter 6: Advanced Context Architecture

---

> *"Information is not knowledge. Knowledge is not wisdom. Wisdom is not truth."*
> — Frank Zappa

---

Chapter 5 established why context matters and how to structure it — the firehose effect, the 100-line AGENTS.md rule, the six-layer knowledge architecture. This chapter addresses the *dynamic* challenges: how context is consumed at the systems level, why retrieval fails, what happens as codebases scale, and how to prevent the degradation that accompanies growth.

If Chapter 5 was about *what* context to provide, this chapter is about *how* it flows, *why* it breaks down at scale, and *what to do about it* in production systems.

## The Five Layers of a Strong Context Stack

Every time an AI coding agent acts in your codebase, it consumes context from five distinct layers. Understanding these layers — and optimizing each one — is the core discipline of context engineering.

```
┌──────────────────────────────────────────────────────────────┐
│                    CONTEXT STACK                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  5. MEMORY LAYER                                       │  │
│  │  Conversation history, prior decisions, accumulated    │  │
│  │  understanding across the session                      │  │
│  │  Lifecycle: per-session, grows over time               │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  4. TOOL LAYER                                         │  │
│  │  Available tools, their signatures, constraints,       │  │
│  │  and results from prior tool calls                     │  │
│  │  Lifecycle: configured per platform, results append    │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  3. STATE LAYER                                        │  │
│  │  Current files, recent edits, git status, test         │  │
│  │  results, error messages                               │  │
│  │  Lifecycle: per-action, changes rapidly                │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  2. KNOWLEDGE LAYER                                    │  │
│  │  Reference docs, API specs, ADRs, guides,              │  │
│  │  retrieved on demand                                   │  │
│  │  Lifecycle: relatively stable, updates with releases   │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  1. INSTRUCTIONAL LAYER                                │  │
│  │  AGENTS.md, .cursorrules, system prompts,              │  │
│  │  project rules                                         │  │
│  │  Lifecycle: stable, changes with architecture          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Let's examine each layer in detail, with specific strategies for optimization.

### Layer 1: The Instructional Layer

The instructional layer is your agent's constitution — the fundamental rules that govern all behavior. This is your AGENTS.md, your .cursorrules, your system prompt. It's loaded first and persists throughout the entire session.

**Optimization strategy: Maximize signal density.**

Every token in the instructional layer carries disproportionate weight because it's present for every action the agent takes. A rule that says "use Zod for all runtime validation" will be attended to thousands of times across a development session. A paragraph explaining the history of why you chose Zod over Joi will also be attended to thousands of times — and will dilute attention from the rules that actually matter every single time.

Specific techniques:
- **Use imperative mood.** "Use Zod" not "We use Zod."
- **Eliminate rationale.** The agent doesn't need to know *why*. It needs to know *what*.
- **Use concrete examples.** `[payments] add Apple Pay support` teaches more than "Use descriptive PR titles."
- **Group by activity.** Architecture rules, coding rules, testing rules, PR rules — separate sections so the agent can attend to the relevant group.
- **Version your instructions.** Include a last-updated date. This helps you track staleness and helps future-you understand when rules were changed.

### Layer 2: The Knowledge Layer

The knowledge layer is your reference material — docs/, API specifications, architecture decision records. The agent reads this on demand when it needs information that isn't in the instructional layer or the code itself.

**Optimization strategy: Design for retrieval.**

The critical insight: agents don't read docs linearly. They retrieve specific information. Your knowledge layer should be structured for point lookups, not sequential reading.

Specific techniques:
- **One topic per file.** Don't create a single `docs/architecture.md` that covers everything. Create `docs/architecture/dependency-rules.md`, `docs/architecture/data-flow.md`, `docs/architecture/authentication.md`. Small, focused files are easier to retrieve accurately.
- **Front-load key information.** If a doc has a critical rule, put it in the first paragraph. The "Lost in the Middle" effect applies to individual documents too.
- **Use consistent structure.** Every ADR should follow the same template: Context, Decision, Consequences, Status. Every API doc should follow the same format: Endpoint, Method, Parameters, Response, Errors. Consistency makes retrieval predictable.
- **Cross-reference from instructions.** In AGENTS.md: "For payment gateway integration, see `docs/guides/payment-integration.md`." This tells the agent where to look without loading the information into the instructional layer.

### Layer 3: The State Layer

The state layer is ephemeral: current files, recent edits, git status, test results, error messages. This is the context that changes with every action and is usually managed automatically by the agent platform.

**Optimization strategy: Maximize actionability.**

State context is most valuable when it's immediately actionable. The difference between "1 test failed" and "payment.service.test.ts: Test 'should reject expired cards' failed — expected status 'declined' but received 'error' at line 47" is the difference between the agent fixing the bug in one attempt and the agent spending five attempts exploring.

Specific techniques:
- **Verbose test output.** Configure your test runner to output full error details, not just pass/fail. In Jest: `--verbose --no-coverage`. In Go: `-v` flag. The extra tokens are worth it because they're high-signal.
- **Structured error messages.** If you control error types, make them descriptive. `new PaymentError('card_expired', { lastFour: '4242', expiryMonth: 3, expiryYear: 2023 })` is infinitely more useful than `new Error('Payment failed')`.
- **Git status in context.** Some platforms automatically include recent git changes. If yours doesn't, add a step to your agent workflow that runs `git diff --stat` before major operations. Knowing what changed recently prevents the agent from re-implementing something that was just added.

### Layer 4: The Tool Layer

The tool layer includes the tools available to the agent, their signatures, and the results of prior tool calls. When an agent reads a file, the file contents appear in the tool layer. When it runs a command, the output appears here.

**Optimization strategy: Curate tool results.**

Tool results are often the largest component of an agent's context window. A single `cat` of a large file can consume thousands of tokens. A `grep` across the codebase can return hundreds of matches. Unfiltered tool results are a major source of context bloat.

Specific techniques:
- **Targeted file reads.** Instead of reading an entire file, read specific functions or sections. Most agent platforms support line-range reads. Use them.
- **Filtered search results.** Instead of `grep -r "payment" .`, use `grep -r "payment" src/services/ --include="*.ts" | head -20`. The agent gets the same signal with a fraction of the tokens.
- **Structured tool outputs.** If you're building custom tools or MCP servers, design the output format for agent consumption. JSON is better than formatted text. Compact is better than verbose. Include only the fields the agent needs.

### Layer 5: The Memory Layer

The memory layer is the agent's accumulated understanding across the session — conversation history, prior decisions, context that builds up as the session progresses. This is the most dynamic and the most dangerous layer.

**Optimization strategy: Summarize aggressively.**

Memory grows unboundedly. Every action adds context. Every tool result adds context. Every conversation turn adds context. Without management, the memory layer eventually drowns the instructional layer. The agent "forgets" the rules because they're buried under thousands of tokens of session history.

Specific techniques:
- **Session resets.** Don't let agent sessions run indefinitely. Start fresh for new tasks. The instructional layer will reload; the accumulated noise won't.
- **Explicit summarization.** When a session gets long, explicitly ask the agent to summarize progress: "Summarize what we've done so far in 5 bullet points, then continue with the next step." This compresses the memory layer and refreshes the agent's attention.
- **Checkpoint context.** At natural breakpoints (feature complete, test passing), save a brief summary: "Stripe client implemented and tested. Gateway factory updated. Next: integration tests." If the session needs to continue, this summary replaces the full history.

## Minimum Viable Context: What Must the Agent Know Before Acting?

There's a minimum set of information an agent needs before it can take meaningful action. I call this the **minimum viable context** (MVC) — not to be confused with Model-View-Controller. The MVC is the smallest context set that enables the agent to produce correct, conventions-compliant code on the first attempt.

The concept borrows from the Lean Startup's "minimum viable product" — the smallest thing that delivers value. In context engineering, the MVC is the smallest context that delivers correct code. Anything less and the agent will make errors of omission (missing conventions, wrong patterns). Anything more and you're paying a cost in attention and tokens without proportional benefit.

The MVC varies by task, but here's the general framework:

```
Minimum Viable Context Checklist:

BEFORE the agent writes any code:
  □ Project structure (from AGENTS.md)
  □ Coding rules (from AGENTS.md)
  □ How to verify (from AGENTS.md commands section)
  □ Relevant existing code (from targeted file reads)
  □ Relevant types and interfaces (from codebase)
  □ Specific task description (from plan or issue)

BEFORE the agent modifies existing code:
  □ All of the above, PLUS:
  □ Tests for the code being modified
  □ Recent git changes to the file
  □ Any known issues or TODOs in the file

BEFORE the agent creates new files:
  □ All of the above, PLUS:
  □ Naming conventions (from AGENTS.md)
  □ Directory structure rules (from AGENTS.md)
  □ Example of a similar file (from codebase)
```

The key insight: **the MVC is surprisingly small.** For most coding tasks, it's:
- ~50 lines from AGENTS.md (project rules)
- ~200 lines of relevant source code (2-3 files)
- ~50 lines of types/interfaces
- ~20 lines of task description

That's roughly 320 lines, or about 4,000-5,000 tokens. Well within even a modest context window. The problem isn't that agents don't have enough context capacity — it's that teams fill that capacity with the wrong material.

### The MVC Test

Here's a practical way to test whether your context architecture provides adequate MVC. Pick a straightforward task that an agent should be able to complete independently. Before giving the task to the agent, ask yourself:

1. **Does the agent know where to put the code?** (Architecture rule in AGENTS.md)
2. **Does the agent know what conventions to follow?** (Coding rules in AGENTS.md)
3. **Does the agent know how to verify the code is correct?** (Commands section in AGENTS.md)
4. **Does the agent have access to the relevant existing code?** (File structure and retrieval)
5. **Does the agent know the specific requirements?** (Task description or plan)

If the answer to all five is yes, you have adequate MVC. If any answer is no, that's the gap to fill. Notice that items 1-3 are all provided by AGENTS.md, which is why it's the single highest-leverage investment in context engineering.

### When MVC Isn't Enough

There are cases where the MVC is insufficient:

1. **Novel architecture tasks** — when the agent needs to create a new architectural pattern, it needs more context about the existing architecture and the design constraints. This is where plan documents and architecture decision records become essential.

2. **Cross-cutting changes** — when a change affects multiple modules or layers, the agent needs context about all the affected areas. This is where scoped instruction files and well-organized docs/ pay off.

3. **Debugging complex issues** — when the agent needs to diagnose a bug, it needs access to logs, error traces, recent changes, and system state. This is where the state layer becomes critical.

In each of these cases, the solution isn't to pre-load more context. It's to structure your knowledge architecture so the agent can retrieve the additional context it needs just-in-time. The MVC is the starting point; the retrieval system (docs/, scoped rules, targeted file reads) handles the escalation.

## Splitting Permanent Context from Runtime Context

One of the most important architectural decisions in context engineering is the separation of **permanent context** from **runtime context**.

Permanent context is information that doesn't change within a session:
- Project rules and conventions
- Architecture overview
- Directory structure
- Available commands
- Coding standards

Runtime context is information that changes during a session:
- Current file contents
- Recent edits
- Test results
- Error messages
- Conversation history
- Intermediate calculations

The distinction matters because permanent context should be **front-loaded and protected**, while runtime context should be **managed and summarized**.

Here's the practical pattern:

```
Permanent Context (put in AGENTS.md):
├── Project overview
├── Directory structure
├── Dependency rules
├── Coding conventions
├── Testing rules
├── PR conventions
└── Commands (test, lint, build)

Runtime Context (managed by agent/platform):
├── Current task description
├── Files being worked on
├── Test output
├── Error messages
├── Conversation history
└── Prior action results
```

Why does this matter? Because most agent platforms load permanent context first (as system prompts or instruction files) and then append runtime context as the session progresses. This means permanent context naturally sits at the **beginning** of the context window — exactly where the "Lost in the Middle" research says attention is strongest. Runtime context accumulates at the end, where attention is also relatively strong. The middle — the least-attended region — is where session history and intermediate results pile up.

By keeping permanent context lean and front-loaded, you ensure the most important rules are in the highest-attention region. By summarizing runtime context regularly, you prevent the middle from growing to the point where it overwhelms the agent's attention.

## Just-in-Time Retrieval vs. Pre-Loading

There are two strategies for providing knowledge-layer context: **pre-loading** (including it in the initial context) and **just-in-time retrieval** (fetching it when needed).

Most teams default to pre-loading because it feels safer. If we include everything, the reasoning goes, the agent will have what it needs. But as we've established, more context isn't better — it's often worse. The firehose effect means pre-loading comprehensive documentation can actually reduce the agent's ability to use any of it effectively.

Just-in-time retrieval is the better default. Here's how it works:

1. The agent starts with its instructional layer (AGENTS.md) — the map, not the territory.
2. When it encounters a specific question ("What's the payment gateway interface?"), it retrieves the relevant documentation.
3. The retrieved documentation enters the context for that specific operation.
4. After the operation, the context is available but doesn't carry the same weight as the instructional layer.

This is how most modern agent platforms actually work. Claude Code reads files on demand. Codex retrieves relevant code snippets when needed. Cursor uses embeddings to find relevant context. The agent platform is already doing just-in-time retrieval; your job is to structure your knowledge layer so the retrieval works well.

The key enabler for JIT retrieval: **your file structure IS your retrieval index.** If your docs are organized in small, focused, well-named files, the retrieval system (whether it's simple file-reading or semantic search) can find the right information. If your docs are in a few massive files, retrieval becomes a blunt instrument that loads too much or misses entirely.

```
GOOD: Easy to retrieve precisely
docs/
├── api/
│   ├── payments-endpoints.md     ← Agent needs payment API? Grab this one file.
│   └── users-endpoints.md
├── guides/
│   ├── adding-new-feature.md     ← New feature? Grab this one file.
│   └── testing-patterns.md

BAD: Hard to retrieve precisely
docs/
├── api.md                        ← Agent needs payment API? Loads the whole thing,
│                                   including users, auth, admin, 15 other sections.
└── developer-guide.md            ← New feature? Loads the whole guide including
                                    testing, deployment, debugging, 20 other sections.
```

### When to Pre-Load

There are cases where pre-loading is the right choice:

1. **Universal rules.** If a rule applies to every action (e.g., "never use `any`"), it belongs in the instructional layer — which IS pre-loaded.
2. **Critical safety constraints.** Rules that prevent catastrophic mistakes (e.g., "never modify the database schema without a migration") should be pre-loaded.
3. **Small, critical reference material.** If the reference is under 100 tokens and used frequently (e.g., a type signature that's referenced everywhere), pre-loading is fine.

Everything else should be retrieved just-in-time.

## Aggressive Summarization Without Losing Signal

Summarization is the context engineer's most powerful tool and most dangerous weapon. Done well, it compresses a session's history into a dense, actionable summary that preserves all the critical information. Done poorly, it throws away the exact details the agent needs to avoid repeating mistakes.

Here are the principles of effective summarization:

### Principle 1: Summarize State, Not Process

Bad summary: "We tried several approaches to the Stripe integration. First we attempted direct API calls, then we tried using the official SDK with custom configuration, and finally we settled on the SDK with default configuration because the custom config was causing timeout issues."

Good summary: "Stripe integration uses the official SDK with default configuration. Direct API calls and custom SDK config were rejected due to timeout issues."

The first summary makes the agent re-live the exploration. The second gives it the outcome. Agents don't benefit from knowing your journey — they benefit from knowing your destination.

### Principle 2: Preserve Decision Rationale

When you summarize, you must preserve *why* decisions were made, not just *what* decisions were made. The "why" prevents the agent from re-exploring rejected paths.

Bad summary: "Payment errors use the Result monad."

Good summary: "Payment errors use the Result monad (see `src/types/result.ts`). Regular exceptions were considered but rejected because payment failures are expected business outcomes, not exceptional conditions."

### Principle 3: Preserve Failure Modes

When something went wrong and was fixed, summarize the failure mode alongside the fix. This prevents the agent from re-introducing the same bug.

Bad summary: "Fixed the payment amount calculation."

Good summary: "Payment amounts must be in cents (multiply dollar amount by 100). A previous implementation passed dollars directly, causing $50.00 charges to appear as $0.50."

### Principle 4: Use Structured Summaries

Free-text summaries are fine for human consumption, but structured summaries are better for agent consumption:

```markdown
## Session Summary

### Completed
- Stripe client implementation (`src/services/stripe-client.ts`)
- Gateway factory registration (`src/services/gateway-factory.ts`)
- Unit tests for Stripe client (12 tests, all passing)

### Decisions
- Using official Stripe SDK with default config (custom config caused timeouts)
- Amounts in cents (dollar amounts caused off-by-100x bug)
- Result monad for errors (payment failures are business outcomes, not exceptions)

### In Progress
- Integration tests (need Stripe test mode API key)

### Blocked
- Cannot complete integration tests without STRIPE_SECRET_KEY in environment

### Key Files Modified
- `src/services/stripe-client.ts` (+245 lines)
- `src/services/gateway-factory.ts` (+12 lines)
- `src/config/flags.ts` (+3 lines)

### Known Issues
- None currently
```

This structured summary is about 30 lines — roughly 400 tokens. It compresses what might have been 10,000+ tokens of session history into something the agent can hold in full attention while still having all the critical information.

## Ranking Context by Utility, Not Availability

One of the most common mistakes in context engineering is the **availability heuristic** — including context because it's easy to include, not because it's useful to the agent.

Consider: your CI pipeline produces detailed build logs. They're readily available. Should they be in the agent's context?

If the build is passing: absolutely not. "Build passing" is two tokens. The full build log is thousands. They carry the same information.

If the build is failing: the relevant portion of the log (the specific error) is extremely valuable. The full log is not. "TypeScript error in src/services/payment.ts line 47: Property 'amount' does not exist on type 'PaymentRequest'" is ~20 tokens and tells the agent exactly what to fix. The full build log of 500 lines adds nothing.

The rule: **include context proportional to its actionability, not its accessibility.**

```
Context Utility Ranking (highest to lowest):

1. Error messages (directly actionable)
2. Test failures (directly actionable)
3. Type errors (directly actionable)
4. Lint violations (directly actionable)
5. Specific task description (guides action)
6. Relevant source code (enables action)
7. Project rules (constrains action)
8. Architecture overview (orients action)
9. Reference documentation (informs action)
10. Historical context (explains action)
11. Build logs (usually noise)
12. Full file contents (often overkill)
13. Conversation history (diminishing returns)
```

Items at the top are worth their weight in tokens. Include them aggressively. Items at the bottom are expensive relative to their value. Include them only when there's a specific reason.

## The "Lost in the Middle" Effect and How to Structure Files

Let's return to the research that underpins much of this chapter's advice. In 2023, a team from Stanford, UC Berkeley, UC Santa Barbara, and Meta AI published "Lost in the Middle: How Language Models Use Long Contexts."¹ Their findings have profound implications for how we structure agent-facing files.

### What They Found

The researchers tested multiple language models on information retrieval tasks where the relevant information was placed at different positions within a long context. The key findings:

1. **Position matters enormously.** Models are significantly better at retrieving information at the beginning and end of a context than in the middle.
2. **The effect scales with context length.** In shorter contexts (a few thousand tokens), the effect is modest. In longer contexts (tens of thousands of tokens), retrieval accuracy for middle-positioned information can drop by 50% or more.
3. **All models are affected.** This isn't a quirk of one model family. GPT-4, Claude, Gemini, Llama — all show the pattern to varying degrees.
4. **The model doesn't know it's lost.** When the model fails to retrieve information from the middle, it doesn't say "I don't know." It generates a plausible-sounding answer that ignores the middle information entirely. The failure is invisible.

This finding has a direct, practical implication that I want to state as clearly as possible: **the way you structure your files is as important as the content within them.** You can have the most accurate, well-written rules in the world, but if they're buried in the middle of a long file, the agent may not follow them.

### The U-Shaped Attention Curve

The "Lost in the Middle" researchers documented what they called a U-shaped attention curve. If you plot retrieval accuracy against position in the context, you get a curve that's high at the beginning, dips significantly in the middle, and rises again at the end. It looks roughly like this:

```
Retrieval Accuracy
    100% |█                                      █
         | █                                    █
         |  █                                  █
     75% |   █                                █
         |    █                              █
         |     █                            █
         |      █                          █
     50% |       ██                      ██
         |         ███                ███
         |            ████████████████
         |  Beginning      Middle        End
         +------------------------------------------
                    Position in Context
```

The practical implication: information at the edges of your context gets roughly 2x the effective attention of information in the middle. When you're deciding where to put a critical rule, this graph should be your guide.

Now, before you panic and start reorganizing every file: remember that this effect is most pronounced in *long* contexts. For the 100-line AGENTS.md files we recommend, the effect is minimal. The entire file fits comfortably in the high-attention region. But for longer documentation files — architecture guides, API references, runbooks — the effect is real and consequential.

### Real-World Impact: A Cautionary Tale

A team I worked with had a 400-line coding standards document. It covered naming conventions, error handling patterns, testing requirements, documentation standards, and performance guidelines. The testing section — which specified that all new code must have unit tests with minimum 80% coverage — was located around line 250, right in the middle of the document.

After adopting AI agents, the team noticed a consistent pattern: agents were following the naming conventions and error handling rules (located near the top) but routinely skipped writing tests. The testing requirement was being "lost in the middle."

The fix wasn't to reorganize the document (though that would have helped). The fix was to move the testing requirement to AGENTS.md, where it would be in the high-attention region of every agent session. Within a week, test compliance went from roughly 40% to over 90%.

The lesson: critical rules should never be buried in the middle of long documents. They should be in AGENTS.md (where they're at the beginning of every session) or in focused, short subdirectory instruction files (where there IS no middle to get lost in).

### Implications for File Structure

These findings directly inform how you should structure every file an agent reads:

**1. Front-load critical information.**

Put the most important rules, constraints, and information at the top of every file. In AGENTS.md, the architecture overview and coding rules should come before the PR conventions and testing details — not because PR conventions are unimportant, but because they're less critical for moment-to-moment coding decisions.

**2. Put examples at the top or bottom, never the middle.**

If you include a code example in a documentation file, put it at the beginning (immediately after the heading) or at the end. A code example buried in the middle of a long document may be completely ignored.

**3. Keep files short.**

The "Lost in the Middle" effect is weaker in shorter contexts. A 50-line file has almost no "middle" to get lost in. A 500-line file has a large middle region where critical information can be missed. This reinforces the advice from Chapter 5: keep files focused and modular.

**4. Use headers as landmarks.**

Headers serve as attention anchors. A model scanning a document will attend to headers more strongly than body text. Use descriptive headers that convey the key information even if the body isn't fully read:

```
BAD:  ## Notes
GOOD: ## Rule: Never Use `any` Type

BAD:  ## Details
GOOD: ## Payment Gateway Interface

BAD:  ## Important
GOOD: ## Known Bug: Amount Off-by-100x
```

**5. Repeat critical rules.**

If a rule is absolutely critical — the kind of rule where violating it would cause a serious bug — repeat it. Mention it in AGENTS.md AND in the relevant documentation file AND as a comment in the relevant code. Repetition across files is not redundancy; it's reinforcement. If the agent misses it in one location (because it was in the middle), it may catch it in another (where it's at the top).

**6. Structure the middle with bullet points.**

If you must have information in the middle of a file, use bullet points rather than paragraphs. Bulleted lists are attended to more reliably than prose because they're visually distinct and each item is short enough to avoid the "middle within the middle" problem.

### The Inverted Pyramid for Agent Files

Borrow a technique from journalism: the inverted pyramid. Put the most important information first, supporting details second, background last. This means:

```markdown
# File: Adding a New Payment Gateway

## CRITICAL RULE
All payment gateways must implement the PaymentGateway interface in 
`src/types/payment.ts`. Return Result<Confirmation, PaymentError> from 
every method. Never throw exceptions for business-logic failures 
(expired cards, insufficient funds).

## Steps
1. Create `src/services/<gateway>-client.ts` implementing PaymentGateway
2. Register in `src/services/gateway-factory.ts`
3. Add feature flag in `src/config/flags.ts`
4. Write unit tests (mock external API)
5. Write integration test (use test mode)

## Examples
See `src/services/stripe-client.ts` for a reference implementation.

## Background
We use the factory pattern so that new gateways can be added without 
modifying existing code. The Result monad was chosen over exceptions 
because payment failures are expected outcomes, not exceptional conditions.
```

The critical rule is at the top. The agent will see it regardless of how much of the file it processes. Background context is at the bottom — nice to have, but not essential.

## Scoped Modular Rules by Glob Pattern

For large codebases — especially monorepos — a single AGENTS.md file isn't enough. You need **scoped rules**: instructions that apply to specific directories or file types. This is where per-directory instruction files come in.

The AGENTS.md open standard supports this through a simple convention: AGENTS.md files in subdirectories override or extend the root AGENTS.md for files within that directory and its descendants.

Here's how this looks in practice:

```
project/
├── AGENTS.md                    # Root: project-wide rules (~80 lines)
├── src/
│   ├── types/
│   │   └── AGENTS.md            # Type-specific rules
│   ├── services/
│   │   └── AGENTS.md            # Service-specific rules
│   ├── data/
│   │   └── AGENTS.md            # Data layer rules
│   └── ui/
│       └── AGENTS.md            # UI-specific rules
├── tests/
│   └── AGENTS.md                # Testing rules
└── docs/
    └── AGENTS.md                # Documentation rules
```

### Root AGENTS.md (~80 lines)

```markdown
# Project: Checkout Service

## Overview
Payment processing microservice. TypeScript, Node.js 20+.

## Architecture
- `src/types/` — Shared types and Zod schemas
- `src/config/` — Environment config, feature flags
- `src/data/` — Database queries, repository pattern
- `src/services/` — Business logic
- `src/runtime/` — HTTP handlers, middleware
- `src/ui/` — Admin dashboard React components

Dependency direction: Types → Config → Data → Services → Runtime → UI
Never import upward through the dependency stack.

## Commands
- `npm test` — Run all tests
- `npm run lint` — ESLint + Prettier
- `npm run build` — TypeScript compilation
- `npm run db:migrate` — Run migrations

## Universal Rules
- Never use `any`. Use `unknown` and narrow.
- All async functions: explicit error handling.
- Never commit to `main` directly. Use feature branches.
- All new code must have tests.
```

### src/types/AGENTS.md

```markdown
# Types Layer Rules

## Purpose
Source of truth for all shared types and runtime validation schemas.

## Rules
- All exported types must have a corresponding Zod schema.
- Schema files: `<name>.schema.ts`, Type files: `<name>.ts`.
- Never import from any layer except other types.
- Breaking changes to exported types require an ADR.
- Use `z.infer<typeof Schema>` for type derivation, never hand-write 
  types that duplicate schema definitions.
```

### src/services/AGENTS.md

```markdown
# Services Layer Rules

## Purpose
Business logic. Orchestrates data access and external integrations.

## Rules
- Import from `types` and `data` layers only. Never from `runtime` or `ui`.
- Return `Result<T, E>` from all public methods. See `src/types/result.ts`.
- External API calls go through dedicated client classes (e.g., StripeClient).
- Never access the database directly from services. Use repository functions 
  from `src/data/`.
- Complex workflows: use the Saga pattern. See `docs/architecture/saga-pattern.md`.
```

### src/data/AGENTS.md

```markdown
# Data Layer Rules

## Purpose
Database access. Repository pattern. SQL queries.

## Rules
- All database queries live here. No SQL outside this directory.
- Use the query builder from `src/data/query-builder.ts`. Never raw SQL.
- Repository functions return domain types, never database row types.
- Map database types to domain types in `src/data/mappers/`.
- All queries must have corresponding tests using the test database.
- Use transactions for multi-step mutations.
```

### tests/AGENTS.md

```markdown
# Testing Rules

## Structure
- Unit tests: co-located, `<name>.test.ts`
- Integration tests: `tests/integration/<name>.test.ts`
- E2E tests: `tests/e2e/<name>.test.ts`

## Rules
- Use factory functions for test data: `createTestPayment(overrides)`.
- Never use hardcoded fixture files.
- Mock external services at the boundary only.
- Never mock internal modules (no `jest.mock('../src/services/payment')`).
- Each test must be independent. No shared mutable state.
- Use `beforeEach` for setup, never module-level side effects.
- Integration tests require Docker (test database). Run via `docker compose up test-db`.
```

This pattern gives every directory its own focused context. When an agent works in `src/services/`, it loads the root AGENTS.md (universal rules) plus `src/services/AGENTS.md` (service-specific rules). It doesn't load the UI rules, the data rules, or the testing rules unless it traverses into those directories.

The attention savings are enormous. Instead of holding 200 lines of rules (many irrelevant to the current task), the agent holds 80 lines of universal rules plus 15 lines of directory-specific rules. Every rule in context is directly relevant to the current operation.

### How Scoped Rules Interact

When using scoped rules, you need a clear policy on how they interact:

1. **Subdirectory rules ADD to root rules.** The agent always loads the root AGENTS.md plus any subdirectory AGENTS.md for the current working directory.
2. **Subdirectory rules OVERRIDE root rules on conflict.** If the root says "use descriptive variable names" and a subdirectory says "use single-letter variables in mathematical functions," the subdirectory wins within that directory.
3. **Rules propagate downward.** A rule in `src/AGENTS.md` applies to `src/services/`, `src/data/`, etc., unless overridden by a more specific rule.

This is similar to how CSS cascading works — more specific rules override less specific ones, and all rules accumulate unless there's a conflict.

## Context Engineering Anti-Patterns from the Field

Beyond the formal failure modes, there are several recurring anti-patterns I've observed across teams adopting agent-first development. These aren't theoretical — they're patterns I've seen play out in real codebases with real consequences.

### Anti-Pattern: The Mega-Context File

Some teams, realizing the importance of context, create a single massive instruction file that attempts to cover every possible scenario. I've seen AGENTS.md files exceeding 500 lines, covering everything from the project architecture to detailed style guides to deployment procedures to incident response protocols.

The result is predictable: the agent follows the rules that happen to be at the top and bottom of the file (where attention is strongest) and ignores the rules in the middle (where they're lost). Critical deployment procedures sit in the middle of the file, effectively invisible.

The fix: split the mega-file into scoped files. Put universal rules in the root AGENTS.md. Put deployment procedures in `docs/runbooks/deployment.md`. Put style guides in the relevant subdirectory's AGENTS.md. Each file stays lean and focused.

### Anti-Pattern: The Example Overload

Examples are powerful teaching tools, but there's a point of diminishing returns. Some instruction files include five or more code examples for every rule — showing the wrong way, the right way, the alternative way, the edge case, and the historical way. Each example might be 10-20 lines of code.

The result: the examples consume more context than the rules themselves. The agent spends its attention processing examples rather than understanding the principle behind them.

The fix: one DO/DON'T pair per rule. If a rule is complex enough to need multiple examples, the rule itself may be too complex. Consider splitting it into simpler rules.

### Anti-Pattern: The Config Drift

When using multiple agent tools (Claude Code, Cursor, Copilot), teams sometimes let their instruction files drift apart. CLAUDE.md gets updated with a new rule, but .cursorrules doesn't. AGENTS.md reflects a recent architectural change, but copilot-instructions.md still references the old structure.

The result: different agents in the same codebase follow different rules. Code produced by Claude Code looks different from code produced by Cursor, even for the same type of task. This inconsistency makes the codebase harder to maintain and confuses agents that read each other's code.

The fix: symlinks or automated synchronization. One source of truth (AGENTS.md) propagated to all tool-specific files. If you must have tool-specific overrides, they should be clearly additive, not contradictory.

### Anti-Pattern: The Stale Skeleton

Many teams create their AGENTS.md when the project starts, then never update it. The file reflects the original architecture — which may have evolved significantly. New directories have been added, conventions have changed, testing frameworks have been swapped, but the instruction file is frozen in time.

The result: agents following the original rules produce code that fits the original architecture but not the current one. The misalignment grows over time, and the agent's code quality degrades progressively.

The fix: put AGENTS.md review on a monthly calendar. Include it as part of your architecture review process. When the architecture changes, update the instruction file first — before writing any code with agents.

## Logging Failure Modes in Context Engineering

Context engineering can go wrong in specific, predictable ways. Understanding these failure modes helps you diagnose and prevent them.

### Failure Mode 1: Context Shadowing

**What happens:** A weaker, more recent signal overrides a stronger, older signal.

**Example:** AGENTS.md says "never use `any`." But in session history, the agent wrote `any` in three places and wasn't corrected. The model concludes that `any` must be acceptable in practice, despite the explicit rule.

**Prevention:** Keep permanent context (AGENTS.md) separate from and higher-priority than session history. If your agent platform treats all context equally, periodically re-state critical rules: "Reminder: never use `any` type."

### Failure Mode 2: Context Drift

**What happens:** The agent gradually shifts its behavior over a long session as accumulated context changes the effective "rules" it follows.

**Example:** An agent starts a session following the rule "services never import from runtime." Over the course of a long session implementing 15 features, it reads files where services DO import from runtime (legacy code that predates the rule). By feature 12, it's regularly violating the rule because the accumulated context (recent file reads) has more weight than the original rule.

**Prevention:** Session resets at natural boundaries. When you finish a feature and start the next one, start a fresh session. The rule reloads from scratch.

### Failure Mode 3: Context Contamination

**What happens:** Incorrect information enters the context (from a stale doc, a misleading error message, or a hallucinated prior conversation) and corrupts subsequent decisions.

**Example:** An agent reads an outdated ADR that says "use REST for all APIs." The team has since moved to GraphQL for new endpoints. The agent implements a REST endpoint for a feature that should have been GraphQL.

**Prevention:** Aggressive doc freshness enforcement (from Chapter 5). When ADRs are superseded, mark them "Superseded by ADR-XXX." Don't delete them (they're historical records) but make the superseded status impossible to miss.

### Failure Mode 4: Context Flooding

**What happens:** A tool or retrieval system returns far more information than needed, drowning the signal in noise.

**Example:** The agent searches for "payment" across the entire codebase and gets 500 matches across 50 files, consuming 15,000 tokens of context. The 20 tokens it actually needed (the PaymentGateway interface) are buried in the flood.

**Prevention:** Targeted searches. Restrict search scope. Use `head` to limit results. Design your codebase structure so that the agent knows WHERE to look without searching broadly.

### Failure Mode 5: Context Amnesia

**What happens:** Critical context is evicted from the context window because the session has grown too long. The agent "forgets" rules it was following earlier.

**Example:** In a 50,000-token session, the agent follows the "never use `any`" rule for the first 20 actions but starts using `any` in later actions because the original rule has been pushed out of the context window by accumulated session history.

**Prevention:** This is the most technically challenging failure mode because it depends on the agent platform's context management. Strategies include:
- Periodic re-injection of critical rules
- Session resets
- Summarization at checkpoints to compress history
- Putting the most critical rules in system prompts (which some platforms keep permanently in context)

### Diagnosing Failure Modes

When an agent produces code that violates your rules, the debugging process should start with the context, not the model. Ask:

1. **Was the rule in context?** Check if the relevant AGENTS.md or doc was loaded.
2. **Where was it positioned?** If it was buried in the middle of a long file, it may have been missed.
3. **Was it contradicted?** Check if any other context (code, docs, session history) said something different.
4. **Was there too much noise?** Check the total context size. If it was large, the signal may have been drowned.
5. **When did the failure occur?** If it was late in a long session, context amnesia or drift may be the cause.

Most "the model isn't following my rules" problems are actually "my rules aren't getting the attention they deserve" problems. And that's a context engineering problem, not a model capability problem.

### Building a Context Debugging Log

For teams serious about optimizing their context architecture, I recommend maintaining a **context debugging log** — a simple record of agent failures and their root causes. Over time, patterns emerge that point to systemic context engineering problems.

```markdown
# Context Debugging Log

## 2024-03-15: Agent used `any` type despite explicit rule
- **Context size:** ~12,000 tokens
- **Rule location:** AGENTS.md line 23 (middle of coding rules section)
- **Root cause:** Context shadowing — session history contained 3 instances 
  of `any` usage that weren't corrected
- **Fix:** Added `any` to lint rules as error. Added reminder at end of AGENTS.md.

## 2024-03-18: Agent placed database query in service file
- **Context size:** ~8,000 tokens
- **Root cause:** Agent didn't load src/services/AGENTS.md (scoped rules)
- **Fix:** Verified scoped rules are being loaded. Added explicit reference in 
  root AGENTS.md: "See src/services/AGENTS.md for service-specific rules."

## 2024-03-22: Agent implemented REST endpoint for GraphQL-only feature
- **Context size:** ~15,000 tokens
- **Root cause:** Context contamination — read outdated ADR that specified REST
- **Fix:** Marked ADR-007 as superseded by ADR-015 (GraphQL migration).
  Added freshness check to CI.
```

This log serves double duty: it helps you fix immediate problems, and it provides data for systematic context architecture improvements. After a month of logging, you'll see clear patterns — which rules are most frequently violated, which files are most commonly misunderstood, which failure modes are most prevalent.

## Putting It All Together: The Context Engineering Diagnostic

Here's a framework you can use to evaluate and improve your context architecture:

```
Context Engineering Diagnostic Checklist:

INSTRUCTIONAL LAYER
□ Root AGENTS.md under 100 lines?
□ Rules are imperative, not descriptive?
□ No contradictions between rules?
□ Last reviewed within 30 days?
□ Commands section includes test, lint, build?
□ Architecture section matches current codebase?

KNOWLEDGE LAYER
□ Docs organized by topic in small files?
□ Each doc is self-contained?
□ ADRs have current status?
□ No docs older than 90 days without freshness check?
□ Critical rules front-loaded in each doc?

STATE LAYER
□ Test output is verbose and specific?
□ Error messages are descriptive?
□ Git status available to agent?
□ Recent changes visible?

RETRIEVAL STRATEGY
□ JIT retrieval is default, pre-loading is exception?
□ Files small enough for precise retrieval?
□ Search scope restricted by convention?
□ Tool outputs filtered and targeted?

MEMORY MANAGEMENT
□ Sessions reset between tasks?
□ Summaries used at checkpoints?
□ Critical rules re-injected if sessions run long?
□ State summarized, not process?

FAILURE MODE PREVENTION
□ No stale documentation in context?
□ Scoped rules for subdirectories?
□ CI enforces doc freshness?
□ Context size monitored (tokens per action)?
```

This diagnostic should be run weekly in active development, monthly in maintenance mode. It takes about 15 minutes and catches 80% of context engineering problems before they manifest as agent failures.

## Context at Scale: How Stripe Serves Context to 1,300+ Agents Per Week

Stripe's Minions system — their fleet of one-shot, end-to-end coding agents — represents one of the most demanding context engineering challenges in production. Over 1,300 autonomous PRs per week, each requiring precise, well-structured context to produce correct code in a financial services codebase with regulatory requirements.²

**The MCP Toolshed: Context as Tool Infrastructure.** Stripe didn't just write instruction files. They built a central MCP (Model Context Protocol) server called the Toolshed, aggregating over 400 internal and external tools into a single interface that every agent accesses. Each tool description is itself a form of context — it tells the agent what's available, what the constraints are, and how to use it correctly. The Toolshed isn't just a tool registry; it's a context delivery system that ensures every agent has access to the same standardized, up-to-date information about Stripe's internal APIs, services, and conventions.

**The Devbox: Context Through Isolation.** Each Minion task runs in a pre-warmed, isolated EC2 instance called a Devbox — a clean environment with the full repository, dependencies pre-installed, and the development server ready to run. This is context engineering through infrastructure: instead of loading context about the environment into the agent's instructions, Stripe builds the environment so the agent can discover it directly. The agent doesn't need to read a doc about how to start the dev server — it's already running. It doesn't need instructions about which Node version to use — the Devbox has the right one. The infrastructure IS the context.

**Deterministic + Agentic: Constraining the Context Problem.** Perhaps the most important lesson from Stripe's approach is their hybrid architecture. Minion workflows are divided into deterministic nodes (fixed steps that always execute the same way) and agentic nodes (AI-powered steps with flexibility). This dramatically reduces the context engineering burden because deterministic nodes don't need AI context at all — they're simple code. Only the agentic nodes need carefully curated context, and those nodes are scoped to specific, well-defined tasks within the larger workflow.

**Lesson for your context architecture:** Context at scale requires *infrastructure*, not just good prompts. The larger your agent operation, the more you need to invest in the systems that deliver context — tool registries, isolated environments, and hybrid workflows that minimize the surface area where context engineering is critical. A solo developer can curate context by hand. A team running 1,300 agents per week needs the context to deliver itself.

## Context Degradation and Drift

Context engineering isn't a one-time investment. Context degrades over time, and the larger and more active your codebase, the faster it degrades. Understanding degradation patterns is essential for maintaining a healthy context architecture.

**How context degrades:**

1. **AGENTS.md goes stale.** The architecture described in AGENTS.md drifts from the actual architecture as teams make pragmatic decisions. New directories are added without updating the file. Conventions change but the rules don't. After three months without maintenance, AGENTS.md becomes a mix of accurate rules and outdated fiction.

2. **Comments contradict code.** As agents modify code, comments from earlier sessions may no longer match the implementation. An agent reads a comment that says "this function always returns a Promise" but the function now returns a Result type. The comment is context pollution — it actively misleads.

3. **Dependencies evolve but docs don't.** A third-party library updates its API, but the internal documentation still describes the old API. Agents follow the documented API and produce code that doesn't work with the current version.

4. **Pattern proliferation.** Over time, multiple agents working independently introduce slightly different patterns for the same task. Five different error handling approaches. Three different ways to structure a repository function. The codebase becomes inconsistent, and the inconsistency is itself a form of context degradation — agents see the variation and produce still more variation.

**The maintenance cliff:** Research from Angel Kurten found that 75% of AI-maintained codebases experience failures or breakages over time.³ This isn't because the AI produces bad code initially — it's because context degrades, and degraded context produces progressively worse code. It's a compounding problem: each piece of stale context makes the next agent session slightly less effective, which produces slightly worse code, which adds slightly more stale context.

**Solutions for context degradation:**

- **Automated context freshness checks.** CI jobs that verify AGENTS.md matches the actual directory structure, that referenced commands still exist, and that cited conventions are consistent with linter rules.
- **Context linters.** Custom tools that flag stale documentation — comments that reference deleted files, ADRs that describe deprecated patterns, instructions that contradict the current codebase.
- **Garbage collection agents.** Dedicated agents (covered in Chapter 19) that periodically scan for and fix context degradation: updating stale comments, archiving outdated docs, flagging AGENTS.md inconsistencies.
- **Monthly context review.** A human review of all agent-facing instruction files, checking that they match the current state of the codebase. This is low-effort (30 minutes per month) and high-impact.

The key principle: **context quality is a maintenance problem, not a creation problem.** Writing good context once is necessary but insufficient. Maintaining it over time is where the real discipline lies.

## The Art of What to Leave Out

I want to close this chapter with the most important principle in context engineering, one that's easy to understand intellectually but surprisingly hard to practice:

**The hardest part of context engineering is not deciding what to include. It's deciding what to leave out.**

Every piece of context you include has a cost — not in tokens alone, but in attention. Every line that doesn't directly help the agent do its current task is a line that dilutes the signal from the lines that do. Every file you load "just in case" is a file that makes it slightly harder for the agent to find the information it actually needs.

The discipline of context engineering is the discipline of restraint. Of resisting the urge to add "one more helpful document." Of trusting that a well-structured codebase and a focused instruction file will guide the agent better than an encyclopedia of documentation.

### The Inclusion Bias and How to Fight It

There's a cognitive bias at work here that I call the **inclusion bias** — the tendency to include information because you *can*, not because you *should*. It manifests in several ways:

1. **The Just-in-Case Bias:** "We might need this documentation about our caching strategy. Let me include it." But the agent isn't working on caching today. It's working on payment processing. The caching documentation is noise.

2. **The Completeness Bias:** "If I don't explain the full context, the agent won't understand." But the agent doesn't need to understand the full context. It needs to understand the specific task at hand.

3. **The Consistency Bias:** "I included this information for the last task, so I should include it for this one too." But different tasks need different context. The previous task's context may be irrelevant to the current one.

4. **The Documentation Bias:** "We spent weeks writing this documentation. We should use it." But documentation written for human consumption is rarely optimized for agent consumption. The format, structure, and level of detail are different.

Fighting the inclusion bias requires a deliberate practice: for every piece of context you're considering including, ask yourself: "If the agent spends attention on this instead of something else, will it produce better code?" If the answer isn't a clear yes, leave it out.

### The Confidence Test

Here's a practical test I use. Before starting an agent task, I list everything I'm planning to include in the context. Then I go through the list and rate each item:

- **Essential** — The agent cannot complete the task without this.
- **Helpful** — This will improve the quality of the output.
- **Nice to have** — This might be relevant but probably isn't.
- **Harmful** — This could confuse or distract the agent.

Only Essential and Helpful items make the cut. Nice-to-have items are excluded unless the task is particularly complex and needs extra context. Harmful items are removed immediately.

What counts as harmful? Things like:
- Outdated documentation that contradicts current practice
- Historical context about rejected approaches
- Style guides that describe the team's preferences but don't affect code correctness
- Background information about the business domain that isn't relevant to the specific coding task
- Conversational context from previous sessions that doesn't directly bear on the current task

The goal is to reach a state where every token in the agent's context window is pulling its weight — contributing directly to the quality of the output. When you achieve this, the results are remarkable: agents produce correct, conventions-compliant code on the first attempt, with minimal iteration required.

In the next chapter, we'll look at the practical implementation of the instructional layer — the AGENTS.md open standard, cross-tool compatibility, and how to write instructions that actually work.

---


---

## Footnotes

¹ Liu, Nelson F. et al., "Lost in the Middle: How Language Models Use Long Contexts," arXiv, July 2023. https://arxiv.org/abs/2307.03172

² Stripe Engineering, "Minions: Stripe's One-Shot End-to-End Coding Agents," stripe.dev, 2025. https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents

³ Angel Kurten, "75% of AI Agents Break Code They Maintain," angelkurten.com, 2025. https://angelkurten.com/blog/ai-agents-breaking-codebases

---

## Key Takeaways

1. **The five-layer context stack** (Instructional, Knowledge, State, Tool, Memory) provides a mental model for all agent-facing information. Optimize each layer independently.

2. **Minimum viable context** is surprisingly small: ~4,000-5,000 tokens for most coding tasks. The problem isn't context capacity — it's context quality.

3. **Separate permanent from runtime context.** Permanent context (rules, architecture) sits at the beginning of the attention window. Runtime context (session history) accumulates at the end. Protect the permanent.

4. **Just-in-time retrieval beats pre-loading** for knowledge-layer context. Structure your files for precise retrieval: small, focused, well-named.

5. **Summarize aggressively** — state, not process. Preserve decision rationale and failure modes. Use structured summaries.

6. **The "Lost in the Middle" effect** means critical information at the top or bottom of files is attended to more reliably than information in the middle. Use the inverted pyramid structure.

7. **Scoped modular rules** (per-directory AGENTS.md files) dramatically reduce the context load for any single operation while maintaining comprehensive coverage across the codebase.

8. **Five failure modes** — shadowing, drift, contamination, flooding, amnesia — account for most "the agent isn't following my rules" problems. Diagnose the context first.

---

*Next: Chapter 7 — The Instruction Layer: AGENTS.md, CLAUDE.md, .cursorrules →*
