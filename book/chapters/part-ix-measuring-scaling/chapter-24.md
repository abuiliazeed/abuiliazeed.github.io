# Chapter 24: Scaling to Large Teams

> *"Scaling isn't about doing more of the same. It's about doing different things at each level of growth."*

---

## Introduction: The Scaling Journey

A team of 3 engineers using AI coding agents faces fundamentally different challenges than a team of 50, or an organization of 500. The practices that work at small scale break at large scale — not because they're wrong, but because the coordination overhead, cultural dynamics, and infrastructure requirements change qualitatively at each stage.

This chapter maps the scaling journey across three plateaus: the small team (3–5), the medium team (20–50), and the large organization (200–500+). For each stage, we'll explore the organizational structure, platform engineering needs, coordination patterns, and common failure modes.

---

## Stage 1: The Small Team (3–5 Engineers)

### What Works

At this scale, coordination is organic. Everyone knows everything. The harness is simple and maintained by everyone.

**Organizational structure:** Flat. No hierarchy needed. One person (usually the most experienced engineer) serves as the de facto architect, maintaining the harness and making technology decisions.

**Harness approach:** A single AGENTS.md in the repo root. Linters and tests maintained collectively. CI is straightforward (GitHub Actions or equivalent).

**Agent usage:** Everyone uses the same agent platform. Level 2–3 autonomy is common. Multi-agent patterns are used for parallel feature work but not complex orchestration.

**Key practices:**
- Daily standups where engineers share what the agent did (and what went wrong)
- Shared document of "agent lessons learned" (what prompts work, what patterns the agent handles well)
- Collective ownership of the harness — everyone writes linter rules and updates AGENTS.md
- Fast review cycles — PRs are reviewed within hours, not days

**The small team advantage:** Small teams have a unique advantage in agent-first development: everyone sees everything. When one engineer discovers a useful pattern or encounters a surprising failure, the entire team benefits immediately. There's no knowledge transfer overhead, no documentation gap, no communication latency. This makes small teams the ideal environment for rapid harness iteration.

**The first week playbook for a small team:**

```
Day 1: Setup
□ Choose primary agent platform (one tool for everyone)
□ Create initial AGENTS.md with build/test/lint commands
□ Run agent on 3 trivial tasks to calibrate expectations

Day 2: First Real Work
□ Each engineer runs agent on 2 tasks from their backlog
□ Review every line of agent output
□ Document patterns where agent struggled
□ Update AGENTS.md with fixes for top 3 issues

Day 3: Harness Building
□ Write first custom linter rule (based on Day 2 failure patterns)
□ Set up CI integration for agent PRs
□ Create shared document of "agent tips" for the team

Day 4: Expand Scope
□ Give agent multi-file tasks (Level 2)
□ Test the Ralph Wiggum Loop (self-correction)
□ Measure first-attempt pass rate

Day 5: Retrospective
□ Review the week's metrics
□ Identify top 3 harness improvements needed
□ Plan next week's focus
□ Decide: are we ready for Level 2 autonomy?
```

**Common failure:**
The most common failure at this stage is **under-harnessing**. The team doesn't invest enough in context engineering and mechanical enforcement, leading to agent-generated code that requires extensive manual cleanup. The fix is to allocate 20% of engineering time to harness maintenance — writing linters, updating docs, expanding test coverage.

**The under-harnessing death spiral:**

1. Team doesn't invest in AGENTS.md → agent produces inconsistent code
2. Team doesn't write linters → inconsistency isn't caught automatically
3. Agent output requires more human review time → engineers are frustrated
4. Engineers reduce agent usage → throughput gains diminish
5. Team concludes "agents don't work" → reverts to manual coding

The antidote is the 20% rule: from day one, dedicate a portion of each sprint to harness improvement. It's not overhead — it's the infrastructure that makes the other 80% productive.

### The 20% Rule

At every stage, allocate approximately 20% of engineering capacity to harness maintenance and improvement. This includes:
- Writing and updating linter rules
- Maintaining AGENTS.md and docs/
- Improving CI pipelines
- Training and onboarding
- Measuring and reporting on agent effectiveness

This isn't overhead — it's the investment that makes the other 80% productive.

---

## Stage 2: The Medium Team (20–50 Engineers)

### What Changes

At 20+ engineers, organic coordination breaks down. Not everyone knows everything. The harness becomes shared infrastructure that requires dedicated maintenance.

### Organizational Structure

Introduce a **platform engineering team** (2–4 engineers) responsible for:

- Maintaining the shared harness (AGENTS.md templates, linter libraries, CI pipelines)
- Managing agent platform licenses and configuration
- Providing training and support for agent-first workflows
- Measuring and reporting on organizational agent effectiveness
- Responding to agent-related incidents

The platform team is the custodian of the harness. Feature teams consume the harness and provide feedback on what's working and what's not.

**Platform team staffing model:** The platform team should be staffed with engineers who have both deep technical skills (they're building linters and CI pipelines) and strong communication skills (they're training teams and gathering feedback). Look for engineers who enjoy developer infrastructure and have experience with the challenges of multi-team coordination.

The platform team reports to the VP of Engineering or CTO, not to any individual feature team. This independence is crucial — the platform team needs to make decisions that are good for the organization as a whole, even when individual teams would prefer different choices.

**Platform team responsibilities by week:**

| Activity | Weekly Time | Description |
|---|---|---|
| Harness maintenance | 30% | Updating linters, CI pipelines, AGENTS.md templates |
| Team support | 25% | Helping teams with agent issues, debugging harness problems |
| Measurement & reporting | 15% | Tracking metrics, generating reports, identifying trends |
| Training & onboarding | 15% | Training new teams, updating training materials |
| Incident response | 10% | Responding to agent-related security or quality incidents |
| Research & evaluation | 5% | Evaluating new tools, models, and practices |

### Federated Multi-Agent Deployments

At this scale, different teams will want different agent configurations:

- **Frontend team:** Focused on UI legibility, visual regression testing, component library patterns
- **Backend team:** Focused on API contract stability, database migration patterns, service mesh integration
- **Infrastructure team:** Focused on IaC patterns, deployment automation, security scanning
- **Data team:** Focused on pipeline patterns, schema evolution, data quality validation

