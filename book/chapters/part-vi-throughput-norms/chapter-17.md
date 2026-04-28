# Chapter 17: The CI/CD Pipeline for Agent-First Teams

> *"Your CI pipeline is the immune system of your codebase. At agent throughput, it needs to be faster, smarter, and more comprehensive than anything you've built before."*
> — Adapted from DevOps principles

---

In the last chapter, we established the new engineering norms: merge early, merge often, verify automatically. We introduced the six-layer testing stack and the idea that testing — not human review — is the primary quality gate. But we left a critical question unanswered: how do you actually build a CI/CD system that keeps pace with 30 agent-generated pull requests per day?

This chapter answers that question. We'll design a CI/CD pipeline from the ground up for agent-first teams. We'll cover PR gates and merge queues, automated quality scoring, agent-driven CI debugging, fail-fast strategies, parallel test execution, token cost management, and incident runbooks for agent-introduced failures.

By the end, you'll have a complete blueprint for a CI/CD system that doesn't just survive agent throughput — it thrives on it.

### Agent-Driven CI Debugging Patterns

Beyond the basic auto-fix loop, mature teams use several patterns for agent-driven CI debugging:

**Pattern 1: Diagnostic Mode.** When a PR fails CI for the third time, the agent switches to diagnostic mode: instead of trying to fix the issue directly, it generates a diagnostic report that includes the full error context, the files involved, recent changes to those files, and a hypothesis about the root cause. This report is posted as a PR comment for human review.

```
Diagnostic Report (Auto-generated after 3 failed fix attempts)

Failing Check: integration-tests
Error: Timeout waiting for database connection in user-service.test.ts

Files Changed:
  - src/services/user-service.ts (modified)
  - src/data/user-repository.ts (modified)

Hypothesis: The new connection pool configuration in user-repository.ts
may not be compatible with the test database setup. The pool max (20)
exceeds the test database's connection limit (10).

Suggested Fix: Reduce pool max to 5 in test environment configuration.

Confidence: 75%
```

**Pattern 2: Root Cause Analysis Agent.** A separate "investigator" agent that specializes in diagnosing CI failures. When the implementing agent fails, the investigator reads the full CI output, traces the failure through the codebase, and produces a detailed analysis. The implementing agent then uses this analysis to make a more targeted fix.

**Pattern 3: Cross-Reference Checking.** Before submitting a PR, the agent checks whether any of its changes might affect other parts of the codebase that it didn't modify. This pre-emptive check catches integration issues before CI even runs:

```bash
# Pre-submit cross-reference check
# Agent runs this before submitting PR

CHANGED_FILES=$(git diff --name-only origin/main)

# Find files that import the changed files
for file in $CHANGED_FILES; do
  IMPORTERS=$(grep -rl "from.*$(basename $file)" src/ --include="*.ts")
  if [ -n "$IMPORTERS" ]; then
    echo "Files importing $file:"
    echo "$IMPORTERS"
    # Run tests for importing files to check for breakage
    for importer in $IMPORTERS; do
      TEST_FILE=$(echo $importer | sed 's|src/|tests/|' | sed 's|\.ts|.test.ts|')
      if [ -f "$TEST_FILE" ]; then
        npx vitest run "$TEST_FILE" --reporter=verbose || echo "WARNING: Test failed for $TEST_FILE"
      fi
    done
  fi
done
```

These patterns dramatically reduce the number of CI cycles needed per PR. Teams using diagnostic mode report 40% fewer total CI runs per PR compared to teams using only the basic auto-fix loop.

### Fail-Fast Beyond CI: Pre-Commit Hooks

CI is the primary fail-fast mechanism, but the fastest feedback comes from pre-commit hooks that catch issues before the PR is even created:

```bash
#!/bin/bash
# .husky/pre-commit
# Runs on every commit — catches issues before they reach CI

echo "Running pre-commit checks..."

# Fast checks (< 5 seconds each)
npm run lint:changed      # Lint only changed files
npm run typecheck:changed # Type-check only changed files
npm run check:staged      # Check staged files for size, naming conventions

echo "Pre-commit checks passed."
```

Pre-commit hooks should be **fast** (under 10 seconds) and **non-blocking** (engineers can bypass with `--no-verify` for WIP commits). They catch the most common issues — lint violations, type errors, file size violations — before the agent even submits the PR. This reduces CI load by 30–40% and speeds up the overall cycle.

---

## Designing CI That Keeps Pace with Agent Throughput

Traditional CI pipelines were designed for human-paced development. A human opens a PR, CI runs for 20-40 minutes, the human gets a coffee, reviews the results, and either approves or requests changes. The pipeline is a gatekeeper, and the gate is designed for a pedestrian walking pace.

Agent-paced development is more like a highway. PRs arrive in batches, sometimes simultaneously. The pipeline isn't a gatekeeper — it's a toll booth with EZ-Pass. It needs to process vehicles at 65 mph, not stop each one for inspection.

### What Agent-First CI Requires

In Chapter 16, we established the six-layer testing stack and the principle that testing — not human review — is the primary quality gate. The CI pipeline is where that principle becomes infrastructure. An agent-first pipeline has four requirements that traditional pipelines de-prioritize: speed above all else (target under 10 minutes for the happy path), deterministic outcomes (flaky tests are catastrophic at agent throughput), actionable failure messages (errors must tell the agent exactly what to fix), and comprehensive coverage (every quality dimension that humans would catch in review must be encoded as a check).

### From Six Layers to Three Tiers

We mapped out the six testing layers in Chapter 16. In CI, those layers compress into three execution tiers that trade off speed against coverage:

| Tier | Target | What It Runs | Layer Coverage |
|---|---|---|---|
| **1: Fast Path** | < 3 min | Lint, type-check, file conventions | Layers 1–2 |
| **2: Core Path** | < 10 min | Unit tests, structural tests, security scan | Layers 3–4 + security |
| **3: Deep Path** | < 25 min | Integration tests, E2E tests, perf/load | Layers 5–6 |

### Fail-Fast at the Tier Level

Each tier acts as a gate. If Tier 1 fails, Tiers 2 and 3 don't run. If Tier 2 fails, Tier 3 doesn't run. This saves compute resources and provides the fastest possible feedback:

```yaml
# GitHub Actions: Tiered CI pipeline
name: Agent CI

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  # TIER 1: Fast path
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci --prefer-offline
      - run: npm run lint -- --format github-actions  # Outputs annotations
      - run: npm run typecheck
      - run: npm run check:file-sizes
      - run: npm run check:naming-conventions

  # TIER 2: Core path (only if Tier 1 passes)
  unit-tests:
    runs-on: ubuntu-latest
    needs: lint
    strategy:
      matrix:
        shard: [1, 2, 3, 4]  # Split into 4 parallel shards
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci --prefer-offline
      - run: npm run test:unit -- --shard=${{ matrix.shard }}/4
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-${{ matrix.shard }}
          path: coverage/

  structural-tests:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci --prefer-offline
      - run: npm run test:structural

  security-scan:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - run: npx audit-ci --moderate
      - run: npx semgrep --config=auto --json .
      - uses: github/codeql-action/analyze@v3

  # TIER 3: Deep path (only if Tier 2 passes)
  integration-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, structural-tests]
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci --prefer-offline
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/testdb

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, structural-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci --prefer-offline
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          BASE_URL: http://localhost:3000

  # MERGE GATE: All tiers must pass
  merge-ready:
    runs-on: ubuntu-latest
    needs: [lint, unit-tests, structural-tests, security-scan, integration-tests, e2e-tests]
    if: success()
    outputs:
      ready: true
    steps:
      - run: echo "All CI checks passed. PR is ready for merge queue."
```

