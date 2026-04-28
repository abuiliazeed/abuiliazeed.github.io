# Chapter 13: Multi-Agent Coordination Patterns

> "The whole is greater than the sum of its parts, but only if the parts know what the other parts are doing."
> — Adapted from Aristotle's *Metaphysics*

---

## From Single Agent to Agent Teams

You've built your harness. You have AGENTS.md, mechanical enforcement, a dependency graph that flows in one direction, and linters that catch violations before they reach CI. Your single coding agent is productive—resolving tasks, writing tests, submitting PRs.

And then you hit the ceiling.

A single agent, no matter how capable, processes one task at a time. It reads context sequentially, writes code sequentially, and waits for verification sequentially. When your codebase grows past a certain size, when your task backlog fills faster than one agent can drain it, the math stops working. You need parallelism. You need teams.

But adding a second agent isn't like hiring a second developer. Developers carry institutional knowledge, understand social cues, and naturally coordinate through conversation. Agents start each session with amnesia, communicate only through structured protocols, and have no intuition for what another agent might be doing. Throwing multiple agents at a problem without coordination patterns is worse than using one agent—it creates merge conflicts, duplicated work, contradictory changes, and subtle bugs that emerge from incompatible assumptions.

This chapter introduces the coordination patterns that make multi-agent orchestration not just possible but *reliable*. These aren't theoretical constructs—they're the patterns that OpenAI used to produce a million lines of code with zero human-written lines, that Affirm deployed across 800 engineers in a week, and that production teams use daily to ship code faster than any single agent could.

The shift from single-agent to multi-agent development is the most consequential architectural decision in agent-first engineering. Get the coordination patterns right, and your agents become a multiplier. Get them wrong, and you'll spend more time resolving conflicts than writing code.

### The Human Parallel: How We Coordinate

It's worth pausing to consider how human development teams coordinate, because the patterns in this chapter mirror human coordination in many ways:

- **Spec-driven decomposition** is how a tech lead breaks down a feature into tickets for the sprint backlog.
- **Worktree isolation** is how developers work on feature branches instead of committing directly to main.
- **Coordinator/specialist/verifier** is how teams have specialized roles—senior engineers architect, mid-level engineers implement, QA engineers verify.
- **Per-task model routing** is how managers assign complex work to senior engineers and routine work to junior engineers.
- **Automated quality gates** are how CI/CD pipelines enforce standards that no human would check manually for every PR.
- **Sequential merge** is how teams manage dependencies—you don't deploy the frontend until the backend API is ready.

The key difference is *explicitness*. Humans coordinate through implicit understanding—social norms, shared history, verbal communication. Agents coordinate through explicit protocols—specs, quality gates, dependency declarations. This explicitness is actually an advantage: it makes coordination auditable, reproducible, and improvable in ways that human coordination isn't.

When Martin Fowler commented that "Harness Engineering is a valuable framing of a key part of AI-enabled development," he was recognizing that the discipline makes explicit what human teams have always done implicitly. The harness doesn't replace human coordination patterns—it codifies them so agents can participate.

### The Fundamental Challenge

Before we dive into patterns, understand the core problem: **agents share a filesystem but don't share a brain**.

When two agents work in the same repository simultaneously, several things can go wrong:

1. **File conflicts**: Agent A and Agent B both edit `user_service.py`. One overwrites the other, or they merge incorrectly.
2. **Semantic conflicts**: Agent A changes a function signature while Agent B adds callers that expect the old signature. Both changes compile; neither works together.
3. **Dependency conflicts**: Agent A adds a new dependency to `package.json`; Agent B removes an unrelated one in a separate edit. The combined state is broken.
4. **Context conflicts**: Agent A writes code assuming the database schema is version 3; Agent B migrates it to version 4 in parallel. The assumptions diverge.
5. **Test conflicts**: Agent A's tests depend on fixture state that Agent B's changes invalidate.

These aren't hypothetical—they happen every day in teams using multiple agents without coordination. The patterns in this chapter exist to prevent each one.

### The Coordination Spectrum

Multi-agent coordination isn't binary. It exists on a spectrum from tight coupling to full isolation:

```
Tight Coupling                              Full Isolation
    |                                            |
    v                                            v
Shared      Shared repo,     Separate        Separate
workspace   locked files     branches         worktrees
(co-edit)   (turn-based)     (merge later)   (full sandbox)

Low isolation ────────────────────────────── High isolation
Low coordination overhead                  High coordination overhead
High conflict risk                         Low conflict risk
```

As you move right on this spectrum, conflicts decrease but coordination overhead increases. The art of multi-agent orchestration is choosing the right point on this spectrum for each task, and the patterns in this chapter span the entire range.

---

## Six Coordination Patterns

Through extensive production use—across OpenAI's million-line experiment, Affirm's 800-engineer deployment, and dozens of smaller teams—six distinct coordination patterns have emerged. Each addresses a specific type of work, and the best teams use all of them, selecting the right pattern for each task.

### Pattern 1: Spec-Driven Decomposition

**Best for**: Well-defined features that can be cleanly divided into independent subtasks.

Spec-driven decomposition is the most fundamental multi-agent pattern. It works exactly how a human tech lead would break down a feature: write a spec, decompose it into tasks, assign each task to an agent, verify independently, then integrate.

```
┌──────────────────────────────────────────────────┐
│              Spec-Driven Decomposition            │
│                                                  │
│  ┌─────┐    ┌──────────┐    ┌────────────────┐  │
│  │ Spec│───▶│ Decompose│───▶│ Task Queue     │  │
│  └─────┘    └──────────┘    │  ┌─Task 1──┐   │  │
│                             │  ├─Task 2──┤   │  │
│                             │  ├─Task 3──┤   │  │
│                             │  └─Task 4──┘   │  │
│                             └───────┬────────┘  │
│                                     │           │
│                    ┌────────────────┼────────┐  │
│                    v                v        v  │
│              ┌──────────┐  ┌──────────┐ ┌────┐ │
│              │ Agent A  │  │ Agent B  │ │Ag C│ │
│              │ (Task 1) │  │ (Task 2) │ │(T3)│ │
│              └────┬─────┘  └────┬─────┘ └─┬──┘ │
│                   │             │         │    │
│                   v             v         v    │
│              ┌──────────────────────────────┐  │
│              │    Integration & Verify       │  │
│              └──────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**How it works in practice**:

1. A human (or architect agent) writes a specification for a feature—for example, "Add OAuth2 support with Google and GitHub providers."
2. The spec is decomposed into discrete tasks:
   - Task 1: Add OAuth2 configuration types and environment variable schema
   - Task 2: Implement Google OAuth2 provider (auth flow, token validation)
   - Task 3: Implement GitHub OAuth2 provider (auth flow, token validation)
   - Task 4: Add OAuth2 routes and middleware to the HTTP layer
   - Task 5: Write integration tests for the full OAuth2 flow
3. Each task is assigned to a separate agent, working in its own isolated workspace (more on worktrees in Chapter 14).
4. Agents work in parallel, each producing a PR.
5. An integration step (human or verifier agent) merges the PRs in dependency order and runs the full test suite.

**Why it works**: The decomposition ensures that each agent has a clear, bounded scope. No two agents touch the same files. The dependency order (types first, then implementations, then routes, then tests) ensures that each agent's output is compatible with the others'.

**Example: Spec-driven decomposition with Claude Code**

```bash
# The architect writes the spec
cat > plans/oauth2-implementation.md << 'EOF'
# OAuth2 Implementation Plan

## Overview
Add OAuth2 authentication with Google and GitHub providers.

## Task Decomposition

### Task 1: Configuration Layer (dependency: none)
- Add OAuth2Config type to src/types/auth.ts
- Add environment variable schema to src/config/env.ts
- Files: src/types/auth.ts, src/config/env.ts