The harness must support federation: central standards with team-level customization.

### Federation Pattern

```
Root AGENTS.md (maintained by platform team)
├── Organization-wide rules (coding standards, review requirements)
├── Platform-wide linters (security, performance)
└── Shared CI pipeline templates

Per-team AGENTS.md (maintained by feature teams)
├── Team-specific patterns (domain conventions)
├── Team-specific linters (domain-specific rules)
└── Team-specific test templates
```

The root AGENTS.md sets the floor. Team AGENTS.md files add team-specific context on top. Linters enforce that team-level customizations don't violate organization-wide rules.

**Implementing the federation pattern:**

```yaml
# .agents-md-federation.yml
# Controls how AGENTS.md files are merged and enforced

root: "AGENTS.md"  # Organization-wide rules
  priority: 100       # Highest priority
  overrides: false    # Cannot be overridden by team rules
  
teams:
  - pattern: "frontend/**"
    config: "frontend/AGENTS.md"
    priority: 50
    allowed_overrides: [coding_style, test_framework, component_patterns]
    
  - pattern: "backend/**"
    config: "backend/AGENTS.md"
    priority: 50
    allowed_overrides: [api_patterns, database_patterns, error_handling]
    
  - pattern: "infra/**"
    config: "infra/AGENTS.md"
    priority: 50
    allowed_overrides: [iac_patterns, deployment_patterns]

enforcement:
  - rule: "No team config may disable organization-wide linters"
  - rule: "All team configs must include review requirements"
  - rule: "Security rules are always inherited from root"
```

### Cross-Team Coordination

At this scale, agent-generated changes start affecting multiple teams. A backend agent modifies an API contract that the frontend team depends on. An infrastructure agent changes a deployment configuration that affects everyone.

**Coordination mechanisms:**
- **Contract testing:** API contracts between teams are verified automatically. If a backend agent modifies an API, the frontend team's contract tests catch the change.
- **Shared execution plans:** For cross-team changes, create a shared execution plan that coordinates across team boundaries.
- **Agent-aware code review:** Reviewers from affected teams are automatically assigned to PRs that touch shared interfaces.
- **Change notification:** Teams subscribe to notifications for changes in shared areas (API definitions, shared libraries, infrastructure config).

### Knowledge Sharing

The biggest challenge at medium scale is knowledge sharing. What one team learns about agent-first development should be available to all teams.

**Knowledge sharing mechanisms:**
- **Internal wiki:** A shared knowledge base of harness patterns, agent tips, and lessons learned
- **Monthly agent retrospective:** All teams share their experiences, challenges, and innovations
- **Harness pattern library:** A shared repository of reusable linter rules, test templates, and AGENTS.md snippets
- **Center of excellence:** A small group (could be part of the platform team) that curates and disseminates best practices

**The monthly retrospective format:**

```
Agent-First Development Monthly Retrospective (60 minutes)

1. Metrics Review (15 min)
   - Organization-wide: PR throughput, quality scores, ROI
   - Per-team highlights and lowlights

2. Lessons Learned (20 min)
   - Each team shares one thing that worked well
   - Each team shares one thing that didn't work
   - Open discussion

3. Harness Improvements (15 min)
   - Proposed new golden principles
   - Linter rule requests
   - Platform team roadmap update

4. Action Items (10 min)
   - Assign owners for follow-up items
   - Set deadlines
   - Plan next month's focus areas
```

### Common Failure

The most common failure at this stage is **fragmentation**. Teams diverge in their practices, creating silos where each team has a different harness, different agent configurations, and different quality standards. The fix is the federation pattern above — shared standards with team-level customization, enforced by the platform team.

**Signs of fragmentation:**
- Teams use different agent platforms with no shared standards
- An engineer moving between teams needs to learn completely different practices
- Quality metrics vary wildly between teams (some at 90% quality score, others at 50%)
- Cross-team PRs generate confusion because the teams have different naming conventions
- The platform team is overwhelmed with custom requests instead of maintaining shared standards

---

## Stage 3: The Large Organization (200–500+ Engineers)

### What Changes

At 200+ engineers, the challenges become organizational and political as much as technical. The harness is now critical infrastructure, and its governance requires executive-level attention.

### Organizational Structure Changes

**Agent Platform Team (5–8 engineers):**
- Manages agent platform infrastructure
- Handles vendor relationships and licensing
- Implements organization-wide security controls
- Provides L2+ support for agent-related issues

**Harness Engineering Team (3–5 engineers):**
- Maintains the core harness (linters, templates, CI)
- Conducts harness audits for teams
- Publishes best practices and training materials
- Measures organizational agent effectiveness

**Agent Security Team (2–3 security engineers):**
- Conducts security reviews of agent integrations
- Manages incident response for agent-related security events
- Stays current with the threat landscape
- Implements and monitors security controls

**Feature Teams (10–30 per team):**
- Consume the harness provided by platform teams
- Customize the harness for their domain
- Report issues and improvements to platform teams
- Operate with increasing autonomy as the harness matures

**The organizational evolution:** Here's how the structure evolves across stages:

```
Stage 1 (3-5 engineers):     Stage 2 (20-50 engineers):     Stage 3 (200+ engineers):
┌──────────────────┐      ┌──────────────────┐          ┌──────────────────┐
│   Flat Team      │      │  Platform Team   │          │  Agent Platform  │
│   (3-5 people)   │      │  (2-4 people)    │          │  Team (5-8)      │
│                  │      │  + Feature Teams │          ├──────────────────┤
│  Everyone does   │      │  (15-30 each)    │          │  Harness Eng     │
│  everything      │      │                  │          │  Team (3-5)      │
│                  │      │  Shared harness  │          ├──────────────────┤
│  Simple harness  │      │  + team configs  │          │  Agent Security  │
│                  │      │                  │          │  Team (2-3)      │
└──────────────────┘      └──────────────────┘          ├──────────────────┤
                                                          │  Feature Teams   │
                                                          │  (10-30 each)    │
                                                          └──────────────────┘
```

