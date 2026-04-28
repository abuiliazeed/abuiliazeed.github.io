# Appendix E: CI Pipeline Templates

*Production-ready CI pipeline configurations for agent-first development.*

---

## GitHub Actions — Complete Agent PR Pipeline

```yaml
# .github/workflows/agent-pr.yml
name: Agent PR Pipeline

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  # Job 1: Classify the PR by risk tier
  classify:
    runs-on: ubuntu-latest
    outputs:
      tier: ${{ steps.classify.outputs.tier }}
      is_agent: ${{ steps.check.outputs.is_agent }}
    steps:
      - uses: actions/checkout@v4
      - id: check
        run: |
          # Check if PR was created by an agent (bot user or agent label)
          if echo "${{ github.event.pull_request.user.login }}" | grep -qiE "(bot|agent|codex|copilot)"; then
            echo "is_agent=true" >> $GITHUB_OUTPUT
          else
            echo "is_agent=false" >> $GITHUB_OUTPUT
          fi
      - id: classify
        run: |
          CHANGED=$(git diff --name-only origin/main...HEAD)
          
          # Red tier: security-sensitive code
          if echo "$CHANGED" | grep -qE "(auth|crypto|payment|secrets|\.env)"; then
            echo "tier=red" >> $GITHUB_OUTPUT
          
          # Orange tier: configuration and infrastructure
          elif echo "$CHANGED" | grep -qE "(\.github/|docker-compose|Dockerfile|terraform|\.env\.example)"; then
            echo "tier=orange" >> $GITHUB_OUTPUT
          
          # Yellow tier: application code
          else
            echo "tier=yellow" >> $GITHUB_OUTPUT
          fi

  # Job 2: Lint
  lint:
    runs-on: ubuntu-latest
    needs: classify
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
  
  # Job 3: Unit tests
  test-unit:
    runs-on: ubuntu-latest
    needs: classify
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --coverage --ci
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-unit
          path: coverage/

  # Job 4: Integration tests
  test-integration:
    runs-on: ubuntu-latest
    needs: classify
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: docker compose -f docker-compose.test.yml up -d
      - run: npm run test:integration -- --ci
      - run: docker compose -f docker-compose.test.yml down

  # Job 5: Structural tests (architecture invariants)
  test-structural:
    runs-on: ubuntu-latest
    needs: classify
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:structural -- --ci

  # Job 6: Security scanning
  security:
    runs-on: ubuntu-latest
    needs: classify
    steps:
      - uses: actions/checkout@v4
      - name: Secret scanning
        uses: gitleaks/gitleaks-action@v2
      - name: Dependency audit
        run: npm audit --audit-level=high
      - name: License check
        run: npx license-checker --failOn "GPL-3.0;AGPL-3.0"

  # Job 7: Build verification
  build:
    runs-on: ubuntu-latest
    needs: [lint, test-unit]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

  # Job 8: Quality score (agent PRs only)
  quality-score:
    runs-on: ubuntu-latest
    needs: [lint, test-unit, test-integration, test-structural, security, build]
    if: needs.classify.outputs.is_agent == 'true'
    steps:
      - uses: actions/checkout@v4
      - name: Calculate quality score
        run: |
          CHANGED=$(git diff --name-only origin/main...HEAD)
          ADDED=$(git diff --stat origin/main...HEAD | grep "insertion" | grep -oP '\d+(?= insertion)')
          REMOVED=$(git diff --stat origin/main...HEAD | grep "deletion" | grep -oP '\d+(?= deletion)')
          FILES=$(echo "$CHANGED" | wc -l)
          
          echo "## Agent PR Quality Score" >> $GITHUB_STEP_SUMMARY
          echo "| Metric | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|--------|-------|" >> $GITHUB_STEP_SUMMARY
          echo "| Files changed | $FILES |" >> $GITHUB_STEP_SUMMARY
          echo "| Lines added | ${ADDED:-0} |" >> $GITHUB_STEP_SUMMARY
          echo "| Lines removed | ${REMOVED:-0} |" >> $GITHUB_STEP_SUMMARY
          echo "| Risk tier | ${{ needs.classify.outputs.tier }} |" >> $GITHUB_STEP_SUMMARY
          echo "| All checks | ✅ Passed |" >> $GITHUB_STEP_SUMMARY

  # Job 9: Auto-merge for yellow tier (if all checks pass)
  auto-merge:
    runs-on: ubuntu-latest
    needs: [lint, test-unit, test-integration, test-structural, security, build]
    if: needs.classify.outputs.tier == 'yellow'
    steps:
      - name: Enable auto-merge
        run: |
          gh pr merge ${{ github.event.pull_request.number }} --squash --auto
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## CircleCI — Agent PR Pipeline

```yaml
# .circleci/config.yml
version: 2.1

