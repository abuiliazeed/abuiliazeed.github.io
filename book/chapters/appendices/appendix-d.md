# Appendix D: Linter Implementation Examples

*Ready-to-use linter implementations for ESLint, Ruff, and Semgrep.*

---

## ESLint Custom Rules

### Rule 1: Dependency Direction Enforcement

```javascript
// linters/custom/dependency-direction.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce dependency layer ordering',
      category: 'Architecture',
    },
    messages: {
      layerViolation: "Layer violation: '{{fromLayer}}' (L{{fromLevel}}) cannot import from '{{toLayer}}' (L{{toLevel}}). Dependencies must flow inward.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          layers: { type: 'object' },
        },
      },
    ],
  },
  create(context) {
    const layers = context.options[0]?.layers || {
      types: 1, config: 2, data: 3,
      services: 4, runtime: 5, ui: 6, routes: 6,
    };

    function getLayer(filename) {
      const match = filename.match(/src\/(\w+)\//);
      return match ? match[1] : null;
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (!source.startsWith('@/')) return; // Only check internal imports

        const fileLayer = getLayer(context.getFilename());
        const importLayer = getLayer(source.replace('@/', 'src/'));

        if (!fileLayer || !importLayer) return;
        if (!layers[fileLayer] || !layers[importLayer]) return;

        if (layers[importLayer] > layers[fileLayer]) {
          context.report({
            node,
            messageId: 'layerViolation',
            data: {
              fromLayer: fileLayer,
              fromLevel: layers[fileLayer],
              toLayer: importLayer,
              toLevel: layers[importLayer],
            },
          });
        }
      },
    };
  },
};
```

### Rule 2: Structured Logging

```javascript
// linters/custom/structured-logging.js
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce structured logging (no string concatenation in log calls)',
    },
    messages: {
      unstructuredLog: 'Use structured logging: logger.info({ key: value }, "message") instead of string concatenation.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression') return;
        
        const method = node.callee.property?.name;
        if (!['info', 'warn', 'error', 'debug'].includes(method)) return;

        const objName = node.callee.object?.name;
        if (!['logger', 'log'].includes(objName)) return;

        // Check if first argument is a string with concatenation or template literal
        const firstArg = node.arguments[0];
        if (firstArg && firstArg.type === 'BinaryExpression' && firstArg.operator === '+') {
          context.report({ node: firstArg, messageId: 'unstructuredLog' });
        }
        if (firstArg && firstArg.type === 'TemplateLiteral' && firstArg.expressions.length > 0) {
          context.report({ node: firstArg, messageId: 'unstructuredLog' });
        }
      },
    };
  },
};
```

### Rule 3: Error Remediation

```javascript
// linters/custom/error-remediation.js
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Ensure thrown errors include remediation guidance',
    },
    messages: {
      noRemediation: 'Error should include remediation guidance. Use: throw new AppError(code, { remedy: "How to fix" })',
    },
  },
  create(context) {
    return {
      ThrowStatement(node) {
        if (!node.argument) return;
        
        const arg = node.argument;
        // Check if it's a new AppError with remedy
        if (arg.type === 'NewExpression') {
          const name = arg.callee?.name;
          if (name === 'AppError') {
            // Check if options object includes 'remedy' or 'hint'
            const optionsArg = arg.arguments[1];
            if (optionsArg && optionsArg.type === 'ObjectExpression') {
              const hasRemediation = optionsArg.properties.some(
                p => p.key?.name === 'remedy' || p.key?.name === 'hint'
              );
              if (hasRemediation) return; // Good - has remediation
            }
          }
          if (name === 'Error') {
            // Plain Error without remediation - flag it
            context.report({ node, messageId: 'noRemediation' });
          }
        }
      },
    };
  },
};
```

---

## Ruff (Python) Custom Rules

### Rule: Structured Logging

