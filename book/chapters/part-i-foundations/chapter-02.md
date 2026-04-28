# Chapter 2: What is Harness Engineering?

> *"The term represents a shift in engineering focus from writing code to designing the environment, constraints, and feedback loops that allow AI coding agents to operate reliably at scale."*
> — Augment Code, April 2026

---

Imagine you're managing a factory. Not a software factory — a real, physical factory that produces widgets. You have incredibly capable machines on the production floor. They can cut, weld, assemble, and paint faster and more precisely than any human worker. Left to their own devices, they'd produce a thousand widgets an hour.

But you don't just turn them on and walk away. You install safety guards that prevent the machines from operating outside their parameters. You build conveyor systems that move materials in the right order. You install sensors that detect defects and divert bad products before they reach shipping. You write maintenance schedules and quality checklists. You train operators not to operate the machines — the machines run themselves — but to monitor, adjust, and maintain the *system*.

The machines are the AI agents. The safety guards, conveyor systems, sensors, checklists, and operator training — that's the harness.

This chapter defines harness engineering as a discipline, establishes its core principles, and shows you what it looks like in practice. By the end, you'll understand not just *what* a harness is, but *why* it's structured the way it is and how it differs from adjacent concepts that are often confused with it.

## Defining the Discipline

Let's start with a precise definition:

**Harness engineering** is the discipline of designing environments, constraints, and feedback loops that enable AI coding agents to produce reliable, high-quality software at scale.

The term gained its formal definition through an OpenAI blog post by Ryan Lopopolo on February 11, 2026, documenting the million-line experiment we explored in Chapter 1.¹ The post's tagline — "Humans steer. Agents execute." — captured the essence: engineers focus on designing the system that governs how agents work, rather than writing code themselves.

A LangChain post shortly thereafter condensed the model further:¹ **"Agent = Model + Harness."** This is a useful equation because it makes clear that the agent is not just the model. The model provides the reasoning capability. The harness provides everything else — the tools, the constraints, the context, the feedback mechanisms, and the safety boundaries.

The concept is commonly attributed to Mitchell Hashimoto, co-founder of HashiCorp and creator of Terraform, based on a personal blog post from early February 2026. The core principle attributed to him: **whenever an agent makes a mistake, engineers should build a solution ensuring the agent never makes that specific mistake again.** This principle — that every failure is a harness gap, not a model limitation — is the philosophical foundation of the discipline.

Martin Fowler, the Thoughtworks technologist and author, endorsed the framing in a LinkedIn post:² *"Harness Engineering is a valuable framing of a key part of AI-enabled development. Harness includes context engineering, architectural constraints, and garbage collection."*

Note what Fowler includes: not just prompts and context, but architectural constraints and garbage collection. These are structural, mechanical systems — not things you can fix by writing a better prompt.

### What a Harness Is Not

Clarity requires contrast. A harness is not:

- **A prompt.** Prompts are single-interaction instructions. A harness operates across the entire task lifetime — before, during, and after the agent's work.
- **A context window.** Context engineering (which we'll cover in Part II) is a subset of harness engineering. It manages what information the agent sees. But the harness also manages what the agent can *do* — its tools, its constraints, its verification mechanisms.
- **A workflow.** A workflow is a sequence of steps. A harness is an environment that shapes behavior within any workflow.
- **A framework.** Frameworks provide building blocks. Harnesses provide boundaries and feedback loops. You can use a framework *inside* a harness, but they're not the same thing.
- **A replacement for engineering judgment.** The harness encodes judgment so it can be applied consistently and automatically. But someone has to exercise that judgment first.

## The PEV Loop: Plan, Execute, Verify

Before we get deeper into the four pillars, I want to introduce a practical pattern that ties them all together: the Plan-Execute-Verify (PEV) loop. This pattern is the operational heartbeat of agent-first development, and understanding it illuminates why the four pillars are structured the way they are.

The PEV loop separates planning from execution and enforces verification as a structured feedback loop. Rather than asking an agent to solve a multi-step problem in one pass, PEV instructs the agent to:

1. **Plan:** Decompose the problem into an explicit plan with acceptance criteria
2. **Execute:** Implement against the plan, bounded by the harness gates
3. **Verify:** Check the output against both the plan and external quality criteria

This sounds obvious, but the distinction from a naive "generate and check" workflow is architectural, not cosmetic:

| Dimension | Generate-and-Check | PEV Loop |
|---|---|---|
| Planning | None; agent generates directly | Explicit decomposition with acceptance criteria |
| Execution scope | Unconstrained | Bounded by plan; harness gates fire on every tool call |
| Verification timing | Post-hoc only | Pre-execution + runtime + post-execution + plan alignment |
| Feedback signal | Binary pass/fail | Error messages with context looped back into agent reasoning |
| Human involvement | Review output artifacts | Maintain harness; approve at high-leverage decision points |

The Affirm team's workflow — Plan, Review, Execute, Verify, Review, Deliver — is a PEV variant with explicit human checkpoints at critical decision points. The OpenAI team's execution plans, checked into the repository with progress and decision logs, are the Plan artifacts of their PEV loop.

What makes PEV powerful for agents is that it addresses their fundamental limitation: non-determinism. The same task at different times may produce different reasoning paths. PEV reduces this non-determinism by constraining the planning phase, rejecting out-of-scope tool calls pre-execution, and catching architecturally non-compliant paths that test suites alone cannot see.

In harness engineering terms: PEV is where all four pillars converge. The Plan phase relies on Inform (the agent needs the right context to plan well). The Execute phase relies on Constrain (the agent operates within boundaries). The Verify phase is self-explanatory. And when verification fails, the Correct pillar kicks in — the system learns and improves.

## The Four Pillars: Constrain, Inform, Verify, Correct

Every harness, regardless of the specific tools or technologies involved, rests on four pillars. These pillars are not sequential steps — they operate simultaneously and reinforce each other. Think of them as the four legs of a table: remove any one, and the whole thing becomes unstable.

### Pillar 1: Constrain

**Reduce the solution space before the agent begins.**

Constraints are preventive controls that limit what the agent can produce. They don't tell the agent what *to* do — they tell it what it *cannot* do. This is a critical distinction. A constraint like "all API handlers must validate input with Zod schemas" doesn't specify the handler's business logic. It specifies a boundary that the handler must not cross.

Why is constraining the solution space so powerful? Because LLMs are probabilistic systems. Given an open-ended task, an agent might produce any of thousands of possible implementations. Most of them might be fine. Some might be subtly wrong. A few might be catastrophically wrong. Constraints eliminate the catastrophic ones upfront, reducing the probability space to a region where the agent's probabilistic output is much more likely to be acceptable.

The OpenAI team enforced constraints through:

- **Custom linters** that validate architectural rules (dependency direction, file size limits, naming conventions)
- **Structural tests** that verify architectural properties as testable invariants
- **Type systems** that enforce data shapes at compile time
- **CI gates** that block any PR violating the constraints

The key insight: constraints must be *mechanical*, not advisory. A rule like "please follow our dependency layering" in a prompt is advisory — the agent might follow it, might not, and you won't know until review. A custom linter that fails CI when a file in the `types` layer imports from `services` is mechanical — the agent literally cannot merge code that violates the rule.

This is where many teams go wrong. They add rules to their AGENTS.md or CLAUDE.md file and assume the agent will follow them. But LLM compliance with instructions is probabilistic, not deterministic. As the Augment Code guide on harness engineering notes: *"Telling an agent 'follow our coding standards' in a prompt is fundamentally different from wiring a linter that blocks the PR when standards are violated. The first approach relies on probabilistic compliance; the second enforces deterministic constraints."*

### Pillar 2: Inform

**Give the agent the right context at the right time.**

An informed agent is a competent agent. An uninformed agent is a hallucination machine. The second pillar is about ensuring the agent has the information it needs to make good decisions — and, equally important, that it doesn't have too much information.

The OpenAI team learned this the hard way. They initially tried a "one big AGENTS.md" approach — a massive instruction file containing everything the agent might need to know. It failed in predictable ways:

1. **Context is a scarce resource.** A giant instruction file crowds out the task, the code, and the relevant documentation. The agent either misses key constraints or starts optimizing for the wrong ones.
2. **Too much guidance becomes non-guidance.** When everything is "important," nothing is. Agents end up pattern-matching locally instead of navigating intentionally.
3. **It rots instantly.** A monolithic manual turns into a graveyard of stale rules. Agents can't tell what's still true, humans stop maintaining it, and the file quietly becomes an attractive nuisance.
4. **It's hard to verify.** A single blob doesn't lend itself to mechanical checks (coverage, freshness, ownership, cross-links), so drift is inevitable.

Their solution: treat AGENTS.md as a *table of contents*, not an encyclopedia. Roughly 100 lines, pointing to a structured `docs/` directory that serves as the system of record. The agent starts with a small, stable entry point and is taught where to look next — a pattern called *progressive disclosure*.

Let me show you what an effective AGENTS.md looks like in practice:

```markdown
# AGENTS.md

## Project Overview
This is [Project Name], a [brief description].
Built with TypeScript, React, and PostgreSQL.

## Architecture
See ARCHITECTURE.md for the full architecture map.
Key rule: Dependencies flow forward through layers:
  Types → Config → Data → Services → Runtime → UI

## Key Documents
- `docs/DESIGN.md` — Design principles and patterns
- `docs/FRONTEND.md` — Frontend conventions
- `docs/SECURITY.md` — Security requirements
- `docs/RELIABILITY.md` — Reliability standards
- `docs/QUALITY_SCORE.md` — Per-domain quality grades

## Execution Plans
All work is tracked in `docs/exec-plans/`.
Active plans are in `docs/exec-plans/active/`.
Completed plans in `docs/exec-plans/completed/`.

## Commands
- `npm test` — Run all tests
- `npm run lint` — Run all linters
- `npm run build` — Build the project
- `npm run dev` — Start development server

## Conventions
- Use structured logging: `logger.info({event: 'name', ...data})`
- All API inputs validated with Zod schemas
- Maximum file size: 300 lines
- Maximum function complexity: 10
```

This is ~30 lines, not 300. It tells the agent where to find what it needs without trying to include everything. The detail lives in the linked documents, where it can be maintained and verified independently.

The inform pillar also covers the knowledge architecture: how you organize documentation, plans, design decisions, and domain knowledge so the agent can find what it needs without being overwhelmed. We'll cover this in depth in Part II (Context Engineering).

There's a deeper principle at work here: **context curation is an engineering discipline, not a documentation task.** The right context at the right time makes the agent effective. Too much context makes it overwhelmed. Too little makes it ignorant. The art is in the curation — deciding what the agent needs to know, when it needs to know it, and how to deliver it efficiently. This is why the OpenAI team treats documentation as a first-class engineering artifact, mechanically enforced by linters and CI jobs.

### Pillar 3: Verify

**Check the agent's output against the intended behavior.**

Verification is what separates agent-first development from wishful thinking. Without verification, you're just hoping the agent got it right. With verification, you *know*.

Verification operates at multiple levels:

- **Unit tests** verify individual functions and modules
- **Integration tests** verify component interactions
- **End-to-end tests** verify user-facing behavior
- **Structural tests** verify architectural properties (e.g., "no file in the `types` layer imports from `services`")
- **Static analysis** verifies code quality, security, and style
- **Agent review** verifies code against intent — did the agent implement what was asked?

The OpenAI team took verification to an extreme that's instructive. They made the application *legible* to the agent — bootable per git worktree, with Chrome DevTools Protocol wired in for UI testing, and local observability stacks that the agent could query. This meant the agent could verify its own work in ways that go far beyond running tests. It could:

- Boot the application
- Navigate to a URL
- Take a screenshot
- Compare the screenshot to expected behavior
- Read logs and metrics
- Query traces
- Identify performance regressions

This is "verify" at a qualitatively different level from "run the test suite." It's verification against *real behavior*, not just against unit test expectations.

The Affirm engineering team discovered a subtler verification challenge: when an agent generates both implementation and tests in the same session, a misunderstanding of requirements can produce code and tests that confirm each other's errors. Tests pass, coverage looks strong, and the defect ships. They're now piloting a system that cross-references PR diffs against acceptance criteria using multiple models as an independent check.

### Pillar 4: Correct

**When the agent makes mistakes, fix the system, not just the output.**

This is the Hashimoto principle: *whenever an agent makes a mistake, build a solution ensuring the agent never makes that specific mistake again.* The correction isn't to manually fix the agent's output — it's to add a constraint, improve the context, or enhance the verification so the mistake becomes impossible.

This is fundamentally different from how we handle human errors. When a human developer introduces a bug, we fix the bug, maybe add a test, and move on. The human learns (hopefully) and doesn't make that specific mistake again. With agents, learning doesn't accumulate within the agent — each session starts from scratch. The agent won't remember that it made this mistake last time. So the learning has to go *somewhere else* — into the harness.

The OpenAI team operationalized this as the "taste feedback loop": observe → name → document → mechanize → verify. When they noticed the agent producing a pattern they didn't like, they'd:

1. **Observe** the pattern (e.g., agents using `console.log` instead of structured logging)
2. **Name** it (e.g., "unstructured logging anti-pattern")
3. **Document** it (add it to the engineering standards)
4. **Mechanize** it (write a custom linter that detects and blocks it)
5. **Verify** (confirm the linter catches it in CI)

The error messages from their linters are designed to be *remediation instructions*, not just complaints. Instead of "unstructured logging detected," the error message says "use `logger.info({event: 'name', ...data})` instead of `console.log`." The error message itself becomes a prompt that enables the agent to fix the violation without human intervention.

This is a subtle but crucial design principle: **your lint error messages are prompts.** Write them accordingly. A human-targeted error message says "this is wrong." An agent-targeted error message says "this is wrong; here's how to fix it."

The OpenAI team also built a *garbage collection* system — recurring background agents that scan for deviations from their "golden principles," update quality grades, and open targeted refactoring PRs. They call it "garbage collection" because it works like garbage collection in programming languages: instead of manually freeing memory, the system automatically identifies and cleans up unused resources on a regular cadence.

Before they built this system, the team spent every Friday — 20% of their work week — cleaning up "AI slop." The automated garbage collection replaced this manual effort and did it more consistently.

## Harness vs. Prompt Engineering vs. Context Engineering

Three terms are in circulation, and they're often used interchangeably. They shouldn't be. Understanding the boundaries prevents you from applying single-turn techniques to multi-session, multi-agent problems.

**Prompt engineering** optimizes instructions for a single interaction. It's about crafting the right input to get the right output from one model call. "Write a function that sorts a list in reverse order" is prompt engineering. Prompt engineering operates at the turn level.

**Context engineering** curates the information available to the model across turns within one context window. It's about selecting, ordering, and compressing the right tokens so the model can reason effectively. Context engineering operates at the session level.

**Harness engineering** operates outside both: it introduces context resets, structured handoff artifacts, and phase gates that enable coherent, goal-directed work across multiple context windows. It encompasses prompt engineering (your instructions matter) and context engineering (your information architecture matters), but adds the structural, mechanical, and environmental dimensions that neither covers alone.

| Dimension | Prompt Engineering | Context Engineering | Harness Engineering |
|---|---|---|---|
| Scope | Single interaction | One context window | Entire agent system |
| What it controls | Instruction wording | Token selection, ordering, compaction | Tool orchestration, state persistence, verification loops, error recovery |
| Failure modes addressed | Unclear instructions | Wrong or missing context | Agent errors, doom loops, multi-session drift, unsafe actions |
| Temporal boundary | One turn | One session | Multiple sessions; full task lifetime |
| Primary tool | Natural language | File organization, retrieval | Linters, CI gates, structural tests, garbage collection |

Andrej Karpathy coined "context engineering" in December 2025 and "agentic engineering" in February 2026. The terms are complementary, not competing. Context engineering is a *subset* of harness engineering — one of the four pillars (Inform). Agentic engineering is a broader term that encompasses the full practice of building agent-based systems, of which harness engineering is the engineering discipline.

Think of it this way: prompt engineering is tuning a single note. Context engineering is arranging the music. Harness engineering is designing the concert hall — the acoustics, the lighting, the stage, the audience seating, and the fire exits.

## Why "Boring" Technology Wins

One of the most counterintuitive findings from the OpenAI experiment is the preference for "boring" technology. The team specifically chose technologies that are well-established, well-documented, and widely understood. Not because they're less capable, but because they're more *legible* to agents.

This is counterintuitive because software engineering culture often celebrates the new and exciting. We're drawn to cutting-edge frameworks, novel architectural patterns, and elegant abstractions. But in an agent-first world, the criteria for technology selection change.

Here's why: agents learn from their training data. A technology that appears in millions of repositories, Stack Overflow answers, and blog posts is one the model has seen extensively. It understands the idioms, the pitfalls, the edge cases, and the best practices. A technology that's new and niche? The model has seen less of it, makes more mistakes, and produces less reliable output.

The OpenAI team was explicit about this:

> *"Technologies often described as 'boring' tend to be easier for agents to model due to composability, API stability, and representation in the training set. In some cases, it was cheaper to have the agent reimplement subsets of functionality than to work around opaque upstream behavior from public libraries."*

That last sentence is remarkable. They found it was more efficient to have the agent *reimplement* functionality than to use an existing library that the agent couldn't fully reason about. For example, rather than pulling in a generic `p-limit`-style concurrency package, they had the agent implement its own map-with-concurrency helper. The custom implementation:

- Is tightly integrated with their OpenTelemetry instrumentation
- Has 100% test coverage
- Behaves exactly the way their runtime expects
- Is fully visible and modifiable by the agent

This is the "boring technology" principle in action: choose technologies that the agent can fully internalize and reason about, even if that means reimplementing functionality that exists in external packages. The marginal cost of reimplementing is low (the agent does it), but the benefit — full legibility and controllability — is high.

This principle extends beyond technology selection to architectural choices:

- **Convention over configuration** is better because conventions are learnable patterns, while configuration is unique per project.
- **Explicit is better than implicit** because agents can't infer what's not stated.
- **Flat structures** are better than deep nesting because agents lose track of deep hierarchies.
- **Standard patterns** are better than novel ones because the model has seen them before.

The boring technology principle is also why the OpenAI team chose a rigid, strictly-enforced layer architecture — the kind of architecture you usually postpone until you have hundreds of engineers. With agents, it's an early prerequisite. Not because it's the most elegant architecture, but because it's the most *predictable* one. The agent always knows which layer it's in and which layers it can depend on.

## What a Harness Looks Like in Practice

Enough theory. Let's look at what a harness actually looks like in a real repository. Here's the structure the OpenAI team built:

```
repository/
├── AGENTS.md                    # ~100 lines, table of contents
├── ARCHITECTURE.md              # Top-level architecture map
├── DESIGN.md                    # Design principles
├── docs/
│   ├── design-docs/
│   │   ├── index.md
│   │   ├── core-beliefs.md
│   │   └── ...
│   ├── exec-plans/
│   │   ├── active/              # Plans currently being executed
│   │   ├── completed/           # Plans that are done
│   │   └── tech-debt-tracker.md
│   ├── generated/
│   │   └── db-schema.md         # Auto-generated from code
│   ├── product-specs/
│   │   ├── index.md
│   │   ├── new-user-onboarding.md
│   │   └── ...
│   ├── references/              # Third-party docs for the agent
│   │   ├── design-system-reference-llms.txt
│   │   ├── nixpacks-llms.txt
│   │   ├── uv-llms.txt
│   │   └── ...
│   ├── FRONTEND.md
│   ├── PLANS.md
│   ├── PRODUCT_SENSE.md
│   ├── QUALITY_SCORE.md         # Per-domain quality grades
│   ├── RELIABILITY.md
│   └── SECURITY.md
├── lint-rules/                  # Custom linters (agent-generated!)
│   ├── dependency-direction.js
│   ├── file-size-limits.js
│   ├── structured-logging.js
│   └── naming-conventions.js
├── tests/
│   ├── structural/              # Architectural invariant tests
│   │   ├── layer-dependencies.test.ts
│   │   └── module-boundaries.test.ts
│   └── ...
└── .github/
    └── workflows/
        └── ci.yml               # Runs linters + structural tests
```

Let's break down the components:

**AGENTS.md (~100 lines):** The entry point. Not an encyclopedia — a map. It tells the agent where to find what it needs: architecture docs, design principles, product specs, and plans. It's injected into context automatically when the agent starts a session.

**docs/ directory:** The system of record. Design decisions, execution plans, product specifications, quality scores — all versioned, cross-linked, and mechanically verified. Agents don't need to ask humans for context because everything is discoverable here.

**Custom linters:** The enforcement mechanism. Each linter encodes a specific rule — dependency direction, file size limits, structured logging, naming conventions. They run in CI and block any PR that violates the rules. Critically, the error messages include remediation instructions, so the agent can fix violations autonomously.

**Structural tests:** Tests that verify architectural properties, not functional behavior. For example, a test that asserts no file in the `types` layer imports from `services`. These are the "taste invariants" — encoding engineering judgment as testable invariants.

**CI pipeline:** The gate. Runs linters, structural tests, unit tests, integration tests, and any other verification. Blocks merging until everything passes. This is what makes the constraints *mechanical* — they're enforced by code, not by prompts or code review.

Now, this is a mature harness. The OpenAI team built this over five months with three to seven engineers. You don't need all of this on day one. The minimum viable harness — the one you should start with — has five components:

1. **AGENTS.md** with basic instructions and pointers to key docs
2. **Basic lint rules** for the three most important constraints in your codebase
3. **CI pipeline** that runs those linters on every PR
4. **A structured docs/ directory** with architecture and design decisions
5. **A plan template** for breaking down work into agent-executable tasks

That's it. Start there. Add more as you learn what the agent gets wrong. Remember the Hashimoto principle: every agent mistake is an opportunity to add a new constraint.

### A Simple Harness in Action

Let's trace a single task through a harness to see how the pillars work together:

1. **An engineer describes a task:** "Add email notification support to the user registration flow."
2. **Inform:** The agent reads AGENTS.md, which points it to the architecture docs, the registration flow spec, and the notification system design. It reads the relevant files and understands the context.
3. **Constrain:** The agent plans changes across multiple files. As it writes code, it operates within the established layers — types, config, services, runtime. The custom linters are waiting in CI.
4. **Execute:** The agent implements the changes, writes tests, and opens a PR.
5. **Verify:** CI runs. Linters check architectural compliance. Tests verify functional correctness. A structural test confirms the dependency direction is correct. Everything passes.
6. **Correct (if needed):** If the linter catches a violation — say, unstructured logging — the error message includes remediation instructions. The agent reads the error, fixes the code, and pushes an update. The fix is automatic because the harness was designed to enable self-correction.

Notice what the human did: described a task, and eventually merged a PR. Everything in between was handled by the agent operating within the harness. The human's time was spent on *what* to build and *whether* the result was correct, not on *how* to build it.

Now let's trace what happens when the harness catches a real problem. Imagine the agent, while implementing the email notification feature, decides to add a new `NotificationService` class in the `types` layer (where it doesn't belong according to the architecture).