### Task 2: Google Provider (dependency: Task 1)
- Implement GoogleOAuthProvider class
- Add token validation and user info fetching
- Files: src/services/auth/google_provider.ts

### Task 3: GitHub Provider (dependency: Task 1)
- Implement GitHubOAuthProvider class
- Add token validation and user info fetching
- Files: src/services/auth/github_provider.ts

### Task 4: HTTP Routes (dependency: Tasks 2, 3)
- Add OAuth2 callback routes
- Add session middleware
- Files: src/routes/auth.ts, src/middleware/auth.ts

### Task 5: Integration Tests (dependency: Task 4)
- Test full OAuth2 flow with mock providers
- Files: tests/integration/auth_oauth2_test.ts
EOF

# Spawn parallel agents for independent tasks
# Agent A handles Task 1 (no dependencies)
claude-code task "Implement OAuth2 configuration layer per plans/oauth2-implementation.md Task 1" \
  --worktree oauth2-config

# Agent B handles Task 2 (depends on Task 1, but can start with the spec)
claude-code task "Implement Google OAuth2 provider per plans/oauth2-implementation.md Task 2" \
  --worktree oauth2-google

# Agent C handles Task 3 (parallel with Task 2)
claude-code task "Implement GitHub OAuth2 provider per plans/oauth2-implementation.md Task 3" \
  --worktree oauth2-github
```

**The key insight**: Spec-driven decomposition works because the *spec is the coordination mechanism*. Agents don't need to communicate with each other—they communicate through the spec. The spec encodes all the assumptions, interfaces, and dependencies that each agent needs.

### Pattern 2: Worktree Isolation

**Best for**: Independent tasks that might touch overlapping files, or when you want maximum parallelism without coordination overhead.

Worktree isolation is the bread-and-butter pattern for multi-agent development. Each agent gets its own working directory—a git worktree—so it can modify files freely without conflicting with other agents.

```
┌──────────────────────────────────────────────────┐
│              Worktree Isolation                   │
│                                                  │
│  Main Repository (.git)                          │
│  ├── worktree/agent-a/  ── Agent A modifies here │
│  ├── worktree/agent-b/  ── Agent B modifies here │
│  └── worktree/agent-c/  ── Agent C modifies here │
│                                                  │
│  Each worktree:                                  │
│  • Full copy of working tree                     │
│  • Independent branch                            │
│  • No file-level conflicts                       │
│  • Merged via PR when ready                      │
└──────────────────────────────────────────────────┘
```

We'll cover worktrees in depth in Chapter 14, but the coordination pattern is simple: **isolation first, merge later**. Each agent works in its own worktree on its own branch. When the agent completes its task, it creates a PR. A human or automated system reviews and merges.

**Example: Batch pattern with git worktrees**

```bash
# Create worktrees for parallel agent work
git worktree add .worktrees/add-user-api feature/add-user-api
git worktree add .worktrees/user-validation feature/user-validation
git worktree add .worktrees/user-tests feature/user-tests

# Each agent works independently
# Agent A: implements the API endpoint
codex --worktree .worktrees/add-user-api \
  "Implement POST /api/users endpoint with request validation"

# Agent B: adds input validation rules
codex --worktree .worktrees/user-validation \
  "Add Zod validation schemas for user creation"

# Agent C: writes tests
codex --worktree .worktrees/user-tests \
  "Write integration tests for user API endpoints"

# Merge in order when complete
git checkout main
git merge feature/user-validation  # validation first
git merge feature/add-user-api     # API next
git merge feature/user-tests       # tests last
```

**When worktree isolation fails**: If tasks have deep semantic dependencies—Agent A's output is Agent B's input—worktree isolation alone isn't sufficient. You need spec-driven decomposition or one of the other patterns that encode dependencies.

### Pattern 3: Coordinator/Specialist/Verifier Roles

**Best for**: Complex tasks that benefit from separation of concerns—planning, execution, and verification as distinct roles.

This pattern assigns agents to specific roles, mirroring how human teams function:

```
┌──────────────────────────────────────────────────┐
│         Coordinator/Specialist/Verifier           │
│                                                  │
│  ┌──────────────┐                                │
│  │ Coordinator  │── Assigns tasks, manages flow   │
│  │  (Architect) │                                │
│  └──────┬───────┘                                │
│         │                                        │
│    ┌────┴────────────────┐                       │
│    v                      v                      │
│  ┌──────────┐    ┌──────────┐                    │
│  │Specialist│    │Specialist│  ...N specialists   │
│  │   (Impl) │    │  (Tests) │                    │
│  └────┬─────┘    └────┬─────┘                    │
│       │               │                          │
│       v               v                          │
│  ┌──────────────────────────────────┐            │
│  │        Verifier Agent            │            │
│  │  • Runs tests                    │            │
│  │  • Checks linters                │            │
│  │  • Reviews for pattern violations│            │
│  │  • Approves or rejects           │            │
│  └──────────────────────────────────┘            │
└──────────────────────────────────────────────────┘
```

The Coordinator agent reads the task, breaks it down, and delegates to specialists. Specialists execute. The Verifier agent checks the output against the project's standards. This creates a natural quality pipeline without human intervention for routine work.

**Role definitions**:

- **Coordinator**: Understands the full task, decomposes it, assigns subtasks, tracks progress. Doesn't write code—manages other agents.
- **Specialist**: An agent optimized for a specific type of work. A "test specialist" has instructions focused on writing tests. A "refactoring specialist" understands code transformation patterns. A "documentation specialist" writes clear prose.
- **Verifier**: An agent that doesn't write code—it reviews code. It runs linters, checks test coverage, verifies architectural constraints, and looks for common anti-patterns.

Augment Code formalized this as the **Coordinator-Implementor-Verifier pattern**, which adds constraint layers, feedback loops, and quality gates between each role transition. The key innovation is that the verifier provides structured feedback that the implementor can act on without human intervention—creating a self-correcting loop.

**Example: Coordinator/Specialist/Verifier in practice**

```yaml
# orchestrator-config.yaml
# Defines the coordinator/specialist/verifier pipeline

coordinator:
  model: claude-sonnet-4  # Strong reasoning for decomposition
  system_prompt: |
    You are a task coordinator. Given a feature request:
    1. Break it into implementation tasks
    2. Identify dependencies between tasks
    3. Assign each task to the appropriate specialist
    4. Track completion and handle failures
    Do NOT write code. Only decompose and delegate.

specialists:
  - name: implementor
    model: claude-sonnet-4
    system_prompt: |
      You are an implementation specialist. Given a task:
      1. Read the relevant code
      2. Implement the change
      3. Write unit tests for your changes
      Follow all patterns in AGENTS.md strictly.

  - name: tester
    model: claude-sonnet-4
    system_prompt: |
      You are a testing specialist. Given implemented code:
      1. Write integration tests
      2. Write edge case tests
      3. Verify test coverage meets 90% threshold
      Do NOT modify implementation code.

verifier:
  model: claude-sonnet-4
  system_prompt: |
    You are a code verifier. Review changes for:
    1. Linter violations (run eslint, ruff)
    2. Architectural constraint violations
    3. Pattern consistency with codebase
    4. Test adequacy
    Provide structured feedback with specific file:line references.
    Approve only if ALL checks pass.
