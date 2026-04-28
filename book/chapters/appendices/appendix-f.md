# Appendix F: Quality Scorecard Template

*A template for measuring codebase health in agent-first development.*

---

## How to Use This Scorecard

Run this scorecard monthly. Track trends over time. Use the results to prioritize harness improvements and identify entropy hotspots.

---

## Codebase Health Metrics

### Growth Metrics

| Metric | Current | Previous | Trend | Target | Status |
|---|---|---|---|---|---|
| Total lines of code | ___ | ___ | ↑↓→ | Stable/slow growth | |
| Net code growth rate (% per month) | ___% | ___% | ↑↓→ | <5% | |
| Files added this month | ___ | ___ | ↑↓→ | <20% of existing count | |
| Files removed this month | ___ | ___ | ↑↓→ | Tracking additions | |
| New dependencies added | ___ | ___ | ↑↓→ | <5/month | |

### Structure Metrics

| Metric | Current | Previous | Trend | Target | Status |
|---|---|---|---|---|---|
| Average file size (lines) | ___ | ___ | ↑↓→ | <200 | |
| Largest file (lines) | ___ | ___ | ↑↓→ | <500 | |
| Files exceeding 300 lines | ___ | ___ | ↑↓→ | 0 | |
| Circular dependencies | ___ | ___ | ↑↓→ | 0 | |
| Dependency depth (average) | ___ | ___ | ↑↓→ | <4 | |
| Layer violations this month | ___ | ___ | ↑↓→ | 0 | |

### Quality Metrics

| Metric | Current | Previous | Trend | Target | Status |
|---|---|---|---|---|---|
| Test coverage (%) | ___% | ___% | ↑↓→ | >85% | |
| Linter pass rate (first attempt) | ___% | ___% | ↑↓→ | >70% | |
| Rework rate (% code modified within 30 days) | ___% | ___% | ↑↓→ | <20% | |
| Defect escape rate (bugs per 100 PRs) | ___ | ___ | ↑↓→ | <5 | |
| Agent self-correction iterations (avg) | ___ | ___ | ↑↓→ | <3 | |
| PR merge rate (% PRs merged vs abandoned) | ___% | ___% | ↑↓→ | >70% | |

### Agent-Specific Metrics

| Metric | Current | Previous | Trend | Target | Status |
|---|---|---|---|---|---|
| Agent PR throughput (per engineer per week) | ___ | ___ | ↑↓→ | Increasing | |
| AI vs. human lines (% agent-generated) | ___% | ___% | ↑↓→ | Growing | |
| First-attempt pass rate (%) | ___% | ___% | ↑↓→ | >60% | |
| Human intervention rate (%) | ___% | ___% | ↑↓→ | <20% | |
| Review time per PR (minutes) | ___ | ___ | ↑↓→ | <30 | |
| Cost per incremental PR ($) | $___ | $___ | ↑↓→ | <$37.50 | |

### Entropy Indicators

| Indicator | Current | Previous | Trend | Threshold | Alert? |
|---|---|---|---|---|---|
| Dead code ratio (%) | ___% | ___% | ↑↓→ | <3% | |
| Pattern variants (similar-but-different) | ___ | ___ | ↑↓→ | <5 per pattern type | |
| Documentation drift (%) | ___% | ___% | ↑↓→ | <10% | |
| `eslint-disable` comments (count) | ___ | ___ | ↑↓→ | <10 total | |
| TODO comments older than 30 days | ___ | ___ | ↑↓→ | 0 | |
| Test flakiness rate (%) | ___% | ___% | ↑↓→ | <2% | |

---

## Harness Health Metrics

| Component | Status | Last Updated | Notes |
|---|---|---|---|
| AGENTS.md | ✅❌ | ___ | |
| Custom linter rules | ___ active | ___ | |
| Structural tests | ___ active | ___ | |
| CI pipeline | ✅❌ | ___ | |
| Execution plan template | ✅❌ | ___ | |
| Garbage collection agents | ___ active | ___ | |
| Security scanning | ✅❌ | ___ | |
| Audit logging | ✅❌ | ___ | |

---

## Scoring

### Per-Metric Score
- **Green** (3 pts): At or better than target
- **Yellow** (1 pt): Within 20% of target
- **Red** (0 pts): More than 20% from target

### Overall Health Score

| Category | Max Points | Score |
|---|---|---|
| Growth | 18 | ___ |
| Structure | 18 | ___ |
| Quality | 18 | ___ |
| Agent-Specific | 18 | ___ |
| Entropy | 18 | ___ |
| **Total** | **90** | **___** |