The sequence looks like this:

1. Agent writes `src/types/notification-service.ts` with business logic
2. Agent opens a PR
3. CI runs the dependency-direction linter
4. Linter detects: `Layer "types" cannot contain service classes. Services belong in the "services" layer. Move business logic to src/services/notification.ts and keep only type definitions in src/types/`
5. Agent reads the error message (which is a remediation instruction)
6. Agent moves the file to the correct location, updates imports
7. Agent pushes a new commit
8. CI runs again — passes this time
9. PR is ready for human review

The human never saw the misplaced file. They never had to write a comment saying "this is in the wrong directory." The harness caught the problem, told the agent how to fix it, and the agent fixed it autonomously. This is the "lint error messages are prompts" principle in action.

Compare this to the traditional workflow: the engineer writes the code in the wrong location, pushes, another engineer reviews it, writes a comment, the original engineer moves it, pushes again, waits for another review. The cycle time for this catch might be hours or days. With the harness, it's minutes — and it requires zero human attention.

## The Harness as a Living System

One final principle before we move on: a harness is not something you build once and forget. It's a living system that evolves with your codebase, your team, and the agents themselves.

The OpenAI team's harness grew significantly over five months. They started with basic scaffolding and added layers progressively:

- Week 1-2: Repository structure, AGENTS.md, basic CI
- Week 3-4: Custom linters, structural tests, initial docs
- Month 2: Execution plans, quality scoring, garbage collection agents
- Month 3-5: Application legibility, Chrome DevTools integration, observability stack, progressive autonomy

