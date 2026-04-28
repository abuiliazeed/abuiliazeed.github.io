# Chapter 4: The New Role of the Engineer

> *"The lack of hands-on human coding introduced a different kind of engineering work, focused on systems, scaffolding, and leverage."*
> — Ryan Lopopolo, OpenAI, February 2026²

---

In February 2026, Affirm — the financial technology company processing over 130 million transactions a year — did something that would have seemed insane just twelve months earlier. They paused all normal engineering delivery for an entire week. Product deadlines were pushed back. Non-essential meetings were cancelled. And 800+ engineers were asked to stop doing what they'd been trained to do their entire careers and instead learn an entirely new way of working.

The results were remarkable. By the end of that week, 92% of the engineering organization — including managers — had submitted at least one agent-assisted PR. Within four months, over 60% of all PRs at Affirm were agent-assisted. Weekly merged PR volume was up 58% year-over-year.

But here's the part that matters for this chapter: the engineers who succeeded that week weren't the best coders. They were the best *communicators*, the best *systems thinkers*, the best at *breaking down complex problems into clear specifications*. The skills that made someone a great traditional software engineer were not the same skills that made someone great at agent-first development.

This chapter is about that shift — what the engineer's role becomes in agent-first development, the archetypes that emerge, the skills that matter (and the ones that matter less), and the psychological adjustment required to thrive in a world where you no longer write code.

## From Coder to Conductor

The most fundamental shift in agent-first development is the change in the engineer's relationship to code. In traditional development, the engineer *is* the code producer. Your identity, your skill, your value — they're all expressed through the code you write. The best engineers write elegant code, fast. The worst engineers write buggy code, slow. Code is the medium through which everything else is expressed.

In agent-first development, the engineer is no longer the code producer. The agent is. The engineer's role shifts to what the OpenAI team described as "designing environments, specifying intent, and building feedback loops." Let's unpack each of these:

**Designing environments** means creating the harness — the constraints, the context architecture, the verification mechanisms, the CI pipeline. This is systems-level thinking: understanding how the agent interacts with the codebase, what information it needs, what boundaries it requires, and what feedback it responds to.

**Specifying intent** means describing what you want built with enough clarity and precision that the agent can implement it correctly. This is specification writing — a skill that's always been important in software engineering but was often treated as secondary to coding. In agent-first development, it becomes primary. A vague specification produces vague code. A precise specification produces precise code. The quality of the output is directly proportional to the quality of the input.

**Building feedback loops** means creating mechanisms that tell the agent (and you) whether the output is correct. Tests, linters, CI gates, application legibility — these are all feedback loops. The engineer designs them, maintains them, and extends them as the codebase evolves.

The mental model I find most useful is the conductor of an orchestra. The conductor doesn't play any instrument. They don't produce any sound directly. But they shape the entire performance through gestures, expressions, and rehearsal decisions. They communicate tempo, dynamics, phrasing, and emotion to musicians who are far more skilled at their individual instruments than the conductor could ever be.

Similarly, the agent-first engineer doesn't produce any code directly. But they shape the entire codebase through specifications, constraints, and feedback loops. They communicate architecture, quality standards, and intent to agents that can produce code far faster than the engineer ever could.

Here's the crucial insight: **the conductor doesn't need to be the best violinist. They need to understand music at a level that transcends any individual instrument.** The agent-first engineer doesn't need to be the best coder. They need to understand software systems at a level that transcends any individual line of code.

This is both empowering and disorienting. Empowering because your leverage goes up dramatically — you're no longer limited by your typing speed or your knowledge of a specific framework's API. Disorienting because the skill you've spent years or decades developing — writing code — is no longer your primary value proposition.

The Affirm team captured this shift in their mental model for the week:¹ **Plan, Review, Execute, Verify, Review, Deliver.** Notice that "write code" doesn't appear anywhere in this cycle. The engineer plans, reviews, and delivers. The agent executes and verifies. The engineer's touchpoints with the process are at the decision points — where judgment matters most.

Affirm's working group was explicit about one rule: *"Do not send unreviewed AI output to your coworkers."* Reviewers use agents too — they point the review tool at the PR along with their team's architectural context. But the reviewer reads the code, applies their own judgment, and catches what the agent misses. Review is a human activity. Code production is not.

## The Four Engineer Archetypes: Architect, Specifier, Verifier, Mechanic

In practice, agent-first development reveals four distinct engineering archetypes. Every engineer embodies all four to some degree, but most gravitate toward one or two. Understanding these archetypes helps you identify your strengths, recognize where you need to grow, and build balanced teams.

### The Architect

**What they do:** Define the overall structure of the system — the layers, the boundaries, the dependency directions, the technology choices.