## PR Gates and Merge Queues

We introduced the merge queue concept in Chapter 16. Now let's explore the full PR gate architecture — the set of conditions that must be met before a PR can enter the merge queue.

### The PR Gate Checklist

Every PR must satisfy these conditions before it can merge:

1. **All CI checks pass** (all three tiers)
2. **No merge conflicts** with the target branch
3. **Branch is up to date** with the target branch (or rebase succeeds)
4. **PR has a valid description** referencing the task or execution plan
5. **Code coverage has not decreased** (net new code must be tested)
6. **No security vulnerabilities** introduced (dependency audit + SAST)
7. **Self-review checklist completed** (agent confirms compliance)

For sensitive areas — authentication, payment processing, data pipelines, public APIs — additional gates apply:

8. **Human approval required** (at least one engineer with domain expertise)
9. **API contract tests pass** (no breaking changes to public APIs)
10. **Database migration is backward-compatible** (if applicable)

### Branch Protection Configuration

```yaml
# GitHub branch protection rules for agent-first codebase
branch_protection:
  main:
    required_pull_request_reviews:
      required_approving_review_count: 0  # Automated verification replaces review
      require_code_owner_reviews: false
      # BUT: CODEOWNERS can require review for sensitive paths
      #   path: src/auth/**    → requires @security-team review
      #   path: src/payments/** → requires @payments-team review
    
    required_status_checks:
      strict: true  # Require branches to be up to date before merging
      contexts:
        - "lint"
        - "unit-tests (1)"
        - "unit-tests (2)"
        - "unit-tests (3)"
        - "unit-tests (4)"
        - "structural-tests"
        - "security-scan"
        - "integration-tests"
        - "e2e-tests"
    
    enforce_admins: true  # Even admins must pass CI
    required_linear_history: true  # Squash merge only
    allow_force_pushes: false
    required_conversation_resolution: true
    
    merge_queue:
      enabled: true
      max_entries: 5
      batch_size: 3
      merge_method: squash
```

Notice the `required_approving_review_count: 0`. In agent-first development, human review is not required for every PR. The CI checks provide the quality gate. But the `CODEOWNERS` file specifies paths where human review *is* required:

```
# CODEOWNERS - Require human review for sensitive paths
/src/auth/**          @security-team
/src/payments/**      @payments-team  
/src/api/public/**    @api-team
/migrations/**        @database-team
/src/config/**        @platform-team
```

This hybrid approach gives you the speed of automated merging for most PRs while preserving human oversight for high-risk changes.

### The Merge Queue in Action

Here's what the merge queue looks like in practice for a team producing 20-30 PRs per day:

```
Time    Queue State                              Actions
─────── ──────────────────────────────────────── ─────────────────────────
09:00   [#47, #48, #49, #50]                     #47 enters, CI starts
09:03   [#48, #49, #50]                          #47 CI passes, merges
09:04   [#48, #49, #50, #51]                     #48 tested against #47's merge
09:07   [#49, #50, #51]                          #48 passes, merges
09:08   [#49, #50, #51, #52]                     #49 tested against #48's merge
09:10   [#50, #51, #52]                          #49 fails! Returned for rework
09:11   [#50, #51, #52, #53]                     #50 tested against #48's merge
09:14   [#51, #52, #53]                          #50 passes, merges
09:15   [#51, #52, #53, #54]                     #51 tested against #50's merge
09:17   [#52, #53, #54]                          #51 passes, merges
09:18   [#52, #53, #54, #55]                     #49 resubmits with fix
09:20   [#53, #54, #55, #49]                     #52 tested against #51's merge
```

At this rate, the merge queue processes roughly 10-15 PRs per hour during peak times. The queue acts as a serialization mechanism, ensuring that each PR is tested against the latest state of the main branch before merging.

## Automated Quality Scoring Per PR

Beyond pass/fail, agent-first teams benefit from a quality score for each PR — a numerical assessment that captures not just whether the code works, but how well it conforms to the team's standards.

### The Quality Score Components

A quality score combines multiple signals into a single metric:

```typescript
interface PRQualityScore {
  overall: number;          // 0-100
  breakdown: {
    testCoverage: number;    // 0-25 points
    lintCompliance: number;  // 0-20 points
    typeSafety: number;      // 0-15 points
    architecturalCompliance: number;  // 0-20 points
    documentation: number;   // 0-10 points
    codeComplexity: number;  // 0-10 points
  };
  flags: string[];          // Areas of concern
  recommendation: 'merge' | 'review' | 'reject';
}

function calculateQualityScore(pr: PullRequest): PRQualityScore {
  const score: PRQualityScore = {
    overall: 0,
    breakdown: {
      testCoverage: 0,
      lintCompliance: 0,
      typeSafety: 0,
      architecturalCompliance: 0,
      documentation: 0,
      codeComplexity: 0,
    },
    flags: [],
    recommendation: 'merge',
  };

  // Test coverage (0-25 points)
  const coverage = calculateCoverageForChangedFiles(pr);
  score.breakdown.testCoverage = Math.min(25, coverage * 25 / 80);  // 80% coverage = full marks
  
  if (coverage < 50) {
    score.flags.push('Low test coverage: ' + coverage.toFixed(1) + '%');
  }

  // Lint compliance (0-20 points)
  const lintErrors = countLintErrors(pr);
  score.breakdown.lintCompliance = Math.max(0, 20 - lintErrors * 5);
  
  if (lintErrors > 0) {
    score.flags.push(lintErrors + ' lint errors found');
  }

  // Type safety (0-15 points)
  const anyTypes = countAnyTypes(pr);
  const typeErrors = countTypeErrors(pr);
  score.breakdown.typeSafety = Math.max(0, 15 - anyTypes * 3 - typeErrors * 5);
  
  if (anyTypes > 0) {
    score.flags.push(anyTypes + ' explicit any types');
  }

  // Architectural compliance (0-20 points)
  const archViolations = countArchitecturalViolations(pr);
  score.breakdown.architecturalCompliance = Math.max(0, 20 - archViolations * 10);
  
  if (archViolations > 0) {
    score.flags.push(archViolations + ' architectural violations');
  }

  // Documentation (0-10 points)
  const undocumentedExports = countUndocumentedExports(pr);
  score.breakdown.documentation = Math.max(0, 10 - undocumentedExports * 2);

  // Code complexity (0-10 points)
  const complexityScore = calculateComplexityScore(pr);
  score.breakdown.codeComplexity = Math.max(0, 10 - complexityScore);

  // Total
  score.overall = Object.values(score.breakdown).reduce((a, b) => a + b, 0);

  // Recommendation
  if (score.overall >= 80) {
    score.recommendation = 'merge';
  } else if (score.overall >= 60) {
    score.recommendation = 'review';
  } else {
    score.recommendation = 'reject';
  }

  return score;
}
```

### A Working Quality Score Implementation

The `calculateQualityScore` function above delegates to helpers like `countLintErrors` and `countAnyTypes`. Here is a concrete, self-contained implementation that reads ESLint's JSON output and a coverage summary to produce a real quality score — no stubs:

```typescript
// quality-score.ts — run via: npx eslint --format json src/ | npx ts-node quality-score.ts
import * as fs from 'fs';

interface ESLintResult {
  filePath: string;
  messages: Array<{ severity: number; ruleId: string; message: string }>;
  errorCount: number;
  warningCount: number;
}

interface CoverageSummary {
  total: { lines: { pct: number }; branches: { pct: number } };
}

function computeQualityScore(
  eslintJson: ESLintResult[],
  coverage: CoverageSummary | null,
  changedFiles: string[]
): { score: number; lintErrors: number; lintWarnings: number; flags: string[] } {
  const flags: string[] = [];
  let lintErrors = 0;
  let lintWarnings = 0;

  // 1. Lint compliance: start at 40, deduct per error/warning
  for (const file of eslintJson) {
    lintErrors += file.errorCount;
    lintWarnings += file.warningCount;
  }
  const lintScore = Math.max(0, 40 - lintErrors * 10 - lintWarnings * 2);
  if (lintErrors > 0) flags.push(`${lintErrors} lint error(s)`);

  // 2. Type safety: check for `any` in changed files
  let anyCount = 0;
  for (const f of changedFiles) {
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    anyCount += (src.match(/:\s*any\b/g) || []).length;
  }
  const typeScore = Math.max(0, 20 - anyCount * 4);
  if (anyCount > 0) flags.push(`${anyCount} explicit 'any' type(s)`);

  // 3. Test coverage (if available)
  let coverageScore = 0;
  if (coverage) {
    const lineCov = coverage.total.lines.pct;
    const branchCov = coverage.total.branches.pct;
    coverageScore = Math.min(25, (lineCov + branchCov) / 2 / 4);
    if (lineCov < 60) flags.push(`Low line coverage: ${lineCov.toFixed(0)}%`);
  }

  // 4. File size penalty: flag files over 300 lines
  let sizePenalty = 0;
  for (const f of changedFiles) {
    if (!fs.existsSync(f)) continue;
    const lines = fs.readFileSync(f, 'utf8').split('\n').length;
    if (lines > 300) { sizePenalty += 3; flags.push(`${f} is ${lines} lines`); }
  }
  const sizeScore = Math.max(0, 15 - sizePenalty);

  const score = Math.round(lintScore + typeScore + coverageScore + sizeScore);
  return { score, lintErrors, lintWarnings, flags };
}

// Read from stdin (piped ESLint JSON) + optional coverage file
const chunks: Buffer[] = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const eslint = JSON.parse(Buffer.concat(chunks).toString()) as ESLintResult[];
  const coverageFile = process.argv[2]; // e.g. coverage/coverage-summary.json
  const coverage = coverageFile && fs.existsSync(coverageFile)
    ? JSON.parse(fs.readFileSync(coverageFile, 'utf8')) as CoverageSummary : null;
  const changed = process.env.CHANGED_FILES?.split(' ') || [];
  const result = computeQualityScore(eslint, coverage, changed);
  console.log(JSON.stringify(result, null, 2));
});
```

Wire this into CI by piping ESLint's JSON output directly into the script:

```yaml
# In your CI workflow
- run: npx eslint --format json src/ > eslint-report.json
- run: npx ts-node scripts/quality-score.ts coverage/coverage-summary.json < eslint-report.json
  env:
    CHANGED_FILES: ${{ steps.changed-files.outputs.all }}
```

The script produces a JSON score object you can post as a PR comment, log to a dashboard, or use as a merge-queue gate. Adjust the point allocations and penalties to match your team's priorities — the important thing is that the score is computed from real tool output, not stubs.

### Using Quality Scores

Quality scores serve several purposes:

**1. Merge decision automation.** PRs with a score of 80+ merge automatically via the merge queue. PRs with a score of 60-79 require a brief human review. PRs below 60 are rejected and sent back for rework.

**2. Trend tracking.** By tracking the average quality score over time, you can measure whether your harness is improving. A rising average score means your mechanical enforcement is working. A declining score means entropy is winning — time to add new linters or strengthen existing ones.

**3. Agent performance evaluation.** If you're using multiple agents or multiple models, quality scores help you compare their output. Is Claude producing higher-quality PRs than Codex? Is the GPT-4 model producing more lint errors than Sonnet? The data tells you.

**4. Spot-check targeting.** Instead of randomly sampling PRs for human review, you can focus on PRs with scores in the 60-79 range — where human judgment adds the most value.

```yaml
# Quality score reporting in CI
quality-report:
  runs-on: ubuntu-latest
  needs: [lint, unit-tests, structural-tests, integration-tests]
  if: always()  # Run even if other jobs fail
  steps:
    - uses: actions/checkout@v4
    - run: npm run quality-score > quality-report.json
    - uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');
          const report = JSON.parse(fs.readFileSync('quality-report.json'));
          
          const emoji = report.overall >= 80 ? '✅' : 
                        report.overall >= 60 ? '⚠️' : '❌';
          
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `## ${emoji} Quality Score: ${report.overall}/100\n` +
                  `\n| Category | Score | Max |\n|---|---|---|\n` +
                  `| Test Coverage | ${report.breakdown.testCoverage} | 25 |\n` +
                  `| Lint Compliance | ${report.breakdown.lintCompliance} | 20 |\n` +
                  `| Type Safety | ${report.breakdown.typeSafety} | 15 |\n` +
                  `| Architecture | ${report.breakdown.architecturalCompliance} | 20 |\n` +
                  `| Documentation | ${report.breakdown.documentation} | 10 |\n` +
                  `| Complexity | ${report.breakdown.codeComplexity} | 10 |\n` +
                  (report.flags.length > 0 ? 
                    `\n**Flags:**\n${report.flags.map(f => '- ' + f).join('\n')}` : '') +
                  `\n\n**Recommendation:** ${report.recommendation}`
          });
```

## Agent-Driven CI Debugging

One of the most powerful patterns in agent-first CI/CD is letting the agent debug its own CI failures. When a PR fails CI, instead of a human investigating the failure, the agent reads the CI output, diagnoses the issue, and submits a fix.

### The Auto-Fix Loop

The auto-fix loop works like this:

```
1. Agent submits PR
2. CI runs
3. If CI fails:
   a. Agent reads CI output (error logs, test failures, lint errors)
   b. Agent diagnoses the root cause
   c. Agent generates a fix
   d. Agent submits a new commit to the PR
   e. CI runs again
   f. Repeat from step 3
4. If CI passes: PR enters merge queue
5. If auto-fix fails after N attempts: escalate to human
```

This is the Ralph Wiggum Loop applied to CI failures. The key insight is that most CI failures are straightforward — a type error, a missing test, a lint violation — and an agent can fix them without human intervention.

### Implementing Auto-Fix

Here's a practical implementation using GitHub Actions:

```yaml
# .github/workflows/auto-fix.yml
name: Auto-Fix CI Failures

on:
  check_suite:
    types: [completed]