```python
# ruff_rules/structured_logging.py
"""Enforce structured logging in Python code."""
from ruff_python_ast import ASTChecker, Violation

class StructuredLoggingChecker(ASTChecker):
    """Flag logging calls that use f-strings or string concatenation."""
    
    name = "structured-logging"
    
    def visit_Call(self, node):
        # Check if it's a logging call
        if not (isinstance(node.func, ast.Attribute) and
                node.func.attr in ('info', 'warning', 'error', 'debug') and
                isinstance(node.func.value, ast.Name) and
                node.func.value.id in ('logger', 'log')):
            return
        
        first_arg = node.args[0] if node.args else None
        if not first_arg:
            return
        
        # Flag f-strings in log calls
        if isinstance(first_arg, ast.JoinedStr):
            yield Violation(
                node=first_arg,
                message="SL001 Use structured logging: logger.info('message', key=value) instead of f-strings",
            )
        
        # Flag string concatenation
        if isinstance(first_arg, ast.BinOp) and isinstance(first_arg.op, ast.Add):
            yield Violation(
                node=first_arg,
                message="SL001 Use structured logging: logger.info('message', key=value) instead of string concatenation",
            )
```

---

## Semgrep Rules

### Architecture Pattern Rules

```yaml
# semgrep/architecture.yml
rules:
  - id: no-database-access-in-routes
    patterns:
      - pattern: |
          import { $DB } from ".../data/..."
      - pattern-inside: |
          // src/routes/$FILE
          ...
    message: "Routes should not directly access the data layer. Use services instead."
    severity: ERROR
    languages: [typescript]

  - id: no-any-type
    pattern: |
      $X: any
    message: "Avoid 'any' type. Use a specific type or 'unknown' for dynamic values."
    severity: WARNING
    languages: [typescript]

  - id: no-hardcoded-secrets
    patterns:
      - pattern-either:
          - pattern: |
              $VAR = "sk-..."
          - pattern: |
              $VAR = "ghp_..."
          - pattern: |
              $VAR = "AKIA..."
          - pattern: |
              password = "..."
    message: "Potential hardcoded secret detected. Use environment variables."
    severity: ERROR
    languages: [typescript, python, javascript]

  - id: parameterized-query
    patterns:
      - pattern: |
          $DB.query($STR + ...)
      - pattern: |
          $DB.query(f"...")
    message: "Use parameterized queries, not string interpolation or concatenation."
    severity: ERROR
    languages: [python, typescript]
```

### Security Pattern Rules

```yaml
# semgrep/security.yml
rules:
  - id: no-eval
    patterns:
      - pattern-either:
          - pattern: eval(...)
          - pattern: Function(...)
          - pattern: new Function(...)
    message: "eval() and Function() are dangerous. Never use them in agent-generated code."
    severity: ERROR
    languages: [javascript, typescript]

  - id: no-http-urls
    pattern: |
      fetch("http://...")
    message: "Use HTTPS, not HTTP, for all external URLs."
    severity: WARNING
    languages: [javascript, typescript]

  - id: no-innerhtml
    pattern: |
      $EL.innerHTML = $VAL
    message: "innerHTML is a XSS risk. Use textContent or a sanitization library."
    severity: ERROR
    languages: [javascript, typescript]
```

---

## Testing Your Linters

```javascript
// linters/custom/__tests__/dependency-direction.test.js
const rule = require('../dependency-direction');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('dependency-direction', rule, {
  valid: [
    {
      filename: 'src/services/user.ts',
      code: "import { User } from '@/types/user';",
      options: [{ layers: { types: 1, services: 4 } }],
    },
    {
      filename: 'src/routes/api.ts',
      code: "import { getUser } from '@/services/user';",
      options: [{ layers: { services: 4, routes: 6 } }],
    },
  ],
  invalid: [
    {
      filename: 'src/types/user.ts',
      code: "import { DB } from '@/data/database';",
      options: [{ layers: { types: 1, data: 3 } }],
      errors: [{ messageId: 'layerViolation' }],
    },
    {
      filename: 'src/services/user.ts',
      code: "import { Router } from '@/routes/api';",
      options: [{ layers: { services: 4, routes: 6 } }],
      errors: [{ messageId: 'layerViolation' }],
    },
  ],
});
```