**What they spend their time on:** Architecture documentation, custom linters, structural tests, technology evaluation, cross-domain coordination.

**How they interact with agents:** The Architect designs the environment in which agents operate. They don't tell agents *what* to build — they define the *space* in which agents can build. A well-architected system is one where agents naturally produce well-structured code because the constraints guide them.

**Key skills:** Systems thinking, abstraction, constraint design, technology evaluation, communication.

**Example work product:** A dependency layer architecture enforced by linters. A structural test suite that validates architectural invariants. A technology selection that prioritizes agent legibility.

The OpenAI team's layer architecture — Types → Config → Data → Services → Runtime → UI — with mechanically enforced dependency directions is pure Architect work. The Architect doesn't write the code that implements this architecture. They define the architecture and build the enforcement mechanisms. The agents write the code that lives within it.

### The Specifier

**What they do:** Define what needs to be built — the requirements, the acceptance criteria, the edge cases, the expected behavior.

**What they spend their time on:** Writing specifications, breaking down features into tasks, defining execution plans, creating test cases (as specifications, not implementations).

**How they interact with agents:** The Specifier writes the instructions that agents execute. Their primary artifact is the execution plan — a detailed, step-by-step description of what the agent should build, including the expected behavior, the error handling, the test scenarios, and the verification criteria.

**Key skills:** Clear writing, decomposition, edge case identification, empathy (understanding what the agent needs to know), domain knowledge.

**Example work product:** An execution plan for "Add email notification support to user registration" that specifies: the email schema, the trigger conditions, the template format, the retry logic, the error handling, the test scenarios, and the verification steps.

The Specifier role is where clear writing becomes an engineering superpower. In traditional development, a vague spec means you have a conversation with your teammate, hash it out over a whiteboard, and figure it out. In agent-first development, a vague spec means the agent builds the wrong thing, and you don't find out until you review the PR. Precision of specification is directly proportional to quality of output.

The OpenAI team's execution plans are first-class artifacts, checked into the repository with progress and decision logs. Active plans, completed plans, and known technical debt are all versioned and co-located, allowing agents to operate without relying on external context. This is Specifier work elevated to a disciplined practice.

### The Verifier

**What they do:** Ensure the output is correct — code review, testing strategy, quality metrics, architectural compliance.

**What they spend their time on:** Reviewing agent-generated PRs, designing verification strategies, maintaining quality metrics, investigating defects, encoding verification into automated tests.

**How they interact with agents:** The Verifier reviews what the agent produces and provides feedback. In mature harnesses, much of this review is automated — linters, structural tests, CI gates. But the Verifier also handles the things that can't be automated: architectural taste, product alignment, and subtle correctness issues.

**Key skills:** Attention to detail, pattern recognition, testing expertise, security awareness, domain knowledge.

**Example work product:** A quality scorecard that grades each domain of the codebase on multiple dimensions. A custom linter that detects a specific anti-pattern. A review of a complex agent-generated PR that identifies a subtle race condition.

The OpenAI team has a dedicated `QUALITY_SCORE.md` that grades each product domain and architectural layer, tracking gaps over time. This is Verifier work — creating and maintaining the metrics that tell you whether the system is healthy.

### The Mechanic

**What they do:** Fix and maintain the harness — the linters, the CI pipeline, the documentation, the tooling.

**What they spend their time on:** Debugging CI failures, updating linters to cover new patterns, maintaining documentation freshness, improving agent tooling, building developer experience.

**How they interact with agents:** The Mechanic keeps the harness running. When an agent encounters a tool failure, a missing dependency, or an unclear error message, the Mechanic fixes the underlying infrastructure. They're the DevOps engineer of the agent-first world.

**Key skills:** Infrastructure expertise, debugging, automation, developer experience design, systems administration.

**Example work product:** A CI pipeline that runs linters, structural tests, and integration tests in parallel. A developer tool that lets agents boot the application per git worktree. A doc-gardening agent that scans for stale documentation.

The OpenAI team's doc-gardening agent — an automated process that scans for stale or obsolete documentation and opens fix-up pull requests — is Mechanic work at its finest. The Mechanic doesn't fix the documentation themselves. They build a tool that fixes it automatically.

### How the Archetypes Work Together

In a well-functioning agent-first team, the archetypes create a cycle:

1. The **Architect** defines the structure and constraints
2. The **Specifier** defines what needs to be built within that structure
3. The **Agent** builds it (guided by the harness)
4. The **Verifier** checks the output
5. The **Mechanic** fixes any harness issues that the process revealed
6. The **Architect** adjusts the architecture based on what was learned
7. Repeat

