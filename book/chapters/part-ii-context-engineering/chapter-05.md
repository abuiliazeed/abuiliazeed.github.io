# Chapter 5: Context Engineering — The Map, Not the Manual

---

> *"The art of being wise is the art of knowing what to overlook."*
> — William James

---

Here is the most counterintuitive fact about working with AI coding agents: **giving them more context often makes them worse.**

Not a little worse. Dramatically, measurably worse. I've watched agents produce elegant, well-targeted code with a carefully curated 3,000 tokens of context, then spiral into confusion and contradiction when handed 30,000 tokens of "helpful background." I've seen the same model, the same task, the same repository go from a clean first-pass solution to three failed retries and a hallucinated import — all because someone decided to be "thorough."

If you take only one lesson from this entire section of the book, let it be this: context engineering is not about providing *more* information. It's about providing the *right* information, in the *right structure*, at the *right time*.

That distinction is the difference between an agent that ships production code and one that generates expensive noise.

## Why More Context Can Hurt (The Firehose Effect)

Let's start with why this is so hard. Software engineers are trained to value completeness. We write comprehensive documentation, detailed specs, thorough comments. Our instinct when an agent makes a mistake is to give it more information — more files, more context, more explanation. Surely if it just *understood* the full picture, it would get it right.

This instinct is exactly wrong.

Here's what happens inside a large language model when you overload its context window. Every token you add dilutes the attention available to every other token. The model doesn't have a separate "important stuff" bucket and "background reading" bucket. It has one continuous stream of tokens, and its attention mechanism — the mathematical machinery that decides what to focus on — has to distribute itself across all of them equally.

Think of it like a conversation at a crowded party. If you're talking to one person in a quiet room, you can hear every word. If fifty people are talking simultaneously, you can still hear, but you have to work much harder to distinguish the signal from the noise. And if two hundred people are talking? The information is technically all there, but you can't extract it. Your attention is spread too thin.

Agents experience context windows the same way. A well-curated 3,000 tokens of context is like a quiet conversation: every instruction is heard clearly. A bloated 30,000 tokens is like a crowded party: the agent can still function, but it misses things. And a 100,000-token context loaded with "everything we thought might be relevant" is the conversational equivalent of a rock concert: technically audible, practically incomprehensible.

Researchers at Stanford, UC Berkeley, and others documented this phenomenon rigorously in a 2023 paper titled "Lost in the Middle: How Language Models Use Long Contexts."⁵ Their finding was stark: when relevant information is buried in the middle of a long context, models retrieve it far less reliably than when it's at the beginning or end. The effect isn't subtle. In some configurations, retrieval accuracy dropped from nearly 100% to below 50% simply by placing the key information in the middle of the context rather than at the edges.

We'll explore the full implications of this research in Chapter 6. For now, the practical takeaway is clear: **every unnecessary token in your agent's context window is actively harming its performance.**

I call this the **firehose effect** — the deluge of information that feels productive to provide but is destructive to consume. And it's the central problem that context engineering exists to solve.

### The Firehose in Practice

Imagine you're onboarding a new engineer to your team. You wouldn't hand them a 500-page binder of every document your company has ever produced and say "here, read this, then implement the checkout feature." You'd give them a focused orientation: the architecture overview, the relevant code modules, the API documentation, the coding conventions, and the specific task description. Maybe 20 pages total.

Yet that's exactly what most teams do with AI agents. They dump the entire repository README, every design doc, all the inline comments, the full dependency tree, and a vague instruction like "implement the feature described in ticket #427" — then wonder why the agent produces code that contradicts the conventions described in the third paragraph of page 47 of the documentation.

I've seen teams provide agents with:
- The entire repository README (2,000+ words of company history and setup instructions)
- Every architecture decision record ever written (35 ADRs spanning three years)
- The full API documentation (hundreds of endpoints, most irrelevant to the current task)
- The team's coding style guide (a Google Doc exported to 50 pages of markdown)
- The project's Notion workspace (meeting notes, design discussions, and half-formed ideas)
- A "comprehensive" task description that includes background, motivation, stakeholder opinions, and implementation suggestions

All of this for a task that requires modifying three files in a single service. The agent's context window is so full of background information that the actual task details — the specific files to modify, the exact behavior to implement — are diluted to near-invisibility.

The OpenAI team, in their landmark harness engineering blog post, described this realization clearly.¹ When they set out to generate one million lines of code with zero human-written lines, they discovered that the quality of agent output was almost entirely determined not by the sophistication of their prompts, but by the architecture of their context. Their AGENTS.md file — the "table of contents" that orients every agent to the codebase — was approximately 100 lines. Not 100 pages. One hundred lines.