---

## Additional ESLint Rules

### Rule 4: File Size Limit

```javascript
// linters/custom/file-size-limit.js
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce maximum file size (lines of code)',
      category: 'Architecture',
    },
    messages: {
      fileTooLarge: "File has {{lines}} lines (max {{max}}). Split into smaller modules.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxLines: { type: 'number' },
        },
      },
    ],
  },
  create(context) {
    const maxLines = context.options[0]?.maxLines || 300;
    return {
      Program(node) {
        const sourceCode = context.getSourceCode();
        const lines = sourceCode.getLines();
        // Count non-empty, non-comment lines
        const codeLines = lines.filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('*');
        });

        if (codeLines.length > maxLines) {
          context.report({
            node,
            messageId: 'fileTooLarge',
            data: { lines: codeLines.length, max: maxLines },
          });
        }
      },
    };
  },
};
```

### Rule 5: No Barrel Re-Export Violations

```javascript
// linters/custom/barrel-exports.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce barrel file (index.ts) export patterns',
    },
    messages: {
      deepImport: "Direct import from module internals. Use the barrel export from '{{barrel}}' instead.",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        // Flag imports that go deeper than one level into src/ modules
        const deepImportMatch = source.match(/@\/(\w+)\/(\w+)\/(.+)/);
        if (deepImportMatch) {
          const [, module] = deepImportMatch;
          context.report({
            node,
            messageId: 'deepImport',
            data: { barrel: `@/${module}` },
          });
        }
      },
    };
  },
};
```

### Rule 6: Descriptive Test Names

```javascript
// linters/custom/descriptive-test-names.js
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce descriptive test names that describe expected behavior',
    },
    messages: {
      vagueTestName: "Test description '{{name}}' is too vague. Describe the expected behavior (e.g., 'returns 404 when user not found').",
    },
  },
  create(context) {
    const vaguePatterns = [/^should work$/i, /^test/i, /^it works$/i, /^correct$/i, /^ok$/i, /^valid$/i];
    return {
      CallExpression(node) {
        if (node.callee?.name !== 'it' && node.callee?.property?.name !== 'it') return;
        const nameArg = node.arguments[0];
        if (!nameArg || nameArg.type !== 'Literal') return;

        const name = nameArg.value;
        if (typeof name === 'string' && name.length < 10) {
          context.report({ node: nameArg, messageId: 'vagueTestName', data: { name } });
        }
        if (typeof name === 'string' && vaguePatterns.some(p => p.test(name))) {
          context.report({ node: nameArg, messageId: 'vagueTestName', data: { name } });
        }
      },
    };
  },
};
```

---

## Full ESLint Plugin Configuration

To integrate all custom rules into a single plugin:

```javascript
// linters/custom/index.js
const { RuleTester } = require('eslint');

const plugin = {
  meta: {
    name: 'harness-engineering-rules',
    version: '1.0.0',
  },
  rules: {
    'dependency-direction': require('./dependency-direction'),
    'structured-logging': require('./structured-logging'),
    'error-remediation': require('./error-remediation'),
    'file-size-limit': require('./file-size-limit'),
    'barrel-exports': require('./barrel-exports'),
    'descriptive-test-names': require('./descriptive-test-names'),
  },
};

module.exports = plugin;
```

```javascript
// .eslintrc.js — Registering the plugin
module.exports = {
  plugins: {
    harness: require('./linters/custom'),
  },
  rules: {
    'harness/dependency-direction': ['error', {
      layers: { types: 1, config: 2, data: 3, services: 4, runtime: 5, ui: 6, routes: 6 },
    }],
    'harness/structured-logging': 'warn',
    'harness/error-remediation': 'warn',
    'harness/file-size-limit': ['error', { maxLines: 300 }],
    'harness/barrel-exports': 'error',
    'harness/descriptive-test-names': 'warn',
  },
};
```