orbs:
  node: circleci/node@5.2

workflows:
  agent-pr:
    jobs:
      - classify-changes
      - lint:
          requires: [classify-changes]
      - test-unit:
          requires: [classify-changes]
      - test-integration:
          requires: [classify-changes]
      - test-structural:
          requires: [classify-changes]
      - security-scan:
          requires: [classify-changes]
      - build:
          requires: [lint, test-unit]

jobs:
  classify-changes:
    docker:
      - image: cimg/base:2024.04
    steps:
      - checkout
      - run:
          name: Classify changed files
          command: |
            CHANGED=$(git diff --name-only origin/main...HEAD)
            if echo "$CHANGED" | grep -qE "(auth|crypto|payment)"; then
              echo "export TIER=red" >> $BASH_ENV
            else
              echo "export TIER=yellow" >> $BASH_ENV
            fi

  lint:
    docker:
      - image: cimg/node:22.0
    steps:
      - checkout
      - node/install-packages
      - run: npm run lint

  test-unit:
    docker:
      - image: cimg/node:22.0
    steps:
      - checkout
      - node/install-packages
      - run: npm run test:unit -- --ci --coverage

  test-integration:
    docker:
      - image: cimg/node:22.0
      - image: cimg/postgres:16.2
        environment:
          POSTGRES_USER: test
          POSTGRES_DB: testdb
    steps:
      - checkout
      - node/install-packages
      - run: npm run test:integration -- --ci

  test-structural:
    docker:
      - image: cimg/node:22.0
    steps:
      - checkout
      - node/install-packages
      - run: npm run test:structural -- --ci

  security-scan:
    docker:
      - image: cimg/node:22.0
    steps:
      - checkout
      - node/install-packages
      - run: npm audit --audit-level=high
      - run: npx gitleaks detect --source . --no-git

  build:
    docker:
      - image: cimg/node:22.0
    steps:
      - checkout
      - node/install-packages
      - run: npm run build
```

---

## CI Best Practices for Agent-First Teams

1. **Fail fast:** Run the cheapest checks first (lint → unit tests → integration → build)
2. **Cache aggressively:** Cache node_modules, build artifacts, and Docker layers
3. **Parallelize tests:** Run unit, integration, and structural tests in parallel
4. **Classify changes:** Different risk tiers get different review requirements
5. **Quality score on agent PRs:** Automated quality metrics posted as PR comments
6. **Secret scanning on every PR:** Never skip security, even for agent PRs
7. **Timeout all jobs:** Set timeouts to prevent runaway agent-generated test suites

---

## GitHub Actions — Nightly Quality Gate

This pipeline runs nightly to catch quality drift that individual PRs might miss.

```yaml
# .github/workflows/nightly-quality.yml
name: Nightly Quality Gate

on:
  schedule:
    - cron: '0 3 * * *'  # 3 AM UTC daily
  workflow_dispatch:      # Manual trigger

jobs:
  entropy-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for trend analysis
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci

      - name: File size report
        run: |
          echo "## File Size Report" >> $GITHUB_STEP_SUMMARY
          echo "| File | Lines | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|------|-------|--------|" >> $GITHUB_STEP_SUMMARY
          find src/ -name '*.ts' | while read f; do
            lines=$(wc -l < "$f")
            if [ "$lines" -gt 300 ]; then
              status="🔴 OVER LIMIT"
            elif [ "$lines" -gt 200 ]; then
              status="🟡 Watch"
            else
              status="🟢 OK"
            fi
            echo "| $f | $lines | $status |" >> $GITHUB_STEP_SUMMARY
          done

      - name: Dependency count check
        run: |
          deps=$(cat package.json | jq '.dependencies | length')
          devDeps=$(cat package.json | jq '.devDependencies | length')
          echo "Dependencies: $deps (target: <20)"
          echo "Dev dependencies: $devDeps"
          if [ "$deps" -gt 20 ]; then
            echo "⚠️ Dependency count exceeds target"
          fi

      - name: Circular dependency check
        run: npx madge --circular src/

      - name: TODO/FIXME audit
        run: |
          echo "## Stale TODOs" >> $GITHUB_STEP_SUMMARY
          grep -rn "TODO\|FIXME" src/ --include="*.ts" || echo "None found" >> $GITHUB_STEP_SUMMARY

      - name: Linter disable audit
        run: |
          echo "## Linter Disables" >> $GITHUB_STEP_SUMMARY
          grep -rn "eslint-disable" src/ --include="*.ts" | wc -l
          echo "Target: <10 total"
          grep -rn "eslint-disable" src/ --include="*.ts" >> $GITHUB_STEP_SUMMARY || true

  full-test-suite:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: docker compose -f docker-compose.test.yml up -d
      - run: npm test -- --ci --coverage
      - name: Coverage threshold check
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          echo "Coverage: $COVERAGE%"
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "❌ Coverage below 80% threshold"
            exit 1
          fi
      - run: docker compose -f docker-compose.test.yml down

  dependency-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - name: npm audit
        run: npm audit --audit-level=moderate || true
      - name: License check
        run: npx license-checker --failOn "GPL-3.0;AGPL-3.0"
      - name: Outdated check (informational)
        run: npm outdated || true