Let's look at why that works.

## AGENTS.md as Table of Contents

The single most important file in any agent-first codebase is the instruction file — what OpenAI popularized as AGENTS.md. This file serves as the map that every agent reads before taking any action. It's not a manual. It doesn't try to explain everything. It's a **table of contents** — a structured, scannable guide that tells the agent where things are, what the rules are, and how to navigate.

Here's what a production-grade AGENTS.md looks like, modeled on the pattern the OpenAI team described:

```markdown
# Project: Checkout Service

## Overview
Payment processing microservice. Handles cart finalization, payment gateway
integration, and order creation. Written in TypeScript, runs on Node.js 20+.

## Architecture
- `src/types/` — Shared type definitions and Zod schemas
- `src/config/` — Environment config, feature flags
- `src/data/` — Database queries, repository pattern
- `src/services/` — Business logic layer
- `src/runtime/` — HTTP handlers, middleware, server setup
- `src/ui/` — Admin dashboard React components

Dependency direction: Types → Config → Data → Services → Runtime → UI
Never import from a lower layer into a higher layer.

## Commands
- `npm test` — Run all tests
- `npm run test:path` — Run tests for a specific file
- `npm run lint` — ESLint + Prettier check
- `npm run build` — TypeScript compilation
- `npm run db:migrate` — Run database migrations

## Coding Rules
- Use Zod for all runtime validation. Never trust raw API input.
- All async functions must have explicit error handling (try/catch or Result type).
- Never use `any`. Use `unknown` and narrow with type guards.
- Database queries go in `src/data/` repository files only.
- Services never import from runtime. Runtime imports from services.
- All new endpoints must have integration tests in `tests/integration/`.

## Testing
- Unit tests co-located with source files: `payment.service.test.ts`
- Integration tests in `tests/integration/`
- Use factory functions for test data, not fixtures.
- Mock external services at the boundary (gateway client), never internal modules.

## Known Patterns
- Payment processing follows the Saga pattern. See `src/services/payment.saga.ts`.
- Error handling uses the Result monad from `src/types/result.ts`.
- Feature flags checked via `src/config/flags.ts` — always check before implementing.

## PR Conventions
- Title format: `[area] description` (e.g., `[payments] add Apple Pay support`)
- Include a test plan in the PR description.
- Never modify `src/types/` without updating the schema migration.
```

That's about 50 lines. The OpenAI team kept theirs around 100. The exact length matters less than the structure. What makes this work is that every line is **high-signal, zero-fluff**. There's no introductory paragraph about the company's mission. There's no history of why the project was started. There's no philosophical musing on the nature of payment processing. Just the facts the agent needs, organized so it can find them instantly.

### Why "Table of Contents" and Not "Manual"

The distinction matters more than it sounds. A **manual** tries to teach understanding. It explains concepts, provides background, walks through examples. A **table of contents** provides orientation. It says: here's where things are, here's how they connect, here are the rules you must follow.

Agents don't need to *understand* your payment processing philosophy. They need to know that dependency direction goes from Types to UI and never the reverse. They need to know that `npm test` is how you verify code, not `npm run check` or `npm run validate`. They need to know that `any` is forbidden and Zod is mandatory.

This is a fundamental shift in how we think about documentation. Traditional documentation serves two audiences: humans who need to build mental models, and humans who need quick reference. Agent instruction files serve a fundamentally different audience: a statistical model that needs precise, unambiguous signals about what to do and what not to do.

The implications are profound:

1. **Precision beats completeness.** It's better to have 50 lines that are exactly right than 500 lines that are mostly right.
2. **Structure beats prose.** Bulleted lists, headers, and tables are processed more reliably than paragraphs.
3. **Rules beat explanations.** "Never use `any`" is stronger than "We generally prefer type safety."
4. **Examples beat descriptions.** `[payments] add Apple Pay support` teaches more than "Use descriptive PR titles."
5. **Negative examples are gold.** Telling an agent what NOT to do is often more valuable than telling it what TO do, because agents have strong default behaviors that may not match your preferences. For instance, an agent might default to using `console.log` for debugging because that's common in its training data. A rule like "Never add console.log statements. Use the structured logger from `src/utils/logger.ts`" overrides this default explicitly.
6. **Boundaries beat guidance.** "Don't modify files outside src/services/" is more effective than "Focus on the services layer." Clear boundaries prevent scope creep more effectively than vague directional guidance.

### The Hundred-Line Constraint