---

## Full Ruff Plugin Configuration

To package the Python structured logging rule as a proper Ruff plugin:

```toml
# pyproject.toml
[tool.ruff]
line-length = 100
select = ["E", "F", "W", "SL"]

[tool.ruff.external-linter]
# Register custom rule prefix
prefix = "SL"

[tool.ruff.per-file-ignores]
"tests/**" = ["SL001"]  # Relax structured logging in tests
```

### Additional Ruff Rule: No Global Mutable State

```python
# ruff_rules/no_global_mutable.py
"""Prevent module-level mutable state in Python."""
import ast
from ruff_python_ast import ASTChecker, Violation

MUTABLE_TYPES = {'list', 'dict', 'set', 'deque'}

class NoGlobalMutableChecker(ASTChecker):
    """Flag module-level mutable variable assignments."""
    
    name = "no-global-mutable"
    
    def visit_Module(self, node):
        for stmt in node.body:
            if isinstance(stmt, ast.Assign):
                for target in stmt.targets:
                    if isinstance(target, ast.Name) and not target.id.startswith('_'):
                        # Check if the assigned value is a mutable type
                        if isinstance(stmt.value, ast.Call):
                            if (isinstance(stmt.value.func, ast.Name) and
                                stmt.value.func.id in MUTABLE_TYPES):
                                yield Violation(
                                    node=stmt,
                                    message=f"GM001 Module-level mutable state: {target.id}. Use functions or constants instead.",
                                )
            elif isinstance(stmt, ast.AnnAssign) and stmt.value:
                if isinstance(stmt.value, ast.Call):
                    if (isinstance(stmt.value.func, ast.Name) and
                        stmt.value.func.id in MUTABLE_TYPES):
                        yield Violation(
                            node=stmt,
                            message=f"GM001 Module-level mutable state found. Use factory functions instead.",
                        )
```

---

## Full Semgrep Configuration

### Agent-Specific Rules

```yaml
# semgrep/agent-patterns.yml
rules:
  - id: no-unvalidated-user-input
    patterns:
      - pattern: req.body.$FIELD
      - pattern-not-inside: |
          validate(...)
          ...
    message: "User input from req.body must be validated before use. Apply a schema validator at the route level."
    severity: ERROR
    languages: [javascript, typescript]

  - id: no-mock-in-production
    patterns:
      - pattern: jest.mock(...)
      - pattern-not-inside: |
          describe(...)
          ...
    message: "jest.mock() should only appear in test files. Remove from production code."
    severity: ERROR
    languages: [typescript, javascript]

  - id: consistent-error-response
    patterns:
      - pattern: res.status($CODE).json({ $...REST })
      - pattern-not: res.status($CODE).json({ error: { ... } })
    message: "API errors should follow RFC 7807 format: { error: { code, message, ... } }"
    severity: WARNING
    languages: [javascript, typescript]

  - id: no-process-exit
    pattern: process.exit(...)
    message: "process.exit() prevents graceful shutdown. Throw an error or use the shutdown handler."
    severity: ERROR
    languages: [javascript, typescript]
```

### Performance Pattern Rules

```yaml
# semgrep/performance.yml
rules:
  - id: n-plus-one-query-pattern
    patterns:
      - pattern: |
          for ($ITEM of $COLLECTION) {
            await $DB.query(...)
          }
    message: "Potential N+1 query pattern. Batch the query outside the loop or use a join."
    severity: WARNING
    languages: [javascript, typescript]

  - id: no-unbounded-array-creation
    patterns:
      - pattern: |
          $ARR = $RESULTS.map(...)
      - pattern-not-inside: |
          ... limit ...
          ...
    message: "Unbounded array operations can cause memory issues. Ensure results are paginated or limited."
    severity: WARNING
    languages: [javascript, typescript]

  - id: no-sync-operations-in-async
    patterns:
      - pattern-inside: |
          async function $F(...) {
            ...
          }
      - pattern-either:
          - pattern: readFileSync(...)
          - pattern: writeFileSync(...)
          - pattern: existsSync(...)
    message: "Synchronous file operations in async functions block the event loop. Use fs.promises or fs/promes."
    severity: ERROR
    languages: [javascript, typescript]
```