Each addition was driven by a specific failure mode they observed. The linters came after the agent repeatedly violated architectural rules. The garbage collection came after they spent too many Fridays cleaning up. The application legibility came after human QA became the bottleneck.

This is the correct approach: start minimal, observe what breaks, and extend the harness to prevent that specific class of breakage. Don't try to predict every failure mode upfront. You'll guess wrong. Instead, let the agent teach you what the harness needs.

The Affirm team followed a similar pattern. They started with a simple workflow — Plan, Review, Execute, Verify, Review, Deliver — and then iterated based on what they learned during their retooling week. The bottlenecks they discovered — slow CI, fragmented documentation, manual review processes — drove their investments in the months that followed.

The harness grows with you. Start simple. Add what you need. Let the failures guide you.

### The Three-Layer Harness Model

Another useful framing comes from the Augment Code guide, which describes harness engineering as operating through three reinforcing layers:

**Layer 1: Constraint Harnesses (Feedforward).** These reduce the agent's solution space *before* generation begins. Rules files, architectural lint configurations, and type systems all function as feedforward controls. They encode what correct code looks like, so the agent converges faster on compliant output. OpenAI's production system enforces what they call "taste invariants" — a small set of rules encoding the team's engineering standards and design philosophy, all enforced as hard CI failures.