### Health Rating
- **75–90:** Healthy — maintain current practices
- **50–74:** Needs attention — prioritize lowest-scoring areas
- **25–49:** At risk — pause feature work for harness improvement
- **0–24:** Critical — immediate intervention required

---

## Action Items

Based on this scorecard:

1. ___
2. ___
3. ___

---

## Scorecard Completed By

- **Date:** ___
- **Reviewer:** ___
- **Next review date:** ___

---

## Worked Example: Scoring a Real Codebase

The following shows a completed scorecard for a mid-stage TypeScript API service that has been using agent-first development for 3 months.

### Growth Metrics (Scored)

| Metric | Current | Target | Score |
|---|---|---|---|
| Total lines of code | 42,300 | Stable | 🟢 3 |
| Net growth rate | 4.2%/mo | <5% | 🟢 3 |
| Files added | 18 | <20% of 320 | 🟢 3 |
| Files removed | 7 | Tracking additions | 🟡 1 |
| New dependencies | 3 | <5/month | 🟢 3 |

**Growth Score: 13/15**

### Structure Metrics (Scored)

| Metric | Current | Target | Score |
|---|---|---|---|
| Average file size | 132 lines | <200 | 🟢 3 |
| Largest file | 410 lines | <500 | 🟡 1 |
| Files >300 lines | 3 | 0 | 🔴 0 |
| Circular dependencies | 0 | 0 | 🟢 3 |
| Dependency depth | 3.1 | <4 | 🟢 3 |
| Layer violations | 0 | 0 | 🟢 3 |

**Structure Score: 13/18** — The 3 files exceeding 300 lines need splitting.

### Quality Metrics (Scored)

| Metric | Current | Target | Score |
|---|---|---|---|
| Test coverage | 87% | >85% | 🟢 3 |
| Linter pass rate (1st attempt) | 72% | >70% | 🟢 3 |
| Rework rate | 18% | <20% | 🟢 3 |
| Defect escape rate | 3.2/100 PRs | <5 | 🟢 3 |
| Agent self-correction iterations | 2.4 | <3 | 🟢 3 |
| PR merge rate | 81% | >70% | 🟢 3 |

**Quality Score: 18/18** — Strong quality metrics across the board.

### Agent-Specific Metrics (Scored)

| Metric | Current | Target | Score |
|---|---|---|---|
| Agent PR throughput | 8.2/eng/wk | Increasing | 🟢 3 |
| AI-generated lines | 74% | Growing | 🟢 3 |
| First-attempt pass rate | 63% | >60% | 🟢 3 |
| Human intervention rate | 17% | <20% | 🟢 3 |
| Review time per PR | 22 min | <30 min | 🟢 3 |
| Cost per PR | $31.20 | <$37.50 | 🟢 3 |

**Agent Score: 18/18** — Agent workflow is well-calibrated.

### Entropy Indicators (Scored)

| Indicator | Current | Threshold | Score |
|---|---|---|---|
| Dead code ratio | 1.8% | <3% | 🟢 3 |
| Pattern variants | 3 | <5/type | 🟢 3 |
| Documentation drift | 6% | <10% | 🟢 3 |
| eslint-disable count | 7 | <10 | 🟢 3 |
| Stale TODOs | 2 | 0 | 🔴 0 |
| Test flakiness | 1.4% | <2% | 🟢 3 |

**Entropy Score: 15/18** — Two stale TODOs need resolution.

### Overall Score: 77/87 — Healthy

**Action Items:**
1. Split the 3 files exceeding 300 lines (assign to agent with GP-02 enforcement)
2. Resolve 2 stale TODO comments (GP-50 enforcement)
3. Continue monitoring rework rate — approaching threshold at 18%

---

## Automated Scoring Script

Use this script to automate data collection for the scorecard:

```bash
#!/bin/bash
# scorecard-collect.sh — Collect metrics for the quality scorecard

echo "=== Codebase Quality Scorecard Data Collection ==="
echo "Date: $(date -I)"
echo ""

# Growth metrics
echo "--- Growth Metrics ---"
echo "Total lines: $(find src/ -name '*.ts' | xargs wc -l | tail -1)"
echo "Total files: $(find src/ -name '*.ts' | wc -l)"
echo "Files added this month: $(git log --since='1 month ago' --name-only --pretty=format: src/ | grep '\.ts$' | sort -u | wc -l)"
echo ""

# Structure metrics
echo "--- Structure Metrics ---"
echo "Average file size: $(find src/ -name '*.ts' -exec wc -l {} + | awk 'END{printf "%.0f\n", $1/NR}')"
echo "Largest file: $(find src/ -name '*.ts' -exec wc -l {} + | sort -rn | head -1)"
echo "Files > 300 lines: $(find src/ -name '*.ts' -exec wc -l {} + | awk '$1 > 300' | wc -l)"

# Circular deps
if command -v npx &> /dev/null; then
  echo "Circular dependencies: $(npx madge --circular src/ 2>/dev/null | grep -c 'Circular' || echo '0')"
fi
echo ""

# Quality metrics
echo "--- Quality Metrics ---"
if [ -f coverage/coverage-summary.json ]; then
  echo "Test coverage: $(cat coverage/coverage-summary.json | jq '.total.lines.pct')%"
fi
echo "eslint-disable count: $(grep -r 'eslint-disable' src/ --include='*.ts' | wc -l)"
echo "TODO count: $(grep -r 'TODO\|FIXME' src/ --include='*.ts' | wc -l)"
echo ""

# Entropy indicators
echo "--- Entropy Indicators ---"
echo "Dead exports (unused): $(npx ts-prune src/ 2>/dev/null | grep -c 'unused export' || echo 'N/A')"
echo "Stale TODOs (>30 days): TODO — requires date parsing"
```

---

## Trend Tracking Template

Track these metrics monthly to visualize codebase health trends:

| Month | Total LOC | Coverage | Avg File Size | Circular Deps | Agent PRs/wk | Health Score |
|-------|-----------|----------|---------------|---------------|--------------|-------------|
| Month 1 | ___ | ___% | ___ | ___ | ___ | ___/90 |
| Month 2 | ___ | ___% | ___ | ___ | ___ | ___/90 |
| Month 3 | ___ | ___% | ___ | ___ | ___ | ___/90 |
| Month 4 | ___ | ___% | ___ | ___ | ___ | ___/90 |
| Month 5 | ___ | ___% | ___ | ___ | ___ | ___/90 |
| Month 6 | ___ | ___% | ___ | ___ | ___ | ___/90 |

**What to watch for:**
- **Score increasing:** Harness is working. Continue current practices.
- **Score flat:** Check if entropy metrics are creeping up while quality stays stable — this is a leading indicator of future decline.
- **Score decreasing:** Pause feature work. Focus on the lowest-scoring category for 1 sprint.
- **Agent throughput dropping while other metrics hold:** The harness may be over-constrained. Consider relaxing rules that agents frequently violate without quality impact.

---

## Working Quality Scoring Implementation

The following is the complete, production-ready quality scoring implementation referenced in Chapter 17. It reads real ESLint output and coverage summaries — no stubs, no placeholders.

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
): { score: number; breakdown: Record<string, number>; lintErrors: number; lintWarnings: number; flags: string[] } {
  const flags: string[] = [];
  let lintErrors = 0;
  let lintWarnings = 0;

  // 1. Lint compliance (40 points)
  for (const file of eslintJson) {
    lintErrors += file.errorCount;
    lintWarnings += file.warningCount;
  }
  const lintScore = Math.max(0, 40 - lintErrors * 10 - lintWarnings * 2);
  if (lintErrors > 0) flags.push(`${lintErrors} lint error(s)`);

  // 2. Type safety (20 points)
  let anyCount = 0;
  for (const f of changedFiles) {
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    anyCount += (src.match(/:\s*any\b/g) || []).length;
  }
  const typeScore = Math.max(0, 20 - anyCount * 4);
  if (anyCount > 0) flags.push(`${anyCount} explicit 'any' type(s)`);

  // 3. Test coverage (25 points)
  let coverageScore = 0;
  if (coverage) {
    const lineCov = coverage.total.lines.pct;
    const branchCov = coverage.total.branches.pct;
    coverageScore = Math.min(25, (lineCov + branchCov) / 2 / 4);
    if (lineCov < 60) flags.push(`Low line coverage: ${lineCov.toFixed(0)}%`);
  } else {
    flags.push('No coverage data available');
  }

  // 4. File size penalty (15 points)
  let sizePenalty = 0;
  for (const f of changedFiles) {
    if (!fs.existsSync(f)) continue;
    const lines = fs.readFileSync(f, 'utf8').split('\n').length;
    if (lines > 300) { sizePenalty += 3; flags.push(`${f} is ${lines} lines`); }
  }
  const sizeScore = Math.max(0, 15 - sizePenalty);

  const score = Math.round(lintScore + typeScore + coverageScore + sizeScore);
  return {
    score,
    breakdown: { lint: lintScore, typeSafety: typeScore, coverage: coverageScore, fileSize: sizeScore },
    lintErrors,
    lintWarnings,
    flags,
  };
}