---

## Structural Test Examples

Structural tests verify architectural properties as testable invariants. These complement linters by checking runtime properties.

```javascript
// tests/structural/dependency-graph.test.js
const madge = require('madge');

describe('Dependency Graph', () => {
  it('has no circular dependencies', async () => {
    const res = await madge(['src/'], {
      fileExtensions: ['ts'],
      detectiveOptions: { ts: { skipTypeImports: true } },
    });
    const cycles = res.circular();
    expect(cycles).toHaveLength(0);
  });

  it('enforces layer boundaries', async () => {
    const res = await madge(['src/'], {
      fileExtensions: ['ts'],
    });
    const graph = res.obj();

    const layers = { types: 1, config: 2, data: 3, services: 4, routes: 5 };

    for (const [file, deps] of Object.entries(graph)) {
      const fileLayer = getLayer(file);
      if (!fileLayer) continue;

      for (const dep of deps) {
        const depLayer = getLayer(dep);
        if (!depLayer) continue;

        if (layers[depLayer] > layers[fileLayer]) {
          throw new Error(
            `Layer violation: ${file} (${fileLayer}) imports ${dep} (${depLayer})`
          );
        }
      }
    }
  });
});

function getLayer(filepath) {
  const match = filepath.match(/src\/(\w+)\//);
  return match ? match[1] : null;
}
```

```javascript
// tests/structural/test-coverage.test.js
const fs = require('fs');
const path = require('path');

describe('Test File Pairing', () => {
  it('every source file has a corresponding test file', () => {
    const srcDir = 'src/';
    const testDir = 'tests/';

    const srcFiles = getSourceFiles(srcDir);
    const testFiles = getSourceFiles(testDir);

    const untested = srcFiles.filter(src => {
      const testName = src.replace('src/', 'tests/').replace('.ts', '.test.ts');
      return !testFiles.includes(testName);
    });

    // Allow certain files to be untested
    const allowedUntested = ['index.ts', 'types.ts', 'constants.ts'];
    const problematic = untested.filter(
      f => !allowedUntested.includes(path.basename(f))
    );

    expect(problematic).toHaveLength(0);
  });
});

function getSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true })
    .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .map(f => path.join(dir, f));
}
```

---

## Progressive Enforcement Strategy

When introducing new linter rules to an existing codebase, use progressive enforcement:

| Week | Action | Linter Setting |
|------|--------|---------------|
| 1 | Add rule, log violations | `"warn"` |
| 2 | Fix top 10 violations manually | `"warn"` |
| 3 | Agent fixes remaining violations | `"warn"` |
| 4 | All violations resolved | `"error"` |
| 5+ | Block PRs on violation | CI gate |

```yaml
# .github/workflows/lint-check.yml
name: Lint Gate
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Run linters
        run: npm run lint -- --max-warnings=0  # Zero warnings = strict mode
      - name: Run structural tests
        run: npm run test:structural
      - name: Run Semgrep
        uses: semgrep/semgrep-action@v1
        with:
          config: >-
            semgrep/architecture.yml,
            semgrep/security.yml,
            semgrep/agent-patterns.yml,
            semgrep/performance.yml
```

---

## The `agent-fix` CLI