In a small team (like the OpenAI team of 3-7 engineers), each person embodies multiple archetypes. In a larger team (like Affirm's 800+ engineers), individuals tend to specialize.

What's important is that *all four archetypes are represented*. A team with strong Architects but weak Specifiers will have a beautiful architecture that agents can't work in because the specifications are too vague. A team with strong Specifiers but weak Verifiers will have precise output that nobody checks for correctness. A team with strong Verifiers but weak Mechanics will have good quality standards but a harness that degrades over time.

## The Multiplier Effect

Here's where the math gets interesting. In traditional development, an engineer's output is bounded by their personal productivity — how fast they can type, how many files they can hold in their head, how many hours they can work. There are only so many lines of code one person can produce in a day.

In agent-first development, an engineer's output is bounded by the quality of their harness and specifications, not by their personal coding speed. One engineer guiding one agent can produce the output of many traditional engineers. The OpenAI team averaged 3.5 PRs per engineer per day — a rate that would require multiple traditional engineers.

But the multiplier effect goes deeper than individual throughput. When you build a good harness — clear constraints, comprehensive documentation, automated verification — it doesn't just help *you*. It helps every agent that works in the codebase, and by extension, every engineer who guides those agents. The harness is a *shared multiplier* that amplifies everyone's productivity.

This is why the OpenAI team's throughput *increased* as the team grew. In traditional development, adding engineers to a project often decreases per-engineer productivity due to coordination overhead (the famous Brook's Law: "adding manpower to a late software project makes it later"). In agent-first development, adding engineers increases per-engineer productivity because each new engineer contributes to the shared harness, making all agents more effective.

The Affirm team saw a similar dynamic. Their investment in "context files maintained at multiple levels of the codebase — conventions, domain knowledge, and team decisions where agents could find them" was a shared multiplier. Every team that contributed to these files made all the other teams more effective.

This is the fundamental economics of agent-first development: **the marginal cost of additional agent-guided output is low, and the shared harness makes each marginal unit higher quality.** The fixed cost is building the harness. The variable cost is specifying tasks and reviewing output. And the harness continuously reduces the variable cost by enabling more autonomous agent behavior.

### The Numbers Behind the Multiplier

Let me put some concrete numbers on this, drawn from the case studies in this book:

- **OpenAI:** 3 engineers → 1M lines in 5 months → ~67,000 lines per engineer per month. Traditional industry average is roughly 500-2,000 lines per engineer per month for production-quality code. That's a 30-130x multiplier on lines produced.
- **Affirm:** 60%+ of PRs agent-assisted within 4 months of retooling. Weekly merged PR volume up 58% year-over-year. This with a twelve-year-old legacy monorepo, not a greenfield project.
- **Wix:** Their AirBot agent saves 675 engineering hours per month at $0.30 per interaction across 4,200 flows per month.⁷ That's a 35-50x ROI on the agent investment.
- **Morgan Stanley:** 280,000 hours reclaimed across 9M lines through their DevGen.AI initiative.⁸
- **Faros AI benchmark:** $37.50 cost per incremental PR — making each additional PR dramatically cheaper than the engineering time it would otherwise require.

Now, lines of code is a terrible metric for productivity, and raw output volume doesn't capture quality. The METR studies we discussed in Chapter 1 remind us that speed without quality is just faster failure. But the multiplier effect is real and significant: agent-first engineers produce substantially more *verified, correct output* than traditional engineers, because the harness handles the mechanical work while the engineer focuses on the judgment work.

There's also a quality dimension to the multiplier that often gets overlooked. When the Affirm team says 60% of PRs are agent-assisted, they're not saying 60% of PRs are lower quality. They're saying 60% of PRs were produced faster, reviewed by both agents and humans, and verified by automated systems. The quality bar — enforced by the harness — remains constant or improves. The throughput goes up *and* the quality stays the same or gets better. That's the promise of agent-first development when the harness is well-designed.

However, the multiplier is not uniform. As the METR study documented (Chapter 1), actual time savings range from 1.5x to 13x depending on task type, harness maturity, and specification quality. Well-specified tasks in well-harnessed environments see the highest multipliers; vaguely-specified tasks in poorly-harnessed environments may see no improvement — or even negative improvement.

## The Daily Workflow

What does an agent-first engineer actually do all day? Let's walk through a typical day:

### Morning: Planning and Prioritization (1-2 hours)

The day starts with *deciding what to build*, not *how to build it*. This might include:

- Reviewing the backlog and selecting the next priority
- Reading bug reports and translating them into agent-executable specifications
- Reviewing execution plans from the previous day's agent runs
- Updating AGENTS.md or other context files based on what you learned
- Checking the quality scorecard for any regressions

The key activity is *translation*: translating product requirements into agent-understandable specifications, translating architectural decisions into enforceable constraints, and translating quality standards into automated checks.

