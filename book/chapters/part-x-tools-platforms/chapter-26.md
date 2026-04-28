# Chapter 26: Building Your Harness — A Practical Guide

> *"A year from now you will wish you had started today."*  
> — Karen Lamb

---

## Introduction

You've read 25 chapters of theory, research, case studies, and patterns. Now it's time to build. This chapter is a step-by-step guide to constructing your harness, from an empty repository to a mature, agent-first development environment.

We'll follow a four-phase approach, with specific tasks, timelines, and deliverables for each phase. By the end of Phase 4, you'll have a production-quality harness that supports Level 3–4 autonomy.

### A Note on Timelines

The timelines in this chapter are calibrated for a team of 5–10 engineers working full-time with a single codebase. Adjust expectations based on your situation:

- **Solo developers:** Phases will take roughly 1.5× longer. You're both building the harness and using it.
- **Large teams (20+):** Phases may move faster because you have more capacity, but coordination overhead increases. Designate 1–2 "harness engineers" who own the infrastructure.
- **Brownfield codebases:** Add 50% to all timelines. Existing code that doesn't conform to the harness will need to be adapted or exempted.
- **Multiple codebases:** Build the harness in one codebase first, then replicate the pattern. Don't try to build harnesses in parallel across multiple repos.

The most important thing is to start. An imperfect harness used today beats a perfect harness planned for next quarter.

---

## Quick Start: Your Harness in 60 Minutes

> **📖 Tear out this section.** Print it, pin it to your monitor, give it to a teammate. This is the fastest path from zero to a working harness. Everything else in this chapter adds depth — but this section gets you started *today*.

You don't need to read 25 chapters before you start. You need 60 minutes, a terminal, and a repository. Here's the step-by-step guide to building a minimum viable harness that supports Level 2 autonomy — enough to make agents productive and reliable.

### Minute 0–10: Create AGENTS.md from Template

Create a file called `AGENTS.md` at the root of your repository. Copy this template and fill in the bracketed sections:

```markdown
# AGENTS.md — [Your Project Name]

## Overview
[One paragraph: what this project does, who uses it, what tech stack]

## Architecture
- **Pattern:** [Monolith / Microservices / Serverless]
- **Language:** [TypeScript/Python/Go/etc.]
- **Dependency layers:** Types → Config → Data → Services → Runtime → UI
- **Rule:** Dependencies flow inward only. UI never imports Data.

## Commands
- `npm test` — Run all tests
- `npm run lint` — Run linters (must pass before PR)
- `npm run build` — Build for production

## Code Style
- Strict mode enabled
- All functions have explicit return types
- Use structured logging: `logger.info({ userId, action }, message)`
- Error handling: always include remediation guidance
- No file exceeds 300 lines

## Testing
- Every source file has a corresponding test file
- Test happy path AND error cases
- Run `npm test` before submitting any PR

## PR Conventions
- Title: [area] description (e.g., "[auth] add refresh token rotation")
- All linters and tests must pass
- No direct pushes to main
```

**Minute 0–10 Checklist:**
```
□ AGENTS.md created at repository root
□ Project overview filled in (2–3 sentences)
□ Architecture section specifies dependency layers
□ All three commands listed (test, lint, build)
□ At least one code style rule specified
□ At least one testing requirement specified
```

**Expected output:** A 40–60 line AGENTS.md file that any agent platform can read. Test it by opening your agent and asking: "Read AGENTS.md and summarize the project conventions." If the agent can accurately describe your rules, the file works.

### Minute 10–25: Set Up Your CI Pipeline

Create a CI pipeline that runs on every pull request. This is your automated quality gate — the mechanism that catches agent mistakes before they reach main.

**GitHub Actions (most common):** Create `.github/workflows/ci.yml`:

```yaml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - run: npm run build
```

**GitLab CI:** Create `.gitlab-ci.yml`:

```yaml
stages: [test]
test:
  stage: test
  image: node:20
  script:
    - npm ci
    - npm test
    - npm run lint
    - npm run build
  rules:
    - if: $CI_MERGE_REQUEST_IID
```

**CircleCI:** Create `.circleci/config.yml`:

```yaml
version: 2.1
jobs:
  test:
    docker:
      - image: cimg/node:20
    steps:
      - checkout
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - run: npm run build
workflows:
  ci:
    jobs:
      - test:
          filters:
            branches:
              ignore: main
```

**Minute 10–25 Checklist:**
```
□ CI configuration file created for your platform
□ Pipeline runs on pull_request / merge request events
□ Pipeline includes: test step, lint step, build step
□ Pipeline completes in under 10 minutes (check by opening a test PR)
□ Branch protection enabled on main (require CI to pass before merge)
```

**Expected output:** A green checkmark on your next pull request. If the pipeline fails on an existing PR, that's actually valuable — it means you've just found code that needs fixing. Don't fix it yet; that's what linters are for (next step).

### Minute 25–40: Add 3 Custom Linter Rules

This is where the harness starts earning its keep. You're going to write three linter rules that target the most common failure modes of AI-generated code. These rules encode your team's judgment into mechanical checks that never get tired, never skip a file, and never have a bad day.

**Rule 1: File Size Limit (no file exceeds 300 lines)**

AI agents love generating large files. This rule catches the problem before it reaches review:

```javascript
// linters/custom/max-file-size.js (ESLint rule)
module.exports = {
  meta: { type: 'suggestion', severity: 'warn' },
  create(context) {
    const MAX_LINES = 300;
    const source = context.getSourceCode();
    
    return {
      Program(node) {
        const lines = source.getLines().length;
        if (lines > MAX_LINES) {
          context.report({
            node,
            message: `File has ${lines} lines (max ${MAX_LINES}). ` +
                     'Split into smaller modules.'
          });
        }
      }
    };
  }
};
```

**Rule 2: Dependency Direction (enforce layer architecture)**

Agents will import from any layer unless you stop them. This rule enforces the dependency direction defined in your AGENTS.md:

```javascript
// linters/custom/dependency-direction.js
module.exports = {
  meta: { type: 'problem', severity: 'error' },
  create(context) {
    const layers = {
      'types': 1, 'config': 2, 'data': 3,
      'services': 4, 'runtime': 5, 'ui': 6
    };
    
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        const fileLayer = context.getFilename()
          .match(/src\/(\w+)\//)?.[1];
        
        if (!fileLayer || !layers[fileLayer]) return;
        
        const importLayer = source.match(/@(\w+)\//)?.[1];
        if (importLayer && layers[importLayer] > layers[fileLayer]) {
          context.report({
            node,
            message: `Layer violation: ${fileLayer} cannot import from ` +
                     `${importLayer}. Dependencies must flow inward.`
          });
        }
      }
    };
  }
};
```

**Rule 3: No Silent Error Catching**

Agents frequently write catch blocks that swallow errors silently. This rule forces every catch block to do something meaningful:

```javascript
// linters/custom/no-silent-catch.js
module.exports = {
  meta: { type: 'problem', severity: 'error' },
  create(context) {
    return {
      CatchClause(node) {
        const body = node.body.body;
        const isEmpty = body.length === 0;
        const onlyLogs = body.every(stmt =>
          stmt.type === 'ExpressionStatement' &&
          stmt.expression.callee?.object?.name === 'console'
        );
        
        if (isEmpty || onlyLogs) {
          context.report({
            node,
            message: 'Catch block must rethrow, return an error result, ' +
                     'or include remediation context. Silent swallowing is not allowed.'
          });
        }
      }
    };
  }
};
```

Register these rules in your ESLint config (or equivalent for your language):

```json
{
  "plugins": ["custom"],
  "overrides": [{
    "files": ["src/**/*.ts"],
    "rules": {
      "custom/max-file-size": "warn",
      "custom/dependency-direction": "error",
      "custom/no-silent-catch": "error"
    }
  }]
}
```

**Minute 25–40 Checklist:**
```
□ File size limit rule implemented and tested
□ Dependency direction rule implemented and tested
□ No silent catch rule implemented and tested
□ All three rules registered in linter configuration
□ Rules run as part of `npm run lint`
□ Rules added to CI pipeline (they already run if `npm run lint` is in CI)
```

**Expected output:** Running `npm run lint` on your codebase produces a list of violations. Don't panic — these violations existed before; you just couldn't see them. Each violation is a specific, fixable problem. Fix the most critical ones first and let the rest be caught incrementally.

### Minute 40–50: Create Your First Execution Plan Template

An execution plan is how you give complex tasks to an agent. It's a structured document that breaks work into discrete steps with explicit scope, dependencies, and acceptance criteria. Create the template:

```markdown
# Execution Plan: [Feature Name]

## Goal
[Clear, measurable outcome — what "done" looks like]

## Context
[Why this feature exists, any relevant background]

## Tasks
- [ ] Task 1: [Description] (Scope: files to modify)
- [ ] Task 2: [Description] (Scope: files to modify)
- [ ] Task 3: [Description] (Scope: files to modify)

## Dependencies
[Which tasks depend on which]

## Acceptance Criteria
- [ ] All tests pass
- [ ] Linting clean
- [ ] [Feature-specific criteria]

## Verification Steps
1. Run `npm test`
2. Run `npm run lint`
3. [Manual verification steps]
```