```

**The power of role separation**: By separating coordination, execution, and verification, you get several benefits:

1. Each role can use a different model optimized for its task. Coordinators need strong reasoning; specialists need code generation; verifiers need attention to detail.
2. Each role has a bounded scope, making failures easier to diagnose.
3. The verifier catches issues that a single agent implementing and "self-reviewing" would miss.
4. The coordinator can reassign work when a specialist fails, creating resilience.

### Pattern 4: Per-Task Model Routing

**Best for**: Cost optimization without sacrificing quality—using the right model for each task.

Not every task needs the most capable (and most expensive) model. Writing a unit test for a simple utility function doesn't require the same reasoning power as designing a new API. Per-task model routing assigns different AI models to different tasks based on complexity, risk, and required capability.

```
┌──────────────────────────────────────────────────┐
│           Per-Task Model Routing                  │
│                                                  │
│  Task arrives ──▶ Complexity Assessment           │
│                        │                         │
│           ┌────────────┼────────────┐            │
│           v            v            v            │
│      ┌─────────┐ ┌──────────┐ ┌──────────┐      │
│      │  Simple │ │ Moderate │ │ Complex  │      │
│      │ haiku/  │ │ sonnet/  │ │ opus/    │      │
│      │ flash   │ │ pro      │ │ ultra    │      │
│      │         │ │          │ │          │      │
│      │$0.25/1M │ │$3/1M in │ │$15/1M in │      │
│      │ tokens  │ │ tokens   │ │ tokens   │      │
│      └─────────┘ └──────────┘ └──────────┘      │
│                                                  │
│  Examples:           Examples:      Examples:    │
│  • Add a log line   • New API      • Architecture│
│  • Fix a typo       • endpoint     • design      │
│  • Update a test    • Refactor     • Cross-cutting│
│  • Add a constant   • module       • changes     │
└──────────────────────────────────────────────────┘
```

**Routing criteria**:

| Task Characteristic | Route To | Rationale |
|---|---|---|
| Touches 1-2 files | Fast/cheap model | Low complexity, bounded scope |
| Follows existing patterns exactly | Fast/cheap model | Pattern matching, not reasoning |
| Requires design decisions | Strong model | Needs architectural judgment |
| Cross-cutting changes | Strong model | Must understand system-wide impact |
| Security-sensitive code | Strong model + verification | Higher risk tolerance needed |
| Documentation updates | Fast/cheap model | Prose, not architecture |
| New test cases for existing code | Fast/cheap model | Follows patterns, low risk |

**Cost impact**: Consider a team that processes 100 tasks per day. If every task goes to the most expensive model at $15/1M input tokens, and each task consumes an average of 50,000 input tokens, that's $75/day. With model routing, 60 tasks go to the cheap model ($0.25/1M tokens × 50K = $0.0125/task), 30 go to the mid-tier ($3/1M × 50K = $0.15/task), and 10 go to the premium tier ($15/1M × 50K = $0.75/task). Total: $0.75 + $4.50 + $7.50 = $12.75/day. That's an 83% cost reduction based on this illustrative routing model (your actual savings will depend on task distribution and model pricing at time of deployment).

**Implementation with routing rules**:

```markdown
# In AGENTS.md — Model Routing Section

## Model Routing Rules

### Use fast model (claude-haiku / gpt-4o-mini) when:
- Task touches ≤2 files
- Task is explicitly marked "low-risk" or "chore"
- Task description contains: "update", "fix typo", "add logging", "rename"
- Task is documentation-only

### Use standard model (claude-sonnet / gpt-4o) when:
- Task touches 3-10 files
- Task involves new functionality
- Task requires understanding existing patterns
- Default when no rule matches

### Use premium model (claude-opus / o1-pro) when:
- Task touches >10 files
- Task involves architectural decisions
- Task description contains: "design", "architect", "refactor", "security"
- Task affects public API surface
- Task has a "critical" or "high-risk" label
```

### Pattern 5: Automated Quality Gates

**Best for**: Ensuring consistent quality across all agent output without human review of every change.

Quality gates are automated checks that agent output must pass before it can be merged. They're the enforcement mechanism that makes multi-agent orchestration safe at scale.

```
┌──────────────────────────────────────────────────┐
│            Automated Quality Gates                │
│                                                  │
│  Agent submits PR                                │
│       │                                          │
│       v                                          │
│  ┌──────────┐  FAIL ──▶ Reject + feedback        │
│  │ Gate 1:  │───────┐                            │
│  │ Linting  │       │                            │
│  └────┬─────┘       │                            │
│       │ PASS        │                            │
│       v             │                            │
│  ┌──────────┐ FAIL  │                            │
│  │ Gate 2:  │───┐   │                            │
│  │ Type     │   │   │                            │
│  │ Check    │   │   │                            │
│  └────┬─────┘   │   │                            │
│       │ PASS    │   │                            │
│       v         │   │                            │
│  ┌──────────┐   │   │                            │
│  │ Gate 3:  │   │   │                            │
│  │ Unit     │───┤   │                            │
│  │ Tests    │   │   │                            │
│  └────┬─────┘   │   │                            │
│       │ PASS    │   │                            │
│       v         │   │                            │
│  ┌──────────┐   │   │                            │
│  │ Gate 4:  │   │   │                            │
│  │ Arch     │───┤   │                            │
│  │ Rules    │   │   │                            │
│  └────┬─────┘   │   │                            │
│       │ PASS    │   │                            │
│       v         │   │                            │
│  ┌──────────┐   │   │                            │
│  │ Gate 5:  │   │   │                            │
│  │ Coverage │───┘   │                            │
│  │ Check    │       │                            │
│  └────┬─────┘       │                            │
│       │ PASS        │                            │
│       v             v                            │
│    MERGE         REJECT loop back to agent       │
└──────────────────────────────────────────────────┘
```

The gates are, in order:

1. **Linting**: Custom linters catch pattern violations, import direction errors, file size limits, naming violations. Fail-fast, cheap to run.
2. **Type checking**: TypeScript `tsc --noEmit`, Python `mypy --strict`, or equivalent. Catches type errors that tests might miss.
3. **Unit tests**: The tests that the agent wrote plus existing tests. Must all pass.
4. **Architectural rules**: Structural tests that verify the code obeys dependency direction, module boundaries, and other architectural invariants.
5. **Coverage check**: Ensures new code has adequate test coverage (typically ≥80% for new lines).

**The rejection loop is critical**: When an agent's output fails a gate, the rejection isn't just a block—it includes structured feedback that the agent can use to fix the issue. This creates a self-correcting loop:

```bash
# Quality gate pipeline (GitHub Actions example)
name: Agent Quality Gates
on: [pull_request]

jobs:
  gate-1-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run lint
        # Custom linters: dependency direction, file size, naming

  gate-2-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx tsc --noEmit

  gate-3-unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test

  gate-4-arch-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run test:arch
        # Runs structural/architectural tests

  gate-5-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run test:coverage
      - name: Check coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "::error::Coverage $COVERAGE% is below 80% threshold"
            exit 1
          fi
```

**What makes quality gates different for agents vs. humans**: Humans can explain why they violated a lint rule and request an exception. Agents can't—or shouldn't. Quality gates for agents should be *absolute*. If the linter says no, the agent fixes it. No exceptions, no override comments. This absolutism is what makes agent output reliable at scale. It's the "mechanical enforcement" principle from Part IV applied to multi-agent coordination.

### Pattern 6: Sequential Merge (Dependency-Ordered)

**Best for**: Tasks with known dependencies where later tasks build on earlier ones.

When tasks have a dependency chain—Task 2 needs Task 1's output, Task 3 needs both—you can't run them in parallel. Sequential merge handles this by processing tasks in dependency order, merging each completed task before starting the next.

```
┌──────────────────────────────────────────────────┐
│          Sequential Merge (Dependency Order)      │
│                                                  │
│  Task Graph:                                     │
│    T1 (types) ──▶ T2 (service) ──▶ T4 (routes)   │
│                  T3 (tests)     ──▶ T5 (e2e)     │
│                                                  │
│  Execution:                                      │
│  ┌─────┐  merge  ┌─────┐  merge  ┌─────┐        │
│  │ T1  │────────▶│ T2  │────────▶│ T4  │        │
│  └─────┘         └─────┘         └─────┘        │
│           ┌─────┐  merge  ┌─────┐               │
│           │ T3  │────────▶│ T5  │               │
│           └─────┘         └─────┘               │
│                                                  │
│  T1 and T3 can run in parallel (no dependency)   │
│  T2 depends on T1; T5 depends on T3; T4 on T2   │
└──────────────────────────────────────────────────┘
```

**Sequential merge in action**:

```bash
# Phase 1: Run independent tasks in parallel
agent-task "Add OAuth2 types to src/types/auth.ts" --worktree oauth2-types
agent-task "Add OAuth2 test fixtures" --worktree oauth2-fixtures