**Layer 2: Feedback Loops (Corrective).** These return structured error signals to the agent, enabling autonomous self-correction. The critical implementation detail: the lint message itself becomes a prompt. A lint error saying "violation detected" requires human interpretation. A lint error saying "use `logger.info({event: 'name', ...data})` instead of `console.log`" enables the agent to fix the violation without human intervention. One implementation detail most teams overlook: inline-disable rules (like `// eslint-disable-next-line`) should be disabled to prevent agents from suppressing violations rather than fixing them.

**Layer 3: Quality Gates (Enforcement).** These prevent non-compliant code from being merged. Standard CI pipelines are insufficient for AI-generated code because agents introduce problems that conventional checks miss. Some teams add purpose-built staleness gates to catch dependency choices that don't match the codebase's current strategy. All rules should be set to "error," not "warn," so they function as hard gates, not advisory signals.

The recommended implementation order: constraints first (they reduce failure volume before anything else is in place), feedback loops second (they enable self-correction without human intervention), quality gates third (they enforce what the first two layers could not prevent). There's one universal tradeoff: over-constraining is a real failure mode. Complexity limits set too low flag legitimate refactoring; lint rules that reject valid patterns slow agents without improving output quality. Start narrow, measure, then expand.

### Measuring Harness Effectiveness