jobs:
  auto-fix:
    if: failure()  # Only run on CI failure
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.check_suite.head_branch }}
      
      - name: Get failure details
        id: failures
        uses: actions/github-script@v7
        with:
          script: |
            const runs = await github.rest.checks.listForRef({
              owner: context.repo.owner,
              repo: context.repo.repo,
              ref: context.ref,
              status: 'completed',
              conclusion: 'failure'
            });
            
            const failureDetails = [];
            for (const run of runs.data.check_runs) {
              const logs = await github.rest.checks.listAnnotations({
                owner: context.repo.owner,
                repo: context.repo.repo,
                check_run_id: run.id
              });
              failureDetails.push({
                name: run.name,
                annotations: logs.data.map(a => ({
                  path: a.path,
                  line: a.start_line,
                  message: a.message,
                  level: a.annotation_level
                }))
              });
            }
            
            return JSON.stringify(failureDetails);
      
      - name: Auto-fix with agent
        env:
          FAILURE_DETAILS: ${{ steps.failures.outputs.result }}
          MAX_ATTEMPTS: 3
        run: |
          ATTEMPT_FILE=".auto-fix-attempts"
          CURRENT=$(( $(cat $ATTEMPT_FILE 2>/dev/null || echo 0) + 1 ))
          
          if [ $CURRENT -gt $MAX_ATTEMPTS ]; then
            echo "Max auto-fix attempts reached. Escalating to human."
            exit 1
          fi
          
          echo $CURRENT > $ATTEMPT_FILE
          
          # Phase 1: Mechanical fixes (no tokens required)
          npx eslint --fix $(git diff --name-only origin/main -- '*.ts' '*.js') 2>/dev/null || true
          npx prettier --write $(git diff --name-only origin/main -- '*.ts' '*.js') 2>/dev/null || true
          
          # Phase 2: Agent-assisted fixes for remaining issues
          # Pipe the structured failure details to the agent
          echo "$FAILURE_DETAILS" | claude -p \
            "You are a CI auto-fix agent. Read the JSON failure details from stdin.
             For each failure: edit the source file to fix the issue.
             Do NOT modify test expectations to make tests pass.
             Output only the list of files you changed." \
            > .auto-fix-changes.txt
          
          # Commit and push any changes
          if git diff --quiet; then
            echo "No fix generated. Escalating to human."
            exit 1
          fi
          git config user.name "Auto-Fix Agent"
          git config user.email "agent@ci.example.com"
          git add -A
          git commit -m "auto-fix: attempt $CURRENT (CI failure resolution)"
          git push
```

### When Auto-Fix Works (and When It Doesn't)

Auto-fix is effective for:

- **Lint errors** — Missing semicolons, wrong import order, naming violations
- **Type errors** — Missing type annotations, incorrect types, missing generic parameters
- **Missing tests** — The agent can generate basic tests for uncovered code
- **Formatting issues** — Prettier, ESLint auto-fix, gofmt, etc.

Auto-fix is less effective for:

- **Logic errors** — If the agent's implementation is fundamentally wrong, auto-fix won't help
- **Architectural violations** — These often require restructuring, not patching
- **Test design issues** — Tests that pass but don't actually verify the right thing
- **Flaky test failures** — The agent might "fix" a test that was actually fine, introducing new issues

The practical limit is usually 2-3 auto-fix attempts. After that, the agent is likely making things worse, not better. The escalation path — a human engineer investigates — should kick in automatically.

### Cost of Auto-Fix

Auto-fix consumes tokens. Each CI failure that triggers auto-fix costs roughly the same as generating the original PR. If your PR generation cost is $0.50 and 20% of PRs need auto-fix with an average of 1.5 attempts, your per-PR CI cost increases by about $0.15. At 30 PRs per day, that's $4.50 per day in auto-fix token costs — trivially small compared to engineer time.

But there's a hidden cost: auto-fix iterations consume CI compute time. Each iteration adds 5-10 minutes to the PR lifecycle. If 20% of PRs need 1.5 auto-fix iterations, the average PR lifecycle increases from ~10 minutes to ~13 minutes. This is acceptable for most teams.

## Fail-Fast Strategies

Fail-fast is the principle of detecting and reporting problems as quickly as possible. In agent-first CI, fail-fast isn't just a principle — it's a necessity. Every minute of CI time is a minute of throughput lost.

### Strategy 1: Optimistic Path Execution

Don't wait for Tier 1 to finish before starting Tier 2. Instead, start all tiers in parallel and cancel downstream jobs when upstream failures are detected:

```yaml
# Optimistic parallel execution with cancellation
jobs:
  lint:
    # Runs immediately
    
  unit-tests:
    # Runs in parallel with lint
    # If lint fails, this is cancelled
    
  structural-tests:
    # Runs in parallel with lint
    # If lint fails, this is cancelled

# Cancellation logic
concurrency:
  group: ci-${{ github.head_ref }}
  cancel-in-progress: true  # Cancel old runs when new commits are pushed
```

The `cancel-in-progress` flag is crucial for agent-paced development. When an agent pushes a fix commit to a failing PR, the old CI run should be cancelled immediately — there's no point finishing a CI run against outdated code.

### Strategy 2: Targeted Test Execution

Don't run the full test suite for every PR. Run only the tests that are relevant to the changed files:

```bash
#!/bin/bash
# Determine which tests to run based on changed files

CHANGED_FILES=$(git diff --name-only origin/main)

# Map changed files to test files
TEST_FILES=""
for file in $CHANGED_FILES; do
  if [[ $file == src/**/*.ts && $file != *.test.ts ]]; then
    # For source files, find corresponding test file
    DIR=$(dirname "$file")
    BASE=$(basename "$file" .ts)
    TEST_FILE="$DIR/$BASE.test.ts"
    if [ -f "$TEST_FILE" ]; then
      TEST_FILES="$TEST_FILES $TEST_FILE"
    fi
  elif [[ $file == src/**/*.test.ts ]]; then
    # For test files, run them directly
    TEST_FILES="$TEST_FILES $file"
  elif [[ $file == src/shared/** || $file == src/types/** ]]; then
    # Changes to shared code require broader test execution
    TEST_FILES="$TEST_FILES src/**/*.test.ts"
    break
  fi
done

if [ -n "$TEST_FILES" ]; then
  npx vitest run $TEST_FILES
else
  echo "No relevant tests found for changed files"
fi
```

Targeted test execution can reduce test time by 50-80% for most PRs, while still running the full suite on a nightly schedule.

### Strategy 3: Incremental Builds

Don't rebuild the entire project for every PR. Use build caching and incremental compilation:

```yaml
# Build caching configuration
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          cache: 'npm'
      
      # Cache the build output
      - uses: actions/cache@v4
        with:
          path: |
            dist/
            .turbo/
            node_modules/.cache/
          key: build-${{ hashFiles('src/**/*.ts', 'tsconfig.json') }}
          restore-keys: |
            build-
      
      - run: npm ci --prefer-offline
      - run: npm run build  # Incremental via Turborepo or Nx
```

Tools like Turborepo and Nx provide build-level caching that can skip rebuilding packages that haven't changed. For monorepos, this can reduce build times from minutes to seconds.

### Strategy 4: Fail-Fast Error Annotations

CI should surface errors immediately, not bury them in logs. GitHub Actions annotations, GitLab code quality reports, and similar mechanisms highlight errors directly in the PR diff:

```yaml
# ESLint with GitHub annotations
- run: npm run lint -- --format github-actions

# The output generates inline annotations like:
# ::error file=src/services/user-service.ts,line=47,col=12::Property 'email' does not exist on type 'UserCreateInput'
```

The agent reads these annotations and can fix the issues without parsing raw log output. This makes auto-fix more reliable and faster.

## Parallel Test Execution

At agent throughput, serial test execution is too slow. A test suite of 2,000 tests averaging 100ms each takes over three minutes serially. With parallel execution across 8 workers, it takes under 30 seconds.

### Sharding Strategies

There are three common sharding strategies for parallel test execution:

**1. Even splitting by count.** Divide the total number of tests evenly across workers. Simple but doesn't account for test duration variability.

**2. Even splitting by historical duration.** Divide tests so that each worker gets roughly the same total execution time. Requires historical timing data but produces better load balancing.

**3. Dependency-aware splitting.** Group tests by the modules they test, so that tests for the same module run on the same worker. This can improve caching and reduce setup overhead.

```typescript
// Vitest configuration for parallel execution
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests in parallel within a single worker
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 8,
        minThreads: 2,
      },
    },
    
    // Shard configuration for CI parallelism
    // CI runs: vitest --shard=1/4, vitest --shard=2/4, etc.
    
    // Test timeout
    testTimeout: 30000,
    
    // Retry flaky tests once
    retry: 1,
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