// CLI entry point: reads ESLint JSON from stdin
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

### Wiring into CI

```yaml
# In your CI workflow
- run: npx eslint --format json src/ > eslint-report.json
- run: npx ts-node scripts/quality-score.ts coverage/coverage-summary.json < eslint-report.json
  env:
    CHANGED_FILES: ${{ steps.changed-files.outputs.all }}
```

The script produces a JSON score object you can post as a PR comment, log to a dashboard, or use as a merge-queue gate. Adjust the point allocations and penalties to match your team's priorities — the important thing is that the score is computed from real tool output, not stubs.

---

## Quality Score Interpretation Guide

Quality scores are computed on a 0–100 scale, weighted across four dimensions: lint compliance (40 points), type safety (20 points), test coverage (25 points), and file size adherence (15 points). Here is what the scores mean and what actions to take.

### Score Ranges and Thresholds

| Score Range | Rating | Meaning | Required Action |
|-------------|--------|---------|-----------------|
| **90–100** | Excellent | Code exceeds all harness standards. Minimal human review needed. | Auto-merge via merge queue. Optional kudos to the agent configuration. |
| **80–89** | Good | Code meets all critical standards with minor warnings. | Auto-merge for yellow-tier PRs. Brief human review for orange/red tiers. |
| **70–79** | Acceptable | Code passes but has notable quality gaps. Review the `flags` array. | Human review required. Agent should auto-fix lint errors and re-submit. |
| **60–69** | Below Standard | Multiple quality issues. One or more dimensions scored poorly. | Block auto-merge. Agent must rework. Engineer reviews breakdown to identify systemic issues. |
| **50–59** | Poor | Significant quality debt. Likely multiple lint errors and low coverage. | Block merge. Investigate: is the task too large? Is the agent missing context? |
| **Below 50** | Failing | Code does not meet minimum quality standards. | Block merge. Re-scope the task. Check if the AGENTS.md is up to date. |

### Breakdown Interpretation

The `breakdown` object tells you *where* quality is strong or weak:

| Dimension | Max Points | What a Low Score Means |
|-----------|-----------|----------------------|
| `lint` | 40 | The agent violated golden principles. Each lint error costs 10 points. Check which rules fired — recurring violations indicate a missing constraint or unclear AGENTS.md instruction. |
| `typeSafety` | 20 | The agent introduced `any` types. Each costs 4 points. This usually means the agent couldn't find the right type — add the type to `schemas/` or `types/` and update AGENTS.md. |
| `coverage` | 25 | Test coverage is below threshold. If null (no data), the CI pipeline is not generating coverage reports — fix that first. If low, the agent skipped tests — enforce GP-16. |
| `fileSize` | 15 | Changed files exceed the 300-line limit. The agent should have split the file — enforce GP-02 and re-run. |

### When Scores Drop: Diagnostic Checklist

When the average quality score trends downward over multiple PRs:

1. **Check the breakdown.** Is one dimension dragging everything down, or are all dimensions declining? A single declining dimension points to a specific gap (e.g., a new dependency without types). All dimensions declining points to a systemic issue (e.g., a model downgrade or context file corruption).
2. **Check the flags.** Are the same rules firing repeatedly? Each recurring flag is a candidate for a new AGENTS.md instruction or linter rule.
3. **Check agent context.** Has the AGENTS.md been updated recently? Has the architecture changed without updating the context files?
4. **Check model version.** Did the LLM provider update their model? Model changes can silently affect code quality. Compare scores before and after the change date.
5. **Check task scope.** Are agents being given tasks that are too large? Large tasks produce lower-quality code regardless of model capability. Re-scope into smaller tasks.

### Score-Based Merge Policy

```yaml
# Recommended merge policy based on quality score
if: score >= 80
  action: auto-merge (yellow tier) or brief human review (orange/red tier)

if: score 70-79
  action: human review required, agent may auto-fix and re-submit

if: score 60-69
  action: block merge, agent reworks with engineer guidance

if: score < 60
  action: block merge, re-scope task, update harness before retry
```