# Wait for Phase 1 to complete, merge
git checkout main && git merge oauth2-types && git merge oauth2-fixtures

# Phase 2: Run tasks that depend on Phase 1
agent-task "Implement OAuth2 service using new types" --worktree oauth2-service
agent-task "Write unit tests for OAuth2 service" --worktree oauth2-unit-tests

# Wait for Phase 2, merge
git checkout main && git merge oauth2-service && git merge oauth2-unit-tests

# Phase 3: Integration
agent-task "Add OAuth2 HTTP routes and middleware" --worktree oauth2-routes

git checkout main && git merge oauth2-routes
```

**Why not just run everything in parallel?** The sequential merge pattern sacrifices speed for correctness. When Task 2 genuinely depends on Task 1's output—importing types that Task 1 defines, calling functions that Task 1 implements—running them in parallel means Task 2 is working with assumed interfaces that might not match Task 1's actual output. The merge step at the end becomes a debugging session instead of a formality.

Sequential merge front-loads the integration cost. Each merge happens while the context is fresh, and each subsequent agent starts with the actual (not assumed) output of its dependencies.

---

## Hub-and-Spoke vs. Peer-to-Peer Communication

Coordination patterns describe *what* agents do. Communication topologies describe *how* agents talk to each other. There are two fundamental topologies: hub-and-spoke and peer-to-peer.

### Hub-and-Spoke

In hub-and-spoke topology, a central coordinator (the hub) manages all communication. Agents never talk directly to each other—they send messages to the hub, which routes them.

```
Hub-and-Spoke:

          ┌──────────────┐
          │   Coordinator │
          │    (Hub)      │
          └──┬───┬───┬───┘
             │   │   │
        ┌────┘   │   └────┐
        v        v        v
   ┌────────┐ ┌────────┐ ┌────────┐
   │Agent A │ │Agent B │ │Agent C │
   │(Spoke) │ │(Spoke) │ │(Spoke) │
   └────────┘ └────────┘ └────────┘

Communication flow: A → Hub → B (never A → B directly)
```

**Advantages**:
- Simple to implement and reason about
- Hub has full visibility into all agent activity
- Easy to add quality gates, logging, and auditing at the hub (a pattern that benefits from utilities like the `safe_repr()` function introduced in Chapter 9, which truncates large object representations for concise log output)
- Single point of control for error handling and retry

**Disadvantages**:
- Hub is a bottleneck for high-throughput coordination
- Hub failure blocks all communication
- Adds latency for inter-agent coordination

**When to use hub-and-spoke**:
- Production multi-agent systems where auditability matters
- Teams new to multi-agent orchestration (simpler mental model)
- Systems with strong quality gate requirements (hub enforces gates)
- Any system using the coordinator/specialist/verifier pattern

### Peer-to-Peer

In peer-to-peer topology, agents communicate directly with each other. There's no central coordinator—each agent knows about the others and can send messages, share state, and coordinate directly.

```
Peer-to-Peer:

   ┌────────┐         ┌────────┐
   │Agent A │◄────────►│Agent B │
   └───┬────┘         └────┬───┘
       │                   │
       │    ┌────────┐     │
       └───►│Agent C │◄────┘
            └────────┘

Communication flow: A → B directly, A → C directly, B → C directly
```

**Advantages**:
- Lower latency for inter-agent coordination
- No single point of failure
- More flexible for complex coordination patterns
- Agents can self-organize

**Disadvantages**:
- Harder to implement correctly
- No centralized visibility or audit trail (without additional infrastructure)
- Coordination logic is distributed, making it harder to debug
- Risk of circular dependencies or deadlocks

**When to use peer-to-peer**:
- Research or experimental multi-agent systems
- Systems where agents need fine-grained coordination
- Scenarios where the coordinator would be a bottleneck
- Advanced teams with experience debugging distributed systems

### Hybrid Topology

Most production systems use a hybrid approach: hub-and-spoke for high-level orchestration (task assignment, quality gates, integration) with peer-to-peer channels for specific coordination needs (shared state, real-time collaboration on a single file).

```
Hybrid:

          ┌──────────────┐
          │ Coordinator  │ (task assignment, quality gates)
          └──┬───┬───┬───┘
             │   │   │
        ┌────┘   │   └────┐
        v        v        v
   ┌────────┐ ┌────────┐ ┌────────┐
   │Agent A │◄───►│Agent B │ │Agent C │
   └────────┘ └────────┘ └────────┘
        ▲           ▲
        │           │
        └──shared───┘
           state
      (peer-to-peer for specific coordination)
```

The Claude Code Agent SDK implements a version of this hybrid with its "teammates" concept—a coordinator assigns tasks to teammates (hub-and-spoke), but teammates can read each other's output through the shared task board (lightweight peer-to-peer).

---

## Agent Teams vs. Subagents vs. Teammates

The terminology around multi-agent systems is inconsistent across platforms. Let's define the three main concepts clearly, because they represent fundamentally different architectural choices.

### Subagents

A **subagent** is a child process spawned by a parent agent. The parent delegates a specific task to the subagent, waits for it to complete, and incorporates the result.

**Characteristics**:
- Spawned on-demand by the parent
- Has a bounded, specific task
- Returns a result to the parent
- Shares the parent's context (inherently or explicitly)
- Lifetime is tied to the task

**Use case**: "I need to refactor this module. Let me spawn a subagent to write the tests while I focus on the implementation."

**Platform example — Codex subagents API**:
OpenAI's Codex platform supports subagents through its API, with explicit controls for depth and concurrency:

```typescript
// Codex subagent configuration
const codexConfig = {
  max_threads: 4,        // Maximum concurrent subagents
  max_depth: 3,          // Maximum nesting depth (agent spawning agent)
  job_max_runtime: 300,  // Maximum seconds per subagent task
};
```

Here's the same subagent configuration pattern in Go, using goroutines for concurrency control:

```go
// agent/subagent_config.go
package agent

import "time"

// SubagentConfig controls concurrency and safety for spawned subagents.
type SubagentConfig struct {
    MaxThreads    int           // Maximum concurrent subagents
    MaxDepth      int           // Maximum nesting depth (agent spawning agent)
    JobMaxRuntime time.Duration // Maximum duration per subagent task
}

// DefaultConfig returns safe defaults for subagent spawning.
func DefaultConfig() SubagentConfig {
    return SubagentConfig{
        MaxThreads:    4,
        MaxDepth:      3,
        JobMaxRuntime: 5 * time.Minute,
    }
}
```

The `MaxDepth` parameter is particularly important—it prevents runaway agent spawning where Agent A spawns Agent B, which spawns Agent C, ad infinitum. OpenAI's harness engineering blog describes this as a key safety mechanism: "We limit the depth of agent recursion to prevent the Ralph Wiggum scenario."

### Agent Teams

An **agent team** is a persistent group of agents that work together on a shared objective. Unlike subagents, team members aren't spawned on-demand—they're registered, named entities that persist across tasks.

**Characteristics**:
- Pre-registered members with names and roles
- Shared task board (common coordination mechanism)
- Persistent across multiple tasks
- Can communicate through the shared board
- Members can be added or removed dynamically

**Use case**: "Our team has three members: an implementor, a tester, and a reviewer. They'll work through the backlog together."

**Platform example — Claude Code Teams**:
Claude Code's Agent SDK provides a team abstraction with registered teammates:

```typescript
// Claude Code Agent SDK — Team setup
import { Agent } from '@anthropic/agent-sdk';