The `agent-fix` tool is a thin Node.js wrapper around ESLint that provides agent-friendly output formatting and controlled auto-fix behavior. It is designed to be invoked by AI coding agents as part of their self-review cycle (see Chapter 16). The key design goals: (1) output is machine-parseable JSON, not human-oriented terminal formatting; (2) auto-fix runs are limited to prevent infinite loops; (3) exit codes are meaningful — 0 = clean, 1 = fixable errors remain, 2 = unfixable errors.

```javascript
#!/usr/bin/env node
// agent-fix.js — Agent-friendly ESLint wrapper with auto-fix and JSON output
// Usage: node agent-fix.js [--fix] [--max-fix-rounds 3] [files...]
//   --fix              Auto-fix lint errors (default: dry-run)
//   --max-fix-rounds   Maximum auto-fix iterations (default: 3)
//   --json             Output JSON (default: true for non-TTY)
// Exit codes: 0 = clean, 1 = fixable errors remain, 2 = unfixable errors

const { ESLint } = require('eslint');
const fs = require('fs');

const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const maxRounds = parseInt(args.find(a => a.startsWith('--max-fix-rounds='))?.split('=')[1] || '3', 10);
const files = args.filter(a => !a.startsWith('--')) ;
const targets = files.length > 0 ? files : ['src/'];

async function run() {
  const eslint = new ESLint({ fix: shouldFix, errorOnUnmatchedPattern: false });
  let round = 0;
  let results;

  do {
    results = await eslint.lintFiles(targets);
    if (shouldFix) await ESLint.outputFixes(results);
    round++;
  } while (shouldFix && results.some(r => r.output !== undefined) && round < maxRounds);

  const errors = results.reduce((sum, r) => sum + r.errorCount, 0);
  const warnings = results.reduce((sum, r) => sum + r.warningCount, 0);
  const fixable = results.reduce((sum, r) => sum + (r.fixableErrorCount + r.fixableWarningCount), 0);

  const summary = {
ound, errors, warnings, fixable, files: results.length, results: results.map(r => ({
    filePath: r.filePath,
    messages: r.messages.map(m => ({
      line: m.line, column: m.column, severity: m.severity,
      ruleId: m.ruleId, message: m.message, fixable: !!m.fix,
    })),
  }))};

  // Write JSON to stdout (agents parse this)
  console.log(JSON.stringify(summary, null, 2));

  // Meaningful exit codes
  if (errors > 0 && fixable === 0) process.exit(2);  // Unfixable
  if (errors > 0 || warnings > 0) process.exit(1);    // Fixable remain
  process.exit(0);                                    // Clean
}

run().catch(e => { console.error(JSON.stringify({ error: e.message })); process.exit(2); });
```

Install and wire into your package.json:

```json
{
  "scripts": {
    "lint:agent": "node scripts/agent-fix.js",
    "lint:agent:fix": "node scripts/agent-fix.js --fix"
  }
}
```

**Agent usage:** When an agent finishes coding, it runs `npm run lint:agent`. If exit code is 1, it runs `npm run lint:agent:fix` and re-checks. If exit code is 2, it knows there are unfixable errors it must address manually. The JSON output lists exact file, line, rule, and message for each violation.

---

## Python Equivalents Using Ruff and import-linter

The following provides Python equivalents for three rules that currently only have ESLint implementations in this appendix. Each uses Ruff (the standard Python linter) or import-linter (for dependency-layer enforcement).

### Python Rule 1: Dependency Direction Enforcement (import-linter)

This replaces the custom ESLint `dependency-direction` rule for Python projects using FastAPI or Django.

```ini
# .import-linter.contracts
[importlinter:contract: FastAPI - Inward-only dependencies]
name = Enforce layer ordering: routers -> services -> repositories -> models -> schemas
type = layers
layers =
    routers
    services
    repositories
    models
    schemas
containers =
    app.routers
    app.services
    app.repositories
    app.models
    app.schemas

[importlinter:contract: Domain layer has no external imports]
name = Domain models must not import from application layers
type = forbidden
source_modules =
    app.models
forbidden_modules =
    app.services
    app.repositories
    app.routers
```