Save this as `docs/execution-plans/_template.md`. Now create your first real plan. Pick something simple from your backlog — a single-endpoint feature, a new type definition, or a bug fix that touches 2–3 files. Fill in the template with the real task.

**Minute 40–50 Checklist:**
```
□ docs/execution-plans/ directory created
□ Template saved as _template.md
□ First real execution plan created from template
□ Plan has a clear, measurable goal
□ Plan lists specific files in scope for each task
□ Plan includes acceptance criteria
```

**Expected output:** A completed execution plan document that you can hand to an agent and say "Follow this plan." The plan should be specific enough that a new team member could execute it without asking questions — if it is, the agent can too.

### Minute 50–60: Run Your First Agent Task and Verify It Passes CI

Now the moment of truth. You're going to give your agent a real task and see if the harness you just built catches problems and guides the agent to correct output.

**Step 1: Install an agent platform** (if you haven't already):
- **GitHub Copilot:** Install the extension in VS Code or your IDE. Done.
- **Cursor:** Download from cursor.com, open your project. Done.
- **Claude Code:** Run `npm install -g @anthropic-ai/claude-code`, then `claude init` in your repo.

**Step 2: Create a branch:** `git checkout -b test/harness-health-check`

**Step 3: Give the agent this task:**

> "Add a health check endpoint at GET /health that returns { status: 'ok', version: package.json version, uptime: process.uptime() }. Follow the conventions in AGENTS.md. Include tests. Ensure all linters pass."

**Step 4: Review the agent's output:**
1. Did it create files in the correct directory? (Check against AGENTS.md architecture rules)
2. Did it write tests? (Check for a corresponding test file)
3. Did it follow code style? (Run `npm run lint` and check for violations)
4. Does it pass CI? (Open a PR and check)

**Step 5: If something fails**, update AGENTS.md with the missing rule and try again. This iteration — agent produces code, harness catches issues, AGENTS.md improves — is the core loop of harness engineering.

**Minute 50–60 Checklist:**
```
□ Agent platform installed and configured
□ Agent successfully reads AGENTS.md
□ Test task completed: health check endpoint created
□ Agent wrote tests for the new endpoint
□ Agent output passes lint (npm run lint clean)
□ Agent output passes tests (npm test clean)
□ PR opened and CI passes with green checkmark
```

**Expected output:** A merged PR (or one ready to merge) that adds a health check endpoint with tests, passing all linters and CI checks. If you reached this point, congratulations — you have a working harness. It's minimal, but it's real. Everything else in this chapter builds on this foundation.

### What to Do After the First 60 Minutes

If you've completed all five steps, you have:
- An AGENTS.md that agents can read and follow
- A CI pipeline that enforces quality on every PR
- Three custom linter rules that catch the most common AI-generated code problems
- An execution plan template for structured task delegation
- Evidence that the system works (a passing PR)

Your next priorities, in order:
1. **Expand AGENTS.md** — Add more code style rules, testing conventions, and PR conventions as you observe what the agent gets wrong.
2. **Add more linters** — Each new rule targets a specific failure pattern. Aim for 5–10 rules by the end of Week 2.
3. **Create execution plans for real features** — Practice makes perfect. The more plans you write, the better the agent's output.
4. **Follow the Phase 1–4 roadmap below** — The quick start covered Phase 1. The rest of this chapter guides you through Phases 2–4.

---

## Phase 1: Foundation (Week 1)

**Goal:** Establish the minimum infrastructure for agent-assisted development.

### Day 1–2: Repository Setup

**Tasks:**
1. Create the repository (or select an existing one)
2. Initialize with a clear directory structure:

```
my-project/
├── AGENTS.md              # Agent instructions (the map)
├── docs/
│   ├── architecture.md    # System architecture overview
│   ├── execution-plans/   # Living execution plans
│   └── conventions/       # Coding conventions
├── src/
│   ├── types/             # Shared types (dependency layer 1)
│   ├── config/            # Configuration (dependency layer 2)
│   ├── data/              # Data access (dependency layer 3)
│   ├── services/          # Business logic (dependency layer 4)
│   ├── runtime/           # Runtime infrastructure (dependency layer 5)
│   └── ui/                # User interface (dependency layer 6)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── structural/        # Architectural invariant tests
├── .github/
│   └── workflows/         # CI pipeline
└── linters/
    └── custom/            # Custom linter rules
```

3. Set up CI (GitHub Actions recommended):
```yaml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - run: npm run build
```

### Day 3–4: AGENTS.md

Write your AGENTS.md. Start small — it's a map, not an encyclopedia:

```markdown
# Project Overview
Brief description of what this project does and why.

# Architecture
- Dependency layers: Types → Config → Data → Services → Runtime → UI
- Dependencies flow inward only (UI depends on Services, never the reverse)
- See docs/architecture.md for full details

# Commands
- `npm test` — Run all tests
- `npm run lint` — Run linters (must pass before PR)
- `npm run build` — Build for production
- `npm run dev` — Start development server

# Code Style
- Use TypeScript strict mode
- All functions have explicit return types
- Use structured logging (JSON format with correlation IDs)
- Error handling: always include remediation guidance

# Testing
- Every source file has a corresponding test file
- Use describe/it pattern with descriptive test names
- Test the happy path AND error cases
- Integration tests for API endpoints

# PR Conventions
- Title format: [area] description (e.g., "[auth] add refresh token rotation")
- Include context in PR description: what, why, how to verify
- All linters and tests must pass
- No direct pushes to main

# Security
- Never commit secrets (use environment variables)
- All external inputs are validated
- See docs/security.md for detailed guidelines
```

### Day 5: Agent Configuration

Configure your chosen agent platform:

- **Claude Code:** Set up `.claude/` config with model preferences and tool permissions
- **Codex:** Configure environment variables and sandbox settings
- **Copilot:** Enable in IDE, configure workspace settings

Test the agent with a simple task: "Add a health check endpoint that returns the service version and uptime." Verify that:
1. The agent reads AGENTS.md
2. The agent follows the directory structure
3. The agent writes tests
4. The code passes CI

If any of these fail, iterate on AGENTS.md until the agent gets it right.

### Phase 1 Deliverables Checklist

Before moving to Phase 2, confirm all of the following:

```
Phase 1 Completion Checklist

Repository Structure:
  □ Directory structure follows dependency layer pattern
  □ docs/ directory created with architecture.md placeholder
  □ tests/ directory has unit/, integration/, and structural/ subdirectories
  □ .github/workflows/ contains basic CI pipeline
  □ linters/custom/ directory exists (even if empty for now)

AGENTS.md:
  □ Under 100 lines
  □ Contains project overview
  □ Contains architecture summary with dependency layers
  □ Lists all build/test/lint commands
  □ Specifies code style rules
  □ Defines testing requirements
  □ Defines PR conventions
  □ Points to docs/ for details

CI Pipeline:
  □ Runs on every pull request
  □ Runs all tests
  □ Runs linter
  □ Runs build verification
  □ Completes in under 10 minutes

Agent Configuration:
  □ Agent platform installed and configured
  □ Agent successfully reads AGENTS.md
  □ Test task completed successfully (health check endpoint)
  □ Agent output passes CI

Metrics Baseline:
  □ Record current PR throughput (PRs per week)
  □ Record current cycle time (time from first commit to merge)
  □ Record current test coverage percentage
```

### Phase 1 Common Struggles and Fixes

**Struggle: The agent ignores AGENTS.md.**
This usually means the agent platform isn't configured to read it. Check your platform's configuration: Claude Code reads AGENTS.md automatically when it's in the repo root. Codex requires `instructions_file: AGENTS.md` in `.codex/config.yaml`. Copilot reads `.github/copilot-instructions.md` — add a pointer to AGENTS.md there.

**Struggle: The agent puts files in the wrong directory.**
Your AGENTS.md may not be specific enough about file placement. Add explicit examples: "New API routes go in `src/routes/`. New service functions go in `src/services/`. New types go in `src/types/`." The more explicit you are about *where* things go, the less the agent will guess.

**Struggle: CI takes too long.**
Start simple. Don't try to run a full integration test suite in Phase 1. Focus on lint + unit tests + build. You'll add integration tests, structural tests, and security scans in later phases.

**Struggle: The agent doesn't write tests.**
Add this to AGENTS.md explicitly: "Every PR MUST include tests. PRs without tests will be rejected." If the agent still skips tests, make it a CI gate: add a check that verifies every changed source file has a corresponding test file.

---

## Phase 2: Core Practices (Weeks 2–3)

**Goal:** Add the mechanical enforcement that makes agent-generated code reliable.

### Week 2: Custom Linters

Write 3–5 custom linter rules targeting the most common agent failure modes you observed in Phase 1:

**Priority linters to implement first:**

1. **Dependency direction** — Enforce layer architecture
2. **File size limit** — No file exceeds 300 lines
3. **Structured logging** — All logging calls use structured format
4. **Error handling** — All catch blocks include remediation
5. **No direct database access outside data layer** — Enforce module boundaries

```javascript
// Example: dependency-direction linter (ESLint)
module.exports = {
  meta: { type: 'problem', severity: 'error' },
  create(context) {
    const layers = {
      'types': 1, 'config': 2, 'data': 3, 
      'services': 4, 'runtime': 5, 'ui': 6
    };
    
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        const fileLayer = context.getFilename()
          .match(/src\/(\w+)\//)?.[1];
        
        if (!fileLayer || !layers[fileLayer]) return;
        
        // Check if importing from a deeper layer
        const importLayer = source.match(/@(\w+)\//)?.[1];
        if (importLayer && layers[importLayer] > layers[fileLayer]) {
          context.report({
            node,
            message: `Layer violation: ${fileLayer} (L${layers[fileLayer]}) ` +
                     `cannot import from ${importLayer} (L${layers[importLayer]}). ` +
                     `Dependencies must flow inward.`
          });
        }
      }
    };
  }
};
```

### Week 3: Execution Plans

Create your first execution plan for a real feature. Use this template:

```markdown
# Execution Plan: [Feature Name]

## Goal
[Clear, measurable outcome]

## Tasks
- [ ] Task 1: [Description] (Scope: files to modify)
- [ ] Task 2: [Description] (Scope: files to modify)
- [ ] Task 3: [Description] (Scope: files to modify)

## Dependencies
Task 2 depends on Task 1
Task 3 depends on Task 2

## Acceptance Criteria
- [ ] All tests pass
- [ ] Linting clean
- [ ] [Feature-specific criteria]

## Verification Steps
1. Run `npm test`
2. Run `npm run lint`
3. [Manual verification steps]
```

Practice giving execution plans to the agent and observing how it follows them. Iterate on plan quality based on results.

### Week 3 Alternative: Execution Plan Alternatives

Not every task needs a formal execution plan. Here's when to use different instruction formats:

| Task Complexity | Instruction Format | Example |
|---|---|---|
| **Simple** (single file, <50 lines) | Direct prompt | "Add a `createdAt` field to the User type in `src/types/user.ts`" |
| **Medium** (2–4 files, 50–200 lines) | Structured prompt with scope | "Add email validation to the user registration flow. Modify: src/services/user-service.ts (add validation function), src/routes/user-routes.ts (add validation middleware), tests/unit/user-service.test.ts (add tests)." |
| **Complex** (5+ files, 200+ lines) | Full execution plan | Create a plan document in `docs/execution-plans/` |
| **Exploratory** (unknown scope) | Phased prompt | "Investigate the authentication flow and propose improvements. Start by reading the current implementation, then propose a plan before making changes." |

The mistake most teams make is either over-planning simple tasks (wasting time) or under-planning complex ones (getting poor results). Match the instruction format to the task complexity.

### Phase 2 Deliverables Checklist

```
Phase 2 Completion Checklist

Custom Linters:
  □ Dependency direction linter implemented and tested
  □ File size limit linter implemented and tested
  □ At least 1 more linter rule implemented
  □ All linters run in CI
  □ All linters have clear, actionable error messages

Execution Plans:
  □ Execution plan template created in docs/execution-plans/
  □ At least 1 real execution plan created for a feature
  □ Agent has successfully followed an execution plan
  □ Plan quality has been iterated based on results

Agent Proficiency:
  □ Agent correctly follows directory structure 90%+ of the time
  □ Agent writes tests for new code 80%+ of the time
  □ Agent-generated code passes CI 70%+ of the time
  □ Team has established prompt patterns that work reliably

Process:
  □ Team has a clear process for creating and assigning tasks to agents
  □ Code review process adapted for agent-generated PRs
  □ Retrospective held to review Phase 2 learnings
```

---

## Phase 3: Maturity (Weeks 4–8)

**Goal:** Build the self-sustaining harness that supports Level 3+ autonomy.

### Structural Tests

Write tests that verify architectural invariants:

```typescript
// tests/structural/dependency-graph.test.ts
describe('Dependency Graph', () => {
  it('should have no circular dependencies', () => {
    const graph = buildDependencyGraph('src/');
    const cycles = detectCycles(graph);
    expect(cycles).toHaveLength(0);
  });
  
  it('should enforce layer ordering', () => {
    const violations = checkLayerOrdering('src/', LAYER_CONFIG);
    expect(violations).toHaveLength(0);
  });
  
  it('should have test files for all source files', () => {
    const sourceFiles = glob.sync('src/**/*.ts', { ignore: ['**/*.test.ts'] });
    const testFiles = glob.sync('tests/**/*.test.ts');
    
    const missingTests = sourceFiles.filter(src => {
      const expected = src.replace('src/', 'tests/').replace('.ts', '.test.ts');
      return !testFiles.includes(expected);
    });
    
    expect(missingTests).toHaveLength(0);
  });
});
```

### Self-Review Process

Implement the self-correction loop (the "Ralph Wiggum Loop" from Chapter 13): the agent completes a task, runs tests, reads failures, fixes them, and repeats until tests pass. Then it reviews its own diff for style compliance, checks scope adherence, and generates a PR description with context. This loop is the single most impactful quality gate in the harness — it catches 80%+ of issues before human review.

### Legibility Improvements

Add agent-legible infrastructure:

- Structured logging with JSON format and correlation IDs
- Health check endpoints with dependency status
- OpenAPI documentation for all API endpoints
- Data-testid attributes for all UI components
- Error messages with remediation guidance

### Week 4–5: Expanding the Linter Suite

By this point, your agents have been producing code for 3+ weeks. You should have enough data to identify patterns in what they get wrong. Review the CI failure logs from Phase 2 and ask:

1. **What are the top 5 CI failure reasons?** Each one is a candidate for a new linter rule.
2. **What patterns does the self-review miss?** These are gaps in the checklist.
3. **Where do agents consistently produce suboptimal code?** These are candidates for structural tests.

Common Phase 3 linter additions:

```javascript
// Example: no-unsafe-error-handling linter
// Catches: catch blocks that swallow errors without remediation
module.exports = {
  meta: { type: 'problem', severity: 'error' },
  create(context) {
    return {
      CatchClause(node) {
        const body = node.body.body;
        // Check if catch block only has console.log/console.error
        const onlyLogs = body.every(stmt => 
          stmt.type === 'ExpressionStatement' &&
          stmt.expression.callee &&
          stmt.expression.callee.object &&
          stmt.expression.callee.object.name === 'console'
        );
        
        if (onlyLogs || body.length === 0) {
          context.report({
            node,
            message: 'Catch block must either rethrow, return an error result, ' +
                     'or log with remediation context. Silent error swallowing is not allowed.'
          });
        }
      }
    };
  }
};
```

```javascript
// Example: consistent-error-response linter
// Catches: API error responses that don't follow the standard format
module.exports = {
  meta: { type: 'suggestion', severity: 'warn' },
  create(context) {
    return {
      ReturnStatement(node) {
        // Check for error response objects
        if (node.argument && node.argument.type === 'ObjectExpression') {
          const props = node.argument.properties.map(p => p.key?.name);
          if (props.includes('error') && !props.includes('remediation')) {
            context.report({
              node,
              message: 'Error responses should include a "remediation" field. ' +
                       'Pattern: { error: string, code: string, remediation: string }'
            });
          }
        }
      }
    };
  }
};
```

### Week 6–7: Execution Plan Evolution

By Week 6, your execution plans should be more sophisticated. Move beyond simple task lists to include:

```markdown
# Execution Plan: User Password Reset Flow

## Goal
Implement a secure password reset flow with email verification, 
rate limiting, and audit logging.

## Context
- Users can request a password reset via POST /auth/reset-password
- A time-limited token is sent to their email
- They verify via POST /auth/confirm-reset with the token and new password
- Rate limit: 3 requests per email per hour
- All attempts are logged for security auditing

## Architecture Decision
- Tokens stored in a dedicated `password_reset_tokens` table
- Tokens expire after 15 minutes
- Old tokens are invalidated when a new one is requested

## Tasks

### Task 1: Database Schema (Scope: prisma/schema.prisma, src/data/)
- [ ] Add PasswordResetToken model
- [ ] Create migration
- [ ] Add data access functions: createToken, findValidToken, markTokenUsed
- Dependencies: None (start here)

### Task 2: Token Generation Service (Scope: src/services/auth-service.ts)
- [ ] Add generateResetToken function
- [ ] Add validateResetToken function
- [ ] Add resetPassword function
- [ ] Rate limiting logic (3 per hour per email)
- Dependencies: Task 1

### Task 3: API Routes (Scope: src/routes/auth-routes.ts)
- [ ] POST /auth/reset-password endpoint
- [ ] POST /auth/confirm-reset endpoint
- [ ] Input validation with Zod schemas
- [ ] Error handling with remediation messages
- Dependencies: Task 2

### Task 4: Email Integration (Scope: src/services/email-service.ts)
- [ ] Add sendPasswordResetEmail function
- [ ] Use existing email template infrastructure
- Dependencies: Task 2 (needs token)

### Task 5: Tests (Scope: tests/)
- [ ] Unit tests for auth-service token functions
- [ ] Unit tests for rate limiting
- [ ] Integration tests for API endpoints
- [ ] Edge cases: expired token, already-used token, wrong token
- Dependencies: Tasks 1–4

## Acceptance Criteria
- [ ] User can request password reset and receive email
- [ ] User can reset password with valid token
- [ ] Rate limiting prevents abuse (>3 requests/hour returns 429)
- [ ] Expired tokens are rejected
- [ ] All attempts logged with user ID, timestamp, and outcome
- [ ] All tests pass
- [ ] All linters pass

## Security Review Required
This plan touches authentication. Mark PR as Tier 3 review.
Require @security-team approval per CODEOWNERS.
```

Notice how this plan includes context, architecture decisions, explicit dependencies, security considerations, and a clear definition of done. This level of detail enables Level 3 autonomy — the agent can work through the tasks independently while the human reviews the architecture decision and security implications.

### Phase 3 Deliverables Checklist

```
Phase 3 Completion Checklist

Structural Tests:
  □ No circular dependencies test
  □ Layer ordering test
  □ Test coverage completeness test
  □ At least 1 domain-specific structural test

Self-Review:
  □ Self-review checklist in AGENTS.md
  □ Agent runs self-review before PR submission
  □ Self-review catches 80%+ of issues that CI would catch

Linter Suite:
  □ 10+ custom linter rules
  □ All linters have clear error messages with remediation
  □ Linters cover: dependency direction, file size, logging, error handling, boundaries

Execution Plans:
  □ Template established and used
  □ 3+ real execution plans created
  □ Plans include context, dependencies, and acceptance criteria

Legibility:
  □ Structured logging implemented
  □ Health check endpoints with dependency status
  □ API documentation (OpenAPI or equivalent)
  □ Error messages include remediation guidance

Agent Proficiency:
  □ Agent-generated code passes CI 85%+ of the time
  □ Agent operating at Level 2–3
  □ Self-review reduces CI failures by 50%+
```

### Week 8–10: Advanced Multi-Agent Patterns

As your team grows comfortable with single-agent workflows, introduce multi-agent coordination. The key is to start with the simplest pattern — batch parallel — and only add complexity when needed.

**Pattern 1: Batch Parallel (Start Here)**

The simplest multi-agent pattern: decompose a feature into independent tasks, assign each to a separate agent in its own worktree, merge sequentially.

```bash
# Batch parallel: feature broken into 3 independent tasks
# Task 1: Add types (no dependencies)
git worktree add ../feature-types feature/types
# Task 2: Add data layer (no dependencies)
git worktree add ../feature-data feature/data
# Task 3: Add service layer (depends on 1 and 2 — run after)
git worktree add ../feature-services feature/services

# Run Task 1 and Task 2 in parallel
codex --worktree ../feature-types "Add Order types to src/types/order.ts"
codex --worktree ../feature-data "Add Order data access in src/data/order-repository.ts"

# After both merge, run Task 3
codex --worktree ../feature-services "Add Order service using types and data layer"
```

**Pattern 2: Coordinator/Specialist/Verifier**

For more complex features, use the three-role pattern from Chapter 13:

```
Coordinator agent:
  1. Read the execution plan
  2. Decompose into specialist tasks
  3. Assign tasks to specialist agents
  4. Monitor progress
  5. Assign verification to verifier agent

Specialist agent(s):
  1. Receive scoped task
  2. Implement within scope
  3. Run tests locally
  4. Submit PR

Verifier agent:
  1. Review all PRs for the feature
  2. Run integration tests
  3. Check for consistency across PRs
  4. Flag issues for human review
```

**Pattern 3: Ralph Wiggum Loop at Scale**

Apply the self-correction loop from Chapter 13 to multi-agent workflows: if a specialist agent fails, create a fresh worktree and retry with the failure context injected as additional instructions. The key is *not* to debug in-place — start clean with more information.

### Week 10+: Autonomy Graduation Protocol

Moving between autonomy levels should be deliberate and data-driven. The full autonomy spectrum is defined in Chapter 18; the graduation criteria below are the practical checkpoints for this harness:

```
Autonomy Graduation Protocol

Level 2 → Level 3:
  Prerequisites:
    □ Agent pass rate at Level 2: >70%
    □ Self-review catches >80% of CI failures
    □ At least 10 custom linter rules enforced
    □ Structural tests for all key architectural invariants
    □ Execution plan process established and working
  
  New capabilities unlocked:
    □ Agent can run self-correction loops (max 3 iterations)
    □ Agent can create its own execution plans (human reviews before execution)
    □ Agent can initiate PRs without being explicitly told to

Level 3 → Level 4:
  Prerequisites:
    □ Agent pass rate at Level 3: >80%
    □ Quality score average: >75/100
    □ Multi-agent patterns working for parallel tasks
    □ GC agents running (Quality Scorer, Doc Gardener)
    □ No production incidents caused by agent-generated code in the last month
  
  New capabilities unlocked:
    □ Agent can work on tasks with minimal supervision
    □ Agent can debug its own CI failures
    □ Agent can handle multi-step features spanning 5+ files
    □ Multi-agent orchestration for complex features

Level 4 → Level 5:
  Prerequisites:
    □ Agent pass rate at Level 4: >90%
    □ Quality score average: >85/100
    □ Full GC suite operational and self-regulating
    □ Entropy budget defined and maintained
    □ Zero critical production incidents from agent code in 3+ months
  
  New capabilities unlocked:
    □ Agent-initiated features (agent identifies improvements and proposes them)
    □ Agent-driven refactoring at scale
    □ Autonomous bug fixing with monitoring integration
```

**Do not skip levels.** See Chapter 18 for the full trust gradient and the consequences of premature autonomy.

### Garbage Collection

Implement recurring agents for entropy management using the GC agent patterns from Chapter 22 (Quality Scorer on every PR, Doc Gardener daily, Dead Code Hunter weekly). The specific schedules and configurations are detailed there.

### Multi-Agent Patterns

Set up worktree-based parallel development using the patterns described earlier in this chapter (batch parallel, coordinator/specialist/verifier). For the full multi-agent architecture, see Chapter 13.

### Autonomy Increase

Gradually increase autonomy using the graduation protocol described earlier in this chapter. The key principle from Chapter 18 applies: trust is earned through demonstrated pass rates, not declared by fiat. Do not advance to the next level until your current-level pass rate exceeds 80%.

---

## The Minimum Viable Harness (5 Components)

If you only have time for five things, do these:

1. **AGENTS.md** — 50–100 lines of clear, imperative instructions
2. **CI pipeline** — Tests, linters, build verification on every PR
3. **3 custom linter rules** — Target the most common agent failure modes
4. **Directory structure** — Clear, enforced layer architecture
5. **Execution plan template** — Standardized task decomposition

With these five components, you have enough infrastructure for Level 2–3 autonomy. Everything else builds on this foundation.

---

## Common Pitfalls (7 Anti-Patterns)

### 1. The Encyclopedia AGENTS.md

Writing a 1,000-line AGENTS.md that tries to document everything. The agent won't read it all, and it'll be stale within a week. Keep it under 100 lines. Point to docs/ for details.

**The fix:** Write a 50–100 line AGENTS.md that serves as a table of contents. It should contain: project overview, architecture summary, build/test/lint commands, code style rules, testing conventions, and PR conventions. Everything else goes in docs/ where it can be more detailed and more easily maintained.

**The AGENTS.md smell test:** If a new team member couldn't read your AGENTS.md in 2 minutes and start working productively with the agent, it's either too long (encyclopedia) or too vague (no useful information).

### 2. No CI Enforcement

Writing linter rules but not running them in CI. If the agent can generate code that doesn't pass CI, it will — every time. Make CI the source of truth.

**The fix:** Every linter rule must run in CI. Every PR must pass CI before merging. If a linter rule is worth writing, it's worth enforcing. Linter rules that exist only locally are linter rules that don't work.

**The CI-first development pattern:** Before writing a new linter rule, ask: "How will this be enforced in CI?" If the answer is "it won't," either find a way to enforce it or reconsider whether it's a principle or a guideline.

### 3. Vague Prompts

Asking the agent to "fix the bug" or "improve performance." Be specific: "Fix the null pointer exception in src/services/user.ts:47 by adding a null check for the email field."

**The fix:** Use the specificity framework for prompts:

| Prompt Type | Example | Expected Quality |
|---|---|---|
| Vague | "Fix the bug" | 10–30% success rate |
| Specific | "Fix the null pointer in user.ts by adding null check" | 60–80% success rate |
| Contextual | "Fix the null pointer in user.ts:47. The email field comes from the API and can be null. Return a 400 error with remediation message." | 80–95% success rate |
| Plan-based | "Follow execution plan in docs/plans/fix-user-null.md" | 90–99% success rate |

The more specific and contextual the prompt, the higher the success rate. At Level 3+, prompts become execution plans — the most specific and contextual form of instruction.

### 4. Skipping the Harness

Letting agents write code without linters, tests, or architectural constraints. This works for a prototype and fails catastrophically at scale.

**The fix:** Even for prototypes, invest 2 hours in the minimum viable harness: AGENTS.md + basic CI + directory structure. The harness doesn't need to be perfect — it needs to exist. You can always improve it later, but you can't retroactively add structure to code that was written without any.

### 5. Review Fatigue

Reviewing every agent PR line-by-line. Use the tiered review system from Chapter 21 (auto-approve low-risk changes, focus human review on high-risk changes) and the blast radius heuristic from Chapter 18 to classify PRs into tiers. Without tiered review, human reviewers become the bottleneck that negates the agent's speed advantage.

### 6. No Entropy Management

Ignoring the gradual accumulation of agent-driven disorder. By the time you notice, it's expensive to fix. Set up garbage collection agents from the start.

**The fix:** Deploy the Quality Scorer in Phase 1 (it runs on every PR and costs almost nothing). Deploy the Doc Gardener in Phase 3 (it runs daily and catches documentation drift). Don't wait until entropy is a problem — prevent it from becoming one.

### 7. Premature Autonomy

Jumping to Level 4–5 autonomy before the harness is ready. This results in agents producing code that looks impressive but fails in subtle ways. Earn each level through demonstrated competence.

**The fix:** Follow the trust gradient from Chapter 18. Start at Level 1. Track your agent pass rate. Don't advance to Level 2 until the pass rate at Level 1 is >70%. Don't advance to Level 3 until the pass rate at Level 2 is >70%. The progression feels slow, but it's faster than jumping ahead and dealing with the cleanup.

## The Harness Maturity Roadmap

Beyond the four phases, here's how the harness evolves over time. Use this roadmap to set expectations with leadership and track your team's progress objectively:

### Month 1: Survival
- AGENTS.md created and iterated (expect 5–10 revisions)
- CI pipeline running on every PR
- 3–5 custom linter rules
- Agent operating at Level 1–2
- Team learning to write effective prompts
- First execution plan created and tested
- **Throughput gain:** 2–3x
- **Key risk:** Team frustration with agent mistakes. Mitigate by celebrating small wins.

### Month 2: Stability
- Execution plan template established and used for all complex tasks
- 10+ custom linter rules covering the top failure modes
- Structural tests for key architectural invariants
- Agent operating at Level 2–3
- Quality Scorer running on every PR
- Self-review checklist in AGENTS.md
- **Throughput gain:** 3–5x
- **Key risk:** Over-investment in linters at the expense of feature work. Mitigate by setting a linter budget (max 2 hours per week on linter development).

### Month 3: Maturity
- Self-review pattern operational and catching 80%+ of issues
- Doc Gardener running daily
- Agent operating at Level 3
- Multi-agent patterns for parallel work on at least one feature
- Entropy budget defined and tracked
- Brownfield codebase migration underway (if applicable)
- **Throughput gain:** 5–10x
- **Key risk:** Complacency — the harness works well enough that the team stops improving it. Mitigate by scheduling a monthly harness review.

### Month 6: Scale
- Full garbage collection suite operational (Quality Scorer, Doc Gardener, Dead Code Hunter, Pattern Detector)
- Agent operating at Level 3–4
- Multi-agent orchestration for large features (coordinator/specialist/verifier pattern)
- Harness maturity score >60
- Entropy management self-regulating
- Platform-agnostic harness proven (can switch agents without retooling)
- **Throughput gain:** 10–20x
- **Key risk:** Organizational scaling challenges — new team members need onboarding. Mitigate by creating an "agent-first onboarding guide" based on your harness.

### Year 1: Mastery
- Agent operating at Level 4–5 for most tasks
- Fully self-regulating entropy management
- Harness maturity score >80
- Organization functioning as an agent-first factory
- Other teams in the organization adopting your harness pattern
- **Throughput gain:** 3–20× depending on task type (repetitive implementation skews higher; novel architecture skews lower)
- **Key risk:** Over-reliance on agents for tasks that genuinely need human creativity and judgment. Mitigate by identifying which tasks are "agent-appropriate" and which aren't.

## Appendix: Copy-Paste AGENTS.md Template

```markdown
# AGENTS.md — [Project Name]

## Overview
[One paragraph: what this project does, who uses it, what tech stack]

## Architecture
- **Pattern:** [Monolith / Microservices / Serverless]
- **Language:** [TypeScript/Python/Go/etc.]
- **Framework:** [Express/FastAPI/Gin/etc.]
- **Database:** [PostgreSQL/MongoDB/etc.]
- **Dependency layers:** Types → Config → Data → Services → Runtime → UI
- **Rule:** Dependencies flow inward only. UI never imports Data.

## Commands
- `npm test` — Run all tests
- `npm run lint` — Run linters (must pass before PR)
- `npm run build` — Build for production
- `npm run dev` — Start dev server
- `npm run test:watch` — Run tests in watch mode

## Code Style
- [Language] strict mode enabled
- All functions have explicit [return types/type annotations]
- Use structured logging: `logger.info({ userId, action }, message)`
- Error handling: always include remediation guidance in error messages
- No file exceeds 300 lines
- No function exceeds 40 lines

## Testing
- Every source file has a corresponding test file
- Use describe/it pattern with descriptive names
- Test happy path AND error cases
- Integration tests for all API endpoints
- Run `npm test` before submitting any PR

## PR Conventions
- Title: [area] description (e.g., "[auth] add refresh token rotation")
- Include context: what changed, why, how to verify
- All linters and tests must pass
- No direct pushes to main
- Max 500 lines changed per PR (split larger changes)

## Security
- Never commit secrets (use environment variables)
- All external inputs are validated
- Use parameterized queries for database access
- See docs/security.md for detailed guidelines

## Golden Principles
1. No file exceeds 300 lines
2. No circular dependencies
3. All errors have remediation messages
4. All logging is structured (JSON)
5. Test files mirror source files
6. Comments describe why, not what
```

Adjust this template to your project's specific needs. The key is that it's concise (under 100 lines), imperative (tells the agent what to do), and actionable (contains commands the agent can run).

### The Anti-Pattern Deep Dives

Each of the seven anti-patterns deserves more than a brief description. Let's examine what each one looks like in practice and how to recover if you've already fallen into the trap.

#### Anti-Pattern 1 Recovery: The Encyclopedia AGENTS.md

**How to tell if you have this problem:** Your AGENTS.md is over 200 lines. Agents still make mistakes that are "documented" in the file. Engineers complain that "the agent never follows the rules."

**The recovery process:**

1. **Audit your current AGENTS.md.** Highlight every line that describes *what to do* in yellow and every line that describes *how to verify it* in green.
2. **Move all yellow lines to docs/.** The detailed explanations belong in `docs/conventions/` or `docs/architecture.md`.
3. **Keep only green lines plus a table of contents.** Your AGENTS.md should say "Do X" (imperative) and point to `docs/why-we-do-x.md` for the explanation.
4. **Verify the agent reads it.** Give the agent a test task and ask it to confirm it understood the instructions. If it can't summarize the key rules, the file is still too long.

**The 80/20 rule:** 80% of agent compliance comes from 20% of the instructions. Find the 20% — build commands, testing requirements, directory structure, dependency rules — and make those prominent. Everything else is supporting detail.

#### Anti-Pattern 4 Recovery: Skipping the Harness

**How to tell if you have this problem:** You've been using agents for 2+ months without custom linters. Code review is the only quality gate. Engineers are spending significant time reviewing agent output and finding the same categories of issues repeatedly.

**The recovery process:**

1. **Collect the last 50 code review comments** on agent-generated PRs.
2. **Categorize them.** Group by type: style violations, missing tests, architecture violations, edge cases, error handling.
3. **Pick the top 3 categories.** These are your first three linter rules.
4. **Implement them as linters, not guidelines.** If it's worth commenting on in code review, it's worth encoding as a mechanical check.
5. **Add them to CI.** Every new PR must pass these three checks.
6. **Retroactively fix the existing violations.** Use an agent task: "Fix all violations of the new linter rules in the existing codebase."

This recovery typically takes 1–2 weeks and produces an immediate improvement in agent output quality. The feedback loop is powerful: the linter catches the issue, the agent learns from the linter error message, and the next PR doesn't have the same problem.

#### Anti-Pattern 7 Recovery: Premature Autonomy

**How to tell if you have this problem:** You enabled Level 3+ autonomy early and now have production incidents, growing technical debt, or a codebase that's becoming harder to maintain. Engineers are losing trust in the agents.

**The recovery process:**

1. **Dial back to Level 2 immediately.** This means every agent PR requires human approval before merging. Yes, this will slow throughput. That's the point — you're rebuilding trust.
2. **Audit the last 30 days of agent-generated code.** Identify the patterns that caused problems. Were they architectural violations? Missing edge cases? Over-abstraction?
3. **Encode the findings as linters and structural tests.** Every problem you found is a gap in the harness. Close the gaps.
4. **Run the agent pass rate test.** Give the agent 20 tasks at Level 2 and track how many pass CI on the first attempt. If the rate is below 70%, your harness isn't ready for Level 3.
5. **Re-graduate gradually.** Follow the autonomy graduation protocol. Move to Level 3 only when the pass rate exceeds 80%.

The key insight: **trust is earned, not declared.** You don't decide to give agents more autonomy — the data tells you when they're ready.

## Measuring Harness Effectiveness

How do you know if your harness is actually working? Track these key metrics across all four phases:

### Phase 1 Metrics (Week 1)
- **Agent task completion rate:** Can the agent complete a simple task end-to-end? Target: 100% for basic tasks.
- **AGENTS.md comprehension:** Does the agent correctly follow the directory structure and conventions? Target: >80% compliance.
- **CI setup time:** How long did it take to get CI running? Target: <2 hours.

### Phase 2 Metrics (Weeks 2–3)
- **First-pass CI rate:** What percentage of agent PRs pass CI on the first attempt? Target: >50%.
- **Linter effectiveness:** What percentage of CI failures are caught by your custom linters? Target: >40%.
- **Execution plan adherence:** Does the agent follow the execution plan? Target: >70% task completion within scope.

### Phase 3 Metrics (Weeks 4–8)
- **First-pass CI rate:** Target: >70%.
- **Self-review catch rate:** What percentage of potential CI failures does the self-review catch before submission? Target: >80%.
- **Quality score trend:** Is the average quality score increasing week over week? Target: +5 points/week during Phase 3.

### Phase 4 Metrics (Weeks 8+)
- **Agent autonomy level:** What's the highest autonomy level at which your agents can operate reliably? Target: Level 3+.
- **Entropy indicators:** Are codebase health metrics (cyclomatic complexity, file count, dependency count) stable or improving? Target: stable or decreasing.
- **Multi-agent throughput:** Can you run 3+ agents in parallel without conflicts? Target: >80% conflict-free merges.

If metrics plateau or decline, it's a signal that the harness needs strengthening. The most common cause of declining metrics is entropy — the gradual accumulation of patterns that the harness doesn't yet enforce. Each plateau is an opportunity to add a new linter rule, structural test, or execution plan template.

---

## Tool Recommendations

### Agents
- **Starting out:** GitHub Copilot (lowest barrier) or Claude Code (most configurable)
- **Serious harness work:** OpenAI Codex or Claude Code with Agent SDK
- **Autonomous tasks:** Devin for well-defined, bounded tasks
- **Budget-conscious:** Aider (open-source, git-native, supports multiple models)

### Linting
- **JavaScript/TypeScript:** ESLint with custom rules (use `@typescript-eslint/utils` for AST-based rules)
- **Python:** Ruff with custom plugins (fast, Rust-based, replaces flake8 + isort + black)
- **Go:** Go/ast-based custom analyzers (compile into `golangci-lint` plugins)
- **Cross-language:** Semgrep for pattern-based rules (supports 30+ languages without compilation)
- **Architecture-level:** Custom structural tests using dependency analysis tools (dependency-cruiser for JS/TS, import-linter for Python)

### Testing
- **Unit:** Jest/Vitest (JS/TS), pytest (Python), Go testing
- **Integration:** Supertest (API), Playwright (E2E)
- **Structural:** Custom tests using ts-morph (TS), ast (Python), go/ast (Go)
- **Property-based:** fast-check (JS/TS), hypothesis (Python) — excellent for finding edge cases in agent-generated code
- **Contract testing:** Pact for microservices API contracts

### CI/CD
- **GitHub Actions:** Best GitHub integration, largest ecosystem, free for public repos
- **CircleCI:** Good for complex pipelines with Docker-based workflows
- **Buildkite:** Good for large-scale, self-hosted runners with fine-grained control
- **Merge queue tools:** Mergify, GitHub merge queues, Graphite

### Documentation
- **AGENTS.md:** Agent instructions (in-repo, first priority)
- **Markdown docs:** docs/ directory (in-repo, second priority)
- **API docs:** OpenAPI/Swagger for REST, GraphQL schema docs
- **Architecture decision records:** docs/adr/ for significant design decisions
- **External:** Notion/Confluence for team-level process documentation (external, agent-inaccessible)

### Monitoring and Metrics
- **Quality tracking:** Custom quality score scripts (see Chapter 22 for the scoring framework)
- **Token cost tracking:** Platform-native dashboards + custom aggregation
- **Entropy indicators:** Custom scripts for codebase health metrics (file count trends, cyclomatic complexity trends, dependency count trends)

---

## The Cost of Not Building a Harness

Before we get to the health check and getting-started guide, let's address the question that some teams will inevitably ask: "What happens if we just use agents without building a harness?"

The answer is: you'll see initial productivity gains that plateau and then reverse. Here's the typical trajectory of a no-harness team:

### Month 1: The Honeymoon
Engineers are excited. Agents produce code quickly. PR velocity increases 3–5x. Everyone is optimistic. A few concerning patterns emerge — inconsistent error handling, duplicated utility functions, some tests that don't actually test anything meaningful — but the velocity is intoxicating.

### Month 2: The Plateau
PR velocity stays high, but the merge rate starts to slow. Why? Code review is taking longer because the code is harder to understand. Engineers are spending more time fixing subtle bugs in agent-generated code. The codebase is growing but not cohering — it's becoming harder for agents (and humans) to understand how the pieces fit together.

### Month 3: The Decline
The team is now spending 30–40% of its time on activities that a harness would have prevented: fixing recurring bug patterns, manually checking code quality, resolving architectural drift, and rewriting agent-generated code that doesn't follow consistent patterns. PR velocity drops back to near-baseline, but now the codebase is larger and harder to maintain than before.

### Month 6: The Reckoning
The codebase has accumulated significant technical debt. Onboarding new engineers is difficult because the code doesn't follow consistent patterns. Agents produce lower-quality output because the context they read is inconsistent and confusing. The team either invests heavily in cleanup (which takes weeks) or abandons agent-first development as "not ready for prime time."

**The cost of the harness** (Phase 1: 1 week, Phase 2: 2 weeks) is paid once. **The cost of not having a harness** compounds every week. This is why Chapter 2 argued that "boring technology wins" — the harness isn't exciting, but it's what separates sustainable agent-first development from a brief productivity spike followed by regret.

### The ROI Timeline

Here's when the harness investment pays off, based on teams that have followed this approach:

| Timeframe | With Harness | Without Harness |
|---|---|---|
| **Week 1** | Slight dip (setup time) | 3–5x productivity spike |
| **Week 2–3** | 3–5x productivity, improving quality | 3–5x productivity, quality concerns emerging |
| **Week 4–8** | 5–10x productivity, sustainable | 2–3x productivity, review overhead growing |
| **Month 3** | 8–15x productivity, self-reinforcing | 1–2x productivity, cleanup beginning |
| **Month 6** | 10–20x productivity, scaling | 0.5–1x productivity, technical debt crisis |

The crossover point — where the harnessed team surpasses the unharnessed team's cumulative output — is typically around Week 6. After that, the gap widens dramatically.

---

---

¹ "How Claude P Silently Inflates Your Pipeline Token Costs," dontcodethisathome.com, 2026. https://dontcodethisathome.com/how-claude-p-silently-inflates-your-pipeline-token-costs

---

## Key Takeaways

- **You can start in 60 minutes.** Create AGENTS.md, set up CI, install an agent platform, run a test task. The "Quick Start" section earlier in this chapter walks you through it step by step.
- **Four phases over 8+ weeks:** Foundation → Core Practices → Maturity → Scale. Don't skip phases — each builds on the trust and infrastructure of the previous one.
- **Start with the minimum viable harness:** AGENTS.md, CI, 3 linter rules, directory structure, execution plan template. These five components enable Level 2–3 autonomy.
- **Invest in the harness, not the platform.** The harness is platform-agnostic and compounds in value. Platforms come and go; your harness persists.
- **Brownfield migration is possible** — the harness grows from the edges inward using the "strangler fig" pattern. New code follows the harness; existing code migrates incrementally.
- **The cost of not building a harness compounds.** Without it, teams see a 3–5× spike followed by a decline to baseline or below. The crossover point is around Week 6.
- **Avoid the 7 anti-patterns:** encyclopedia AGENTS.md, no CI enforcement, vague prompts, skipping the harness, review fatigue, no entropy management, premature autonomy.
- **Measure relentlessly:** agent pass rate (>80% target), quality score trend (increasing), human rework rate (<15%). If metrics plateau, strengthen the harness.
- **Onboard new engineers in 5 days** with the structured program in the Team Onboarding Guide section above.

## The Team Onboarding Guide

When new engineers join an agent-first team, they need a different onboarding experience than traditional teams. Here's a structured onboarding plan:

### Day 1: Understand the Harness
- Read AGENTS.md (it's under 100 lines — this should take 10 minutes)
- Read docs/architecture.md (the full architecture overview)
- Walk through the CI pipeline configuration
- Review 5 recent agent-generated PRs to see what good output looks like

### Day 2: Use the Agent
- Set up the agent platform (Claude Code, Codex, or Copilot)
- Complete a simple task: "Add a new field to an existing type with tests"
- Watch how the agent reads AGENTS.md, follows conventions, and writes tests
- Review the agent's output against the self-review checklist

### Day 3: Write an Execution Plan
- Pick a real feature from the backlog
- Write an execution plan using the template
- Have the agent execute the plan
- Review the results and iterate on plan quality

### Day 4: Review and Linters
- Review 10 agent-generated PRs using the tiered review system
- Learn the custom linter rules and how to read their error messages
- Write one new linter rule (with help from a harness engineer)

### Day 5: Independence
- Complete a full feature independently: plan → agent execution → review → merge
- Participate in a harness retrospective
- Identify one improvement to the harness and propose it

This 5-day onboarding produces engineers who can work effectively within the harness from their second week. Compare this to traditional onboarding that often takes 2–4 weeks before a new engineer is productive.

---

## The Harness Health Check

After Phase 4, your harness should pass this health check:

```
Harness Health Check

□ AGENTS.md
  □ Under 100 lines
  □ Contains build/test/lint commands
  □ Contains architecture summary
  □ Contains code style rules
  □ Points to docs/ for details

□ CI Pipeline
  □ Runs on every PR
  □ Runs all tests
  □ Runs all linters
  □ Runs build verification
  □ Completes in <15 minutes

□ Linter Rules
  □ Dependency direction enforced
  □ File size limit (300 lines)
  □ Structured logging enforced
  □ Error handling pattern enforced
  □ Dead export detection

□ Structural Tests
  □ No circular dependencies
  □ Layer ordering verified
  □ Test coverage for all source files
  □ API response schema verified

□ Agent Configuration
  □ Reads AGENTS.md
  □ Runs tests after code generation
  □ Self-reviews before PR
  □ Scope constraints configured
  □ Iteration limit set (3–5)

□ Garbage Collection
  □ Quality Scorer runs on every PR
  □ Doc Gardener runs daily
  □ At least 2 other GC agents running weekly

□ Metrics
  □ Agent pass rate tracked weekly
  □ Quality scores tracked per PR
  □ Entropy indicators monitored
  □ Cost per PR tracked monthly
```

## The Brownfield Harness: Migrating an Existing Codebase

Most teams don't have the luxury of starting from an empty repository. You have 200,000 lines of code, five years of accumulated patterns, three different architectural eras, and a team that's skeptical of yet another process change. The greenfield approach in the rest of this chapter won't work for you — at least not directly.

This section presents a four-phase migration strategy specifically designed for existing codebases. It uses the "strangler fig" pattern: new growth wraps around the old, gradually replacing it module by module. The harness grows from the edges inward, and the codebase becomes progressively more agent-friendly over time.

Shopify used a similar approach when building their plugin architecture — rather than rewriting their monolith, they built new functionality as plugins that worked within existing workflows, gradually expanding the plugin boundary outward. The same principle applies here: don't fight the legacy, envelop it.

### Phase 1 (Week 1): Measure and Seed

Before writing a single linter rule, you need to understand the territory. This week is about measurement, not enforcement.

**Map the architecture as it actually exists.** Not as the architecture docs say it should be — as it actually is. Run a dependency analysis tool (dependency-cruiser for JavaScript/TypeScript, import-linter for Python, go/ast for Go) and generate a map of the real dependency graph. You'll likely find circular dependencies, cross-layer imports, and modules that serve multiple purposes. Document all of this. You need to know the starting position before you can plan the journey.

**Identify the hot spots.** Which files change most frequently? Which modules have the highest bug rate? Where do code review discussions get most heated? These are where agents will spend the most time — and where the harness needs to be strongest. Prioritize these modules for early migration.

**Catalog existing tests.** What test coverage exists? Are the tests deterministic? Do they run in under 10 minutes? Can you run them in CI? This establishes your verification baseline. If test coverage is below 40%, you'll need to add basic coverage before agents can be trusted to modify code safely.

**Measure the current state with concrete numbers.** Record:
- Total lines of code, total files
- Number of files over 300 lines
- Number of circular dependencies
- Test coverage percentage
- Average PR review time
- Average PR size (lines changed)

These numbers become your baseline. Every migration phase should move them in the right direction.

**Create AGENTS.md for one service.** Pick the service that changes most frequently — the one where agent assistance would have the most immediate impact. Write AGENTS.md specifically for that service, including an explicit legacy exemption:

```markdown
# Legacy Exemptions
The following directories follow historical conventions and are exempt
from the rules below until they are migrated:
- src/legacy-auth/ (to be migrated in Phase 3)
- src/legacy-payments/ (to be migrated in Phase 4)

All NEW code must follow the rules in this file, regardless of which
module it lives in.
```

**Run linters in warn mode only.** Implement your first 3–5 linter rules, but set them all to `warn` severity. Run them in CI as informational — they won't block PRs, but they will produce reports. This gives you two things: a count of existing violations (your technical debt inventory) and a way to ensure new code doesn't add to the debt.

**Phase 1 deliverables:**
```
□ Dependency map generated and documented
□ Hot spot modules identified (top 5 by change frequency + bug rate)
□ Test coverage baseline recorded
□ Concrete metrics baseline recorded (file count, violations, coverage)
□ AGENTS.md created for one service with legacy exemptions
□ 3–5 linter rules running in warn mode in CI
□ Team briefed on the migration plan and timeline
```

### Phase 2 (Weeks 2–3): Enforce for New Code Only

The rule for Phase 2 is simple: **no new violations.** Existing violations are documented and tolerated. New code must follow the harness.

**Configure CI with a "new code only" check.** This is the key technical mechanism. Set up your linters to only enforce rules on lines that were added or modified in the PR, not on existing code. ESLint supports this with the `--diff` flag; for other tools, you can use git diff to filter violations:

```bash
# Only lint lines changed in this PR
git diff --name-only --diff-filter=ACM origin/main...HEAD | 
  grep '\.ts$' | 
  xargs npx eslint
```

This approach means that:
- A developer (or agent) modifying an existing file only needs to ensure their *new* code follows the rules
- Legacy code is not blocked from being merged
- The codebase gets incrementally cleaner with every PR

**Add structural tests for new modules.** Write tests that verify any *new* module follows the architectural rules: no circular dependencies, correct layer ordering, test files present. These tests check only newly-added modules:

```typescript
describe('New module architecture', () => {
  it('new modules have no circular dependencies', () => {
    const newModules = getModulesAddedSince('2026-01-15'); // migration start date
    const cycles = detectCyclesInModules(newModules);
    expect(cycles).toHaveLength(0);
  });
});
```

**Expand AGENTS.md to cover the full project.** Once the "new code only" pattern is working, update AGENTS.md to cover the entire project. New code everywhere now follows the harness. Legacy exemptions are explicitly listed.

**Phase 2 deliverables:**
```
□ CI enforces linter rules on new code only (using diff-based checking)
□ Structural tests active for newly-created modules
□ AGENTS.md expanded to cover full project
□ Zero new violations added to the codebase (verified by CI)
□ Team comfortable with the "new code follows rules" pattern
□ First agent task executed successfully on the brownfield codebase
```

### Phase 3 (Weeks 4–6): The Strangler Fig Expansion

Now you start bringing existing code into the harness, one module at a time. The metaphor is the strangler fig: the new pattern grows around the old, gradually replacing it.

**Select migration targets by impact.** Prioritize modules that agents will work on most frequently. Use the hot spot analysis from Phase 1: the modules with the highest change frequency and bug rate should be migrated first.

**For each module, follow this mini-process:**

1. **Run the linter suite on the module.** Count the violations. If there are fewer than 20, fix them all in one pass (use an agent task: "Fix all linter violations in src/services/user-service.ts"). If there are more than 20, create a dedicated migration branch and fix them incrementally over 2–3 PRs.

2. **Remove the legacy exemption.** Once the module is clean, remove it from the exemption list in AGENTS.md. CI now enforces all rules for this module.

3. **Add structural tests.** Write architectural invariant tests for the migrated module. These tests ensure the module doesn't regress.

4. **Mark the module as "harness-compliant."** Add it to a `docs/harness-coverage.md` file that tracks which modules have been migrated. This creates visible progress that leadership and the team can see.

**The module migration template:**
```markdown
# Module Migration: [module-name]

## Status: [Pending | In Progress | Complete]

## Pre-migration metrics:
- Linter violations: [count]
- Test coverage: [%]
- File count: [count]
- Lines of code: [count]

## Migration steps:
- [ ] Fix all linter violations
- [ ] Remove legacy exemption from AGENTS.md
- [ ] Add structural tests for this module
- [ ] Verify CI passes with full enforcement
- [ ] Update harness-coverage.md

## Post-migration metrics:
- Linter violations: 0
- Test coverage: [%] (target: >80%)
- Agent pass rate for tasks in this module: [%]
```

**Phase 3 deliverables:**
```
□ At least 3 modules fully migrated to harness compliance
□ harness-coverage.md tracking document created and maintained
□ Each migrated module has 0 linter violations and structural tests
□ Agent tasks in migrated modules have >70% first-pass CI rate
□ Legacy exemption list in AGENTS.md shrinking (document before/after)
```

### Phase 4 (Weeks 7+): Full Enforcement

The final phase removes all legacy exemptions and brings the entire codebase under the harness.

**Promote all linter rules to error severity.** The rules that started as warnings in Phase 1 and were promoted to errors for new code in Phase 2 are now errors for all code. Every module is subject to full enforcement.

**Enable full structural test coverage.** All architectural invariant tests now run on every PR. No module is exempt.

**Set agent autonomy levels by module compliance.** Not all modules will be equally clean. Use this autonomy mapping:

| Module Compliance | Agent Autonomy | Human Review Required |
|---|---|---|
| Fully compliant (0 violations, >80% coverage) | Level 3–4 | Tier 1–2 (auto-approve or quick review) |
| Mostly compliant (<5 violations, >60% coverage) | Level 2–3 | Tier 2–3 (quick to standard review) |
| Partially migrated (5–20 violations) | Level 1–2 | Tier 3–4 (standard to deep review) |
| Not yet migrated (>20 violations) | Level 1 only | Tier 4 (deep review, every line) |

This creates a natural incentive structure: teams that maintain harness compliance get faster agent workflows and less human review overhead.

**Phase 4 deliverables:**
```
□ All legacy exemptions removed from AGENTS.md
□ All linter rules at error severity for entire codebase
□ Full structural test coverage active in CI
□ Agent autonomy levels set per module based on compliance
□ 90%+ of modules at "fully compliant" or "mostly compliant" status
□ Agent pass rate >70% across the entire codebase
```

### Brownfield Gotchas

**What to do when legacy code violates 80% of your rules.** Don't panic, and don't try to fix everything at once. Accept that the baseline is what it is. Focus on the "new code only" enforcement in Phase 2 and the module-by-module migration in Phase 3. The codebase will be measurably better every week, even if it takes 2–3 months to reach full compliance.

**How to handle third-party dependencies.** Third-party code lives in `node_modules/` or `vendor/` — exclude it from the harness entirely. But if your code wraps third-party libraries, the *wrapper* code should follow the harness rules. Add a linter rule that catches direct imports of third-party libraries outside the designated wrapper modules.

**How to deal with generated code from frameworks.** Auto-generated code (ORM models, API clients, protobuf definitions) should be excluded from most linter rules. Put generated code in a clearly marked directory (e.g., `src/generated/`) and exclude it in your linter configuration. The code that *uses* the generated code, however, must follow all harness rules.

**What to do when the team resists.** Resistance to brownfield migration usually comes from the perceived cost of fixing existing violations. Combat this with data: show the team the metrics from Phase 1 (the current state), the metrics from migrated modules (the improved state), and the agent pass rates for each. The numbers speak louder than opinions. Also, frame the migration as "making code review faster" rather than "adding more rules" — because that's exactly what it does.

**What to do when migration stalls.** If progress stalls after Phase 3, it usually means the remaining modules are too complex or too large to migrate incrementally. Consider a "quarantine" approach: move the most resistant modules into an explicitly marked `src/legacy-quarantine/` directory. These modules get Level 1 agent access and Tier 4 human review. They're not migrated, but they're contained. The rest of the codebase operates at full harness compliance.

---

> **📊 Sidebar: Token Cost Budgeting for Your Harness**
>
> One cost that catches teams off guard is the token consumption of agent operations. Unlike traditional CI (which costs compute time), agent tasks cost tokens — and tokens are priced per million. A single complex agent task can consume 50,000–200,000 tokens. At scale, this adds up fast.
>
> **How to estimate token costs.** Track these three metrics for one week:
>
> 1. **Average tokens per task:** Most agent tasks consume between 20,000 and 150,000 input + output tokens. Simple tasks (add a field, fix a typo) use ~20,000. Complex tasks (implement a feature with 5 files) use ~100,000–150,000.
> 2. **Tasks per day:** Count how many agent tasks your team runs daily. In early adoption, this is typically 5–20 tasks per engineer per day.
> 3. **Cost per million tokens:** Check your provider's pricing. As of 2026, Claude Sonnet is approximately $3/$15 per million input/output tokens. GPT-4o is approximately $2.50/$10.
>
> The formula: `daily_cost = tasks_per_day × avg_tokens_per_task × cost_per_million_tokens / 1,000,000`
>
> For a team of 8 engineers running 10 tasks/day at 80,000 average tokens and $0.01 per 1,000 tokens: `8 × 10 × 80,000 × $0.01 / 1,000 = $64/day ≈ $1,280/month`.
>
> **The silent cost inflater: repeated attempts.** Research from dontcodethisathome.com¹ found that agents can silently inflate costs through repeated attempts — an agent that fails and retries may consume 3–5× the tokens of a successful first-pass task. This is the hidden cost of a weak harness: every CI failure that the agent has to self-correct is a multiplier on token costs. A strong harness with high first-pass rates (>80%) dramatically reduces this multiplier.
>
> **Cost budgeting template:**
>
> | Category | Budget | Alert Threshold | Actual (This Month) |
> |---|---|---|---|
> | Monthly token budget | $_______ | 80% → warning, 100% → block | $_______ |
> | Per-task token cap | _______ tokens | Soft cap → warn, hard cap → abort | avg: _______ |
> | Daily spend limit | $_______ | Alert via Slack/email | $_______/day |
> | Agent retry multiplier | 3× max | If avg > 2×, investigate harness quality | avg: ___× |
>
> **Practical cost controls:**
> 1. Set a per-task token cap in your agent configuration. If a task exceeds the cap, abort and escalate to a human.
> 2. Track the retry multiplier (total tokens / first-attempt tokens). If the average exceeds 2×, your harness needs strengthening.
> 3. Review token spending weekly. The trend matters more than any single day's number.
> 4. Budget for growth: as agent adoption increases from Phase 1 to Phase 4, expect token costs to increase 3–5× while engineering output increases 10–20×. The ROI is clear, but you need to plan for the cash flow.

---





## Frequently Asked Questions

### "Our codebase is a mess. Should we clean it up before adding agents?"

No. Start with agents and the harness simultaneously. The harness defines the target state; the agents help you reach it. If you wait for a clean codebase, you'll wait forever. Instead, use the brownfield migration path described earlier in this chapter: new code follows the harness, existing code migrates incrementally.

### "How many linter rules is too many?"

There's no fixed number, but watch for these signals that you've gone too far:
- **CI takes more than 15 minutes.** Some linter rules may need to be consolidated or moved to a slower nightly run.
- **Engineers are disabling linter rules.** This means the rules are too strict or too noisy. Either fix the rule or remove it.
- **Linter errors outnumber linting-passing files.** You may be trying to enforce too many rules at once. Use progressive enforcement (warn → error → block) to ease in.
- **The linter rules contradict each other.** This happens when rules are written independently without a unified philosophy. Consolidate around the golden principles.

A healthy harness typically has 10–30 custom linter rules, with the first 5–10 covering the most critical patterns.

### "What if our team is resistant to agent-first development?"

Resistance usually comes from one of three sources:

1. **Fear of job displacement.** Address this directly: agents amplify engineers, they don't replace them. The engineer's role shifts from writing code to designing systems — a higher-value activity.

2. **Bad prior experience.** Someone tried using ChatGPT to write code, got garbage output, and concluded "AI isn't ready." Invite them to try a task with a proper harness (AGENTS.md + linters + CI). The difference is night and day.

3. **Process inertia.** "We've always done code review this way." The Affirm case study is powerful here — 800 engineers retrained in one week, with productivity gains that converted skeptics into advocates.

The most effective approach is a pilot project with willing early adopters. Let the results speak for themselves. After 2–3 weeks of improved throughput, resistance typically fades.

### "Can I use multiple agent platforms simultaneously?"

Yes, and many mature teams do. The key is that the harness (AGENTS.md, linters, CI) is platform-agnostic. See Chapter 25's multi-platform strategy for detailed guidance on how to set this up.

### "How do we measure whether the harness is working?"

Track these three metrics weekly:

1. **Agent pass rate:** What percentage of agent-generated PRs pass CI on the first attempt? Target: >80%.
2. **Quality score trend:** Is the average quality score per PR increasing, stable, or decreasing? Target: steadily increasing.
3. **Human rework rate:** What percentage of merged agent PRs require follow-up fixes? Target: <15%.

If all three metrics are moving in the right direction, your harness is working. If any metric is declining, investigate and strengthen the harness in that area.