const team = await Agent.createTeam({
  name: 'feature-team',
  members: [
    { name: 'implementor', role: 'Writes implementation code' },
    { name: 'tester', role: 'Writes tests for implemented code' },
    { name: 'reviewer', role: 'Reviews all changes for quality' },
  ],
  hooks: {
    onTaskCompleted: {
      requireFiles: ['**/*.test.ts'],  // Tests must exist
    },
    onTeammateIdle: {
      autoAssign: true,  // Automatically pick up next task
      maxIdleMs: 30000,  // Alert if idle for 30s
    },
  },
});
```

### Teammates

A **teammate** is a specific member of an agent team. The term emphasizes the collaborative nature of the relationship—teammates are peers working toward a shared goal, not subordinates executing delegated tasks.

**Characteristics**:
- Named, addressable entity within a team
- Has a defined scope of work (system prompt, tool access)
- Can send and receive messages to other teammates
- Can claim, release, and complete tasks on the shared board
- Maintains its own context within a session

**The critical difference from subagents**: A subagent is ephemeral—it exists for the duration of a single task. A teammate is persistent—it works through multiple tasks over time, building up context about the codebase and the team's progress.

### Choosing Between Them

| Factor | Subagents | Teams/Teammates |
|---|---|---|
| Task scope | Single, bounded task | Ongoing, multi-task |
| Lifetime | Ephemeral (task duration) | Persistent (session/scenario) |
| Communication | Return value to parent | Shared task board + messages |
| Context | Inherits from parent | Builds own context over time |
| Complexity | Simple to implement | More complex setup |
| Best for | Ad-hoc delegation | Sustained parallel work |

**Rule of thumb**: Use subagents for one-off delegation ("write tests for this function"). Use teams/teammates for sustained parallel work ("implement this feature with parallel implementor, tester, and reviewer").

---

## The 5-6 Tasks Per Teammate Sweet Spot

Through empirical observation across a small number of production deployments, a consistent pattern emerges: the optimal workload for a single agent teammate is approximately 5-6 tasks per session. Based on our observations across a handful of multi-agent deployments; your optimal batch size will depend on task complexity, codebase size, and merge conflict frequency. This figure should be treated as a starting point rather than a universal constant.

This isn't arbitrary. It reflects a fundamental constraint of current AI systems:

1. **Context window economics**: Each task consumes context window space—reading files, understanding requirements, generating code. After 5-6 tasks, the context window becomes crowded with accumulated information from previous tasks, degrading performance on subsequent ones.

2. **Attention degradation**: LLMs show degraded performance on later tasks in a session compared to earlier ones. The "Lost in the Middle" effect (discussed in Chapter 6) applies to sequential task processing too.

3. **Error accumulation**: Small mistakes in early tasks compound. If Task 3 introduces a subtle pattern violation, Tasks 4-6 might propagate it. By Task 7+, the agent's output quality measurably declines.

4. **Session overhead**: Starting a new agent session has a cost—loading context, understanding the codebase, orienting to the task. But this cost is amortized across 5-6 tasks. Below 3 tasks per session, you're spending more time on overhead than productive work.

**Practical implications**:

```markdown
# Task Sizing Guide

## Good task for one teammate session (5-6 tasks):
- "Implement CRUD endpoints for the User resource"
  - Task 1: Add User types and validation schema
  - Task 2: Implement UserRepository with database queries
  - Task 3: Implement UserService with business logic
  - Task 4: Add HTTP routes and middleware
  - Task 5: Write unit tests for service layer
  - Task 6: Write integration tests for API endpoints

## Bad task for one teammate session (too many):
- "Implement the entire authentication system"
  - This decomposes into 15-20 tasks. Split across 3-4 teammates.
```

**What happens when you exceed the sweet spot**: Quality degrades predictably. Tasks 7-8 might be 80% as good as tasks 1-5. Tasks 9-10 drop to 60%. By task 12+, you're often introducing more bugs than features. The solution is simple: start a new session with fresh context after 5-6 tasks.

This is analogous to human cognitive limits. A developer working on 12 different things in a single afternoon produces worse code than one focused on 5-6 related tasks. Agents have the same limitation—they just reach it faster and more predictably.

---

## Steve Yegge's Progression: The Multi-Agent Maturity Model

Steve Yegge, the veteran engineer known for his incisive writing on developer tools and culture, has described a progression that most teams go through as they adopt multi-agent orchestration. It's become a useful maturity model for understanding where your team is and what comes next.

### Stage 1: Single Agent

**What it looks like**: One agent, one task at a time. The developer prompts the agent, waits for it to complete, reviews the output, and prompts again.

**Throughput**: Limited by serial execution. One task every 10-30 minutes, depending on complexity.

**Typical adoption**: Every team starts here. It's the "learning to walk" phase. You're figuring out how to write good prompts, how to provide context, and how to verify agent output.

**Key challenge**: Velocity. You can see the potential, but the serial bottleneck is frustrating.

### Stage 2: Dual Agent

**What it looks like**: Two agents running in parallel, typically one implementing and one testing. Or one working on the frontend and one on the backend.

**Throughput**: Roughly 1.5-1.8x the single-agent throughput. Not a full 2x, because coordination overhead (merge conflicts, integration) eats into the gains.

**Typical adoption**: Teams that have mastered single-agent workflows and want more speed. This is the "learning to coordinate" phase.

**Key challenge**: Merge conflicts. Two agents editing the same repository creates friction. Teams at this stage usually discover git worktrees for the first time.

### Stage 3: 3-5 Parallel Agents

**What it looks like**: A small team of agents working on independent tasks, coordinated through a shared task board. This is where the coordination patterns from this chapter start to matter.

**Throughput**: 2.5-4x single-agent throughput. Coordination overhead is significant but manageable with worktree isolation and quality gates.

**Typical adoption**: Teams that have invested in harness engineering—AGENTS.md, custom linters, quality gates, and spec-driven decomposition. Without these foundations, 3-5 agents create chaos.

**Key challenge**: Context consistency. Each agent needs accurate, up-to-date context about the codebase. As agents make changes, the context they started with becomes stale. Teams at this stage invest heavily in context engineering (Part II).

### Stage 4: 10+ Agents

**What it looks like**: A fleet of agents working on many tasks simultaneously. A coordinator agent (or human architect) decomposes large features into 20-30 tasks and distributes them across the fleet.

**Throughput**: 6-10x single-agent throughput. But only with sophisticated orchestration—quality gates, automated merge queues, and strong architectural enforcement.

**Typical adoption**: Large teams (50+ engineers) with dedicated infrastructure for agent orchestration. This is where OpenAI was when they produced their million-line codebase.

**Key challenge**: Quality at scale. With 10+ agents, you're merging 10-20 PRs per day. Without automated quality gates (Pattern 5), the integration cost overwhelms the throughput gains. This is where mechanical enforcement (Part IV) becomes essential, not optional.

### Stage 5: Agent Factory

**What it looks like**: Fully automated software factories where agents decompose, implement, test, review, and merge with minimal human intervention. Humans define what to build; the factory builds it.

**Throughput**: 3–20× single-agent throughput for well-harnessed, repetitive implementation tasks (based on published case studies from OpenAI, Stripe, and Affirm; see Chapter 22 for the full methodology). The upper range applies to high-repetition work in mature codebases; novel architectural work typically sees 3–5× gains. The limiting factor is no longer agent speed but specification quality and integration complexity.

**Typical adoption**: Cutting-edge teams with extensive harness infrastructure. This is the vision that OpenAI described in their blog post, and it requires every pattern and practice discussed in this book.

**Key challenge**: Specification quality. The factory is only as good as its inputs. Vague or contradictory specifications produce code that technically passes all quality gates but doesn't do what the team actually wants. Spec engineering becomes the core human skill.

### Where Most Teams Should Start

If you're reading this and thinking "I need to get to Stage 4 immediately," slow down. The progression is a maturity model, not a race. Each stage builds on the foundations of the previous one:

- **Stage 1** teaches you prompt engineering, context provision, and output verification.
- **Stage 2** teaches you worktree isolation, merge workflows, and parallel coordination.
- **Stage 3** teaches you spec-driven decomposition, quality gates, and multi-agent context management.
- **Stage 4** teaches you fleet orchestration, automated integration, and quality at scale.
- **Stage 5** teaches you specification engineering, factory management, and human-in-the-loop optimization.

Skip a stage and you'll hit the challenges of that stage unprepared. Most teams that try to jump from Stage 1 to Stage 4 end up retreating to Stage 2 after a week of chaos.

---

## Putting It All Together: A Multi-Agent Session

Let's walk through a complete multi-agent session using the patterns from this chapter. The goal: implement a notification system with email and SMS channels.

### Step 1: Write the Spec

```markdown
# Notification System Implementation