### Centralized Governance with Team Autonomy

The tension at large scale is between centralized governance (consistency, security, compliance) and team autonomy (speed, domain-specific optimization, innovation).

The resolution is **governance as code:**

- **Policies are encoded** as linter rules, CI checks, and automated gates
- **Teams can propose changes** through a pull request to the governance repository
- **The platform team reviews and merges** policy changes
- **Compliance is verified automatically** by the CI pipeline
- **Exceptions are tracked and reviewed quarterly**

This turns governance from a bureaucratic process into a code review process — one that agents can participate in.

**The governance repository structure:**

```
governance/
├── policies/
│   ├── security.yml          # Security policies (blocked patterns, required reviews)
│   ├── quality.yml           # Quality policies (max file size, coverage minimums)
│   ├── licensing.yml         # License policies (approved licenses, blocked packages)
│   └── autonomy.yml          # Autonomy budget per domain
├── linters/
│   ├── org/                  # Organization-wide linter rules
│   │   ├── no-circular-deps.js
│   │   ├── max-file-size.js
│   │   └── structured-logging.js
│   └── templates/            # Templates for team-specific rules
│       ├── api-patterns.js
│       └── component-patterns.js
├── ci-templates/
│   ├── agent-pr-pipeline.yml # Standard CI pipeline for agent PRs
│   ├── quality-score.yml     # Quality scoring configuration
│   └── entropy-gate.yml      # Entropy budget enforcement
└── agents-md-templates/
    ├── root.md               # Root AGENTS.md template
    ├── frontend-team.md      # Frontend team template
    ├── backend-team.md       # Backend team template
    └── infra-team.md         # Infrastructure team template
```

Teams can submit pull requests to add new linter rules, update policies, or modify templates. The platform team reviews these PRs, ensuring they don't conflict with organization-wide standards. This collaborative approach to governance keeps teams invested in the system while maintaining consistency.

### Onboarding New Engineers

At large scale, onboarding becomes a significant challenge. New engineers need to learn not just the codebase, but the entire agent-first workflow.

**The Agent-First Onboarding Program (Week 1):**

| Day | Focus | Activities |
|---|---|---|
| Day 1 | Agent fundamentals | Introduction to the team's agent platform. Hands-on exercises. |
| Day 2 | Context engineering | Reading and writing AGENTS.md. Navigating the docs/ directory. |
| Day 3 | The harness | Linter rules, structural tests, CI pipeline. How to add new rules. |
| Day 4 | Agent-first workflow | Execution plans, self-review, PR patterns. Practice on real tasks. |
| Day 5 | Security and autonomy | Security awareness, autonomy levels, approval gates. Assessment. |

**Mentorship:** Each new engineer is paired with an experienced team member for the first month. The mentor reviews the new engineer's agent interactions and provides feedback on harness usage.

**Progressive autonomy:** New engineers start at Level 1 autonomy and advance through the levels as they demonstrate competence. The progression is tracked by the harness itself — if an engineer's agent PRs consistently pass review with minimal changes, they're ready for higher autonomy.

**The 30-60-90 day plan for new engineers:**

```
Day 1-30: Learning Phase
□ Complete onboarding program (Week 1)
□ Work with mentor on Level 1 tasks
□ Write first AGENTS.md contribution
□ Pass security awareness assessment
□ Demonstrate understanding of golden principles

Day 31-60: Practicing Phase
□ Graduate to Level 2 autonomy for routine tasks
□ Write first custom linter rule
□ Review 10+ agent PRs from other engineers
□ Contribute to team's knowledge base
□ Demonstrate consistent quality scores >70

Day 61-90: Contributing Phase
□ Graduate to Level 3 for appropriate tasks
□ Mentor a newer team member
□ Propose a new golden principle or linter rule
□ Participate in monthly retrospective
□ Demonstrate ability to write execution plans for agents
```

### Cross-Team Coordination at Scale

At 200+ engineers, cross-team coordination requires dedicated infrastructure:

**Dependency management:**
- Shared libraries have designated owners and explicit API contracts
- Versioning is automated (semantic versioning enforced by CI)
- Breaking changes go through a formal review process with affected teams notified

**Agent coordination:**
- When multiple teams' agents are working on related features, a coordination plan is required
- The coordination plan is a shared execution plan with cross-team dependencies
- A designated coordinator (human) reviews the plan and monitors execution

**Incident coordination:**
- Agent-introduced incidents are escalated to the Agent Security Team
- A shared incident response protocol ensures consistency
- Post-incident reviews are published to the organization-wide knowledge base

### Measuring at Scale

At large scale, measurement becomes both more important and more challenging:

**Organization-level metrics:**
- Total PR throughput (agent vs. human)
- Aggregate ROI calculation
- Security incident count and severity
- Developer satisfaction (quarterly survey)
- Harness compliance rate (% of teams meeting golden principles)