```

---

## GitHub Actions — Agent Worktree Cleanup

When using git worktrees for multi-agent workflows, stale worktrees can accumulate. This job runs hourly to clean up.

```yaml
# .github/workflows/worktree-cleanup.yml
name: Worktree Cleanup

on:
  schedule:
    - cron: '0 * * * *'  # Hourly
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Prune stale worktrees
        run: |
          # List worktrees older than 4 hours
          stale=$(git worktree list --porcelain | grep "worktree" | awk '{print $2}')
          for wt in $stale; do
            if [ -d "$wt" ]; then
              age_hours=$(( ($(date +%s) - $(stat -f %m "$wt" 2>/dev/null || stat -c %Y "$wt")) / 3600 ))
              if [ "$age_hours" -gt 4 ]; then
                echo "Removing stale worktree: $wt (${age_hours}h old)"
                git worktree remove --force "$wt" 2>/dev/null || true
              fi
            fi
          done
          git worktree prune
          echo "Remaining worktrees:"
          git worktree list
```

---

## Cost Optimization for CI

Agent-first teams generate significantly more CI runs than traditional teams. These strategies help manage costs:

### 1. Path-Based Job Skipping

```yaml
# Only run relevant jobs based on changed paths
jobs:
  frontend-tests:
    if: contains(github.event.pull_request.changed_files, 'frontend/')
    runs-on: ubuntu-latest
    steps:
      - run: npm test -- --project=frontend

  backend-tests:
    if: contains(github.event.pull_request.changed_files, 'backend/')
    runs-on: ubuntu-latest
    steps:
      - run: npm test -- --project=backend
```

### 2. Smart Test Selection

```yaml
# Only run tests affected by the change
- name: Run affected tests
  run: npx jest --changedSince=origin/main --coverage
```

### 3. Merge Queue for Throughput

```yaml
# .github/workflows/merge-queue.yml
name: Merge Queue
on:
  pull_request:
    types: [labeled]
jobs:
  merge:
    if: contains(github.event.pull_request.labels.*.name, 'auto-merge')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint && npm test && npm run build
      - name: Auto-merge if all checks pass
        run: gh pr merge ${{ github.event.pull_request.number }} --squash --auto
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Jenkinsfile — Agent PR Pipeline

Many enterprise teams still use Jenkins. This Jenkinsfile provides the same agent-aware pipeline structure as the GitHub Actions template, including risk classification, parallel test execution, and token cost tracking.

```groovy
// Jenkinsfile
pipeline {
    agent any

    environment {
        NODE_VERSION = '22'
        MAX_WARNINGS = '0'
        COVERAGE_THRESHOLD = '80'
    }

    stages {
        stage('Classify') {
            steps {
                script {
                    def changed = sh(script: 'git diff --name-only origin/main...HEAD', returnStdout: true).trim()
                    if (changed.contains('auth') || changed.contains('crypto') || changed.contains('payment')) {
                        env.RISK_TIER = 'red'
                    } else if (changed.contains('.github/') || changed.contains('Dockerfile') || changed.contains('terraform')) {
                        env.RISK_TIER = 'orange'
                    } else {
                        env.RISK_TIER = 'yellow'
                    }
                    echo "Risk tier: ${env.RISK_TIER}"
                }
            }
        }

        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Parallel Checks') {
            parallel {
                stage('Lint') {
                    steps {
                        sh 'npm run lint -- --max-warnings=${MAX_WARNINGS}'
                    }
                }
                stage('Unit Tests') {
                    steps {
                        sh 'npm run test:unit -- --coverage --ci'
                    }
                    post {
                        always {
                            junit 'coverage/junit.xml'
                            publishHTML(target: [
                                allowMissing: true,
                                alwaysLinkToLastBuild: true,
                                reportDir: 'coverage',
                                reportFiles: 'lcov-report/index.html',
                                reportName: 'Coverage Report'
                            ])
                        }
                    }
                }
                stage('Structural Tests') {
                    steps {
                        sh 'npm run test:structural -- --ci'
                    }
                }
                stage('Security Scan') {
                    steps {
                        sh 'npm audit --audit-level=high'
                        sh 'npx gitleaks detect --source . --no-git'
                    }
                }
            }
        }

        stage('Integration Tests') {
            steps {
                sh 'docker compose -f docker-compose.test.yml up -d'
                sh 'npm run test:integration -- --ci'
            }
            post {
                always {
                    sh 'docker compose -f docker-compose.test.yml down'
                }
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Token Cost Report') {
            steps {
                script {
                    def costData = sh(
                        script: 'node scripts/token-cost-report.js 2>/dev/null || echo "{}"',
                        returnStdout: true
                    ).trim()
                    echo "Token cost data: ${costData}"
                }
            }
        }
    }

    post {
        failure {
            mail to: '${TEAM_EMAIL}',
                subject: "Pipeline failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: "Risk tier: ${env.RISK_TIER}\nBuild: ${env.BUILD_URL}"
        }
    }
}
```