Run in CI:
```yaml
- name: Check dependency layers
  run: lint-imports --config .import-linter.contracts
```

### Python Rule 2: Structured Logging (Ruff Custom Rule)

This replaces the custom ESLint `structured-logging` rule for Python projects using `structlog` or the standard `logging` module.

```python
# ruff_rules/structured_logging.py
"""Enforce structured logging in Python code.
Flag logging calls that use f-strings, .format(), or string concatenation
instead of structured key-value arguments.
"""
import ast
from ruff_python_ast import ASTChecker, Violation

class StructuredLoggingChecker(ASTChecker):
    """Flag logging calls that use f-strings or string concatenation."""

    name = "structured-logging"

    def visit_Call(self, node):
        # Check if it's a logging call: logger.info(), log.warning(), etc.
        if not (isinstance(node.func, ast.Attribute)
                and node.func.attr in ('info', 'warning', 'error', 'debug', 'critical')
                and isinstance(node.func.value, ast.Name)
                and node.func.value.id in ('logger', 'log', 'logging')):
            return

        first_arg = node.args[0] if node.args else None
        if not first_arg:
            return

        # Flag f-strings in log calls
        if isinstance(first_arg, ast.JoinedStr):
            yield Violation(
                node=first_arg,
                message="SL001 Use structured logging: logger.info('message', key=value) "
                        "instead of f-strings",
            )

        # Flag string concatenation
        if isinstance(first_arg, ast.BinOp) and isinstance(first_arg.op, ast.Add):
            yield Violation(
                node=first_arg,
                message="SL001 Use structured logging: logger.info('message', key=value) "
                        "instead of string concatenation",
            )

        # Flag .format() calls in log messages
        if (isinstance(first_arg, ast.Call)
                and isinstance(first_arg.func, ast.Attribute)
                and first_arg.func.attr == 'format'):
            yield Violation(
                node=first_arg,
                message="SL001 Use structured logging: logger.info('message', key=value) "
                        "instead of .format()",
            )
```

Register in `pyproject.toml`:
```toml
[tool.ruff]
select = ["E", "F", "W", "SL"]
external = ["SL"]
```

### Python Rule 3: Error Remediation (Ruff Custom Rule)

This replaces the custom ESLint `error-remediation` rule for Python projects.

```python
# ruff_rules/error_remediation.py
"""Ensure raised exceptions include remediation context.
Flag bare raise Exception('message') without a structured error class
or without including a remedy/hint field.
"""
import ast
from ruff_python_ast import ASTChecker, Violation

ALLOWED_EXCEPTION_BASES = {'AppError', 'DomainError', 'ServiceError'}

class ErrorRemediationChecker(ASTChecker):
    """Flag bare raise statements that lack remediation guidance."""

    name = "error-remediation"

    def visit_Raise(self, node):
        if not node.exc:
            return  # bare `raise` is fine (re-raising)

        # Check if it's a new-style exception instantiation
        if isinstance(node.exc, ast.Call):
            func = node.exc.func
            if isinstance(func, ast.Name):
                # If it's a known structured exception class, it's fine
                if func.id in ALLOWED_EXCEPTION_BASES:
                    return
                # Plain Exception or ValueError without structured context — flag it
                if func.id in ('Exception', 'RuntimeError', 'ValueError'):
                    # Check if it has keyword args like 'remedy' or 'hint'
                    has_remedy = any(
                        kw.arg in ('remedy', 'hint', 'remediation')
                        for kw in node.exc.keywords
                    )
                    if not has_remedy:
                        yield Violation(
                            node=node,
                            message="ER001 Exceptions should include remediation. "
                                    "Use AppError(code, remedy='How to fix') or "
                                    "add a remedy keyword argument.",
                        )
```

---

## Semgrep Rule: No Business Logic in UI Layer (Language-Agnostic)