I recommend treating 100 lines as a soft ceiling for your root AGENTS.md. The 100-line rule (explained with full rationale and evidence in Chapter 7) forces you to make hard choices about what matters. If you can't fit your project's orientation into 100 lines, it usually means your architecture is too complex, you're explaining instead of instructing, or you need subdirectory instruction files — all of which we'll address in Chapters 6 and 7.

## Structured docs/ as System of Record

AGENTS.md provides orientation. But agents also need reference material — design documents, API specifications, architectural decisions, runbooks. This is where your `docs/` directory comes in.

The key principle: **docs/ is for reference, not orientation.** The agent reads AGENTS.md before every action. It reads docs/ only when it needs specific information. This means your docs/ structure needs to be predictable, searchable, and designed for retrieval.

Here's the pattern I recommend:

```
docs/
├── architecture/
│   ├── overview.md          # System architecture diagram (text description)
│   ├── dependency-graph.md  # Module dependency rules
│   └── decisions/           # Architecture Decision Records
│       ├── 001-use-saga-pattern.md
│       ├── 002-result-monad-for-errors.md
│       └── 003-zod-validation.md
├── api/
│   ├── endpoints.md         # REST API reference
│   └── schemas.md           # Request/response schemas
├── guides/
│   ├── adding-new-feature.md
│   ├── database-migrations.md
│   └── testing-patterns.md
├── runbooks/
│   ├── deployment.md
│   ├── incident-response.md
│   └── rollback.md
└── plans/
    ├── 2024-q1-checkout-redesign.md
    └── 2024-q2-payment-methods.md
```

Each document should be:
- **Titled clearly** so the agent (or a retrieval system) can find it by name
- **Self-contained** so reading one document doesn't require reading three others
- **Factual** — focused on what IS, not what SHOULD BE
- **Current** — which brings us to the hardest part

### Mechanically Enforced Freshness

Documentation rots. Everyone knows this. In traditional development, stale documentation is an annoyance. In agent-first development, stale documentation is a **runtime error** — because the agent will faithfully follow outdated instructions and produce code that doesn't work.

Let me be concrete about what this looks like. I consulted with a team whose AGENTS.md file said "use the Express.js framework for all HTTP handlers." Six months earlier, they had migrated to Fastify. The AGENTS.md hadn't been updated. Every agent that read this file faithfully wrote Express-style handlers — different middleware patterns, different request/response typing, different error handling — that then had to be manually rewritten to use Fastify conventions. Multiply this by hundreds of agent actions over months, and you can see how a single stale line in an instruction file can waste enormous engineering time.

The OpenAI team addressed this by making documentation freshness a mechanical property, not a social one. They didn't rely on engineers to remember to update docs. They built systems that enforced it.

Here are the patterns that work:

**1. Code-generated documentation.** Wherever possible, generate docs from code rather than maintaining them separately. If your API docs are generated from your OpenAPI spec, which is generated from your route definitions, they can't go stale. The code is the documentation.

**2. Test-referenced documentation.** Link documentation to tests. If a guide says "use the Result monad for error handling," there should be a test that verifies new code follows this pattern. If someone changes the pattern, the test breaks, and the doc update is forced.

**3. Plan-document gating.** Treat plan documents like code. When an agent finishes implementing a plan, the plan should be marked as complete or archived. Stale active plans are one of the most insidious forms of context pollution — an agent might read a six-month-old plan and start implementing features that were already shipped.

**4. CI-enforced doc checks.** Simple automated checks go a long way:
- Do all ADRs (Architecture Decision Records) have a status field?
- Are any plans older than 30 days still marked as "active"?
- Do all API docs match the current route registrations?
- Are there TODO markers in documentation that are older than 90 days?

These aren't sophisticated checks. They're the documentation equivalent of linting. But they prevent the slow drift that turns a helpful docs/ directory into a minefield of outdated information.

## Plans as First-Class Artifacts

Plans deserve special attention because they're the most powerful and most dangerous tool in your context architecture.

A good plan gives an agent everything it needs to execute a complex, multi-step task without human intervention. It breaks down the work into ordered steps, specifies the files to modify, the tests to write, the verification criteria. A well-structured plan can turn a 30-minute back-and-forth coding session into a single agent invocation that runs for 20 minutes and produces a clean, complete implementation.

A bad plan — vague, incomplete, or outdated — is worse than no plan at all. It gives the agent false confidence, leading it down a path that doesn't match reality, producing code that looks right but is structurally wrong.

Here's what a good plan looks like:

```markdown
# Plan: Add Stripe Payment Method Support

## Context
Users can currently pay with credit cards via the PaymentService.
We need to add Stripe as an alternative payment gateway.

## Prerequisites
- Stripe API key available in environment as `STRIPE_SECRET_KEY`
- Stripe webhook endpoint already configured in staging

## Steps

### Step 1: Create Stripe Gateway Client
- **File**: `src/services/stripe-client.ts`
- **What**: Implement `PaymentGateway` interface from `src/types/payment.ts`
- **Rules**:
  - Use the official `stripe` npm package
  - All amounts in cents (multiply dollar amounts by 100)
  - Handle `StripeCardError` and `StripeRateLimitError` specifically
  - Return `Result<PaymentConfirmation, PaymentError>` from all methods
- **Test**: `src/services/stripe-client.test.ts`
  - Mock Stripe API responses
  - Test success case, card decline, rate limit, network error

### Step 2: Register Stripe in Gateway Factory
- **File**: `src/services/gateway-factory.ts`
- **What**: Add `stripe` case to the factory switch
- **Rules**: Read gateway config from `src/config/payment.ts`

### Step 3: Add Feature Flag
- **File**: `src/config/flags.ts`
- **What**: Add `ENABLE_STRIPE` flag, default `true` in staging, `false` in prod
- **Test**: Verify feature flag check in gateway factory test

### Step 4: Integration Test
- **File**: `tests/integration/stripe-payment.test.ts`
- **What**: End-to-end test using Stripe test mode
- **Rules**: Use Stripe test card `4242424242424242`

### Step 5: Update Documentation
- **File**: `docs/api/endpoints.md`
- **What**: Document `stripe` as a valid payment_method value

## Verification
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] Integration test creates and confirms a Stripe payment
- [ ] No imports violate dependency direction rules

## Scope Boundaries
- Do NOT modify the checkout UI
- Do NOT modify the order creation flow
- Do NOT change the database schema
```

Notice what makes this plan effective:

- **Files are specified.** The agent doesn't have to guess where to put things.
- **Rules are explicit.** "Amounts in cents" prevents a common class of bugs.
- **Tests are specified alongside code.** The agent writes tests as it goes, not as an afterthought.
- **Scope boundaries are explicit.** The agent knows what NOT to touch.
- **Verification is concrete.** `npm test` passing is a binary check, not a subjective judgment.

### Plans as Living Documents

Plans aren't just instructions for agents. They're **communication artifacts** that bridge human intent and agent execution. A well-written plan can be reviewed by a human engineer in two minutes, approved, and then executed autonomously by an agent for twenty minutes. That's a 600:1 leverage ratio on engineering time.

This means plans deserve the same care as code. They should be:
- **Version-controlled** alongside the code they describe
- **Reviewed** before agent execution (a two-minute human review saves a twenty-minute agent mistake)
- **Marked complete** when implementation finishes
- **Archived** to prevent stale plans from confusing future agent sessions

The OpenAI team treated plans as first-class artifacts in their development workflow. A plan wasn't a casual note — it was a specification that, once approved, became the agent's contract. The agent was accountable to the plan, and the plan was accountable to the human who approved it.

## The Knowledge Architecture Pattern

Let's step back and look at the full picture. Your context architecture — the complete system of information that agents consume — has six distinct layers:

```
┌─────────────────────────────────────────────┐
│  Layer 6: PLANS                             │
│  Task-specific execution blueprints         │
│  (per-task, ephemeral)                      │
├─────────────────────────────────────────────┤
│  Layer 5: RUNTIME STATE                     │
│  Current branch, recent changes, test       │
│  results, build status                      │
│  (per-session, dynamic)                     │
├─────────────────────────────────────────────┤
│  Layer 4: REFERENCE DOCS                    │
│  Architecture decisions, API specs,         │
│  guides, runbooks                           │
│  (docs/, relatively stable)                 │
├─────────────────────────────────────────────┤
│  Layer 3: CODEBASE CONTEXT                  │
│  The actual source code, imports, types     │
│  (per-operation, on-demand)                 │
├─────────────────────────────────────────────┤
│  Layer 2: PROJECT INSTRUCTIONS              │
│  AGENTS.md, .cursorrules, coding rules      │
│  (root-level, stable)                       │
├─────────────────────────────────────────────┤
│  Layer 1: PLATFORM CONTEXT                  │
│  Agent identity, capabilities, tool access  │
│  (pre-configured, rarely changes)           │
└─────────────────────────────────────────────┘
```

Each layer serves a different purpose, has a different lifecycle, and requires different maintenance strategies. Let's walk through them from bottom to top.

### Layer 1: Platform Context

This is the agent's identity — what model it is, what tools it has access to, what capabilities it possesses. You don't usually control this directly; it's determined by your choice of agent platform (Codex, Claude Code, Cursor, etc.). But you should understand it, because it determines the baseline of what the agent can and cannot do.