This is where the Specifier archetype dominates. The output of this phase is not code — it's a clear, precise description of what the agent should build.

### Mid-Morning: Agent Execution (2-3 hours)

This is where you set the agent in motion. The workflow might be:

1. Write the execution plan or task description
2. Start the agent (or queue it in the cloud)
3. Review the agent's initial plan (many agents will propose an approach before executing)
4. Approve or redirect the plan
5. Let the agent execute
6. Review the PR when it's ready

In a mature harness, the agent handles steps 4-5 autonomously. The engineer's time is spent on steps 1-3 (specification) and step 6 (verification). Multiple agents can run in parallel on different worktrees, so the engineer might be reviewing one agent's output while another is still executing.

The Affirm team's workflow captures this pattern: *"One task equals one agent session equals one PR."* Each task is self-contained, with its own worktree, and the engineer can have multiple tasks running in parallel.

What does a good execution plan look like? Here's an example for the task "Add email notification support to user registration":

```markdown
# Execution Plan: Email Notification for Registration

## Goal
When a user successfully registers, send a welcome email
using the existing notification service.

## Scope
- Modify registration service to emit a USER_REGISTERED event
- Add email handler in notification service
- Create email template using our design system
- Add integration test covering the full flow

## Constraints
- Use existing EventBus (see docs/services/event-bus.md)
- Email template must be in docs/templates/ format
- All new code must follow layer architecture (Types → Config → Data → Services → Runtime → UI)
- Structured logging required at each step

## Acceptance Criteria
1. After successful registration, welcome email is sent within 5 seconds
2. Email contains user's name and a link to getting-started guide
3. If email sending fails, registration still succeeds (fire-and-forget)
4. Integration test passes confirming email content
5. Lint and structural tests pass

## Out of Scope
- Email customization preferences
- Multiple email templates
- Email analytics tracking
```

This specification is precise enough that the agent can implement it without additional context, yet flexible enough that the agent has freedom in *how* it implements each step. The constraints reference specific documents and patterns in the repository. The acceptance criteria are testable. The scope is explicit about what's not included.

The time to write this specification might be 15-20 minutes. The time for the agent to implement it might be 10-30 minutes (depending on the codebase and the model). The time to review the PR might be 10-15 minutes. Total human time: 25-35 minutes. Traditional implementation time: 2-4 hours. The leverage ratio is clear.

### Afternoon: Review and Harness Maintenance (2-3 hours)

The afternoon is for *verifying and improving*:

- Reviewing agent-generated PRs (both your own and your teammates')
- Identifying patterns in agent errors or suboptimal output
- Updating linters, documentation, or other harness components
- Writing or updating execution plans for tomorrow's tasks
- Reviewing the quality scorecard and addressing any regressions

This is where the Verifier and Mechanic archetypes dominate. The engineer is maintaining the system that makes the agents effective.

### End of Day: Preparation for Tomorrow (30 minutes)

Before signing off, the engineer might:

- Queue up overnight agent runs for tasks that can execute autonomously
- Review the results of any overnight runs from the previous night
- Update the priority list based on what was accomplished today
- Document any architectural decisions or context that was discovered during the day

The OpenAI team regularly saw single Codex runs work on tasks for upwards of six hours — often while the humans were sleeping. This overnight execution is a uniquely agent-first phenomenon: your agents can be productive 24/7, and the harness ensures they're productive *in the right direction*.

## Skills That Matter Most (And Least)

The shift from coding to conducting requires a different skill set. Let me be specific about what matters more and what matters less.

### Skills That Matter Most

**Clear writing.** This is the #1 skill in agent-first development. Can you describe what you want built with precision and clarity? Can you write a specification that leaves no room for misinterpretation? Can you document an architectural decision so that both humans and agents can understand it? Engineers who can write clearly will thrive. Engineers who can't will struggle.

**Systems thinking.** Can you see the codebase as a system, not just a collection of files? Can you identify the architectural boundaries, the dependency flows, the abstraction layers? Can you predict how a change in one area will affect others? This is essential for designing effective harnesses.

**Decomposition.** Can you break a complex feature into small, well-scoped tasks? Can you identify the dependencies between tasks and sequence them correctly? Can you define the minimum viable implementation that exercises the full stack? This is the core Specifier skill.

**Pattern recognition.** Can you identify recurring patterns in agent output — both good and bad? Can you see when the agent is drifting from the architecture, and can you articulate *why*? This is the core Verifier skill.

**Discipline and consistency.** Can you maintain the harness over time? Can you resist the temptation to skip the specification and just "fix it yourself"? Can you follow the observe → name → document → mechanize → verify loop consistently? This is the core Mechanic skill.

**Domain knowledge.** Understanding the business domain — what the product does, who the users are, what the edge cases are, what "correct" looks like — becomes more important, not less. The agent can implement anything you specify. But it can't tell you whether you specified the *right* thing. That's human judgment, and it requires domain knowledge.

### Skills That Matter Less (But Still Matter)

**Typing speed and coding fluency.** You don't need to be fast at typing code. The agent handles code production. But you still need to be able to *read* code — to review the agent's output and understand what it does. Reading code is a different skill from writing it, and it's arguably more important in agent-first development than it was in traditional development.

**Framework-specific knowledge.** The agent knows the frameworks. It knows the APIs, the patterns, the idioms. You need to know *which* framework to use and *why*, but you don't need to memorize its API surface. This is especially true given the "boring technology" principle — if you're using well-established frameworks, the agent has seen them extensively in its training data and will produce idiomatic code.

**Debugging at the code level.** In agent-first development, debugging is often handled by the agent itself — it reads error messages, identifies the issue, and fixes the code. You need to be able to debug at the *system* level (why is the architecture wrong? why is the harness insufficient?) but less so at the code level (why is this variable null?).

**Knowledge of syntax and language quirks.** The agent handles syntax. You focus on semantics — what the code should do, not how to express it.

I want to be clear: I'm not saying these skills are *unimportant*. I'm saying they're *less differentiating* in agent-first development than they are in traditional development. An engineer who's great at all of the above but terrible at clear writing will struggle. An engineer who's mediocre at coding but excellent at writing, systems thinking, and decomposition will thrive.

### A Personal Reflection on the Skill Shift

I've spoken with dozens of engineers who've made this transition, and the most common emotional response is a mixture of liberation and anxiety. Liberation because the parts of the job they found tedious — writing boilerplate, debugging typos, looking up API signatures — are now handled automatically. Anxiety because the parts of the job they found identity-defining — "I wrote that service," "I debugged that production issue" — are no longer their exclusive domain.

The engineers who thrive are the ones who find new sources of satisfaction. There's a deep satisfaction in designing an architecture that agents naturally follow. There's pride in writing a specification so clear that the agent nails it on the first attempt. There's a particular joy in writing a linter that catches a class of bugs forever — knowing that no future agent session will ever make that mistake again because of something you built.

As one Affirm engineer put it during their retooling week: the experience of watching an agent correctly implement your specification is not unlike the experience of mentoring a junior developer who really gets it. You provided the guidance, they did the work, and the result is better than either of you could have achieved alone. The difference is that the "junior" can work 24/7, never gets frustrated, and can handle ten tasks simultaneously.

## How the Role is Already Changing

The shift from coder to conductor isn't theoretical — it's happening right now at some of the world's largest engineering organizations.

**Meta: From Writing ML Code to Designing Experiments.** Meta's Ranking Engineer Agent (REA) operates at a level of autonomy that would have seemed science fiction just two years ago. REA can work independently for weeks at a time, improving the ML models that power Meta's ads ranking system. It doubled model accuracy and 5x'd engineering output. But the most interesting part is what the *engineers* are now doing. Instead of writing ML code, they define experiment hypotheses, set constraints on the solution space, and review the agent's output for business alignment. The engineers have become experiment designers. The harness — Meta's internal platform for managing REA — defines what the agent can and cannot do, what metrics it optimizes for, and when it must escalate to a human. The engineers who thrive in this model are the ones who can think clearly about what the system *should* do, not how to implement it.

**Uber: From Writing Tests to Reviewing AI-Generated Tests.** Uber built Validator and AutoCover — two AI-powered systems that detect security violations and automatically generate test coverage. The result: 21,000 developer hours saved, 10% test coverage increase with less human effort, and 92% of engineers using AI agents monthly.⁴ But the role shift is the real story. Engineers who previously spent hours writing unit tests now review AI-generated tests for completeness and correctness. The skill that matters isn't "writing a good test" — it's "recognizing whether a test actually validates the right behavior." That's a Verifier skill, and it's becoming the primary activity for many Uber engineers.

**Spotify: From Implementation to Specification via Slack.** Spotify's background coding agent, Honk, integrates directly into Slack. Engineers prompt code changes from their phones during a commute, specify what they want changed, and review the resulting PR when they're back at their desk. Over 1,500 PRs have been merged through Honk.⁵ The workflow compresses the traditional cycle — write code, test, review, merge — into a specification-verification loop. The engineer specifies; Honk implements and verifies; the engineer reviews the result. The engineers who get the most from Honk are the ones who write the clearest specifications — reinforcing the pattern that clear writing is the #1 skill in agent-first development.

The common thread across all three companies: **what the engineer did before → what they do now → what the harness enables.** In every case, the harness makes the transition possible. Without Meta's platform constraining REA's behavior, engineers couldn't trust it to work autonomously. Without Uber's MCP Gateway providing standardized agent access, the multi-agent ecosystem wouldn't scale. Without Spotify's Fleet Management platform ensuring predictable results through strong feedback loops, engineers wouldn't trust Honk's output enough to merge its PRs.

### The Solo Developer and the Small Team

Most of the case studies in this book involve enterprise teams — hundreds of engineers, dedicated platform teams, significant infrastructure budgets. But harness engineering applies just as much to solo developers and small teams of 2–5 engineers. In fact, the leverage effect may be even more pronounced at small scale, because a single engineer with a good harness can produce the output of an entire traditional team.

**The personal harness.** A solo developer doesn't need all the infrastructure described in the OpenAI case study. A personal harness can be surprisingly simple:

1. **A concise AGENTS.md** (30–50 lines) with project conventions, build commands, and testing requirements.
2. **Pre-commit hooks** instead of full CI. Tools like `husky` and `lint-staged` provide local enforcement that catches violations before they're pushed, without the overhead of a CI pipeline.
3. **A reusable project template** — a GitHub repository template or a `degit`-compatible scaffold that includes the directory structure, linter rules, and AGENTS.md. When you start a new project, you clone the template and have a working harness in under five minutes.

Shopify's open-source AI Toolkit provides an example of accessible tooling for small teams.⁶ Rather than building proprietary infrastructure, Shopify built plugins that integrate into existing developer tools — editor extensions for Claude Code, Cursor, Gemini CLI, and VS Code. Small teams can adopt these plugins without building anything from scratch.

**The small-team advantage.** Teams of 2–5 engineers have an advantage that large teams lack: communication overhead is near zero. Everyone knows the architecture, everyone agrees on the conventions, and the harness can evolve quickly through informal consensus. The "one team, one brain" principle that the OpenAI team relied on comes naturally to small teams.

The key insight for solo developers and small teams: **start with the minimum viable harness and grow it organically.** Don't try to replicate the OpenAI team's infrastructure. Instead, start with AGENTS.md and pre-commit hooks, add linters as you discover what the agent gets wrong, and build up to more sophisticated harness elements only when the need arises. The harness should serve you, not the other way around.

## The Psychological Shift

The hardest part of transitioning to agent-first development is not technical. It's psychological. You need to fundamentally change your relationship with code.

### The Identity Challenge

For most engineers, their identity is tied to their ability to write code. "I'm a great Python developer." "I wrote that service from scratch." "I can debug anything." This identity has been reinforced over years or decades — through education, through hiring processes, through performance reviews, and through the intrinsic satisfaction of building something yourself.

Agent-first development threatens this identity. If the agent writes the code, who are you? If you can't point to a function and say "I wrote that," what's your contribution?

This is a real psychological challenge, and I don't want to minimize it. But I also want to reframe it. The conductor of an orchestra doesn't feel threatened by the violinist's superior violin playing. They have a different role — one that's equally demanding and equally valuable. The architect who designs a building doesn't feel diminished because they didn't lay the bricks. They understand that the design is the hard part, and the construction is (relatively) mechanical.

In agent-first development, the design *is* the hard part. Specifying what to build, designing the architecture, defining the quality standards, and creating the feedback loops — these are the intellectually demanding activities. The code production is (increasingly) mechanical.

One developer from the METR study captured the psychological shift vividly: *"My head's going to explode if I try to do too much the old fashioned way because it's like trying to get across the city walking when all of a sudden I was more used to taking an Uber."* This isn't just about speed — it's about a fundamental change in how you relate to the work.

### The Control Challenge

Engineers like control. We like to know exactly what's happening in our code, why it's happening, and how to fix it if something goes wrong. Agent-first development reduces this control. You describe what you want, the agent builds it, and you review the result. You don't control every line of code. You don't direct every decision. You set boundaries and let the agent operate within them.

For engineers who derive satisfaction from fine-grained control, this is uncomfortable. But consider: the OpenAI team produced better code with agents than many human-first teams produce, precisely because they gave up fine-grained control in favor of *system-level control*. They didn't control what each function looked like. They controlled the architecture, the constraints, and the verification — and that was enough.

> *"The resulting code does not always match human stylistic preferences, and that's okay. As long as the output is correct, maintainable, and legible to future agent runs, it meets the bar."*

This is a mature perspective. In agent-first development, you let go of *style* and hold onto *correctness*. You let go of *implementation details* and hold onto *architectural boundaries*. You let go of *how* and hold onto *what* and *why*.

### The Learning Challenge

In traditional development, you learn by doing. You write code, it breaks, you fix it, and you learn from the experience. Over time, you accumulate deep knowledge of the codebase because you've personally written and debugged most of it.

In agent-first development, this learning path is disrupted. You're not writing the code, so you're not learning through the write-break-fix cycle. This is a genuine risk — the Affirm team identified it as one of their concerns: "second-order problems that compound over time... the erosion of human understanding of the systems we operate."

How do you maintain deep codebase knowledge when you're not the one writing the code? Several strategies help:

- **Read agent-generated code carefully during review.** This is your primary learning mechanism. Don't rubber-stamp PRs — study them. Understand what the agent did and why.
- **Maintain the documentation.** When you write architecture docs, execution plans, and quality scorecards, you're forced to understand the system at a deep level.
- **Design the tests.** Writing tests is specification work. When you define what the system should do in edge cases, you're learning the system's behavior deeply.
- **Debug the harness.** When the harness breaks — when a linter misses something, when a structural test is wrong, when the CI pipeline fails — fixing it requires understanding the system architecture.

The key insight: in agent-first development, you learn by *reading, specifying, and debugging the meta-system*, not by writing and debugging the code directly. It's a different kind of learning, but it can be equally deep.

### The Affirm Model: How to Retool 800 Engineers

The Affirm retooling week deserves special attention because it's the largest documented case of organizational transformation to agent-first development. Their approach offers a template that other organizations can follow.

**The setup:** A working group of nine engineers had two weeks to produce a repeatable agentic workflow. Three decisions shaped everything:

1. **Single default toolchain.** They chose Claude Code and wrote the entire workflow against its primitives. Engineers who preferred other tools could adapt, but there was a clear starting point.
2. **Local-first development.** The tooling landscape hadn't converged on a centralized platform. Local-first meant engineers could be productive immediately.
3. **Explicit human checkpoints.** Providing intent, approving plans, reviewing code, and merging. Outside those checkpoints, as much toil as possible was automated away.

**The week itself:** Monday opened with a leadership kickoff and live demo. Tuesday featured "art of the possible" sessions. Wednesday was heads-down. Thursday was team-led demos. Friday was org-wide demos selected by engineering leaders and voted on by the whole organization.

**The support system:** Dedicated support channels staffed by timezone, helpdesk sessions for anyone stuck, and a leaderboard of agentic PR submissions by team. The emphasis was on experimentation over perfection.

**The results:** 92% of the engineering organization submitted at least one agent-assisted PR. Budget was ~$200k (around $250/engineer for token usage). They used about 70% of that budget. And the most valuable output was a candid picture of what didn't work.

**The key lesson from Affirm:** Forcing functions work. A dedicated week with suspended meetings and leadership backing created more adoption in five days than months of gradual rollout would have. The enablement team mattered as much as the tools. And culture sets the ceiling — leadership conviction, psychological safety to experiment, and clear accountability for outcomes created the conditions for success.

## Team Size and Leverage

The OpenAI team started with three engineers and grew to seven. Affirm has 800+. Both achieved significant results. So what's the right team size for agent-first development?

The answer depends on the phase:

### Small Team (3-7 engineers): The Greenfield Phase

For a new project starting from an empty repository, a small team is ideal. Three to seven engineers can move fast, build consensus quickly, and evolve the harness rapidly. Each engineer embodies all four archetypes — Architect, Specifier, Verifier, Mechanic — and wears different hats depending on the day's needs.

The OpenAI team operated this way. Three engineers building a million-line product. Their small size was an advantage: they could make architectural decisions quickly, update the harness without bureaucratic overhead, and maintain a shared understanding of the system.

What makes this work at small scale is the "one team, one brain" principle. In a small team, everyone has the same mental model of the architecture, the same understanding of the constraints, and the same quality standards. When the Architect adds a new linter, the Specifier immediately knows about it and adjusts their specifications. When the Verifier identifies a new failure mode, the Mechanic fixes it that afternoon. Communication overhead is minimal because the team is small enough that everyone is in everyone else's context.

The risk at small scale is burnout. Each engineer is wearing multiple hats, and the harness requires constant maintenance. The OpenAI team spent 20% of their week on cleanup before they automated it. At small scale, this maintenance load falls on everyone.

### Medium Team (10-50 engineers): The Scaling Phase

As the codebase grows and the team expands, specialization emerges. Some engineers focus on architecture, others on specification, others on verification, others on tooling. The harness becomes the coordination mechanism — it encodes the architectural decisions and quality standards so that every agent (and every engineer) operates consistently.

At this scale, the key challenge is maintaining the harness. More engineers means more context to manage, more patterns to enforce, and more opportunities for drift. The Mechanic archetype becomes critical — someone needs to keep the harness healthy as the codebase scales.

A pattern that works well at this scale is the "platform team" model: a small group (3-5 engineers) maintains the harness — the linters, the CI pipeline, the documentation structure, the quality metrics — while the product teams consume it. The platform team is the guardian of the architecture and the enabler of the product teams.

This is where the "boring technology" principle from Chapter 2 becomes especially important. At this scale, you have many agents working in the codebase simultaneously, and they need to produce consistent output. A technology stack that's well-represented in training data and has stable APIs makes consistency much easier to achieve. A technology stack that's novel or unstable introduces variability that the harness has to work harder to control.

The communication pattern also changes at this scale. In a small team, knowledge sharing is organic — everyone sees everything. In a medium team, you need structured knowledge sharing: architecture decision records (ADRs), regular design reviews, and documentation that's treated as a first-class artifact. The harness should encode the architectural decisions, but the *rationale* for those decisions needs to be documented somewhere the agent can find it.

### Large Team (50-500+ engineers): The Enterprise Phase

At enterprise scale, the harness becomes a platform. It's maintained by a dedicated team (platform engineering) and consumed by many product teams. The architecture is relatively fixed, and the primary activity is specification and verification within the established framework.

Affirm is at this phase. Their approach — a dedicated Developer Productivity team maintaining the tooling and context, with product teams consuming it — is the enterprise pattern. The working group of nine engineers that prepared for their retooling week was effectively a platform team building the harness that 800+ engineers would use.

### The Leverage Ratio

Regardless of team size, the key metric is the *leverage ratio*: how much verified, correct output does each engineer produce? In traditional development, this ratio is roughly constant — adding engineers adds output proportionally. In agent-first development, the ratio increases over time as the harness improves. Each improvement to the harness amplifies every engineer's productivity simultaneously.

This is the fundamental economic argument for agent-first development: **the harness is a fixed investment that compounds over time.** Every linter you write catches violations forever. Every documentation improvement helps every future agent session. Every structural test prevents architectural drift permanently. The marginal cost of each improvement is low (the agent can help you write linters and tests!), but the cumulative benefit is enormous.

The Affirm team's experience illustrates this beautifully. Their retooling week was a fixed investment (one week of paused delivery, ~$200k in token costs). The return is ongoing: 60%+ of PRs agent-assisted, 58% increase in merged PR volume, and accelerating. The investment compounds.

---


---

## Footnotes

¹ Affirm Engineering, "Retooling Our Engineering Organization for Agentic Development," Affirm Engineering Blog, 2026. [Citation needed — verify before publication]

² Ryan Lopopolo, "Harness Engineering: Leveraging Codex in an Agent-First World," OpenAI Blog, February 2026. https://openai.com/blog/harness-engineering-leveraging-codex

³ Meta Engineering, "Ranking Engineer Agent (REA)," Meta Engineering Blog, March 2026. https://engineering.fb.com/2026/03/17/developer-tools/ranking-engineer-agent-rea

⁴ Uber Engineering, "uReview: AI-Powered Code Review at Uber," Uber Blog, 2025. https://www.uber.com/blog/ureview

⁵ Spotify Engineering, "Spotify's Background Coding Agent," November 2025. https://engineering.atspotify.com/2025/11/spotifys-background-coding-agent-part-1

⁶ Shopify, "Shopify AI Toolkit," shopify.dev. https://shopify.dev/docs/apps/build/ai-toolkit

⁷ Wix Engineering, "AirBot: Our AI On-Call Teammate," Wix Engineering Blog, 2025. [Citation needed — verify before publication]

⁸ Morgan Stanley, "DevGen.AI: Transforming Developer Productivity," Morgan Stanley Technology, 2025. [Citation needed — verify before publication]

---

## Chapter Summary

- The engineer's role shifts from code producer to conductor: designing environments, specifying intent, and building feedback loops.
- Four archetypes emerge: **Architect** (structure and constraints), **Specifier** (what to build), **Verifier** (correctness), and **Mechanic** (harness maintenance). All four must be represented on a team.
- The multiplier effect means each engineer's output is amplified by the shared harness. Adding engineers increases per-engineer productivity because each contributes to the shared multiplier.
- A typical day includes: planning and specification (morning), agent execution (mid-day), review and harness maintenance (afternoon), and overnight autonomous runs.
- The most important skills are clear writing, systems thinking, decomposition, pattern recognition, discipline, and domain knowledge. Coding fluency matters less.
- The psychological shift involves letting go of identity tied to code-writing, accepting reduced fine-grained control, and finding new ways to learn and maintain codebase knowledge.
- Team size follows the project phase: small (3-7) for greenfield, medium (10-50) for scaling, large (50-500+) for enterprise. The leverage ratio increases over time as the harness improves.
- The fundamental economics: the harness is a fixed investment that compounds. Every improvement amplifies every engineer's productivity forever.