## Overview
Add a notification system supporting email and SMS channels.

## Architecture
- NotificationService: routes notifications to channels
- EmailChannel: sends via SMTP
- SMSChannel: sends via Twilio
- Notification types: welcome, password_reset, order_confirmation

## Task Decomposition

### Task 1: Types and Configuration (no dependencies)
- src/types/notification.ts: Notification, NotificationChannel, NotificationType types
- src/config/notification.ts: SMTP and Twilio configuration from env vars
- Tests: type validation tests

### Task 2: Email Channel (depends on Task 1)
- src/services/notification/email_channel.ts: EmailChannel implementation
- Tests: unit tests with mocked SMTP

### Task 3: SMS Channel (depends on Task 1)
- src/services/notification/sms_channel.ts: SMSChannel implementation
- Tests: unit tests with mocked Twilio

### Task 4: Notification Service (depends on Tasks 2, 3)
- src/services/notification/service.ts: NotificationService with channel routing
- Tests: unit tests for routing logic

### Task 5: Integration Tests (depends on Task 4)
- tests/integration/notification_test.ts: end-to-end notification flow
```

### Step 2: Spawn Agents

```bash
# Phase 1: Independent tasks
# Agent A - Types and Config
claude-code task "Implement notification types and config per plan Task 1" \
  --worktree notify-types --model claude-sonnet-4

# Phase 2: Wait for Phase 1 to complete, then parallel implementation
# (After Phase 1 merges...)
# Agent B - Email Channel
claude-code task "Implement email channel per plan Task 2" \
  --worktree notify-email --model claude-sonnet-4

# Agent C - SMS Channel (parallel with B)
claude-code task "Implement SMS channel per plan Task 3" \
  --worktree notify-sms --model claude-sonnet-4

# Phase 3: Integration
# Agent D - Service (after B and C merge)
claude-code task "Implement notification service per plan Task 4" \
  --worktree notify-service --model claude-sonnet-4

# Agent E - Integration tests (after D merges)
claude-code task "Write notification integration tests per plan Task 5" \
  --worktree notify-integration --model claude-haiku  # Cheaper model for tests