---

## Token Cost Monitoring Step

Agent-first teams must track LLM token costs per PR and per pipeline run. Without monitoring, costs can silently inflate — as documented in Chapter 17. Add this step to every pipeline template to track and alert on token spending.

### Token Cost Report Script

```javascript
// scripts/token-cost-report.js
// Reads token usage from agent logs and computes cost.
// Assumes agent logs are in .agent-logs/ directory with JSONL format.
// Each line: { "timestamp": "...", "model": "...", "inputTokens": N, "outputTokens": N }

const fs = require('fs');
const path = require('path');

const COST_PER_MILLION = {
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-haiku-3-20250414': { input: 0.80, output: 4.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'o3': { input: 2.00, output: 8.00 },
};

const LOG_DIR = process.env.AGENT_LOG_DIR || '.agent-logs';
const COST_THRESHOLD = parseFloat(process.env.COST_THRESHOLD_USD || '5.00');

function computeCosts() {
  if (!fs.existsSync(LOG_DIR)) {
    console.log(JSON.stringify({ totalCost: 0, byModel: {}, warning: 'No agent logs found' }));
    return;
  }

  const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.jsonl'));
  let totalCost = 0;
  const byModel = {};

  for (const file of files) {
    const lines = fs.readFileSync(path.join(LOG_DIR, file), 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const rates = COST_PER_MILLION[entry.model] || { input: 3.00, output: 15.00 };
        const cost = (entry.inputTokens / 1_000_000 * rates.input) + (entry.outputTokens / 1_000_000 * rates.output);
        totalCost += cost;
        byModel[entry.model] = (byModel[entry.model] || 0) + cost;
      } catch {}
    }
  }

  const report = {
    totalCost: parseFloat(totalCost.toFixed(4)),
    costThreshold: COST_THRESHOLD,
    exceedsThreshold: totalCost > COST_THRESHOLD,
    byModel: Object.fromEntries(Object.entries(byModel).map(([k, v]) => [k, parseFloat(v.toFixed(4))]))
  };

  console.log(JSON.stringify(report, null, 2));
  if (totalCost > COST_THRESHOLD) {
    console.error(`WARNING: Token cost $${totalCost.toFixed(2)} exceeds threshold $${COST_THRESHOLD}`);
    process.exit(1);
  }
}

computeCosts();
```

### Adding Token Monitoring to Each Pipeline

**GitHub Actions** — add after the quality-score job:
```yaml
  # Add to agent-pr.yml after quality-score
  token-cost:
    runs-on: ubuntu-latest
    needs: [lint, test-unit]
    if: needs.classify.outputs.is_agent == 'true'
    steps:
      - uses: actions/checkout@v4
      - name: Compute token costs
        run: node scripts/token-cost-report.js
        env:
          AGENT_LOG_DIR: '.agent-logs'
          COST_THRESHOLD_USD: '5.00'
      - name: Post cost to PR
        if: always()
        run: |
          REPORT=$(node scripts/token-cost-report.js 2>/dev/null || echo '{}')
          gh pr comment ${{ github.event.pull_request.number }} \
            --body "### 💰 Token Cost Report
          \`\`\`json
          $REPORT
          \`\`\`"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**CircleCI** — add to the workflow:
```yaml
  token-cost:
    requires: [classify-changes]
    docker:
      - image: cimg/node:22.0
    steps:
      - checkout
      - run:
          name: Compute token costs
          command: |
            node scripts/token-cost-report.js
            REPORT=$(node scripts/token-cost-report.js 2>/dev/null || echo '{}')
            echo "Token cost: $REPORT"
          environment:
            COST_THRESHOLD_USD: "5.00"
```

**Jenkins** — already included in the Jenkinsfile above as the "Token Cost Report" stage.