For example, Claude Code has filesystem access and can run shell commands. Codex runs in a sandboxed cloud environment with more restricted access. Cursor operates within an IDE context. These platform differences affect what context the agent can discover on its own versus what you need to provide explicitly.

### Layer 2: Project Instructions

This is your AGENTS.md, .cursorrules, or equivalent root-level instruction file. It's the most important layer because it's the one you control most directly, and it's loaded for every agent interaction. We've already covered this extensively — the 100-line table of contents that orients every action.

### Layer 3: Codebase Context

This is the source code itself. Most agent platforms automatically load relevant files when the agent starts working — the file being edited, related imports, test files. You don't need to explicitly include source code in your instructions; the agent discovers it.

What you DO need to do is make the codebase **legible** — organized so that relevant context is easy to find. This means clear file names, consistent directory structure, and conventions that make the codebase self-documenting. We'll cover this in depth in Part III.

### Layer 4: Reference Documentation

Your docs/ directory. API specifications, architecture decision records, runbooks, guides. The agent reads these on demand when it needs specific information that isn't in the code itself. The key management challenge here is freshness — ensuring docs stay current as the codebase evolves.

### Layer 5: Runtime State

This is ephemeral context: what branch you're on, what files were recently changed, what tests are failing, what the last build output said. Most agent platforms handle this automatically, but you can enhance it. For example, some teams include a `CONTEXT.md` file that's automatically updated by CI with the current state of the system:

```markdown
# Current State (auto-generated)

Last updated: 2024-03-15T14:32:00Z
Branch: feature/stripe-payments
Recent changes:
- Added Stripe client (2 files, +340 lines)
- Updated gateway factory (1 file, +12 lines)
Failing tests: 0
Build status: passing
Lint status: passing
Known issues: none
```

This gives the agent a quick snapshot of the current state without having to discover it through exploration.

### Layer 6: Plans

Task-specific execution blueprints. Plans are the most ephemeral layer — they exist for the duration of a task and are archived when complete. They're also the most powerful, because a good plan can compress a complex multi-step implementation into a single agent invocation.

## The Context Budget: A Practical Framework

One of the most useful mental models I've developed for context engineering is the **context budget**. Just as engineering teams have sprint budgets, deployment budgets, and infrastructure cost budgets, you should think of your agent's context window as a finite budget that must be allocated wisely.

Here's the framework:

```
Context Budget Allocation (per agent action):

Instructional Layer:  15-20% of context window
  (AGENTS.md, rules, architecture overview)

Task Description:      5-10% of context window
  (specific task, plan, or issue description)

Codebase Context:     30-40% of context window
  (relevant source files, types, imports)

Runtime State:        10-15% of context window
  (test results, error messages, git status)

Tool Results:         15-25% of context window
  (file reads, search results, command output)

Headroom:             10-15% of context window
  (reserved for agent reasoning and generation)
```

Notice that the instructional layer — the part you control most directly — gets only 15-20% of the budget. This is by design. If your instructions consume 50% of the context window, the agent won't have room to read the files it needs to do its job. This is another reason to keep AGENTS.md lean: you're making a tradeoff between instruction comprehensiveness and the agent's ability to consume codebase context.

The headroom allocation is critical and often overlooked. An agent needs space to "think" — to generate its reasoning, plan its approach, and produce code. If you fill the context window to 100% with instructions and file reads, the model has no space for reasoning. This is like trying to write a complex program on a computer with 100% RAM usage — technically possible, but dramatically slower and more error-prone.

### Tracking Your Context Budget

Here's a practical technique: periodically check how much context your agents are consuming. Most agent platforms report token usage. Track it:

- **Average context size per action** — gives you a baseline
- **Maximum context size** — tells you if you're approaching limits
- **Context size vs. task complexity** — reveals if simple tasks are consuming too much context (waste) or complex tasks are consuming too little (insufficient information)

If you see simple tasks consuming 80%+ of the context window, you likely have a context bloat problem. If you see complex tasks consuming less than 30%, you likely have an information gap.

### The 80/20 of Context

In practice, about 20% of your context drives 80% of the agent's behavior. The instructional layer (AGENTS.md) is the highest-leverage 20%. The commands section within AGENTS.md is the highest-leverage part of the instructional layer. And the first 10 lines of your commands section — the exact test and lint commands — are the highest-leverage part of that.

This means that if you have limited time to invest in context engineering (and everyone has limited time), the priority order should be:

1. **Get the commands right.** Ensure the agent knows exactly how to test and lint.
2. **Get the architecture rules right.** Ensure the agent knows where code belongs and what it can import.
3. **Get the coding rules right.** Ensure the agent knows the critical conventions.
4. **Organize your docs/.** Ensure reference material is structured for retrieval.
5. **Add scoped rules.** Extend into subdirectories for monorepos and large projects.
6. **Build freshness enforcement.** Add CI checks for stale documentation.

Items 1-3 can be done in an afternoon and will have the largest immediate impact. Items 4-6 are ongoing investments that compound over time.

## Lessons from the OpenAI Team

The OpenAI team's experience building a million-line codebase with AI agents provides the most detailed case study we have in context engineering. Their blog post, published in early 2026, described the practices that made this possible. Let me extract the key lessons specific to context:

### Lesson 1: Context is the Bottleneck

The OpenAI team found that the limiting factor in agent productivity wasn't model capability — it was context quality. When agents had well-structured, focused context, they produced high-quality code on the first attempt. When context was bloated, ambiguous, or contradictory, agents produced code that looked plausible but was wrong in subtle ways.

This mirrors the "Lost in the Middle" finding from a different angle. It's not just that models struggle to find information in long contexts. It's that contradictory or ambiguous context actively degrades performance. An agent that sees "use Zod for validation" in one place and "validate with manual checks" in another will produce inconsistent code, or worse, will faithfully follow whichever instruction it happened to attend to more strongly.

The implication: **consistency matters more than completeness.** It's better to have a small set of rules that are consistently applied than a comprehensive guide that contradicts itself.

### Lesson 2: The Ralph Wiggum Loop

The OpenAI team's iterative development pattern — the Ralph Wiggum Loop, described in detail in Chapter 14 — showed that **error context is the highest-signal context.** The loop works because test failure output tells the agent exactly what went wrong and where, which is far more useful than generic instructions. The key insight: you don't need to prevent all errors in advance through exhaustive instructions. You need a fast verification loop that catches errors quickly and feeds them back as high-quality context.

### Lesson 3: Dependency Layers as Context Architecture

The layer architecture (Types → Config → Data → Services → Runtime → UI, defined in Chapter 10) wasn't just a technical choice — it was a context engineering choice. By enforcing dependency direction mechanically, the OpenAI team created a codebase where architectural rules were embedded in the structure itself. An agent just needs to follow the rule: "never import from a lower layer." The linter makes violations impossible to merge.

This is context engineering at its most elegant: **building the context into the code itself so the agent doesn't need external instructions to do the right thing.**

### Lesson 4: Garbage Collection is Context Maintenance

Dead code is context pollution. Every unused import, commented-out code block, and outdated comment competes for the agent's attention. Consider what happens when an agent reads a file with five commented-out blocks, three unused imports, and a six-month-old TODO — it may treat any of these as actionable context, all wrong.

The OpenAI team addressed this with garbage collection agents that periodically removed dead code, updated stale comments, and archived outdated documentation (see Chapter 19 for the full taxonomy of GC agents and their implementation). The key takeaway for context engineering: **code cleanliness and context quality are the same thing.** A clean codebase IS a well-context-engineered codebase.

### Lesson 5: Plans Scale Context Across Tasks

Perhaps the most overlooked aspect of the OpenAI team's approach was how they used plans to manage context across multiple related tasks. Rather than treating each agent invocation as an independent event, they used plans as a thread that connected related work.

When implementing a multi-step feature, they'd write a plan document that served as shared context across multiple agent sessions. The first session would implement Step 1 and update the plan. The second session would read the updated plan, implement Step 2, and update again. The third session would read the updated plan, implement Step 3, and so on.

This pattern solves a fundamental problem: agent sessions are stateless. When you start a new session, the agent has no memory of what happened in previous sessions. Plans bridge this gap, carrying forward the accumulated knowledge of prior sessions in a compressed, structured format.

The key design principle: plans should capture **decisions and outcomes**, not the exploration process. A plan updated after Step 1 should say "Stripe client implemented using official SDK with default config" — not "We explored three approaches and settled on the SDK." The former gives the next session actionable context. The latter gives it noise.

## Context Engineering in Practice: Lessons from Spotify's Honk

Spotify's background coding agent, Honk, provides one of the most detailed public case studies in context engineering at scale.⁴ Over 1,500 PRs merged through the system, and their engineering team published a three-part series documenting exactly how they engineered context for autonomous coding agents.

**Context delivery as infrastructure.** Spotify didn't just write a good AGENTS.md and call it done. They built a Fleet Management platform — a dedicated system for managing the context, tooling, and execution environment for every agent task. When an engineer submits a task via Slack, the platform automatically provisions the right context: the relevant codebase modules, the team's conventions, the design documents for the affected features, and the verification criteria. Context isn't assembled ad hoc by each engineer; it's delivered systematically by a platform designed for the purpose.