```

### Step 3: Quality Gates

Each PR goes through the same automated pipeline:

```yaml
# .github/workflows/agent-quality-gates.yml
name: Agent Quality Gates
on: [pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint           # Gate 1: Custom linters
      - run: npx tsc --noEmit       # Gate 2: Type checking
      - run: npm test               # Gate 3: All tests
      - run: npm run test:arch      # Gate 4: Architecture rules
      - run: npm run test:coverage  # Gate 5: Coverage threshold
```

### Step 4: Sequential Merge

```bash
# Merge in dependency order
git checkout main

# Phase 1 output
git merge --no-ff notify-types

# Phase 2 outputs (independent, can merge in either order)
git merge --no-ff notify-email
git merge --no-ff notify-sms

# Phase 3 output
git merge --no-ff notify-service
git merge --no-ff notify-integration

# Run full verification after all merges
npm run verify:all
```

This session uses:
- **Spec-driven decomposition** (Pattern 1) for task breakdown
- **Worktree isolation** (Pattern 2) for conflict prevention
- **Per-task model routing** (Pattern 4) for cost optimization (haiku for tests)
- **Automated quality gates** (Pattern 5) for consistent quality
- **Sequential merge** (Pattern 6) for dependency management
- **Hub-and-spoke** communication (the human architect coordinates)

---

## Real-World Case Studies: Multi-Agent Coordination in Production

Understanding patterns in the abstract is valuable. Seeing how they're applied in production is essential. Let's examine how three organizations—with vastly different scales and challenges—implemented multi-agent coordination.

### Case Study 1: OpenAI's Million-Line Codebase

The OpenAI experiment (Chapter 1) remains the most ambitious multi-agent deployment publicly documented — one million lines of code across roughly 1,500 PRs with zero human-written lines.

**Coordination approach**: OpenAI used a sophisticated combination of spec-driven decomposition, worktree isolation with the Ralph Wiggum Loop (Chapter 14) for failure recovery, mechanically enforced quality gates (custom linters, dependency checks, structural tests), and per-task model routing.

The key insight: **the harness IS the coordination**. Agents didn't coordinate with each other directly — they coordinated through the shared harness (AGENTS.md as source of truth, linters as enforcement, quality gates as integration checkpoints). Each agent worked independently within the constraints of the harness.

### Case Study 2: Affirm's 800-Engineer Retraining

Affirm's organizational-scale transition—retraining 800+ engineers in agentic development in a single week—offers essential lessons on the *organizational* dimension of multi-agent coordination. Their three key decisions (single default toolchain, local-first development, explicit human checkpoints for every agent PR) illustrate that technical patterns alone aren't sufficient; organizational alignment on tooling, training, and review processes is equally critical, especially during the transition from single-agent to multi-agent workflows. The full case study, including their approach to trust-building and human oversight, is covered in detail in Chapter 16.

### Case Study 3: Wix's AirBot — Multi-Agent Incident Response

Wix's AirBot (the full case study is in Chapter 16) demonstrates multi-agent coordination in incident response, saving 675 engineering hours per month at $0.30 per interaction.²

**Coordination approach**: AirBot uses a coordinator/specialist/verifier pattern with a central orchestrator dispatching tasks to specialized agents (log analyzer, metrics analyzer, root cause identifier, remediation planner), a sequential pipeline for incident resolution, and quality gates before executing remediation — only 28 of 180 candidate PRs were merged without human changes.

AirBot's experience reinforces a key theme: **coordination patterns are domain-independent**. The same patterns that work for code generation (spec-driven decomposition, sequential merge, quality gates) work for incident response, data pipeline management, and other engineering tasks.

### Lessons Across Case Studies

Drawing from these three case studies—and dozens of smaller deployments—several cross-cutting lessons emerge:

1. **Start with quality gates, add agents later.** Every successful multi-agent deployment invested in verification infrastructure before scaling agent count. Teams that added agents first and quality gates second always struggled with integration.

2. **The spec is the most important artifact.** OpenAI's specs were detailed enough that agents could work independently. Affirm's specs were simpler but backed by human review. Wix's incident specs were semi-structured runbooks. In every case, the quality of the spec directly determined the quality of the agent output.

3. **Organizational alignment matters as much as technical patterns.** Affirm's single-toolchain decision and OpenAI's architect-driven decomposition both reflect organizational choices that made technical coordination possible. The best coordination patterns fail when the organization isn't aligned on how to use them.

4. **Trust is earned incrementally.** No team went from zero agents to a fully autonomous factory in one step. Every team built trust through a progression: human review → automated checks → selective automation → full automation. The maturity progression from Steve Yegge isn't just a technical model—it's a trust model.

5. **Cost tracking enables optimization.** Wix's $0.30/interaction metric and the Faros AI $37.50/PR benchmark both demonstrate that cost visibility is essential for optimizing multi-agent systems. You can't optimize what you don't measure.

---

## Multi-Agent Systems in Production: Industry Patterns

The case studies above show how three specific organizations applied the coordination patterns in this chapter. But the multi-agent landscape is evolving rapidly. In this section, we survey three additional production systems—each representing a distinct architectural philosophy—and extract the common patterns that connect them back to the six coordination patterns described earlier.

### Stripe Minions: The Deterministic + Agentic Hybrid

Stripe's Minions system is, by volume, the most impressive multi-agent deployment publicly documented. As of early 2026, Minions generates and submits approximately 1,300 pull requests per week—roughly 185 per day—across Stripe's internal codebase.¹ No human writes the code; humans review and merge it.

What makes Minions notable isn't the scale. It's the *architecture*. Stripe didn't give agents free rein. They built a structured workflow system around **blueprints**—templates that wire together two fundamentally different types of steps:

- **Deterministic nodes**: Fixed, predictable operations that always produce the same output for the same input. Parsing source files, running test suites, linting, file I/O, validation checks. No AI involved. Pure functions.
- **Agentic nodes**: Steps that invoke an LLM for reasoning, decision-making, or code generation. Understanding a task description, planning which files to modify, generating implementation code, interpreting test failures, writing PR descriptions.

A typical blueprint for a dependency update task looks like this:

1. **[Deterministic]** Identify all files importing the target library
2. **[Deterministic]** Extract code context around each import
3. **[Agentic]** Analyze current usage patterns and determine necessary changes
4. **[Agentic]** Generate updated code for each affected file
5. **[Deterministic]** Write changes to disk
6. **[Deterministic]** Run the test suite
7. **[Agentic]** If tests fail, interpret errors and generate fixes
8. **[Deterministic]** Verify fixes compile and tests pass
9. **[Deterministic]** Format code per style rules
10. **[Agentic]** Write a PR description summarizing the change
11. **[Deterministic]** Submit the pull request

Notice the rhythm: deterministic steps gather information and verify outputs; agentic steps reason and generate. The agentic nodes never need to run tests or format code—the deterministic nodes handle that. This separation reduces cognitive load on the AI, makes failures explicit and recoverable, and creates auditable workflows where every step can be logged and inspected.

The retry loop is particularly elegant. When a deterministic node catches a failure (e.g., tests don't pass after code generation), the blueprint doesn't halt—it feeds the failure back into an agentic node for interpretation and another generation attempt. This creates *bounded retry loops*: the system attempts corrections a set number of times before escalating to a human.

Blueprints also enable safe parallelization. If Stripe needs to apply the same type of change across 200 services, they run 200 blueprint instances in parallel, each on its own slice of the codebase. Deterministic validation in each instance means no central coordinator is needed to verify results, and stateless agentic nodes mean no cross-instance interference.

**Mapping to the six patterns**: Minions embodies **spec-driven decomposition** (blueprints are specs), **automated quality gates** (deterministic nodes enforce them), and **sequential merge** (dependency-ordered steps within each blueprint). The parallelization across services uses **worktree isolation**—each instance operates on its own code slice. The deterministic/agentic split is a form of **per-task model routing**—only steps that genuinely need AI get AI.

### Uber's Validator + AutoCover: Specialized Agents Coordinated via LangGraph

Uber operates at staggering scale: 33 million trips daily, 15,000 cities, hundreds of millions of lines of code, roughly 5,000 engineers. Their Developer Platform team built two flagship multi-agent tools—**Validator** and **AutoCover**—that together saved approximately 21,000 developer hours.

**Validator** is an IDE-integrated agent that detects security violations, best-practice issues, and style problems in real time. Its architecture is a hybrid: LLM sub-agents handle nuanced analysis that requires understanding context and intent, while deterministic linting tools handle known patterns with zero ambiguity. A developer opens a file and Validator surfaces diagnostic information with one-click fixes. Thousands of fix interactions occur daily.

**AutoCover** is the more ambitious system. It generates comprehensive unit tests—including business case coverage and mutation testing—from a single right-click in the IDE. AutoCover launches a multi-agent pipeline:

1. **Scaffolder agent**: Prepares the test environment, identifies business cases to cover
2. **Generator agent**: Creates test cases informed by the scaffolder's analysis
3. **Executor agent**: Runs builds and coverage analysis in parallel (up to 100 simultaneous test executions per file)
4. **Validator agent** (reused): Vets the generated tests for quality

Tests stream into the IDE in real time—failing tests are pruned, redundant tests are merged, new tests including performance and concurrency benchmarks are added. The developer watches their test suite build itself.

The architectural insight is **agent composability**. AutoCover reuses Validator as a sub-component within its workflow. This isn't accidental—Uber built "LangEffect," an opinionated wrapper around LangGraph and LangChain specifically designed to make agent composition reusable. The same primitives that power Validator and AutoCover also power UReview (AI-powered PR review feedback), Security ScoreBot (conversational security checks), and Picasso's Genie (workflow automation assistant).

Uber's results are concrete: a 10% increase in test coverage, 2–3× better coverage in half the time compared to standard agentic coding tools, and those 21,000 saved developer hours. The system processes thousands of tests monthly.

**Mapping to the six patterns**: Uber's system is a textbook implementation of **coordinator/specialist/verifier roles** (LangGraph orchestrates the scaffolder, generator, executor, and validator). The hybrid LLM + deterministic architecture mirrors **per-task model routing** (LLM for reasoning, deterministic tools for known patterns). AutoCover's multi-agent pipeline uses **sequential merge** within each test generation run. And the IDE integration with one-click fixes is a lightweight form of **automated quality gates**.

### Google's Scion: Container-Based Agent Orchestration

Google's Scion framework takes a fundamentally different approach to multi-agent coordination. Rather than prescribing rigid orchestration patterns, Scion acts as a "hypervisor for agents"—managing isolated, concurrent agent processes without dictating *how* they coordinate.

Scion orchestrates "deep agents" (Claude Code, Gemini CLI, Codex, and others) as containerized processes. Each agent gets:

- Its own container (Docker, Podman, Apple Container, or Kubernetes pod)
- Its own git worktree (preventing file-level conflicts)
- Its own credentials (preventing permission leakage)
- Its own `tmux` session (for background operation with attach/detach)

The key design philosophy is **isolation over constraints**. Instead of embedding rules into each agent's context ("you may only edit these files"), Scion lets agents operate freely within their container while enforcing boundaries at the infrastructure layer—network policies, filesystem scope, and credential boundaries. As the Scion documentation puts it: agents run in `--yolo` mode, but their container walls keep them safe.

Scion's approach to coordination is notably lightweight. Rather than a fixed set of agents with predefined roles, it supports distinct agent lifecycles—some agents are specialized and long-lived, others are ephemeral and tied to a single task. Agents learn a CLI tool dynamically, and the *models themselves decide how to coordinate* through natural language prompting. This makes Scion less a production deployment framework and more a rapid-prototype testbed for experimenting with multi-agent patterns.

The framework supports multiple runtimes (local, remote VM, Kubernetes cluster) and includes normalized OpenTelemetry telemetry across different agent harnesses—giving operators visibility into what a swarm of agents is doing without needing harness-specific tooling.

Google demonstrated Scion's capabilities with "Relics of Athenaeum," an agent game where groups of specialized agents collaborate to solve computational puzzles. The game runner spawns character agents, which in turn spawn worker and specialized agents dynamically. Coordination occurs through a shared workspace for reading and writing data, plus direct messages and party-wide broadcasts—a hybrid hub-and-spoke + peer-to-peer topology.

**Mapping to the six patterns**: Scion is fundamentally about **worktree isolation** taken to its logical conclusion—each agent gets a full container, not just a branch. The template system (defining agent roles with custom system prompts) maps to **coordinator/specialist/verifier roles**. The multi-runtime support enables **sequential merge** across distributed environments. And the telemetry infrastructure provides the observability layer that makes **automated quality gates** possible at fleet scale.

### Common Patterns Across Industry Deployments

Despite their different scales, domains, and architectural philosophies, Stripe, Uber, and Google share a set of common patterns:

| Pattern | Stripe Minions | Uber Validator/AutoCover | Google Scion |
|---|---|---|---|
| Hybrid deterministic + agentic | Core design principle (blueprints) | Hybrid LLM + lint tools | Isolation over constraints |
| Specialized agents per task type | Blueprints per category | Domain-expert sub-agents | Templates with custom prompts |
| Automated verification | Deterministic validation nodes | Validator as quality gate | OTEL telemetry + infrastructure boundaries |
| Parallel execution | 200+ blueprint instances | 100 parallel test executions | Container-based parallel agents |
| Human in the loop | Review before merge | IDE-integrated, developer-triggered | Attach/detach for oversight |
| Composable primitives | Blueprint templates | Reusable agent graphs (LangEffect) | Harness adapters + templates |

Three meta-lessons emerge from this survey:

**1. Determinism is the foundation, not the ceiling.** All three systems combine deterministic checks with AI reasoning. None rely on AI alone. The deterministic layer—whether it's Stripe's validation nodes, Uber's linting sub-agents, or Scion's container boundaries—provides the reliability backbone that makes AI-generated output safe to ship. This validates the automated quality gates pattern (Pattern 5) as the single most important infrastructure investment for multi-agent systems.

**2. Specialization beats generalization.** Stripe has separate blueprints for dependency updates, API migrations, and test generation. Uber has separate agents for scaffolding, generating, executing, and validating tests. Scion has separate templates for different agent roles. None of these systems use a single general-purpose agent for everything. This validates the coordinator/specialist/verifier pattern (Pattern 3) and per-task model routing (Pattern 4).

**3. Isolation enables parallelism.** Stripe's parallel blueprint instances, Uber's 100 concurrent test executions, and Scion's container-per-agent architecture all demonstrate that safe parallelism requires strong isolation. Worktree isolation (Pattern 2) is the minimum; container-based isolation is the direction the industry is moving.

These industry patterns don't replace the six coordination patterns in this chapter—they validate and extend them. The six patterns are the building blocks; the industry deployments show how to compose those blocks at scale.

---

## Common Anti-Patterns

Before we move to worktree isolation in Chapter 14, let's cover the mistakes that teams commonly make with multi-agent coordination.

### Anti-Pattern 1: The Wild West

**What it looks like**: Multiple agents working in the same repository on the same branch with no coordination.

**What happens**: File conflicts, overwrites, broken builds. Within an hour, the codebase is in an unrecoverable state and someone has to `git reset --hard` back to the last known-good commit.

**The fix**: Always use worktree isolation (Pattern 2) or file locking. Never let two agents edit the same working directory simultaneously.

### Anti-Pattern 2: The Over-Coordinator

**What it looks like**: A coordinator agent that tries to manage every detail of every task—assigning specific files to specific agents, specifying exact function signatures, micromanaging implementation approach.

**What happens**: The coordinator becomes a bottleneck. It spends more time managing than the specialists spend implementing. And because the coordinator is making detailed decisions without reading the actual code, its assignments are often wrong.

**The fix**: The coordinator should decompose at the *task* level, not the *implementation* level. Define what needs to be done, not how. Let specialists make implementation decisions within the constraints of AGENTS.md and the quality gates.

### Anti-Pattern 3: The Quality Gate Bypass

**What it looks like**: Quality gates exist in CI but agents (or humans) can bypass them with `--no-verify` or by merging directly to main.

**What happens**: Agents learn that quality gates are suggestions, not requirements. Substandard code accumulates. The harness becomes theater rather than enforcement.

**The fix**: Branch protection rules that prevent merging without passing all quality gates. No exceptions. No `--no-verify`. No admin overrides for agent-generated code. This is the "mechanical enforcement" principle: if it can be bypassed, it isn't enforcement.

### Anti-Pattern 4: The Context Stalemate

**What it looks like**: Agents are working in parallel, making changes to shared types or interfaces. Agent A changes a type definition. Agent B is still working with the old definition. When they merge, everything breaks.

**What happens**: Integration becomes a debugging session instead of a formality. Teams spend hours resolving semantic conflicts that could have been prevented.

**The fix**: Use spec-driven decomposition (Pattern 1) to define interfaces before implementation. The spec becomes the source of truth that all agents work from, not the current state of the codebase. Changes to shared interfaces go through a dedicated task that merges first (sequential merge, Pattern 6).

### Anti-Pattern 5: The Copy-Paste Swarm

**What it looks like**: Multiple agents independently implementing similar functionality. Agent A adds error handling to the user service. Agent B adds error handling to the order service. They each invent their own pattern instead of sharing one.

**What happens**: Pattern proliferation. The codebase ends up with N different error-handling patterns instead of one. Linters catch this eventually, but the rework is expensive.

**The fix**: Include pattern examples in AGENTS.md or the spec. When multiple agents implement similar functionality, define the pattern once in the spec and reference it from each task. This is where the "golden principles" from Chapter 10 pay dividends—they give agents a shared vocabulary for implementation.

---

## Key Takeaways

1. **Coordination is the hard problem.** Getting a single agent to work is engineering. Getting multiple agents to work together is *orchestration*. The patterns in this chapter are your orchestration toolkit.

2. **Six patterns cover most scenarios.** Spec-driven decomposition, worktree isolation, coordinator/specialist/verifier, per-task model routing, automated quality gates, and sequential merge. You don't need to invent new patterns—these six, combined and composed, handle the vast majority of multi-agent coordination challenges.

3. **The 5-6 task sweet spot is real.** Respect it. Start fresh agent sessions after 5-6 tasks to maintain quality.

4. **The maturity progression is a guide, not a race.** Build foundations at each stage before moving to the next. The patterns you need at Stage 3 don't work without the foundations from Stages 1 and 2.

5. **Communication topology matters.** Hub-and-spoke for simplicity and auditability. Peer-to-peer for performance. Hybrid for production systems.

6. **Quality gates are non-negotiable at scale.** The more agents you run, the more you need automated, absolute quality enforcement. At 10+ agents, quality gates are what separate productive orchestration from expensive chaos.

7. **The spec is the coordination mechanism.** Agents don't need to talk to each other if they have a good spec. Invest in spec quality before investing in coordination infrastructure.

In Chapter 14, we'll dive deep into the worktree isolation pattern—the technical foundation that makes most of these coordination patterns possible. We'll cover git worktrees in detail, the Ralph Wiggum Loop pattern from OpenAI, sandboxing strategies, and the cost implications of running multiple isolated agents.

---

## Further Reading

- OpenAI, "Harness Engineering" blog post (2026) — The foundational description of multi-agent coordination in production
- Augment Code, "Harness Engineering Guide" — Coordinator-Implementor-Verifier pattern formalization
- Affirm Engineering, "How Affirm Retooled Its Engineering Organization for Agentic Software Development" — Enterprise multi-agent deployment
- Claude Code Agent SDK documentation — Teams, teammates, and orchestration APIs
- OpenAI Codex documentation — Subagents API (max_threads, max_depth, job_max_runtime)
- Martin Fowler, "Harness Engineering" commentary — Architectural perspective on multi-agent coordination

---

¹ Stripe Engineering, "Minions: Stripe's one-shot, end-to-end coding agents," 2025. https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents

² Spotify Engineering, "Spotifys background coding agent," 2025. https://engineering.atspotify.com/2025/11/spotifys-background-coding-agent-part-1