One question that every team faces early is: "How do we know if our harness is working?" Intuition and anecdote aren't sufficient — you need metrics. Drawing from the Augment Code framework and DORA guidance, here are the key metrics to track:

**Task Resolution Rate:** The percentage of tasks an agent resolves correctly on the first attempt, verified by automated tests. This is your primary signal of harness quality. A rising task resolution rate means your constraints and context are improving. Top agents achieve 65-76.8% resolution rates on SWE-bench-verified Python tasks, but real-world rates on your codebase will depend heavily on your harness quality.

**Code Churn Rate:** The percentage of agent-written code that's discarded or rewritten within two weeks. High churn means the agent is producing code that doesn't meet standards — either because the constraints are insufficient or the specifications are unclear. Track this weekly, attributed by authorship signal.

**Verification Tax:** The time engineers spend auditing AI-generated code, measured as the delta between time-to-first-commit and time-to-PR-approval. A high verification tax means the harness isn't generating enough trust through automated verification. The goal is to drive this down as the harness matures.

**Harness Constraint Effect:** The improvement in task success rate from constraining the agent environment, independent of model changes. Measure this by comparing success rates on identical tasks with and without specific constraints. This tells you which parts of your harness are actually contributing to quality.

**Defect Escape Rate:** The rate of defects in agent-generated code that reaches production, measured monthly and tagged by AI vs. non-AI commit metadata. This is your ultimate quality metric. A well-harnessed agent should have a defect escape rate no higher than (and ideally lower than) human-written code.