**The tool ecosystem as context.** One of Spotify's key insights was that the tools available to an agent are themselves a form of context. An agent that can run tests, query a database, or check a style guide has richer context than one that can only read and write files. Spotify designed Honk's tool ecosystem so that every tool also serves as a context-delivery mechanism — the testing tool doesn't just run tests, it tells the agent what tests exist and what they cover.

**Predictable results through strong feedback loops.** The most important lesson from Spotify's experience is encapsulated in their own words: "predictable results come from strong feedback loops, not more powerful models."⁴ This is the central thesis of context engineering, validated at production scale. Spotify invested heavily in the verification loop — the cycle where the agent writes code, runs tests, reads failures, and self-corrects. They found that the quality of this feedback loop was a far stronger predictor of agent success than the underlying model's capability.

**What this means for your context architecture:** Spotify's experience reinforces the principles in this chapter. The firehose effect is real — Spotify solved it by building infrastructure that delivers precisely the right context for each task. The verification loop matters more than model power — Spotify's agents succeed because they have fast, high-signal feedback, not because they use the most expensive model. And context engineering is a systems problem, not a documentation problem — it requires tooling, automation, and platform investment, not just well-written files.

## The Cost of Bad Context

Let me make this concrete with a story. A team I advised was building a feature-rich SaaS application using Claude Code as their primary coding agent. They had invested heavily in documentation — a 2,000-line README, comprehensive JSDoc comments on every function, detailed design documents in Notion, and a 500-line AGENTS.md file.

Their agents were producing mediocre code. Not terrible — but consistently missing conventions, using wrong patterns, and requiring extensive human revision.

The diagnosis: context overload. The 500-line AGENTS.md contradicted itself in three places. The README included historical context about decisions that had been reversed. The JSDoc comments described behavior that no longer matched the implementation. The design documents in Notion were six months out of date.

The prescription was ruthless:
1. Cut AGENTS.md from 500 lines to 85 lines. Remove all prose. Keep only rules and structure.
2. Delete the 2,000-line README. Replace with a 100-line project overview.
3. Mark all Notion docs as "historical" and remove from agent context.
4. Add CI checks that flag stale documentation.

The result: agent code quality improved measurably within a week. First-attempt success rate went from roughly 60% to over 85%. The team spent less time reviewing and more time specifying — which is exactly where human time should go.

### The METR Finding: Context Without Governance Slows You Down

This anecdotal experience is backed by rigorous research. The METR study (introduced in Chapter 1) found that **without proper context engineering governance, AI coding tools actually slowed developers by 19%**². The mechanism was clear: without structured context, agents produced code that *looked* right but was subtly wrong. METR's follow-up analysis showed that teams who invested in context engineering began to see genuine speedups. The difference wasn't the AI model. It was the context architecture.

This is perhaps the most important empirical finding in the entire book: **AI coding tools without context engineering are a productivity trap.** The same tools with proper context engineering become transformative.

## Building Your Context Architecture: A Checklist

Before we move to advanced techniques in the next chapter, here's a practical checklist for evaluating your context architecture:

**Root Instruction File (AGENTS.md or equivalent)**
- [ ] Under 100 lines (soft limit)
- [ ] Structured with clear headers
- [ ] Contains commands section (how to test, lint, build)
- [ ] Contains architecture overview (directory structure)
- [ ] Contains coding rules (specific, enforceable)
- [ ] Contains testing rules
- [ ] No prose — only structured information
- [ ] No contradictions between any two lines
- [ ] Reviewed and updated at least monthly

**Reference Documentation (docs/)**
- [ ] Organized by topic (architecture, api, guides, runbooks)
- [ ] Each document is self-contained
- [ ] Architecture Decision Records (ADRs) have status field
- [ ] Plans are dated and have a clear status (active/complete/archived)
- [ ] Freshness checks in CI (stale doc detection)

**Context Hygiene**
- [ ] No dead code (regular garbage collection)
- [ ] No commented-out code blocks
- [ ] No outdated comments
- [ ] No unused imports
- [ ] No stale TODO markers without dates

**Verification Loop**
- [ ] Lint runs on every agent action
- [ ] Tests run on every agent action
- [ ] Type-check runs on every agent action
- [ ] Error output is fed back to agent automatically
- [ ] Failure context is included in retry

## The Map Metaphor

