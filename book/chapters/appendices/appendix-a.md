# Appendix A: The OpenAI Harness Engineering Blog Post — Annotated Reprint

*The following is a reprint of OpenAI's landmark blog post "Harness engineering: leveraging Codex in an agent-first world" with annotations providing context, analysis, and connections to the concepts in this book. The original post is available at [https://openai.com/index/harness-engineering/](https://openai.com/index/harness-engineering/).*

---

## Original Post (with annotations)

**Harness engineering: leveraging Codex in an agent-first world**

*OpenAI Engineering Blog, 2025*

*Source: https://openai.com/index/harness-engineering/*

---

> [ANNOTATION: This post describes the methodology that gave this book its name. It's the most detailed public account of a team building production software entirely with AI agents. The full story of this experiment is told in Chapter 1, which serves as the canonical home for the OpenAI 1M-line experiment narrative.]

We intentionally chose this constraint so we would build what was necessary to increase engineering velocity by orders of magnitude. We had weeks to ship what ended up being a million lines of code. To do that, we needed to understand what changes when a software engineering team's primary job is no longer to write code, but to design environments, specify intent, and build feedback loops that allow Codex agents to do reliable work.

> [ANNOTATION: Three key verbs define harness engineering: design environments, specify intent, build feedback loops. These map to the four pillars of harness engineering defined in Chapter 2 (the canonical home for Constrain/Inform/Verify/Correct): Constrain (design environments), Inform (specify intent), Verify (build feedback loops), and Correct (the output of those loops).]

This post is about what we learned by building a brand new product with a team of agents—what broke, what compounded, and how to maximize our one truly scarce resource: human time and attention.

> [ANNOTATION: "Human time and attention" as the scarce resource is a key insight. The harness exists to maximize the leverage of human attention, not to eliminate it.]

Early progress was slower than we expected, not because Codex was incapable, but because the environment was underspecified. The agent lacked the tools, abstractions, and internal structure required to make progress toward high-level goals. The primary job of our engineering team became enabling the agents to do useful work.

> [ANNOTATION: This is the "underspecified environment" problem described in Chapter 3. The first weeks of agent-first development are spent building the harness, not shipping features. This is an investment, not a delay. See also Chapter 7 for the evidence behind the 100-line AGENTS.md rule.]

In practice, this meant working depth-first: breaking down larger goals into smaller building blocks (design, code, review, test, etc), prompting the agent to construct those blocks, and using them to unlock more complex tasks. When something failed, the fix was almost never "try harder." Because the only way to make progress was to get Codex to do the work, human engineers always stepped into the task and asked: "what capability is missing, and how do we make it both legible and enforceable for the agent?"

> [ANNOTATION: "Legible and enforceable" — these two words capture the essence of harness engineering. Legibility (Chapter 8) means the agent can understand the codebase. Enforcement (Chapter 10, the canonical home for the layer architecture) means the codebase prevents the agent from making mistakes. Together, they create a virtuous cycle. See also Chapter 12 for the canonical explanation of why "lint error messages are prompts."]

### Context Engineering

We did the same for observability tooling. Logs, metrics, and traces are exposed to Codex via a local observability stack that's ephemeral for any given worktree. Codex works on a fully isolated version of that app—including its logs and metrics, which get torn down once that task is complete. Agents can query logs with LogQL and metrics with PromQL. With this context available, prompts like "ensure service startup completes in under 800ms" or "no span in these four critical user journeys exceeds two seconds" become tractable.

> [ANNOTATION: This is advanced agent legibility (Chapter 8). The team gave agents access to the same observability tools that human engineers use — logs, metrics, traces (see also Chapter 9 for deterministic environment patterns). This transforms what agents can verify. Instead of just checking if tests pass, the agent can check if the system actually performs correctly at runtime.]

Because the repository is entirely agent-generated, it's optimized first for Codex's legibility. In the same way teams aim to improve navigability of their code for new engineering hires, our human engineers' goal was making it possible for an agent to reason about the full business domain directly from the repository itself.

> [ANNOTATION: The "agent as new hire" metaphor is powerful. Everything you'd do to help a new team member understand your codebase — clear directory structure, good documentation, consistent patterns — also helps the agent. But the agent needs these things more consistently and more mechanically than a human would. The context architecture for this is detailed in Chapters 5 and 6.]

As code throughput increased, our bottleneck became human QA capacity. Because the fixed constraint has been human time and attention, we've worked to add more capabilities to the agent by making things like the application UI, logs, and app metrics themselves directly legible to Codex.

> [ANNOTATION: This is the throughput bottleneck described in Chapter 16 (the canonical home for the Wix AirBot case study and the quality discount concept). As agents produce code faster, the review and QA process becomes the constraint. The solution is to make more things legible to the agent so it can verify more of its own work.]

### Mechanical Enforcement

Still demands discipline. Our most difficult challenges now center on designing environments, feedback loops, and control systems that help agents accomplish our goal: build and maintain complex, reliable software at scale.

> [ANNOTATION: "Still demands discipline" — AI doesn't eliminate the need for engineering discipline. It amplifies it. Without discipline, AI amplifies disorder. With discipline, AI amplifies productivity. The harness is where that discipline lives. Chapter 19 (the canonical home for garbage collection agents) addresses how to maintain this discipline at scale against entropy.]

> [ANNOTATION: Notice the deliberate constraint — the team chose to use agents even when it was initially slower. This is the "investment phase" described in Chapter 3. Teams that try agent-first development without committing to building the harness first will bounce back to manual coding when friction appears. The OpenAI team couldn't afford to bounce back because the timeline made manual coding impossible. Constraint breeds creativity in harness design.] This meant working depth-first: breaking down larger goals into smaller building blocks (design, code, review, test, etc), prompting the agent to construct those blocks, and using them to unlock more complex tasks. When something failed, the fix was almost never "try harder." Because the only way to make progress was to get Codex to do the work, human engineers always stepped into the task and asked: "what capability is missing, and how do we make it both legible and enforceable for the agent?"

---

## Detailed Commentary and Analysis

### On the Depth-First Approach

The depth-first strategy described here is one of the most counterintuitive aspects of harness engineering. Traditional software development encourages breadth-first planning — sketch out the full architecture, then fill in the details. Agent-first development inverts this: build one vertical slice completely, verify it works, then use it as a template for the next slice.

Why does this matter for agents? Because agents learn from patterns in the codebase. If you build the first service thoroughly — with proper error handling, structured logging, tests, and clean interfaces — the agent will replicate those patterns. If you scaffold everything partially, the agent has no complete example to follow and will fill gaps with its own (often inconsistent) judgment.

> [ANNOTATION: This is why Chapter 3 recommends building the "thin slice" first. A fully working thin slice gives the agent a concrete reference implementation that is worth more than any amount of documentation.]

### On the "What Capability Is Missing?" Reflex

This single question is the heartbeat of harness engineering. When an agent fails, the default human reaction is to fix the output. The harness engineering response is to fix the environment so the agent won't fail the same way again.

This creates a ratcheting effect:
1. Agent fails → Engineer diagnoses the gap → Engineer adds a constraint, linter rule, or documentation → Agent succeeds on that pattern going forward.
2. Each failure makes the harness stronger.
3. Over time, failures become increasingly rare — not because the agent got smarter, but because the harness got tighter.

> [ANNOTATION: This is the "taste feedback loop" from Chapter 10: observe → name → document → mechanize → verify. Every agent failure is a signal that a principle hasn't been mechanized yet. The autonomy levels for deciding how much self-correction to allow are defined in Chapter 18.]

### On Observability as Agent Context

The section on observability is worth studying carefully. The OpenAI team didn't just give agents access to logs — they created ephemeral, per-worktree observability stacks. This means:

- **Isolation:** Each agent task gets its own metrics and traces, not shared with other tasks.
- **Full fidelity:** The agent sees the same telemetry a human SRE would see.
- **Promptability:** Because the observability stack is queryable (LogQL, PromQL), the agent can be given performance requirements as natural language prompts that it can verify mechanically.

This is a sophisticated pattern that most teams skip. The typical approach is to give agents access to test results only. The OpenAI approach gives agents access to runtime behavior — a much richer verification surface.

> [ANNOTATION: This connects to the "observability for agents" pattern in Chapter 8. The key insight is that agents can verify more than just functional correctness — they can verify performance, error rates, and latency budgets if you give them the tools.]

### On Agent-Optimized Code

The line "optimized first for Codex's legibility" is significant. Most codebases are optimized for human readability — and human readability and agent legibility overlap significantly but aren't identical.

What makes code more legible to agents:
- **Consistent patterns** (agents struggle more with creative variation than humans do)
- **Explicit types and interfaces** (agents benefit more from type information than humans)
- **Small files** (agents have context window limits; humans can scroll)
- **Clear naming** (agents don't infer intent from context as well as humans)
- **Self-documenting structure** (directory names, file names, export names that describe their purpose)

> [ANNOTATION: The "agent as new hire" metaphor works well here. Everything you'd do for a new team member — clear onboarding docs, consistent patterns, explicit conventions — helps the agent. But agents need these things more consistently because they lack the human ability to "read between the lines."]

### On the QA Bottleneck

The admission that "our bottleneck became human QA capacity" validates a key thesis of this book: agent throughput outpaces human verification capacity unless you invest in automated verification.

The OpenAI team's response — making the UI, logs, and metrics "directly legible to Codex" — is the right approach. Instead of throwing more humans at the review problem, they gave the agent tools to verify its own work. This is the self-review pattern described in Chapter 16.

> [ANNOTATION: This bottleneck is the primary motivator for the multi-layered verification strategy described in Chapter 16. The six verification layers — linter, unit tests, integration tests, structural tests, security scanning, and quality scoring — exist specifically to reduce the human QA burden to only the things that require human judgment. Security-specific verification is covered in Chapter 21 (the canonical home for the tiered review system).]

### On Discipline and Control Systems

The closing statement about "designing environments, feedback loops, and control systems" reframes the engineering role entirely. In traditional development, the engineer's job is to write code that works. In agent-first development, the engineer's job is to design systems that make it easy for agents to write code that works.

This is a higher-leverage activity. One well-designed linter rule prevents thousands of future errors. One clear architectural document prevents hundreds of wrong design decisions. One good test fixture prevents countless brittle tests.

> [ANNOTATION: This is the "multiplier effect" described in Chapter 4. A harness engineer's work compounds over time because every improvement to the harness improves every future agent interaction. Traditional engineering work compounds too, but more slowly — each function you write helps once. Each linter rule you write helps forever.]

---

## Cross-Reference Guide

| Blog Post Concept | Book Chapter | Key Term |
|---|---|---|
| Design environments | Chapter 2 | Four Pillars: Constrain |
| Specify intent | Chapter 2 | Four Pillars: Inform |
| Build feedback loops | Chapter 2 | Four Pillars: Verify |
| Underspecified environment | Chapter 3 | The Empty Repository |
| Legible and enforceable | Chapter 8, Chapter 10 | Legibility, Mechanical Enforcement |
| Context engineering | Chapter 5, Chapter 6 | Context Architecture |
| Agent-optimized codebase | Chapter 8 | Application Legibility |
| Ephemeral observability | Chapter 8 | Observability for Agents |
| Human QA bottleneck | Chapter 16 | Throughput, Merges, Norms |
| Depth-first approach | Chapter 3 | Starting from Zero |
| "What capability is missing?" | Chapter 10 | Taste Feedback Loop |
| Discipline still matters | Chapter 10, Chapter 19 | Mechanical Enforcement, Entropy |
| Control systems | Chapter 18 | Autonomy Levels |

---

## Key Takeaways from the Post

1. **Start with the environment, not the model.** The harness determines success more than the AI model.
2. **Human attention is the scarce resource.** Design everything to maximize the leverage of human attention.
3. **Legibility and enforceability are the two pillars.** Make the codebase understandable and make it impossible to violate rules.
4. **Work depth-first.** Build the building blocks first, then use them to unlock more complex tasks.
5. **The bottleneck shifts to QA.** As agent throughput increases, review and verification become the constraint.
6. **Discipline still matters.** More than ever. The harness is discipline made mechanical.

---

*The full original post is available at: https://openai.com/index/harness-engineering/*

---

## Practical Exercises Based on the Post

### Exercise 1: The Capability Audit

After reading the post, perform a capability audit on your own repository. For each question, if the answer is "no," you've found a gap in your harness:

1. Can an agent determine your project's architecture from the top-level directory structure alone?
2. Can an agent run the full test suite with a single command documented in a machine-readable file?
3. Can an agent detect when it has violated an architectural rule without human review?
4. Can an agent observe its own code's runtime behavior (logs, metrics, traces)?
5. Can an agent understand why a previous design decision was made, not just what the decision was?
6. Can an agent determine the blast radius of a change before making it?
7. Can an agent verify that its changes don't introduce regressions in performance?
8. Can an agent find and follow the patterns established by existing code in the repository?

Each "no" represents an opportunity to strengthen your harness. Prioritize by frequency: which gaps cause the most agent failures? Fix those first.

### Exercise 2: The Depth-First Sprint

Try the depth-first approach described in the post:
1. Pick one small feature or bug fix.
2. Before touching any code, document what the agent would need to know to complete this task independently.
3. Identify what's missing — what does the agent need that isn't currently available in the codebase?
4. Add the missing context (documentation, linter rules, test fixtures, example patterns).
5. Now prompt the agent to complete the task.
6. Compare the result to what would have happened without the preparation.

This exercise demonstrates the core harness engineering workflow: invest in the environment first, then let the agent work.

### Exercise 3: The "What Capability Is Missing?" Journal

For one week, every time an agent produces incorrect or suboptimal code, write down:
- What the agent did wrong
- What information or constraint would have prevented the error
- Whether this is a one-off issue or a recurring pattern

After the week, group the entries by pattern. Each recurring pattern is a candidate for a new golden principle, linter rule, or documentation section. This is the taste feedback loop in action.