One finding from the evaluation space is worth noting: METR found that many benchmark-passing PRs would not be merged by actual maintainers. This means raw task resolution rate isn't sufficient — you need both automated metrics *and* human judgment to assess quality. The harness improves the automated metrics; human review provides the judgment.

What you should avoid: narrow, output-based metrics like "lines of code accepted" or "number of AI suggestions used." These measure volume, not reliability, and can be actively misleading. DORA explicitly warns against relying on such metrics as primary signals of productivity. The goal is not more code — it's more *correct* code.

### The Cross-Tool Landscape

One of the practical challenges of harness engineering is that different agent tools use different configuration files. The AGENTS.md open standard, released in August 2025 and now stewarded by the Agentic AI Foundation under the Linux Foundation, has emerged as the cross-tool convention. Backed by OpenAI, Anthropic, Google, Microsoft, Amazon, and Cloudflare, it's been adopted by over 60,000 repositories.

Here's how the major tools map to configuration files:

| Tool | File | Scope |
|---|---|---|
| OpenAI Codex | AGENTS.md | Hierarchical, Git root to CWD |
| Claude Code | CLAUDE.md | Project root + ~/.claude |
| Cursor | .cursor/rules/*.mdc | Project-scoped |
| GitHub Copilot | .github/copilot-instructions.md | Repo-wide + path-specific |
| Windsurf | .windsurfrules | Project root |
| Gemini CLI | AGENTS.md | Hierarchical |

The AGENTS.md standard's cross-tool compatibility means you can write your instructions once and have them work across multiple agent platforms. The OpenAI repository uses 88 AGENTS.md files across subcomponents — demonstrating that monorepo-scale constraint composition is practical.

GitHub's analysis of 2,500+ repositories using AGENTS.md files recommends a three-tier boundary pattern:³

| Tier | Examples |
|---|---|
| Always | Log all notification delivery attempts; use UTC for scheduling |
| Ask First | Adding a new notification channel; changing retry intervals |
| Never | Send notifications without verified opt-in; modify the unsubscribe flow |

The "Ask First" tier is particularly important. Without it, an agent building retry logic picks an interval on its own — potentially violating your operational standards. The tier pattern gives agents clear boundaries: things they must always do, things they must ask about, and things they must never do.

---

- Harness engineering is the discipline of designing environments, constraints, and feedback loops that enable AI coding agents to produce reliable software at scale.
- The four pillars are: **Constrain** (reduce the solution space), **Inform** (provide the right context), **Verify** (check output against intent), and **Correct** (fix the system, not just the output).
- Harness engineering encompasses prompt engineering and context engineering but adds structural, mechanical, and environmental dimensions.
- "Boring" technology wins because it's more legible to agents — more represented in training data, more compositional, more stable.
- A practical harness includes: AGENTS.md as table of contents, structured docs as system of record, custom linters for enforcement, structural tests for architectural invariants, and CI gates that make everything mechanical.
- The Hashimoto principle: every agent mistake is an opportunity to add a constraint to the harness.
- A harness is a living system — start minimal and extend based on observed failure modes.

---

## Footnotes

¹ Ryan Lopopolo, "Harness Engineering: Leveraging Codex in an Agent-First World," OpenAI Blog, February 2026. https://openai.com/blog/harness-engineering-leveraging-codex

² Martin Fowler, LinkedIn post on Harness Engineering, 2026. [Citation needed — verify URL before publication]

³ GitHub, "Analysis of AGENTS.md Adoption Across 2,500+ Repositories," GitHub Blog, 2025. [Citation needed — verify before publication]

⁴ Augment Code, "Harness Engineering: A Guide," April 2026. [Citation needed — verify before publication]

---