### Test Selection for Parallel CI

For the highest throughput, combine targeted test execution with parallel sharding:

```
Total test suite: 2,000 tests
Changed files: src/services/user-service.ts, src/api/user-routes.ts
Relevant tests: 45 tests (user-service tests + user-route tests)
Parallel workers: 4
Execution time: ~2 seconds (45 tests × 100ms / 4 workers)
```

Compare this to running the full suite: 2,000 tests × 100ms / 8 workers = 25 seconds. The targeted approach is 12x faster for this PR.

## Token Cost of CI Verification

CI verification isn't free — especially when agents are involved in auto-fix loops. Let's quantify the token costs:

### The Cost Breakdown

| Activity | Tokens Consumed | Approximate Cost |
|---|---|---|
| Generate PR (200 lines) | ~15,000 input + ~8,000 output | $0.10–$0.50 |
| Self-review (checklist) | ~5,000 input + ~2,000 output | $0.03–$0.15 |
| Auto-fix (1 iteration) | ~10,000 input + ~5,000 output | $0.07–$0.30 |
| Auto-fix (avg per PR, 20% fail rate) | ~2,000 input + ~1,000 output | $0.01–$0.06 |
| Quality score calculation | ~1,000 input + ~500 output | $0.01–$0.03 |
| **Total per PR** | | **$0.15–$1.00** |

At 30 PRs per day, the daily CI token cost is $4.50–$30.00. Monthly, that's $90–$600. Compared to the cost of an engineer's time — or even compared to the $37.50 cost per incremental PR benchmark from Faros AI — this is remarkably inexpensive.

### Cost Optimization Strategies

If you're cost-conscious, here are strategies to reduce CI token costs:

1. **Maximize mechanical verification.** Every issue caught by a linter is an issue that doesn't require agent-based auto-fix. Linters are free (or nearly free) compared to agent tokens.

2. **Limit auto-fix attempts.** Set a maximum of 2-3 auto-fix attempts per PR. After that, escalate to a human. The marginal cost of each additional attempt increases while the probability of success decreases.

3. **Use cheaper models for auto-fix.** Auto-fix doesn't require the most capable model. A faster, cheaper model can handle most lint and type fixes. Reserve the expensive model for initial PR generation.

4. **Batch auto-fixes.** If multiple PRs fail for the same reason (e.g., a new lint rule), fix the rule once rather than having each agent fix it individually.

5. **Track and optimize.** Monitor which CI failures trigger auto-fix most frequently. Each frequent failure is a candidate for a new mechanical check that prevents it entirely.

```typescript
// Cost tracking for CI verification
interface CICostMetrics {
  prId: string;
  generationCost: number;       // Token cost to generate the PR
  selfReviewCost: number;       // Token cost for self-review
  autoFixAttempts: number;      // Number of auto-fix attempts
  autoFixCost: number;          // Total auto-fix token cost
  qualityScoreCost: number;     // Token cost for quality scoring
  totalCost: number;            // Sum of all costs
  ciMinutesUsed: number;        // Total CI compute minutes
}

// Track these metrics per PR and aggregate weekly to identify cost drivers
```

## Incident Runbooks for Agent-Introduced Failures

Despite the best verification pipeline, agent-introduced failures will reach production. When they do, you need incident runbooks — documented procedures for diagnosing, fixing, and preventing recurrence of agent-specific failure modes.

### Common Agent Failure Patterns

Agent-introduced failures tend to fall into distinct categories:

**1. Pattern replication errors.** The agent copies a pattern from one context where it's correct to another where it's not. For example, copying a database query pattern that works for reads but using it for writes without transaction handling.

**2. Over-abstraction.** The agent creates an abstraction that's technically correct but adds unnecessary complexity. The code works, but it's harder to understand and maintain than a simpler approach.

**3. Missing edge cases.** The agent handles the happy path correctly but misses edge cases that a human would intuitively handle. Empty arrays, null values, concurrent access, and rate limiting are common blind spots.

**4. Silent failures.** The agent catches an exception but handles it incorrectly — logging a generic message and continuing instead of propagating the error. This is particularly dangerous because the system appears to work correctly while silently losing data or producing incorrect results.

**5. Dependency version conflicts.** The agent introduces a new dependency or updates an existing one without considering compatibility with the rest of the codebase.

### The Agent Incident Runbook Template

```markdown
# Incident Runbook: Agent-Introduced Failure

## Detection
- [ ] How was the failure detected? (monitoring alert, user report, CI failure in production)
- [ ] What are the symptoms? (error messages, behavior changes, performance degradation)
- [ ] What is the blast radius? (which users/features/systems are affected)

## Diagnosis
- [ ] Which PR(s) introduced the failure? (git blame, deployment timeline)
- [ ] Was this PR agent-generated? (check PR author, commit message patterns)
- [ ] What was the agent's execution plan for this PR? (check plans/ directory)
- [ ] Did CI pass? If so, why didn't CI catch this? (gap in verification)
- [ ] What was the root cause? (pattern error, edge case, abstraction issue, etc.)

## Resolution
- [ ] Immediate fix (hotfix or rollback)
- [ ] Verification that the fix resolves the symptoms
- [ ] Post-incident review of the failure mode

## Prevention
- [ ] Can this failure mode be detected by a new lint rule?
- [ ] Can this failure mode be detected by a new structural test?
- [ ] Can this failure mode be detected by a new integration test?
- [ ] Does AGENTS.md need to be updated to prevent this pattern?
- [ ] Does the self-review checklist need a new item?

## Harness Improvement
- [ ] What specific change will prevent this class of failures in the future?
- [ ] Who is responsible for implementing the change?
- [ ] When will the change be verified?
```

### The Prevention Feedback Loop

Every agent-introduced incident should result in a harness improvement. This is the core principle of harness engineering: every failure is a harness gap, not a model limitation. The incident runbook's "Prevention" section is where this principle becomes action.

Here's the progression:

```
Incident #1: Agent produces missing null check
→ Add custom lint rule: "All function parameters must be null-checked before use"

Incident #2: Agent catches exception and logs generic message
→ Add structural test: "All catch blocks must either rethrow or return an error type"

Incident #3: Agent copies read query pattern for write operation
→ Add integration test: "All write operations must use transactions"

Incident #4: Agent introduces breaking API change
→ Add contract test: "All public API responses must match their OpenAPI schema"
```

Each incident strengthens the harness. Over time, the harness becomes increasingly capable of preventing failures before they reach CI, let alone production. This is the Correct pillar in action — the system learns from its mistakes and improves.

### Postmortem Frequency

Agent-first teams should hold regular postmortems — not just for production incidents, but for CI failures as well. A weekly review of CI failures can identify patterns before they become incidents:

- **Which CI checks fail most frequently?** These are candidates for stronger enforcement or pre-commit hooks.
- **Which auto-fix patterns are most common?** These are candidates for new mechanical checks.
- **Which files have the highest churn?** These are hotspots that may need architectural attention.
- **What's the overall quality score trend?** Is it improving, stable, or declining?

The data from your CI pipeline is a goldmine for harness improvement. Use it.

## Merge Queue Deep Dive

The merge queue is the serialization mechanism that makes agent-first throughput possible. Let's explore the operational considerations in detail.

### Merge Queue Configuration for Agent-First Teams

Different team sizes need different merge queue configurations:

```yaml
# Small team (5–10 engineers, 10–20 PRs/day)
merge_queue:
  max_entries: 5
  batch_size: 1           # One PR at a time (simple)
  check_timeout: 15m
  merge_method: squash
  min_ready: 1            # Merge as soon as one PR is ready

# Medium team (10–30 engineers, 20–50 PRs/day)
merge_queue:
  max_entries: 10
  batch_size: 3           # Batch up to 3 compatible PRs
  check_timeout: 15m
  merge_method: squash
  min_ready: 2            # Wait for at least 2 ready PRs before batching

# Large team (30+ engineers, 50+ PRs/day)
merge_queue:
  max_entries: 20
  batch_size: 5           # Batch up to 5 compatible PRs
  check_timeout: 20m
  merge_method: squash
  min_ready: 3
  priority_paths:         # Priority merging for sensitive paths
    - "src/auth/**"
    - "src/payments/**"
```

### Handling Merge Queue Failures

When a PR fails in the merge queue (tested against the latest main and broke), it should be:

1. **Removed from the queue** automatically
2. **Notified** with the specific failure details
3. **Retried** after the blocking PR merges (if the failure was caused by a conflict with another queued PR)
4. **Escalated** to auto-fix if the failure is in the PR's own code

```yaml
# Merge queue failure handling
on_failure:
  remove_from_queue: true
  notify_author: true
  auto_retry_after: 30m    # Retry after other PRs merge
  max_retries: 2
  escalate_to_autofix: true
  autofix_max_attempts: 3
```

### Merge Queue Metrics

Track these metrics to keep your merge queue healthy:

- **Queue depth:** Average number of PRs waiting. Target: <5 for most teams.
- **Queue wait time:** Average time from entering the queue to merging. Target: <30 minutes.
- **Queue throughput:** PRs merged per hour through the queue. Target: >5/hour.
- **Batch efficiency:** Percentage of queue checks that result in a merge (vs. a failure). Target: >90%.

If queue depth consistently exceeds your target, either your CI is too slow or your batch size is too small. If batch efficiency drops below 80%, your PRs are conflicting with each other too often — improve task isolation.

---

## CI/CD Economics for Agent-First Teams

When your team ships 30 agent-generated PRs per day, the economics of CI shift from "rounding error" to "line item." You are now paying for three things simultaneously: CI compute minutes, LLM token consumption for every agent-driven PR and auto-fix cycle, and the engineering time spent maintaining the pipeline itself. Most teams track the first and the third but are caught off guard by the second. Let's build a cost model that accounts for all three.

### Lesson from the Field: Uber's Approach to Slashing CI Costs

Uber operates one of the largest CI systems in the industry. Their Go monorepo alone produced enough CI load to become a meaningful cost center. In 2024, Uber's engineering team published a detailed account of how they reduced CI resource consumption by 53% and CPU usage by 44%, while simultaneously *increasing* developer throughput.¹ Their approach combined several strategies that translate directly to agent-first teams:

**Replace full builds with targeted builds.** Uber migrated from Make to Bazel, which enabled incremental builds that validate only the parts of the codebase affected by a change. For agent-first teams, this means your CI should never rebuild the world for a PR that changes two files. Tools like Turborepo, Nx, or Bazel provide this out of the box.

**Speculative execution with smart scheduling.** Uber's SubmitQueue speculatively executes builds and uses machine learning to prioritize smaller, faster-changing changes over large, slow ones. The agent-first equivalent: when your merge queue has five PRs waiting, test the smallest ones first. A 10-line lint fix should not wait behind a 2,000-line refactoring.

**Result caching across runs.** Uber caches build artifacts keyed by file hashes, skipping work for unchanged code. We covered caching strategies earlier in this chapter, but the economic framing is worth stating bluntly: every cache hit is a dollar saved. A team producing 30 PRs per day that caches dependency installation, build outputs, and test results can cut CI compute costs by 40–60%.

Uber's key insight is that CI cost optimization and developer throughput are not in tension — the same optimizations that save money (smaller builds, smarter scheduling, aggressive caching) also make the pipeline faster. For agent-first teams, this alignment is even stronger, because faster CI means fewer auto-fix cycles, which means fewer tokens consumed.

### The Hidden Cost: Token Inflation in Agent Pipelines

The token cost of generating a PR is relatively straightforward to estimate — roughly 15,000 input tokens and 8,000 output tokens for a 200-line PR, costing $0.10–$0.50 depending on the model. But the token cost of *verifying and fixing* that PR through CI is harder to predict and often silently inflated.

The developer Erik Perttu documented a troubling finding: Claude's pipeline mode (`claude -p`) can silently inflate token costs beyond what the prompt and response would suggest.² The root cause is that the model makes internal tool calls — reading files, executing bash commands, searching the codebase — even when the user did not explicitly request tool usage. Each of these internal calls re-sends the full conversation context, multiplying token consumption. Perttu found that adding a single clarifying sentence to a prompt could paradoxically *reduce* input tokens, because it changed the model's internal tool-use decisions. Separately, users observed that a server-side update in Claude Code (v2.1.100+) inflated cache creation by approximately 20,000 tokens per request compared to the previous version, with no change in the user's payload.

For agent-first CI pipelines, this has three practical implications:

**1. Budget for 2–3× the nominal token cost.** If you estimate that auto-fixing a CI failure should cost 10,000 tokens based on the prompt and expected response, budget for 20,000–30,000 to account for internal tool calls and context re-sends.

**2. Monitor actual token consumption, not theoretical consumption.** Track the `usage` field in API responses, not just your prompt sizes. The delta between what you think you're sending and what the model actually consumes is your "inflation tax." One team reported that their auto-fix pipeline consumed 3× more tokens than their generation pipeline for the same PR, entirely due to internal tool calls during debugging.

**3. Constrain tool access in CI agents.** When invoking an LLM for auto-fix, limit which tools it can use. If the failure is a lint error, the agent does not need bash access or the ability to search the entire codebase. Restricting tool access reduces internal token inflation by limiting the model's ability to make expensive background calls.

### A Practical Cost Model: Per-PR Economics

Here is a cost model you can adapt to your own team. The formula is straightforward:

```
Total Cost per PR = CI Minutes × Cost/Minute + Agent Runs × Tokens/Run × Cost/Token + Maintenance Hours × Cost/Hour / PRs per Month
```

Let's break down each variable with realistic numbers for a mid-size team (15 engineers, 25 PRs/day):

**Variable 1: CI Minutes per PR.** This is the total CI compute time consumed by a single PR, including all tiers, retries, and auto-fix cycles.

| Scenario | CI Minutes/PR | Cost at $0.016/min |
|---|---|---|
| Happy path (all pass, first try) | 8 min | $0.13 |
| One auto-fix cycle | 18 min | $0.29 |
| Two auto-fix cycles | 28 min | $0.45 |
| Flaky test retry | +5 min | +$0.08 |