This Semgrep rule enforces the separation of concerns principle (GP-22) across TypeScript, Python, and Go simultaneously. It detects when business logic (database queries, external API calls, complex calculations) leaks into UI/route/transport handler layers.

```yaml
# semgrep/no-business-logic-in-ui.yml
rules:
  # === TypeScript / Express ===
  - id: no-business-logic-in-express-routes
    patterns:
      - pattern-inside: |
          $APP.$METHOD($PATH, async ($REQ, $RES) => { ... })
      - pattern-either:
          - pattern: await $DB.$QUERY(...)
          - pattern: $POOL.query($SQL, ...)
          - pattern: fetch($URL, ...)
          - pattern: axios.$METHOD(...)
          - pattern: |
              for await ($ITEM of $COLL) { ... }
      - pattern-not-inside: |
          $SERVICE.$METHOD(...)
    message: >
      Business logic detected in route handler. Route handlers should
      extract, validate, and delegate to a service. Move DB queries,
      API calls, and loops into a service function.
    severity: ERROR
    languages: [typescript]

  # === Python / FastAPI ===
  - id: no-business-logic-in-fastapi-routes
    patterns:
      - pattern-inside: |
          @$ROUTER.$METHOD($PATH)
          async def $FUNC(...): ...
      - pattern-either:
          - pattern: await $DB.$QUERY(...)
          - pattern: $SESSION.execute($SQL, ...)
          - pattern: $SESSION.query(...)
          - pattern: httpx.$METHOD(...)
          - pattern: requests.$METHOD(...)
          - pattern: |
              for $ITEM in $COLL: ...
      - pattern-not-inside: |
          await $SERVICE.$METHOD(...)
    message: >
      Business logic detected in FastAPI route handler. Route handlers
      should validate input, delegate to a service, and return. Move
      DB queries, HTTP calls, and loops into a service function.
    severity: ERROR
    languages: [python]

  # === Go / net/http or gRPC ===
  - id: no-business-logic-in-go-handlers
    patterns:
      - pattern-inside: |
          func $FUNC($W http.ResponseWriter, $R *http.Request) { ... }
      - pattern-either:
          - pattern: $DB.Query($CTX, $SQL, ...)
          - pattern: $DB.Exec($CTX, $SQL, ...)
          - pattern: $HTTP.Get($URL, ...)
          - pattern: $HTTP.Post($URL, ...)
      - pattern-not-inside: |
          $SVC.$METHOD(...)
    message: >
      Business logic detected in HTTP handler. Handlers should parse
      request, validate, delegate to a service, and write response.
      Move DB queries and HTTP calls into a service method.
    severity: ERROR
    languages: [go]

  # === Generic: Database imports in handler/transport directories ===
  - id: no-database-import-in-transport-layer
    patterns:
      - pattern-inside: |
          import $MOD
      - pattern-either:
          - pattern: |
              import ".../database"
          - pattern: |
              import ".../repository"
          - pattern: |
              import ".../store"
          - pattern: |
              import ".../sql"
    message: >
      Data-layer import detected in a transport/handler file. Handlers
      should only import service-layer interfaces, never data-layer
      implementations directly.
    severity: ERROR
    languages: [go, python, typescript]
    paths:
      include:
        - "**/transport/**"
        - "**/handlers/**"
        - "**/routers/**"
        - "**/routes/**"
        - "**/controllers/**"
```

Wire this into CI alongside the existing Semgrep configuration:

```yaml
- name: Run Semgrep
  uses: semgrep/semgrep-action@v1
  with:
    config: >-
      semgrep/architecture.yml,
      semgrep/security.yml,
      semgrep/agent-patterns.yml,
      semgrep/performance.yml,
      semgrep/no-business-logic-in-ui.yml
```

This rule set catches the most common agent mistake: generating a route handler that reaches directly into the database instead of delegating to a service layer. By enforcing this across TypeScript, Python, and Go simultaneously, teams with polyglot repositories get consistent architectural protection regardless of which language the agent generates code in.