I titled this chapter "The Map, Not the Manual" because the metaphor captures the essence of context engineering perfectly. A map doesn't tell you everything about a territory. It tells you what you need to navigate it: the major landmarks, the roads, the boundaries, the hazards. It leaves out the details until you need them.

Your AGENTS.md is the map. Your docs/ directory is the gazetteer — the reference you consult when you need specific detail. Your plans are the turn-by-turn directions for a specific journey. Your codebase is the territory itself.

The art of context engineering is knowing what belongs on the map, what belongs in the gazetteer, and what should be left for the agent to discover through exploration.

Martin Fowler, the renowned software architecture author, endorsed this framing in a LinkedIn post about harness engineering³: "Harness Engineering is a valuable framing of a key part of AI-enabled development. Harness includes context engineering, architectural constraints, and garbage collection." His endorsement wasn't about the specific techniques — it was about the conceptual framing. The idea that context needs engineering, that it's a discipline with its own principles and practices, resonated because it names something that many teams were experiencing but couldn't articulate.

Before the term "context engineering" existed, teams would describe their struggles as "the AI doesn't understand our codebase" or "the agent keeps making the same mistakes" or "we need better prompts." These descriptions pointed at the symptoms but missed the cause. The cause was almost always a context architecture problem — too much noise, too little signal, no clear structure for information discovery.

### Context Engineering as a Discipline

Context engineering sits at the intersection of several established disciplines:

- **Information architecture** — the art of organizing information for findability and usability
- **Technical writing** — the craft of communicating complex information clearly
- **Systems engineering** — the discipline of designing complex systems with well-defined interfaces
- **Prompt engineering** — the practice of crafting inputs for language models

But it's not just a combination of these. Context engineering has its own unique concerns:

1. **Attention economics** — unlike human readers who can skim and skip, agents distribute attention mathematically across all tokens. This makes information architecture decisions (position, order, emphasis) have a direct, measurable impact on performance.

2. **Session statelessness** — agents don't carry knowledge between sessions. Every session starts from scratch. This means all critical context must be re-loadable, and session-specific learning must be externalized into persistent artifacts (plans, updated docs, code comments).

3. **Verification-first design** — context engineering isn't just about helping agents write code. It's about helping agents *verify* code. The commands section of AGENTS.md, the testing rules, and the CI pipeline are all part of the context architecture.

4. **Mechanical enforcement** — the best context is the kind that can't go stale. Architecture encoded in linters, types, and directory structures is more reliable than architecture described in documentation.

This discipline will mature rapidly as more teams adopt agent-first development. The practices described in this section — AGENTS.md, scoped rules, freshness enforcement, context budgets — are the early patterns. Over the next few years, we'll see formalized tools, frameworks, and best practices emerge. But the fundamental principles — less is more, structure beats prose, consistency beats completeness — will endure.

In the next chapter, we'll dive deep into the architecture of the context stack — the five layers of context that every agent consumes, and how to optimize each one for maximum signal and minimum noise.

---


---

## Footnotes

¹ Ryan Lopopolo, "Harness Engineering: Leveraging Codex in an Agent-First World," OpenAI Blog, February 2026. https://openai.com/blog/harness-engineering-leveraging-codex

² METR, "Measuring the Impact of AI on Developer Productivity," arXiv, February 2025. https://arxiv.org/abs/2502.12926

³ Martin Fowler, LinkedIn post on Harness Engineering, 2026. [Citation needed — verify URL before publication]

⁴ Spotify Engineering, "Spotify's Background Coding Agent," November 2025. https://engineering.atspotify.com/2025/11/spotifys-background-coding-agent-part-1

⁵ Liu, Nelson F. et al., "Lost in the Middle: How Language Models Use Long Contexts," arXiv, July 2023. https://arxiv.org/abs/2307.03172

---

## Key Takeaways

1. **More context can hurt.** The firehose effect means every unnecessary token dilutes the agent's attention and degrades performance.

2. **AGENTS.md is a table of contents, not a manual.** Keep it under 100 lines. Structured. High-signal. Zero-fluff.

3. **Plans are first-class artifacts.** Well-structured plans turn 30-minute interactive sessions into single-shot agent invocations.

4. **Mechanically enforce freshness.** Stale documentation is a runtime error in agent-first development.

5. **The six-layer knowledge architecture** — Platform, Instructions, Codebase, Reference, State, Plans — gives you a mental model for organizing all agent-facing information.

6. **The Ralph Wiggum Loop works because error context is the highest-signal context.** Invest in fast verification loops, not exhaustive upfront instructions.

7. **Consistency beats completeness.** A small set of consistently applied rules outperforms a comprehensive guide that contradicts itself.

---

*Next: Chapter 6 — Advanced Context Architecture →*