**Optimization levers:** Targeted test selection (−50% test time), aggressive caching (−30% build time), and tiered runners (−40% for Tier 1 on small machines).

**Variable 2: Agent Runs per PR.** This counts every LLM invocation related to a PR: generation, self-review, auto-fix cycles, and quality scoring.

| Activity | Runs per PR | Avg Tokens | Cost (Claude Sonnet) |
|---|---|---|---|
| PR generation | 1 | 23,000 | $0.18 |
| Self-review | 1 | 7,000 | $0.04 |
| Auto-fix (20% of PRs, avg 1.5 cycles) | 0.3 | 15,000 | $0.07 |
| Quality scoring (script-based) | 0 | 0 | $0.00 |
| Inflation tax (internal tool calls) | — | ~10,000 | $0.08 |
| **Subtotal** | | | **$0.37** |

**Optimization levers:** Use cheaper models for auto-fix (Haiku instead of Sonnet saves ~70%), limit auto-fix attempts to 2, and make quality scoring purely mechanical (no LLM needed — see the implementation earlier in this chapter).

**Variable 3: Maintenance Cost per PR.** The engineering time spent maintaining the pipeline — updating linters, debugging flaky tests, tuning quality score weights — amortized across all PRs.

For a well-harnessed team, this is roughly 2–4 hours per week. At $75/hour fully loaded, that's $150–$300 per week, or $0.85–$1.70 per PR at 25 PRs/day.

**Optimization levers:** Automate harness maintenance itself (linter updates via Dependabot, flaky test detection and quarantine, quality score calibration from historical data).

### The Full Picture

Bringing it together for our example team:

| Cost Component | Per PR | Monthly (750 PRs) |
|---|---|---|
| CI compute | $0.25 | $188 |
| Agent tokens | $0.37 | $278 |
| Pipeline maintenance | $1.28 | $960 |
| **Total** | **$1.90** | **$1,426** |

Compare this to the cost of manual review: a human spending 30 minutes per PR at $75/hour is $37.50 per PR, or $28,125 per month. The agent-first pipeline costs 5% of the manual review alternative — and it's faster, more consistent, and available 24/7.

### Cost per Quality-Score Point

One useful metric is the cost per quality-score point — how much you spend on CI for each point on the 0–100 quality scale. If your average PR costs $1.90 and scores 82, your cost per quality point is $0.023. Track this metric over time. If it rises, either your costs are increasing (investigate token inflation or CI inefficiency) or your quality scores are declining (investigate harness gaps). If it drops, your optimizations are working.

### When Costs Spiral: Warning Signs

Watch for these signals that your CI economics are degrading:

- **Auto-fix rate exceeds 30%.** Too many PRs need LLM-based fixes. Your harness has gaps that should be filled with mechanical checks.
- **Average CI minutes per PR exceeds 20.** The pipeline is too slow. Investigate caching, sharding, and targeted test execution.
- **Token cost per PR exceeds $0.75.** You may be over-using expensive models for tasks that cheaper models (or scripts) can handle.
- **Maintenance hours exceed 5 per week.** The pipeline is fragile. Invest in self-service tooling for common maintenance tasks.

The economics of agent-first CI are favorable — but only if you monitor them. Treat your CI pipeline like any other production system: instrument it, set budgets, and alert on anomalies.

---

## The CI Cost Optimization Playbook

At agent throughput, CI compute costs become significant. Here's a playbook for keeping costs under control:

### Strategy 1: Tiered Runners

Use different CI runner sizes for different tiers:

| Tier | Runner Size | Cost/Minute | When to Use |
|---|---|---|---|
| Tier 1 | Small (2 CPU, 4GB) | $0.008 | Lint, typecheck, conventions |
| Tier 2 | Medium (4 CPU, 8GB) | $0.016 | Unit tests, structural tests |
| Tier 3 | Large (8 CPU, 16GB) | $0.032 | Integration tests, E2E |

This alone can reduce CI costs by 30–40% compared to running all jobs on large runners.

### Strategy 2: Smart Scheduling

Not all PRs need all tiers:

- **Documentation-only PRs:** Tier 1 only (lint for broken links, spelling)
- **Test-only PRs:** Tier 1 + Tier 2 (lint + run the new tests)
- **Feature PRs:** All tiers (full pipeline)
- **Hotfix PRs:** Tier 1 + Tier 2 + targeted Tier 3 (skip full E2E, run only relevant integration tests)

Configure path-based CI triggers:

```yaml
# Path-based CI configuration
paths:
  documentation:
    paths: ["docs/**", "*.md", "LICENSE"]
    tiers: [1]
    
  tests_only:
    paths: ["tests/**"]
    tiers: [1, 2]
    
  feature:
    paths: ["src/**"]
    tiers: [1, 2, 3]
    
  hotfix:
    labels: ["hotfix"]
    tiers: [1, 2]
    skip: ["e2e"]
    priority: high  # Jump to front of merge queue
```

### Strategy 3: Result Caching

Cache aggressively across CI runs:

1. **Dependency cache:** Cache `node_modules/` or equivalent (saves 30–60 seconds per run)
2. **Build cache:** Cache compiled output (saves 1–3 minutes per run for compiled languages)
3. **Test result cache:** Cache test results keyed by file hash (skip running tests for unchanged files)
4. **Docker layer cache:** Cache Docker image layers for containerized tests

```yaml
# Aggressive caching configuration
cache:
  dependencies:
    key: ${{ hashFiles('package-lock.json') }}
    path: node_modules
    
  build:
    key: build-${{ hashFiles('src/**/*.ts', 'tsconfig.json') }}
    path: dist
    
  test_results:
    key: tests-${{ hashFiles('src/**/*.ts', 'tests/**/*.ts') }}
    path: .test-results
```

With aggressive caching, CI costs for a 10-engineer team typically run $200–500/month — a fraction of the $15,000+ in engineer time saved by the pipeline.

---

## Putting It All Together: The Complete CI/CD Architecture

Let's zoom out and look at the complete CI/CD architecture for an agent-first team:

```
┌──────────────────────────────────────────────────────────────┐
│                    AGENT WORKFLOW                             │
│                                                              │
│  Task → Plan → Implement → Self-Review → Submit PR          │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             v
┌──────────────────────────────────────────────────────────────┐
│                    CI PIPELINE                                │
│                                                              │
│  TIER 1: Lint → Type Check → Conventions       [< 3 min]    │
│           │ Pass                                             │
│           v                                                  │
│  TIER 2: Unit Tests → Structural → Security     [< 10 min]  │
│           │ Pass                                             │
│           v                                                  │
│  TIER 3: Integration → E2E → Performance        [< 25 min]  │
│           │ Pass                                             │
│           v                                                  │
│  QUALITY SCORE: Calculate and report            [< 1 min]   │
│           │                                                  │
│           ├─ Score ≥ 80 → MERGE QUEUE                       │
│           ├─ Score 60-79 → HUMAN REVIEW                     │
│           └─ Score < 60 → AUTO-FIX LOOP (max 3 attempts)    │
│                          │                                   │
│                          ├─ Fix succeeds → re-enter pipeline │
│                          └─ Fix fails → ESCALATE TO HUMAN   │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             v
┌──────────────────────────────────────────────────────────────┐
│                    MERGE QUEUE                                │
│                                                              │
│  PR → Test against latest main → Merge if passes             │
│  Batch compatible PRs for efficiency                         │
│  Squash merge for clean history                              │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             v
┌──────────────────────────────────────────────────────────────┐
│                    POST-MERGE                                 │
│                                                              │
│  Deploy to staging → Smoke tests → Deploy to production      │
│  Monitor for anomalies → Auto-rollback on degradation        │
│  Track metrics → Feed back into harness improvements         │
└──────────────────────────────────────────────────────────────┘
```