**Team-level metrics:**
- Team-specific DORA metrics
- Harness customization depth (how much team-specific config they've added)
- Agent adoption rate (% of engineers actively using agents)
- Quality metrics (rework rate, defect escape rate)

**Individual-level metrics:**
- Be cautious here. Individual productivity metrics can be misleading and demotivating.
- Focus on growth metrics (advancement through autonomy levels) rather than output metrics.
- Use individual data for coaching and support, not performance evaluation.

**The organizational metrics dashboard:** At large scale, you need a centralized dashboard that aggregates metrics across all teams. This dashboard should be visible to engineering leadership and updated weekly:

```
Organization Agent-First Metrics Dashboard
┌─────────────────────────────────────────────────┐
│ Key Performance Indicators                       │
│                                                   │
│ PR Throughput:   847 PRs/week (↑12% MoM)         │
│ Agent PR Share:  62% (↑8% MoM)                   │
│ Avg Quality Score: 78/100 (↑3pts MoM)            │
│ ROI:             15.2x (↑2.1x YoY)               │
│ HMS Avg:         64/100 (↑7pts YoY)              │
├─────────────────────────────────────────────────┤
│ Per-Team Breakdown                                │
│                                                   │
│ Frontend:    85 quality | L3 autonomy | 72% agent │
│ Backend:     82 quality | L3 autonomy | 68% agent │
│ Infra:       71 quality | L2 autonomy | 45% agent │
│ Data:        76 quality | L3 autonomy | 58% agent │
│ Mobile:      68 quality | L2 autonomy | 52% agent │
├─────────────────────────────────────────────────┤
│ Alerts                                            │
│ ⚠️ Infra team HMS below 60 (needs harness help)  │
│ ⚠️ Mobile team agent adoption below 60%           │
│ ✅ All teams passed security audit                  │
│ ✅ No agent-related security incidents this month   │
└─────────────────────────────────────────────────┘
```

### Common Failure

The most common failure at large scale is **bureaucratic overhead**. The governance mechanisms designed to ensure quality become so burdensome that they negate the productivity gains. The fix is governance as code: automate everything that can be automated, and make the remaining human processes as lightweight as possible.

**Signs of bureaucratic overhead:**
- Agent PRs take more than 24 hours to merge (the review process is too slow)
- Teams need to submit 3+ approval requests before an agent can work on a task
- The platform team is a bottleneck for every harness change
- Engineers complain that the governance process is slower than writing code manually
- Innovation slows because trying new agent patterns requires too many approvals

**The fix:** Every governance process should have a maximum turnaround time:
- Linter rule proposal to deployment: 1 week
- New team onboarding: 2 weeks
- Autonomy level increase: 1 week (with data)
- Exception request: 3 days
- Incident response: 1 hour

If any of these timelines are consistently exceeded, the process needs to be simplified or automated further.

---

## The Scaling Compass

At every stage, keep these principles in mind:

1. **The harness scales, not the heroes.** Don't depend on individual engineers to maintain quality. Build it into the system.

2. **Governance is code.** Encode policies as linters, tests, and CI checks. Make compliance automatic.

3. **Federate, don't centralize.** Central standards with team-level customization. The center sets the floor; the edges raise the ceiling.

4. **Measure relentlessly.** You can't improve what you don't measure. Track agent effectiveness at every level of the organization.

5. **Invest 20% in the harness.** This isn't overhead — it's the infrastructure that makes the other 80% possible.

6. **People matter more than tools.** The best harness in the world is useless if engineers don't understand it, don't trust it, or don't use it. Invest in training, mentorship, and culture.

## The Transition Playbook: Moving Between Stages

Moving from one stage to the next isn't automatic. Each transition requires deliberate investment. Here's what each transition entails:

### Small Team → Medium Team (3–5 → 20–50)

**The primary challenge:** Harness knowledge that was tacit (everyone just knows) must become explicit (documented, shared, enforced).

**Transition steps:**

1. **Codify the harness.** Everything that "just works" on the small team needs to be written down. The informal AGENTS.md needs to become a comprehensive document. The unwritten linter rules need to be implemented.

2. **Establish the platform team.** Recruit 2–4 engineers who are passionate about developer infrastructure. Give them a clear mandate: maintain the shared harness so feature teams can focus on product work.

3. **Create onboarding materials.** New engineers joining the expanded team need to get productive quickly. The small team's intuitive knowledge needs to become structured training.

4. **Set up federation.** As new teams form, each needs the ability to customize the harness for their domain while adhering to organization-wide standards.

5. **Measure the transition.** Track whether expanding the team maintains or improves quality metrics. If metrics decline during the transition, slow down and invest more in the platform.

**Timeline:** 4–8 weeks for the transition, with the platform team fully operational by week 8.

**Success criteria:**
- New teams onboard in <2 weeks (vs. organic learning on the small team)
- Quality metrics are consistent across teams (within 10% variance)
- No increase in agent-related incidents during the transition

### Medium Team → Large Organization (20–50 → 200–500+)

**The primary challenge:** Coordination overhead. What worked with 5 teams doesn't work with 20 teams. The platform team that served 5 teams can't serve 20 by working harder — it needs better systems.

**Transition steps:**

1. **Scale the platform team.** The 2–4 person platform team needs to become 10–16 people across three specialized teams (Agent Platform, Harness Engineering, Agent Security).

2. **Implement governance as code.** Policies that were enforced by the platform team's manual review need to be encoded as automated checks. This is the only way to maintain governance at scale without creating a bottleneck.

3. **Build self-service infrastructure.** Teams should be able to create harness customizations, request autonomy increases, and resolve common problems without involving the platform team. Self-service doesn't mean uncontrolled — it means automated governance.

4. **Establish the center of excellence.** A small group dedicated to sharing best practices, curating the harness pattern library, and facilitating the monthly retrospective.

5. **Measure the transition.** Track whether the organizational structure supports or hinders agent-first development. If teams are waiting for platform team support, the platform team needs more automation.

**Timeline:** 8–16 weeks for the transition, with the full organizational structure in place by week 16.

**Success criteria:**
- All 20+ teams onboarded and productive
- Platform team handles requests within defined SLAs
- Organization-wide DORA metrics maintained or improved
- ROI calculation shows positive return at the organizational level

**The Affirm-inspired rapid transition:** For organizations that want to accelerate this transition, the Affirm model provides a template: pause normal delivery, train everyone simultaneously, and create shared commitment. This is aggressive but effective. The key is having the platform infrastructure (governance, CI, security controls) ready *before* the training begins. The training teaches engineers how to use the system; the system needs to exist first.

### The Multiplier Effect at Each Stage

The whole point of scaling is to achieve multiplicative productivity gains. Here's what the multiplier looks like at each stage:

**Stage 1 (3–5 engineers):** 3–5x multiplier. A small team using agents effectively produces as much as 3–5 teams using traditional methods. The multiplier comes from agent-assisted implementation, not parallel agents (the team isn't large enough for complex orchestration).

**Stage 2 (20–50 engineers):** 5–15x multiplier. With a platform team maintaining the harness, feature teams can operate at higher autonomy levels. Multi-agent patterns emerge as teams coordinate on larger features. The multiplier comes from the combination of individual productivity gains and the network effects of shared learning.

**Stage 3 (200–500 engineers):** The largest organizations report throughput gains ranging from 3× to 20× depending on task type, codebase maturity, and harness quality. The full organizational infrastructure — governance as code, self-service platforms, center of excellence — enables consistent high-quality agent usage at scale. The multiplier comes from organizational intelligence: the system is designed to learn and improve continuously, so productivity compounds over time. It's important to qualify these numbers: a 20× gain typically applies to well-harnessed, repetitive implementation tasks in mature codebases, while novel architectural work or heavily regulated domains may see gains closer to 3–5×. The range is wide because the variables are real — model quality, harness investment, codebase complexity, and regulatory constraints all pull the lever in different directions.

The key insight is that the multiplier doesn't scale linearly with team size. A 100-person agent-first organization doesn't produce 100× what one person produces — it produces 100× × (organizational multiplier). The organizational multiplier is the ROI of the harness, governance, and culture infrastructure.

## Scaling Stories: How the Largest Teams Did It

The hypothetical case studies that previously occupied this section have been replaced with documented accounts from organizations that have scaled AI-assisted development to thousands of engineers. These stories are drawn from engineering blog posts, conference talks, and public reporting. Each illustrates a different facet of the scaling challenge.

### Meta: Agents as Infrastructure

Meta's deployment of AI coding assistants is, by most measures, the largest in the world. By early 2025, over 50% of all code changes across Meta's engineering organization were generated or influenced by AI agents — a figure that encompasses thousands of engineers working across hundreds of repositories.

**What they started with.** Meta's journey began with internal tooling experiments — scripts that wrapped early LLM APIs and integrated them into the company's custom IDE and code review system. These prototypes showed promise but were limited to individual productivity gains. The company quickly realized that the real leverage wasn't in helping one engineer write code faster, but in building shared infrastructure that every engineer could benefit from.

**The inflection point.** The turning point was the creation of **DevMate**, an internal marketplace where engineers could browse, fork, and extend agent configurations. Instead of each team independently discovering what worked, DevMate allowed successful patterns to propagate across the organization in days rather than months. An engineer on the React Native team who found a prompt configuration that reduced hallucinated imports could publish it to DevMate, and within a week, teams across the company were using it.

DevMate also enabled something unexpected: **agent specialization by domain**. Teams working on performance-critical C++ code published configurations optimized for low-level systems programming. Teams working on PHP (Meta's Hack language) published configurations tuned for web backend patterns. The marketplace didn't just share configurations — it created a taxonomy of domain-specific agent expertise that no single team could have developed alone.

**What went wrong.** Meta's scaling journey wasn't without problems. Early in the DevMate rollout, the company encountered a pattern they called **"configuration sprawl"** — hundreds of agent configurations that overlapped, conflicted, or encoded outdated patterns. Engineers would fork a configuration, modify it for their use case, and never update it again. When Meta upgraded the underlying model, dozens of configurations produced degraded results because they were tuned for the previous model's quirks.

The fix was a combination of curation and automation. Meta introduced **configuration health scoring** — an automated system that evaluated each published configuration against current best practices, model capabilities, and recent failure patterns. Configurations that scored below a threshold were flagged for review and eventually deprecated. A small team of "configuration librarians" maintained the most popular configurations and ensured they stayed current.

**The scaling lesson.** Meta's experience demonstrates that at extreme scale, agent configurations become shared infrastructure that requires the same governance as any other shared system. The marketplace model — where engineers can discover and build on each other's work — is far more effective than top-down standardization, but it still needs curation, health monitoring, and a feedback loop between the configuration library and the agents that consume it.

### Uber: From Pilot to Ecosystem

Uber's¹ AI coding journey offers a blueprint for how a large, engineering-driven company can move from experimental pilot to organization-wide adoption in under a year.

**What they started with.** Uber began with **uReview**¹, an internal tool that used AI to assist with code review. The initial scope was modest: summarize PRs, suggest reviewers, and flag common issues. uReview was well-received — engineers appreciated the automated summaries, and review turnaround times improved measurably.

But uReview was a single-purpose tool, and its success raised an obvious question: if AI could help review code, could it help *write* code? More importantly, could Uber scale AI-assisted coding across an engineering organization that was already distributed across dozens of teams and multiple technology stacks?

**The inflection point.** Uber's breakthrough was the **MCP Gateway** — a standardized layer that gave AI agents uniform access to Uber's internal tools, APIs, and data sources. Before the MCP Gateway, each agent integration required custom plumbing: one integration for the code search API, another for the build system, another for the deployment pipeline. The MCP Gateway unified these into a single protocol, so any agent could interact with any internal system through a consistent interface.

The MCP Gateway also solved a governance problem. By routing all agent interactions through a single layer, Uber could enforce access controls, audit agent actions, and measure usage patterns centrally. This was essential for gaining the trust of security teams and engineering leadership — without the Gateway, scaling agents would have meant scaling risk.

By mid-2025, Uber reported that **92% of engineers were using AI agents monthly**, and **11% of all pull requests were generated automatically** by agents. These numbers are remarkable not just for their scale, but for their consistency across teams — the MCP Gateway ensured that every team had the same baseline capability, regardless of their technology stack.

**What went wrong.** The biggest challenge Uber faced was **trust calibration**. When agents first started generating PRs automatically, many engineers treated them with suspicion — reviewing agent PRs more harshly than human PRs, or simply ignoring them. The 11% auto-generation rate was achieved only after significant investment in building trust:

1. **Transparent provenance.** Every agent PR clearly identified itself as AI-generated, included the execution plan it followed, and linked to the agent's full interaction log.
2. **Graduated autonomy.** Teams didn't start at full auto-generation. They progressed through levels: first the agent suggested changes (which engineers applied manually), then it created drafts (which engineers reviewed), and finally it created PRs directly (with post-hoc review).
3. **Blameless postmortems.** When an agent introduced a bug, the postmortem focused on the harness failure, not the agent. What context was missing? What linter would have caught it? This framing prevented trust erosion.

**The scaling lesson.** Uber's story shows that technical infrastructure (the MCP Gateway) is necessary but not sufficient. Scaling requires deliberate trust-building — transparent provenance, graduated autonomy, and a culture that treats agent failures as harness failures rather than proof that agents can't be trusted.

### Stripe: Agents in a Regulated Environment

Stripe's experience with AI coding agents is instructive precisely because of the constraints they operate under. As a financial services company handling payment processing for millions of businesses, Stripe can't afford to move fast and break things. Every code change touches money, and errors have direct financial consequences.

**What they started with.** Stripe built **Minions** — an internal AI coding assistant that integrates with Stripe's development workflow. Minions started as a simple tool: an agent that could implement well-specified tasks in Stripe's Ruby and TypeScript codebases, following Stripe's extensive internal documentation and coding conventions.

The initial deployment was conservative. A small group of volunteers used Minions for low-risk tasks — updating library versions, adding logging, implementing straightforward API endpoints. Each Minion-generated change went through Stripe's standard code review process, with the reviewer explicitly told that the change was AI-generated.

**The inflection point.** Minions' credibility changed when Stripe's infrastructure team used them to implement a complex database migration that would have taken a senior engineer two weeks. The Minion completed the task in three days — generating the migration scripts, updating all affected services, and writing the rollback procedures. The code review caught two issues (a missing index and an edge case in the rollback path), both of which the Minion fixed in a second pass.

This success gave Stripe's engineering leadership the confidence to scale Minions aggressively. By early 2026, Minions were generating **over 1,300 PRs per week**² — a staggering number for an organization operating under financial regulatory requirements.

**What went wrong — and how they solved it.** Scaling Minions to 1,300+ PRs/week required solving three problems unique to regulated environments:

1. **Compliance review at scale.** Every code change at Stripe touches systems that fall under financial regulations. When agents generated hundreds of PRs per day, manual compliance review became a bottleneck. Stripe solved this by building **automated compliance checks** into the CI pipeline: linters that flagged changes to payment processing logic, database schema changes that affected financial records, and any modification to encryption or key management code. These automated checks couldn't replace human judgment entirely, but they reduced the compliance review burden by 80%.

2. **Audit trail integrity.** Financial regulations require complete audit trails for system changes. Agent-generated changes initially created ambiguity: who "made" the change — the agent or the engineer who authorized it? Stripe's solution was a **dual-attribution system**: every PR carried both the agent's provenance (what model was used, what execution plan was followed, what context was provided) and the responsible engineer's attestation (confirming they reviewed and approved the change). This satisfied auditors and created clear accountability.

3. **Error budgets for agent-generated code.** In financial services, bugs have direct monetary cost. Stripe introduced **agent error budgets** — a monthly allowance of production incidents attributable to agent-generated code, calibrated to be lower than the human error rate. If the budget was exceeded, agent autonomy was reduced until the root causes were addressed. This created a natural feedback loop: every agent-caused incident resulted in harness improvements that prevented recurrence.

**The scaling lesson.** Stripe's story proves that AI coding agents can operate in the most constrained environments — but only with governance structures that are specifically designed for those constraints. The combination of automated compliance checks, dual-attribution systems, and agent error budgets is a model for any organization operating under regulatory requirements. The lesson is clear: regulated environments don't preclude aggressive agent adoption, but they do require proportionally more investment in governance infrastructure.

## The Cultural Dimension of Scaling

Technical scaling is necessary but not sufficient. The cultural dimension — how engineers think about their work, their relationship with agents, and their standards for quality — must scale alongside the technology.

### The Culture of Harness Engineering

At small scale, the culture is one of collective ownership: everyone maintains the harness, everyone writes linters, everyone updates AGENTS.md. At large scale, this culture must be preserved even as specialized teams take on more of the harness maintenance burden.

**Principles for preserving the culture:**

1. **Every engineer should know how to write a linter rule.** Even if the platform team maintains the library, feature team engineers should be able to propose and implement new rules. This keeps them invested in the harness and prevents the platform team from becoming a gatekeeper.

2. **AGENTS.md is everyone's responsibility.** Feature teams should update their team-level AGENTS.md regularly, not just consume what the platform team provides. This ensures the instructions stay relevant and accurate.

3. **Quality is not someone else's job.** The quality score on each PR is a shared responsibility. If the score is low, it's not just the platform team's problem — it's the feature team's problem too.

4. **Learning is continuous.** The monthly retrospective, the harness pattern library, and the onboarding program should all reinforce that agent-first development is an evolving practice, not a solved problem.

### The Psychological Journey

Engineers go through a psychological journey as they adopt agent-first development:

1. **Curiosity** (Week 1): "This is interesting. Can it really write code?"
2. **Excitement** (Week 2–3): "This is amazing! I'm so much faster!"
3. **Frustration** (Week 4–5): "Why did it make that mistake? This is stupid."
4. **Understanding** (Week 6–8): "Oh, I need to give it better context. The harness matters."
5. **Mastery** (Week 9+): "I know exactly what to specify and how to verify. The agent is a tool, not a replacement."

At scale, you'll have engineers at every stage of this journey simultaneously. The training program, mentorship, and community support need to meet each engineer where they are. Don't expect everyone to reach mastery at the same pace — some will take weeks, others months. The key is to create an environment where mastery is achievable and supported.

**Managing the emotional valleys:** The frustration phase (Week 4–5) is the most dangerous. This is when engineers are most likely to abandon agents entirely, concluding that "AI doesn't work for our codebase." The antidote is anticipation and support:

- **Normalize the frustration.** Tell engineers upfront that they'll hit a wall around week 4. Frame it as a learning opportunity, not a failure.
- **Have ready solutions.** The most common frustrations (wrong patterns, missing context, too many iterations) have known solutions (better AGENTS.md, custom linters, iteration limits). Have these solutions ready before engineers encounter the problems.
- **Celebrate the wins.** When an engineer successfully uses the agent to complete a complex task, share the story with the team. Positive examples counterbalance the frustration.
- **Provide peer support.** Engineers who've already reached mastery can mentor those in the frustration phase. This is why the progressive onboarding program pairs new engineers with experienced ones.

### The Scaling Anti-Patterns Revisited

Each stage has characteristic anti-patterns that derail scaling:

**Stage 1 anti-pattern: The Solo Genius.** One engineer becomes incredibly productive with agents, but doesn't share their practices. When the team grows, new engineers can't replicate the genius's results because the harness is in the genius's head, not in the codebase.

**Fix:** Insist on codification from day one. Every pattern, every prompt, every linter rule must be in the shared harness, not in any individual's workflow.

**Stage 2 anti-pattern: The Platform Bottleneck.** The platform team becomes a bottleneck because every harness change requires their approval. Feature teams can't iterate on their own configurations, and progress slows to the platform team's capacity.

**Fix:** Self-service governance. Feature teams should be able to make most changes through automated processes. The platform team should be a reviewer and auditor, not a gatekeeper.

**Stage 3 anti-pattern: The Two-Speed Organization.** Some teams are operating at Level 4 autonomy with sophisticated harnesses, while others are still at Level 1 with minimal infrastructure. The gap creates organizational tension and makes cross-team coordination difficult.

**Fix:** The center of excellence actively identifies and supports lagging teams. Mandatory minimum harness standards are enforced through CI. The platform team provides dedicated support to teams below the organizational average.

## Summary: The Scaling Checklist

Before moving from one stage to the next, verify:

### Small → Medium Checklist
- [ ] All harness knowledge documented in AGENTS.md (not in anyone's head)
- [ ] Platform team identified and briefed
- [ ] Federation pattern designed (root + per-team AGENTS.md)
- [ ] Onboarding materials created
- [ ] Quality metrics baselined
- [ ] CI pipeline supports multiple teams

### Medium → Large Checklist
- [ ] Platform team scaled to 10+ engineers across three specialized teams
- [ ] Governance as code implemented (all policies as automated checks)
- [ ] Self-service infrastructure operational
- [ ] Center of excellence established
- [ ] Organizational metrics dashboard live
- [ ] Security audit completed
- [ ] ROI calculation showing positive return
- [ ] Agent-related incident response tested

---

---

¹ Uber Engineering, "uReview," 2025. https://www.uber.com/blog/ureview

² Stripe Engineering, "Minions: Stripe's one-shot, end-to-end coding agents," 2025. https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents

---

## Key Takeaways

- **Three scaling stages:** Small (3–5), Medium (20–50), Large (200–500+). Each requires different organizational structures and practices.
- **Platform engineering** becomes essential at medium scale. A dedicated team maintains the shared harness.
- **Federated governance** — central standards with team-level customization — prevents both fragmentation and bureaucratic overhead.
- **Governance as code** turns policies into linters, tests, and CI checks that are enforced automatically.
- **Onboarding** requires a structured program that teaches the agent-first workflow, not just the codebase.
- **Cross-team coordination** requires dedicated infrastructure: contract testing, shared execution plans, and agent-aware code review.
- **Measurement at scale** requires metrics at the organization, team, and individual levels — with appropriate caution around individual metrics.
- **The 20% rule** applies at every stage: invest 20% of engineering capacity in harness maintenance and improvement.

## Scaling Patterns: What Works at Each Stage

### Pattern 1: The Harness as Product

At every scale, treat the harness as a product with internal customers (the engineers who use it). This means:

- **User research:** Regularly survey engineers about what's working and what's not in the harness
- **Roadmap:** Maintain a public roadmap of harness improvements
- **Release notes:** Communicate changes to the harness (new linter rules, AGENTS.md updates) as you would product releases
- **Feedback loops:** Make it easy for engineers to report issues and suggest improvements
- **Documentation:** The harness itself needs comprehensive documentation — not just what the rules are, but why they exist

At small scale, the "product manager" for the harness is the team's architect. At medium scale, it's the platform team lead. At large scale, it's the Harness Engineering Team with a dedicated product mindset.

### Pattern 2: Progressive Automation

Automation should increase with scale. What's manual at Stage 1 should be automated at Stage 2, and what's automated at Stage 2 should be self-service at Stage 3.

| Activity | Stage 1 (Manual) | Stage 2 (Automated) | Stage 3 (Self-Service) |
|---|---|---|---|
| Quality scoring | Engineer eyeballs PR | CI posts quality score | Auto-block low-scoring PRs |
| Linter rule creation | Engineer writes rule manually | Platform team writes rule | Engineer submits PR, platform reviews |
| Autonomy increases | Team discussion | Data-driven request | Automatic based on quality trends |
| Garbage collection | Manual cleanup | Scheduled GC agents | Continuous self-regulating GC |
| Onboarding | Buddy system | Structured training program | Self-paced + automated assessment |

### Pattern 3: The Knowledge Flywheel

Knowledge about agent-first development should compound, not dissipate:

```
Individual Learning → Team Learning → Organization Learning
       ↑                                        |
       └──────────── Better Harness ────────────┘
```

At small scale, individual learning directly becomes harness improvements. At medium scale, team learning needs to be shared across teams through the center of excellence. At large scale, organization learning needs to be captured, curated, and disseminated systematically.

**The knowledge flywheel in practice:**
1. Engineer discovers that the agent struggles with a specific pattern
2. Engineer writes a linter rule to catch the pattern
3. Linter rule is added to the shared library (all teams benefit)
4. Pattern is documented in the harness pattern library
5. Documentation is incorporated into onboarding materials
6. New engineers learn the pattern on day one instead of discovering it through failure

This flywheel is the mechanism by which the organization gets smarter over time. Each failure becomes a prevention, each lesson becomes documentation, and each engineer becomes more effective because they stand on the accumulated knowledge of everyone who came before.

## Scaling Failure: The Google Antigravity Postmortem

The case studies above show what successful scaling looks like. But the most instructive stories in engineering are often the failures. Google's experience with its internal project codenamed **Antigravity** provides a cautionary tale about what happens when agent infrastructure isn't designed for the load that agent-first development creates.

### The Crisis

In mid-2025, Google's internal AI coding platform experienced a recurring crisis that engineers came to know by the terse error message it produced: **"Agent Terminated."** The message appeared hundreds of times per day across dozens of teams. Agents would start a task, run for minutes or hours, and then be killed by the platform's resource management system.

The root causes were multiple and compounding:

- **Capacity exhaustion.** Google had underestimated how many concurrent agent sessions its infrastructure needed to support. When adoption surged past projections, the platform ran out of compute capacity during peak hours. Agents were terminated not because they failed, but because there wasn't enough hardware to run them.

- **Quota issues.** Google's internal billing system allocated agent compute budgets per team. When a team's budget was exhausted — often because agents consumed more tokens than expected on complex tasks — the team's agents were terminated mid-task. There was no graceful degradation, no warning system, no way to pause and resume. The agent simply died, losing all progress on whatever it was working on.

- **Lack of traffic isolation.** Different teams' agents shared the same underlying compute pool with no traffic isolation. When one team ran a particularly expensive multi-agent orchestration (a team of five agents working on a large refactoring), it consumed resources that starving agents from other teams. A single team's expensive workflow could cascade into "Agent Terminated" errors across the entire organization.

### How the Failure Cascaded

The technical failure triggered an organizational cascade that was far more damaging than the lost compute cycles:

1. **Agent failures.** Engineers lost work-in-progress. An agent that had spent 30 minutes implementing a complex feature would be killed, and the engineer would have to start over — either manually or by re-running the agent and hoping it wouldn't be terminated again.

2. **Productivity loss.** Engineers adapted by running agents only during off-peak hours (early morning or late night), which disrupted normal work schedules. Some engineers stopped using agents for complex tasks entirely, reverting to manual implementation for anything that couldn't be completed in a short, uninterrupted session.

3. **Trust crisis.** The recurring failures eroded confidence in the platform. Engineering leads began questioning whether the agent infrastructure was reliable enough for production use. Internal discussions shifted from "how do we use agents more?" to "how do we work around the reliability problems?"

4. **Reduced adoption.** Teams that had been enthusiastic about expanding agent usage paused their rollouts. Teams that were evaluating agents decided to wait. The adoption curve flattened — not because the agents weren't useful, but because the infrastructure couldn't be trusted to run them.

### The Fixes

Google's response addressed each root cause systematically:

- **Capacity planning.** The platform team implemented predictive capacity planning based on historical agent usage patterns. Instead of provisioning for average load, they provisioned for peak load plus a 30% buffer. They also introduced elasticity — the ability to bring additional capacity online within minutes when demand spiked.

- **Quota management.** The billing system was redesigned to support **graceful degradation** instead of hard termination. When a team approached its quota, agents received warnings and could checkpoint their progress. When the quota was exceeded, agents were paused (not killed) and could resume when the quota refreshed. Teams could also request temporary quota increases for large tasks.

- **Traffic isolation.** The compute pool was partitioned so that each team had a guaranteed minimum capacity that couldn't be consumed by other teams. Burst capacity was shared, but the guaranteed floor ensured that no team's agents would be terminated because another team was running an expensive workflow.

- **Circuit breakers.** The platform introduced circuit breaker patterns at multiple levels: per-agent, per-team, and per-service. If an agent was consuming disproportionate resources, the circuit breaker would throttle it before it impacted other agents. If a service was overloaded, the circuit breaker would queue requests rather than dropping them.

### The Lesson

The Google Antigravity postmortem reveals a fundamental truth that many organizations learn the hard way: **scaling agent infrastructure is fundamentally different from scaling human engineers.**

Human engineers are self-regulating. When they're overwhelmed, they slow down, ask for help, or push back on deadlines. They have built-in backpressure. Agents don't. An agent will happily attempt a task that requires 10× the expected resources, consume everything available, and then fail — taking other agents with it.

This means that agent infrastructure needs the same operational discipline that we apply to production serving systems:

- **Load balancing** to distribute agent workloads across available resources
- **Circuit breakers** to prevent cascading failures
- **Capacity planning** based on actual usage patterns, not projections
- **Graceful degradation** so that resource constraints cause delays, not data loss
- **Monitoring and alerting** that treats agent infrastructure as production-critical

The teams that treat agent infrastructure as a first-class operational concern — with the same rigor they apply to their database clusters or API servers — will scale smoothly. The teams that treat it as a developer convenience that "just works" will hit their own version of "Agent Terminated" — and the cascading trust erosion that follows.

## Conclusion: Scale is a Systems Problem

Scaling agent-first development is fundamentally a systems problem, not a people problem. Individual engineers don't need to be 10x developers — the system needs to be a 10x system. The harness, the governance, the training, and the measurement infrastructure combine to create an environment where every engineer can produce at a level that would have been exceptional in the pre-agent era.

The three-stage model (Small → Medium → Large) provides a roadmap, but the fundamental principles are the same at every scale: invest in the harness, encode governance as code, measure relentlessly, and remember that people matter more than tools.

The organizations that master these principles at scale — the ones where 500 engineers can each produce substantially more than they could before — will define the next era of software development. The technology is ready. The question is whether your organization is ready to build the system that harnesses it.

The scaling journey is not optional. If your team is successful with agents at small scale, growth will happen. Teams will expand, new teams will form, and the practices that worked at 5 engineers will strain at 50 and break at 500. The question isn't whether you'll need to scale — it's whether you'll scale deliberately, with the organizational infrastructure in place, or reactively, scrambling to fix problems after they've already impacted productivity.

The deliberately scaling organizations — the ones who read this chapter and build the platform team before they need it, who implement governance as code before the bureaucracy sets in, who invest in the center of excellence before knowledge starts leaking — will have a compounding advantage. Every month they operate at scale, their harness gets better, their metrics improve, and their competitive position strengthens.

The organizations that scale reactively — the ones who wait until the problems are obvious before investing in infrastructure — will spend 2–3× as much time and money catching up, and they'll lose months of productivity in the process. The Month 3 Crisis from Chapter 19 is the small-scale version; at large scale, the equivalent crisis can set an organization back by quarters.

The choice is yours. Build the system. Invest in the harness. Scale deliberately. The returns — teams report throughput gains ranging from 3× to 20× depending on task type, codebase maturity, and harness quality — are achievable for those who do.