This architecture provides:

- **Speed**: Most PRs merge in under 15 minutes
- **Quality**: Six layers of verification catch issues at every level
- **Autonomy**: Agents handle their own CI failures without human intervention
- **Feedback**: Every failure mode feeds back into harness improvements
- **Cost-effectiveness**: Token costs are modest compared to engineer time

The pipeline isn't static. It evolves as your harness matures, your team grows, and your codebase changes. The key is to treat the CI/CD pipeline as part of the harness — not as external infrastructure, but as an integral component of the system that enables reliable agent-first development.

## The Cultural Shift: CI as Harness

There's a mindset shift that accompanies agent-first CI/CD. In traditional development, CI is a service provided by the platform team. Engineers write code, platform engineers maintain CI. The relationship is often adversarial — engineers want CI to be faster, platform engineers want it to be more thorough.

In agent-first development, CI *is* the harness. It's not separate from the development process — it's the primary mechanism for ensuring quality at agent throughput. The engineers who design the harness are the same engineers who design the CI pipeline. The linters, structural tests, and quality scores are all part of the same system.

This means CI/CD ownership shifts from the platform team to the product engineering team. The platform team provides the infrastructure (runners, containers, caching), but the product team owns the checks, the gates, and the quality standards. This is a natural consequence of the harness engineering philosophy: the team that understands the architecture should be the team that encodes the architecture's constraints.

For organizations transitioning to agent-first development, this ownership shift is worth making explicit. Don't let CI become someone else's problem. It's the immune system of your codebase, and at agent throughput, it needs to be cared for by the people who understand what healthy looks like.

### The CI/CD Anti-Patterns

Watch for these anti-patterns that undermine agent-first CI/CD:

**The Over-Gated Pipeline.** Every check requires human approval. Agents can't merge anything without a human clicking "approve." This negates the entire point of automated verification and bottlenecks throughput at human review speed. **Fix:** Implement the tiered review system. Tier 1 PRs auto-merge. Humans review architecture, not compliance.

**The Under-Gated Pipeline.** CI runs only lint and a few unit tests. Structural tests, integration tests, and security scans are "nice to have" that never get implemented. Agent-generated code accumulates subtle architectural violations. **Fix:** Add one new check per week until all six layers of the testing stack are covered.

**The Perpetual Auto-Fix Loop.** The agent auto-fixes a CI failure, introduces a new failure, auto-fixes that, and cycles indefinitely. Each cycle consumes tokens and CI compute. **Fix:** Cap auto-fix attempts at 3. After 3 failures, escalate to a human. Investigate why the agent can't fix the issue — it may indicate a harness gap.

**The Snowflake Pipeline.** CI is configured through a complex web of interdependent jobs, shared workflows, and environment variables that only one person understands. When that person goes on vacation, CI breaks and no one can fix it. **Fix:** Document the CI pipeline architecture. Use the pipeline-as-code pattern (everything in `.github/workflows/`). Treat CI configuration like application code: review it, test it, version it.

---

The CI/CD pipeline is the operational backbone of agent-first development. Combined with the merge norms from Chapter 16, it creates a system that can absorb massive throughput while maintaining quality. But throughput and quality are just two dimensions of the agent-first equation. In Part VII, we'll explore two more: autonomy (how much freedom you give your agents) and entropy (how you keep the codebase healthy over time).

### CI/CD Platform Comparison for Agent-First Teams

The CI/CD platform itself matters less than the pipeline you build on it, but some platforms have features that particularly benefit agent-first workflows:

| Platform | Merge Queue | Caching | Parallelism | Agent Integration | Cost |
|---|---|---|---|---|---|
| **GitHub Actions** | Native (merge queue) | Good (actions/cache) | Excellent (matrix) | Excellent (webhooks, API) | Free for public, $0.008/min+ |
| **GitLab CI** | Merge trains | Good | Excellent | Good | Included in GitLab |
| **CircleCI** | Via Mergify | Excellent (Docker layers) | Excellent (parallelism) | Good | $0.005/min+ |
| **Buildkite** | Via plugins | Excellent | Excellent (agent-based) | Excellent (agent protocol) | $0.01/min+ |
| **Jenkins** | Via plugins | Variable | Variable | Requires custom setup | Infrastructure cost |

For most agent-first teams, **GitHub Actions** is the best starting point: native merge queue support, excellent caching, and tight integration with the PR workflow that agents use. As teams scale beyond 50 engineers, **Buildkite** or **CircleCI** offer better control over runner infrastructure and parallel execution.

### The CI/CD Maturity Model

As your team matures, your CI/CD pipeline should evolve through these stages:

| Stage | CI Duration | Automation | Human Involvement | Typical Throughput |
|---|---|---|---|---|
| **Manual** | N/A | None | Full review of every PR | 4–5 PRs/day |
| **Basic CI** | 20–30 min | Lint + test + build | Full review after CI passes | 8–10 PRs/day |
| **Agent-First** | 10–15 min | Full tiered pipeline + merge queue | Architecture review, spot checks | 20–30 PRs/day |
| **Self-Optimizing** | 5–10 min | Auto-fix + quality scoring + targeted tests | Exception-only | 50+ PRs/day |

Most teams reach Stage 3 within 8 weeks of starting their harness. Stage 4 requires mature multi-agent orchestration and is the long-term aspiration rather than an immediate goal.

### The CI/CD Health Check

Use this checklist to assess your pipeline's readiness for agent throughput:

```
CI/CD Health Check for Agent-First Teams

Speed:
  □ Tier 1 (lint + typecheck) completes in < 3 minutes
  □ Tier 2 (unit + structural + security) completes in < 10 minutes
  □ Tier 3 (integration + E2E) completes in < 25 minutes
  □ Total pipeline completes in < 30 minutes
  □ Cancel-in-progress enabled for outdated runs

Reliability:
  □ Flaky test rate < 1%
  □ CI results are deterministic (same code = same result)
  □ Auto-retry configured for known flaky tests
  □ Failure messages are actionable and specific

Automation:
  □ Auto-fix loop configured (max 3 attempts)
  □ Merge queue operational
  □ Quality score calculated per PR
  □ Tiered review based on blast radius
  □ CODEOWNERS configured for sensitive paths

Efficiency:
  □ Affected-test selection reduces test time by > 50%
  □ Build caching enabled
  □ Parallel test execution across multiple workers
  □ Token cost tracked and within budget

Feedback:
  □ Error annotations appear inline in PR diff
  □ Quality score posted as PR comment
  □ CI failure trends reviewed weekly
  □ Incident runbooks maintained and up to date
```

---

¹ Uber Engineering, "Slashing CI Costs at Uber," 2024. https://www.uber.com/blog/slashing-ci-costs-at-uber

² Erik Perttu, "How Claude's Pipeline Mode Silently Inflates Your Token Costs," 2026. https://dontcodethisathome.com/how-claude-p-silently-inflates-your-pipeline-token-costs
