# Chapter 12: Linters, Rules, and Automated Governance

> "A linter error message is a conversation with your future self—and with every agent that will ever touch this code."

In the early days of the OpenAI harness engineering project, the team discovered that their agent-generated codebase was accumulating a specific pattern: every error handler followed a different structure. Some logged the error and re-threw it. Some logged it and returned null. Some caught errors broadly and handled them the same way regardless of type. A few silently swallowed exceptions entirely.

The problem wasn't that the agent was writing bad code. The problem was that the agent had no way to know what "good" error handling looked like in this specific codebase. The existing error handlers in the codebase were inconsistent, so the agent learned inconsistent patterns.

The solution was a custom Semgrep rule that enforced a specific error handling pattern across the entire codebase. Within days of deploying the rule, every new error handler followed the same structure. And because the rule included a clear error message with remediation guidance, the agent learned the pattern from the linter itself.

This chapter is about building the governance layer—the linters, rules, and automated checks that turn architectural principles into machine-enforced guarantees. This is where the discipline of harness engineering becomes most concrete.

---

## AST-Based Linting for Precision

Abstract Syntax Tree (AST) analysis is the gold standard for code linting. Unlike regex-based approaches, AST analysis understands the structure of code—it can distinguish between a function call and a variable declaration, between an import statement and a string literal, between a type annotation and a comment.

### How AST Linting Works

When you run ESLint on a TypeScript file, here's what happens:

1. The TypeScript parser reads the source code and produces an AST—a tree structure representing the code's syntax
2. ESLint walks the tree, visiting each node
3. Your custom rule's visitor functions are called for each matching node type
4. If your rule detects a violation, it reports a diagnostic with a message and location

```
Source code:                          AST:
                                     
import { Order } from "./order";      ImportDeclaration
                                       ├── ImportClause
                                       │    └── Identifier ("Order")
export class OrderService {            └── StringLiteral ("./order")
  constructor(                        ClassDeclaration
    private repo: OrderRepository      ├── Identifier ("OrderService")
  ) {}                                └── Constructor
                                         └── Parameter
  async create(                            ├── Identifier ("repo")
    items: OrderItem[]                     └── TypeReference
  ): Promise<Order> {                          └── Identifier ("OrderRepository")
    const order = new Order(items);   MethodDeclaration
    await this.repo.save(order);      ├── Identifier ("create")
    return order;                     ├── Parameter
  }                                   │    └── Identifier ("items")
}                                     └── BlockStatement
                                          ├── VariableDeclaration
                                          │    └── NewExpression
                                          ├── ExpressionStatement (await)
                                          └── ReturnStatement
```

Your custom rules traverse this tree and enforce constraints that would be impossible with text-based patterns.

---

## ESLint Custom Rules: The Complete Guide

ESLint is the most extensible linter in the JavaScript/TypeScript ecosystem. Its plugin architecture lets you write custom rules that enforce your team's specific architectural conventions.

### Setting Up a Custom ESLint Plugin

```
eslint-plugin-your-rules/
├── src/
│   ├── rules/
│   │   ├── enforce-dependency-direction.ts
│   │   ├── enforce-barrel-imports.ts
│   │   ├── no-database-in-api.ts
│   │   ├── enforce-error-handling.ts
│   │   ├── enforce-structured-logging.ts
│   │   └── index.ts
│   └── index.ts
├── tests/
│   └── rules/
│       ├── enforce-dependency-direction.test.ts
│       ├── enforce-barrel-imports.test.ts
│       └── ...
├── package.json
├── tsconfig.json
└── README.md
```

### Rule 1: Enforce Structured Logging

This rule ensures that all logging calls use structured format (objects with labels) rather than string interpolation:

```typescript
// src/rules/enforce-structured-logging.ts
import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  name => `https://docs.example.com/lint-rules/${name}`
);

export const enforceStructuredLogging = createRule({
  name: "enforce-structured-logging",
  meta: {
    type: "problem",
    docs: {
      description: "Enforce structured logging format for agent readability",
      recommended: "error",
    },
    messages: {
      stringInterpolation: (
        "Use structured logging instead of string interpolation. " +
        "Replace: logger.info(`User {{name}} logged in`) " +
        "With: logger.info('user_logged_in', { name })"
      ),
      missingContext: (
        "Logging call '{{method}}' should include a context object. " +
        "Replace: logger.{{method}}('message') " +
        "With: logger.{{method}}('message', { relevantData })"
      ),
      genericMessage: (
        "Use a specific, searchable log message instead of a generic one. " +
        "Replace: logger.info('success') " +
        "With: logger.info('order_created', { orderId })"
      ),
    },
    schema: [
      {
        type: "object",
        properties: {
          logMethods: {
            type: "array",
            items: { type: "string" },
            default: ["info", "warn", "error", "debug"],
          },
          requireContext: {
            type: "boolean",
            default: true,
          },
          bannedPatterns: {
            type: "array",
            items: { type: "string" },
            default: ["success", "error", "done", "failed", "ok"],
          },
        },
      },
    ],
  },

  defaultOptions: [
    {
      logMethods: ["info", "warn", "error", "debug"],
      requireContext: true,
      bannedPatterns: ["success", "error", "done", "failed", "ok"],
    },
  ],

  create(context, [options]) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        // Check if this is a logger call
        if (
          node.callee.type !== "MemberExpression" ||
          node.callee.property.type !== "Identifier"
        ) return;

        const method = node.callee.property.name;
        if (!options.logMethods.includes(method)) return;

        // Check the first argument (the message)
        const firstArg = node.arguments[0];
        if (!firstArg) return;

        // Check for string interpolation (template literals)
        if (firstArg.type === "TemplateLiteral" && firstArg.expressions.length > 0) {
          context.report({
            node: firstArg,
            messageId: "stringInterpolation",
          });
          return;
        }

        // Check for string concatenation
        if (
          firstArg.type === "BinaryExpression" &&
          firstArg.operator === "+"
        ) {
          context.report({
            node: firstArg,
            messageId: "stringInterpolation",
          });
          return;
        }

        // Check for generic messages
        if (firstArg.type === "Literal" && typeof firstArg.value === "string") {
          const message = firstArg.value.toLowerCase();
          
          for (const banned of options.bannedPatterns) {
            if (message === banned || message.startsWith(banned + " ") || message.endsWith(" " + banned)) {
              context.report({
                node: firstArg,
                messageId: "genericMessage",
              });
              break;
            }
          }
        }

        // Check for missing context object
        if (options.requireContext && node.arguments.length < 2) {
          // Error calls might not need context if they have an error object
          if (method === "error" && node.arguments.length === 1) {
            // Acceptable: logger.error("message") when error is in the stack
            return;
          }
          
          context.report({
            node,
            messageId: "missingContext",
            data: { method },
          });
        }
      },
    };
  },
});
```

### Rule 2: Enforce Error Handling Pattern

This rule ensures that all async operations have proper error handling with structured error types:

```typescript
// src/rules/enforce-error-handling.ts
import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  name => `https://docs.example.com/lint-rules/${name}`
);

export const enforceErrorHandling = createRule({
  name: "enforce-error-handling",
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce structured error handling with typed errors",
      recommended: "error",
    },
    messages: {
      bareCatch: (
        "Catch block should use a typed error class, not bare Error. " +
        "Replace: catch (e) " +
        "With: catch (e) { if (e instanceof AppError) ... } " +
        "or use a typed catch handler."
      ),
      silentCatch: (
        "Catch block is empty or only contains a comment. " +
        "Every caught error should be either: " +
        "1) Logged with structured logging, " +
        "2) Re-thrown with additional context, or " +
        "3) Transformed into a typed application error."
      ),
      catchWithoutRemediation: (
        "Error log in catch block should include remediation guidance. " +
        "This helps agents (and humans) understand how to fix the error."
      ),
      unsafeAwaitWithoutTryCatch: (
        "Awaited operation in a non-try-catch context. " +
        "External operations (database calls, HTTP requests) should be " +
        "wrapped in try-catch with structured error handling."
      ),
    },
    schema: [],
  },

  defaultOptions: [],

  create(context) {
    let isInTryCatch = false;

    return {
      CatchClause(node: TSESTree.CatchClause) {
        const prevIsInTryCatch = isInTryCatch;
        isInTryCatch = true;

        // Check for bare catch parameter
        if (
          node.param &&
          node.param.type === "Identifier" &&
          node.param.name === "e"
        ) {
          // Check if 'e' is used with instanceof
          const body = node.body;
          const hasInstanceofCheck = body.statements.some(stmt => {
            const source = context.getSourceCode().getText(stmt);
            return source.includes("instanceof");
          });

          if (!hasInstanceofCheck) {
            context.report({
              node: node.param,
              messageId: "bareCatch",
            });
          }
        }

        // Check for silent catch
        if (node.body.statements.length === 0 || 
            (node.body.statements.length === 1 &&
             node.body.statements[0].type === "EmptyStatement")) {
          context.report({
            node: node.body,
            messageId: "silentCatch",
          });
        }

        // Check for catch without remediation in error log
        const bodyText = context.getSourceCode().getText(node.body);
        if (bodyText.includes("logger.error") && !bodyText.includes("remediation")) {
          context.report({
            node: node.body,
            messageId: "catchWithoutRemediation",
          });
        }

        isInTryCatch = prevIsInTryCatch;
      },

      AwaitExpression(node: TSESTree.AwaitExpression) {
        // Check if this await is inside a try-catch
        if (isInTryCatch) return;

        // Check if the awaited expression is an external operation
        const source = context.getSourceCode().getText(node.argument);
        const externalPatterns = [
          /\.query\(/,
          /\.fetch\(/,
          /\.execute\(/,
          /\.send\(/,
          /\.call\(/,
          /axios\./,
          /fetch\(/,
          /prisma\./,
          /redis\./,
        ];

        const isExternal = externalPatterns.some(p => p.test(source));
        if (isExternal) {
          context.report({
            node,
            messageId: "unsafeAwaitWithoutTryCatch",
          });
        }
      },
    };
  },
});
```

### Rule 3: No Database Access in API Layer

This rule prevents database queries from leaking into API route handlers:

```typescript
// src/rules/no-database-in-api.ts
import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  name => `https://docs.example.com/lint-rules/${name}`
);

export const noDatabaseInApi = createRule({
  name: "no-database-in-api",
  meta: {
    type: "problem",
    docs: {
      description: "Prevent direct database access in API layer",
      recommended: "error",
    },
    messages: {
      directDbAccess: (
        "API layer should not access the database directly. " +
        "Use a service class instead. " +
        "Move this database call to a repository in the data layer, " +
        "and call it through a service in the services layer."
      ),
      directRepoImport: (
        "API layer should not import repository implementations. " +
        "Import service classes from the services layer instead. " +
        "The service layer encapsulates data access."
      ),
    },
    schema: [],
  },

  defaultOptions: [],

  create(context) {
    const filename = context.getFilename();
    
    // Only check API layer files
    if (!filename.includes("/api/") && !filename.includes("\\api\\")) return {};

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        const source = node.source.value;
        
        // Check for imports from data layer
        if (
          typeof source === "string" && (
            source.includes("/data/") ||
            source.includes("\\data\\") ||
            source.includes("/repository") ||
            source.includes("\\repository") ||
            source.includes("/repositories") ||
            source.includes("\\repositories")
          )
        ) {
          context.report({
            node,
            messageId: "directRepoImport",
          });
        }
      },

      // Check for raw SQL or ORM calls
      CallExpression(node: TSESTree.CallExpression) {
        if (node.callee.type !== "MemberExpression") return;
        
        const source = context.getSourceCode().getText(node.callee);
        
        const dbPatterns = [
          /\.query\(/,
          /\.raw\(/,
          /\.execute\(/,
          /\.findMany\(/,
          /\.findUnique\(/,
          /\.create\(/,
          /\.update\(/,
          /\.deleteMany\(/,
          /prisma\./,
          /knex\./,
          /sequelize\./,
          /typeorm\./,
          /dataSource\./,
        ];

        if (dbPatterns.some(p => p.test(source))) {
          context.report({
            node,
            messageId: "directDbAccess",
          });
        }
      },

      // Check for SQL string literals
      TemplateLiteral(node: TSESTree.TemplateLiteral) {
        const parent = node.parent;
        if (parent?.type === "CallExpression") {
          const parentSource = context.getSourceCode().getText(parent);
          if (/SELECT|INSERT|UPDATE|DELETE|FROM|WHERE/i.test(parentSource)) {
            context.report({
              node,
              messageId: "directDbAccess",
            });
          }
        }
      },
    };
  },
});
```

### Registering Custom Rules

```typescript
// src/index.ts — Plugin entry point
import { ESLintUtils } from "@typescript-eslint/utils";

import { enforceDependencyDirection } from "./rules/enforce-dependency-direction";
import { enforceBarrelImports } from "./rules/enforce-barrel-imports";
import { enforceStructuredLogging } from "./rules/enforce-structured-logging";
import { enforceErrorHandling } from "./rules/enforce-error-handling";
import { noDatabaseInApi } from "./rules/no-database-in-api";

const createRule = ESLintUtils.RuleCreator(
  name => `https://docs.example.com/lint-rules/${name}`
);

module.exports = {
  meta: {
    name: "eslint-plugin-arch-rules",
    version: "1.0.0",
  },
  rules: {
    "enforce-dependency-direction": enforceDependencyDirection,
    "enforce-barrel-imports": enforceBarrelImports,
    "enforce-structured-logging": enforceStructuredLogging,
    "enforce-error-handling": enforceErrorHandling,
    "no-database-in-api": noDatabaseInApi,
  },
  configs: {
    recommended: {
      plugins: ["arch-rules"],
      rules: {
        "arch-rules/enforce-dependency-direction": "error",
        "arch-rules/enforce-barrel-imports": "error",
        "arch-rules/enforce-structured-logging": "error",
        "arch-rules/enforce-error-handling": "warn",
        "arch-rules/no-database-in-api": "error",
      },
    },
  },
};
```

---

## Ruff for Python Codebases

For Python codebases, Ruff is the modern linter of choice—replacing Flake8, isort, and pyupgrade with a single, Rust-based tool that runs 10–100× faster. As of this writing, Ruff does not yet support third-party custom rule plugins (the plugin API is under active development; see [GitHub issue #283](https://github.com/astral-sh/ruff/issues/283)). However, Ruff's built-in rule set covers the vast majority of architectural concerns, and its configuration is expressive enough to encode most team conventions.

### Ruff's Built-In Rules for Architectural Enforcement

Ruff ships with over 800 rules. For governance, the most relevant rule categories include:

- **Import sorting and organization** (`isort`-compatible): Enforces consistent import ordering, groupingstdlib, third-party, and first-party imports separately—essential for making dependency direction visible at a glance.
- **Banned imports** (`TID251`): Ruff can ban specific modules from being imported, which directly enforces layer boundaries:

```toml
# ruff.toml — Enforce dependency direction by banning imports

[lint]
select = ["I", "TID251"]

[lint.flake8-tidy-imports.banned-api]
"src.data".msg = "Do not import data layer directly. Use src.services instead."
"src.ui".msg = "Do not import UI layer from business logic. Dependencies must flow inward."
"src.templates".msg = "Do not import templates from services. Use dependency inversion."
```

- **Function complexity limits** (`C901`): Enforces a maximum cyclomatic complexity, preventing god functions from accumulating in the codebase.
- **File and function length** (`PLR0913`, `PLR0915`): Limits parameters per function and statements per function body, keeping modules small and focused.

### When You Need Custom Rules: Semgrep as the Python Governance Tool

When Ruff's built-in rules aren't enough—such as enforcing "no database access in route handlers" or "no business logic in UI components"—use Semgrep. The Semgrep rules shown earlier in this chapter ("No database queries outside the data layer," "Use typed errors," "No silent exception swallowing") work directly on Python code and provide the custom governance layer that Ruff doesn't yet support.

For teams that need fully programmatic Python linting today, Pylint remains a viable option—it supports custom checker plugins via a well-documented Python API. However, Pylint's speed (significantly slower than Ruff) makes it better suited as a CI-time check rather than an editor-time tool.

> **Note:** Ruff's third-party plugin API is under active development. When it ships, it will enable the same kind of custom AST-based rules that ESLint provides for TypeScript. Until then, the combination of Ruff's built-in rules (for import organization, complexity, and banned APIs) plus Semgrep (for custom architectural patterns) provides comprehensive Python governance. See Appendix D for a working example of a Pylint custom checker covering the "no database in routes" pattern.

---

## Go/ast for Go Codebases

Go's standard library includes the `go/ast` and `go/parser` packages, making custom linting straightforward without external tools:

```go
// lint/arch_rules.go
package lint

import (
    "fmt"
    "go/ast"
    "go/parser"
    "go/token"
    "os"
    "path/filepath"
    "strings"
)

type Violation struct {
    File    string
    Line    int
    Rule    string
    Message string
}

// LayerDependencyRule checks that dependencies flow inward
func LayerDependencyRule(fset *token.FileSet, file *ast.File, filePath string) []Violation {
    var violations []Violation
    
    layers := map[string]int{
        "ui":       0,
        "api":      1,
        "services": 2,
        "domain":   3,
        "data":     4,
        "config":   5,
    }
    
    // Determine the layer of the current file
    fromLayer := getLayer(filePath, layers)
    if fromLayer == "" {
        return violations
    }
    
    // Check all imports
    for _, imp := range file.Imports {
        importPath := strings.Trim(imp.Path.Value, "\"")
        
        // Skip standard library and external packages
        if !strings.Contains(importPath, "myproject/") {
            continue
        }
        
        toLayer := getLayer(importPath, layers)
        if toLayer == "" {
            continue
        }
        
        // Check direction: fromLayer can only import from lower layers (higher number)
        if layers[toLayer] < layers[fromLayer] {
            violations = append(violations, Violation{
                File: filePath,
                Line: fset.Position(imp.Pos()).Line,
                Rule: "ARCH001",
                Message: fmt.Sprintf(
                    "Layer '%s' cannot import from '%s'. Dependencies must flow inward.",
                    fromLayer, toLayer,
                ),
            })
        }
    }
    
    return violations
}

// NoGodObjectRule checks that structs don't have too many dependencies
func NoGodObjectRule(fset *token.FileSet, file *ast.File, filePath string) []Violation {
    var violations []Violation
    maxFields := 7
    
    for _, decl := range file.Decls {
        genDecl, ok := decl.(*ast.GenDecl)
        if !ok {
            continue
        }
        
        for _, spec := range genDecl.Specs {
            typeSpec, ok := spec.(*ast.TypeSpec)
            if !ok {
                continue
            }
            
            structType, ok := typeSpec.Type.(*ast.StructType)
            if !ok {
                continue
            }
            
            fieldCount := len(structType.Fields.List)
            if fieldCount > maxFields {
                violations = append(violations, Violation{
                    File: filePath,
                    Line: fset.Position(typeSpec.Pos()).Line,
                    Rule: "ARCH002",
                    Message: fmt.Sprintf(
                        "Struct '%s' has %d fields (max %d). Consider splitting into smaller structs.",
                        typeSpec.Name.Name, fieldCount, maxFields,
                    ),
                })
            }
        }
    }
    
    return violations
}

func getLayer(path string, layers map[string]int) string {
    for layer := range layers {
        if strings.Contains(path, "/"+layer+"/") || strings.Contains(path, "\\"+layer+"\\") {
            return layer
        }
    }
    return ""
}

// LintDirectory runs all architectural rules on a directory
func LintDirectory(dir string) ([]Violation, error) {
    var allViolations []Violation
    fset := token.NewFileSet()
    
    err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
        if err != nil || !strings.HasSuffix(path, ".go") {
            return nil
        }
        
        // Skip test files and generated files
        if strings.HasSuffix(path, "_test.go") || strings.Contains(path, "generated") {
            return nil
        }
        
        file, err := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
        if err != nil {
            return nil
        }
        
        allViolations = append(allViolations, LayerDependencyRule(fset, file, path)...)
        allViolations = append(allViolations, NoGodObjectRule(fset, file, path)...)
        
        return nil
    })
    
    return allViolations, err
}
```

---

## Semgrep for Pattern-Based Cross-Language Linting

Semgrep is a pattern-matching tool that works across dozens of languages. Unlike AST-based linters that require language-specific plugins, Semgrep uses a unified pattern syntax that works consistently across Python, JavaScript, Go, Java, Ruby, and more.

### Why Semgrep?

1. **Cross-language**: Write one rule that works across your entire polyglot codebase
2. **Pattern-based**: Express violations as code patterns, not AST traversal logic
3. **Easy to write**: Rules are YAML, not JavaScript or Python
4. **Fast**: Runs in seconds, even on large codebases
5. **CI-ready**: Integrates with GitHub Actions, GitLab CI, and every major CI system

### Custom Semgrep Rules

```yaml
# .semgrep/architecture.yml
rules:
  # Rule 1: No database queries outside the data layer
  - id: no-database-outside-data-layer
    languages: [python, typescript, javascript]
    severity: ERROR
    message: |
      Database query detected outside the data layer.
      Move database access to src/data/ and call through a service.
      See: docs/architecture.md#data-layer
    patterns:
      - pattern-either:
          # Python patterns
          - pattern: session.query(...)
          - pattern: session.execute(...)
          - pattern: db.query(...)
          - pattern: cursor.execute(...)
          # TypeScript patterns
          - pattern: prisma.$MODEL.findMany(...)
          - pattern: this.db.query(...)
          - pattern: knex($TABLE).select(...)
          - pattern: $REPO.find(...)
      - pattern-not-inside: |
          src/data/...
    paths:
      exclude:
        - src/data/**
        - tests/**
        - migrations/**

  # Rule 2: Error handling must include structured error types
  - id: use-typed-errors
    languages: [python, typescript]
    severity: WARNING
    message: |
      Use a typed error class instead of generic Error.
      Create a subclass of AppError with an error code and remediation guidance.
      Example: class OrderNotFoundError(AppError): ...
    patterns:
      - pattern: raise Exception(...)
      - pattern: throw new Error(...)
    fix: |
      # Replace with a typed error:
      # raise AppError("ERROR_CODE", "message", remediation="how to fix")

  # Rule 3: No silent exception swallowing
  - id: no-silent-exception
    languages: [python]
    severity: ERROR
    message: |
      Exception caught and silently ignored. Every caught exception should be:
      1) Logged with structured logging
      2) Re-raised with additional context
      3) Transformed into a typed application error
    pattern: |
      except $EXCEPTION:
        pass

  # Rule 4: Structured logging required
  - id: structured-logging-required
    languages: [python]
    severity: WARNING
    message: |
      Use structured logging with named fields, not string formatting.
      Replace: logger.info(f"User {name} logged in")
      With: logger.info("user_logged_in", extra={"user_name": name})
    patterns:
      - pattern: logger.$METHOD(f"...")
      - pattern: logger.$METHOD("...{}".format(...))

  # Rule 5: No hard-coded secrets
  - id: no-hardcoded-secrets
    languages: [python, typescript, javascript, go, java]
    severity: ERROR
    message: |
      Hard-coded secret detected. Use environment variables or a secrets manager.
      See: docs/security.md#secrets-management
    patterns:
      - pattern-either:
          - pattern: $VAR = "...password..."
          - pattern: $VAR = "...secret..."
          - pattern: $VAR = "...api_key..."
          - pattern: $VAR = "...token..."
          - pattern: password = "..."
          - pattern: secret_key = "..."
          - pattern: api_key = "..."
      - pattern-not:
          $VAR = os.environ[...]

  # Rule 6: API endpoints must have OpenAPI documentation
  - id: api-must-be-documented
    languages: [python, typescript]
    severity: WARNING
    message: |
      API endpoint is missing documentation. Add a docstring or decorator
      that describes the endpoint, its parameters, and response format.
    patterns:
      - pattern-inside: |
          @app.$METHOD($PATH)
          def $HANDLER(...):
            ...
      - pattern-not-inside: |
          @app.$METHOD($PATH)
          """..."""
          def $HANDLER(...):
            ...
      - pattern-not-inside: |
          @$DOC_DECORATOR(...)
          @app.$METHOD($PATH)
          def $HANDLER(...):
            ...
```

### Semgrep for Security Patterns

```yaml
# .semgrep/security.yml
rules:
  - id: no-sql-injection
    languages: [python]
    severity: ERROR
    message: |
      Potential SQL injection. Use parameterized queries.
      Replace: cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
      With: cursor.execute("SELECT * FROM users WHERE id = %s", [user_id])
    patterns:
      - pattern: cursor.execute(f"...")
      - pattern: session.execute(f"...")
      - pattern: db.execute(f"...")

  - id: no-eval
    languages: [python, javascript, typescript]
    severity: ERROR
    message: "eval() is dangerous and should never be used."
    pattern: eval(...)

  - id: no-unsafe-deserialization
    languages: [python]
    severity: ERROR
    message: |
      pickle.loads() can execute arbitrary code. Use JSON or msgpack instead.
      If you must use pickle, ensure the data is from a trusted source.
    patterns:
      - pattern: pickle.loads(...)
      - pattern: pickle.load(...)
```

### Running Semgrep in CI

```yaml
# .github/workflows/semgrep.yml
name: Semgrep Governance

on:
  pull_request:
  push:
    branches: [main]

jobs:
  semgrep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >
            p/default
            p/security-audit
            p/owasp-top-ten
            .semgrep/architecture.yml
            .semgrep/security.yml
          publishToken: ${{ secrets.SEMGREP_APP_TOKEN }}
```

---

## Error Messages as Teaching Tools

The most overlooked aspect of custom linting rules is the error message. A good error message does three things:

1. **Tells you what's wrong** (the violation)
2. **Tells you why it's wrong** (the principle)
3. **Tells you how to fix it** (the remediation)

Here's the progression from bad to great error messages:

```
Bad:   "Unexpected import"
Why:   "Unexpected import" tells the developer nothing. They have to guess.

OK:    "Don't import from services in domain layer"
Why:   Better—states the rule. But doesn't explain why or how to fix.

Good:  "Domain layer cannot import from services layer. Dependencies must flow
        inward (UI → API → Services → Domain → Data → Config). See:
        docs/architecture.md#dependency-direction"
Why:   States the rule and the principle. Points to documentation.

Great: "Layer 'domain' (layer 3) cannot import from 'services' (layer 2).
        Dependencies must flow from higher layers to lower layers.
        
        Options:
        1. Move the shared code to the 'types' layer (both can import it)
        2. Define an interface in 'types' and implement it in 'services'
        3. Use dependency injection to pass the service at runtime
        
        See: docs/architecture.md#dependency-direction
        Chat: #architecture-help"
Why:   States the rule, the principle, gives three concrete fixes, and 
       points to both documentation and human help.
```

In agent-first development, the "Great" error message is the standard. An agent reading this error can:
1. Understand what it did wrong
2. Choose one of the three remediation options
3. Look up additional documentation
4. Ask for help if needed

Write your error messages for agents, not humans. Agents don't have intuition. They need explicit guidance.

### Error Message Template

```typescript
// Error message template for custom linter rules
interface LintMessage {
  // What was detected
  violation: string;
  // Why it matters
  principle: string;
  // How to fix it (prioritized options)
  remediation: string[];
  // Where to learn more
  documentation: string;
  // Rule code for quick reference
  ruleId: string;
}

// Example:
const message: LintMessage = {
  violation: "Database query detected in API route handler",
  principle: (
    "The API layer should only orchestrate request/response handling. " +
    "Business logic and data access belong in service and data layers respectively."
  ),
  remediation: [
    "Extract the database query to a repository class in src/data/",
    "Create a service method in src/services/ that calls the repository",
    "Call the service method from the route handler",
  ],
  documentation: "docs/architecture.md#layer-responsibilities",
  ruleId: "ARCH-001",
};
```

---

## Build-Time vs. CI-Time Enforcement

Not all rules need to run at the same time. Different enforcement points have different trade-offs:

| Enforcement Point | Speed | Completeness | Cost | Agent Feedback |
|---|---|---|---|---|
| Editor (IDE) | Instant | Partial | Zero | Immediate |
| Pre-commit | Fast | Moderate | Low | Before push |
| Build | Fast | Moderate | Moderate | Before deploy |
| CI | Complete | Full | Higher | Before merge |

### Progressive Enforcement Strategy

**Editor Time** (warnings, instant feedback):
- Style issues (formatting, naming)
- Suspicious patterns (empty catch, missing types)
- Suggestions (extract to function, use constant)

**Pre-commit** (moderate enforcement):
- Fast linter rules (dependency direction, import depth)
- Type checking
- Unit tests for changed files

**CI Time** (complete enforcement):
- All linter rules (including slow ones)
- Full test suite
- Structural architecture tests
- Security scanning
- Dependency graph validation

```bash
# .husky/pre-commit — Fast checks before push
#!/bin/bash
# Quick checks that run in <30 seconds

echo "Running pre-commit checks..."

# Fast lint (only changed files)
npx eslint $(git diff --name-only --cached -- '*.ts' '*.tsx') \
  --rule 'custom-rules/enforce-dependency-direction: error' \
  --rule 'custom-rules/no-database-in-api: error' \
  --max-warnings=0

# Type check (incremental)
npx tsc --noEmit --incremental

# Unit tests for changed files
npx vitest related $(git diff --name-only --cached -- '*.ts')
```

```yaml
# .github/workflows/ci.yml — Complete enforcement
name: Complete CI

on: [pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: ESLint — All custom rules
        run: npx eslint src/ --max-warnings=0
        # Runs ALL rules including slow ones

  architecture:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Structural architecture tests
        run: npx vitest run tests/architecture/
      - name: Circular dependency check
        run: npx madge --circular src/

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Semgrep — All rules
        uses: returntocorp/semgrep-action@v1
        with:
          config: "p/default p/security-audit .semgrep/"

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Full test suite
        run: npx vitest run --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Testing Your Linters

Linter rules are code. Code needs tests. Untested linter rules are particularly dangerous because false positives (flagging valid code) erode trust and false negatives (missing violations) undermine the architecture.

### The Rule Tester Pattern

Every custom ESLint rule should have a comprehensive test suite using the RuleTester:

```typescript
// tests/rules/no-database-in-api.test.ts
import { RuleTester } from "@typescript-eslint/rule-tester";
import { noDatabaseInApi } from "../../src/rules/no-database-in-api";

const ruleTester = new RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-database-in-api", noDatabaseInApi, {
  // Valid cases — these should NOT produce errors
  valid: [
    {
      name: "API route using a service class",
      filename: "/project/src/api/routes/orders.ts",
      code: `
        import { OrderService } from "../../services/orders";
        
        export async function createOrder(req: Request, res: Response) {
          const order = await orderService.create(req.body);
          res.status(201).json(order);
        }
      `,
    },
    {
      name: "Service class using a repository",
      filename: "/project/src/services/orders.ts",
      code: `
        import { OrderRepository } from "../data/order-repository";
        
        export class OrderService {
          constructor(private repo: OrderRepository) {}
          
          async create(data: any) {
            return this.repo.save(data);
          }
        }
      `,
    },
    {
      name: "External package import in API",
      filename: "/project/src/api/routes/orders.ts",
      code: `
        import { validate } from "class-validator";
        
        export async function createOrder(req: Request, res: Response) {
          await validate(req.body);
        }
      `,
    },
  ],

  // Invalid cases — these SHOULD produce errors
  invalid: [
    {
      name: "API route importing from data layer",
      filename: "/project/src/api/routes/orders.ts",
      code: `
        import { OrderRepository } from "../../data/order-repository";
      `,
      errors: [
        {
          messageId: "directRepoImport",
        },
      ],
    },
    {
      name: "API route with Prisma call",
      filename: "/project/src/api/routes/orders.ts",
      code: `
        export async function getOrders(req: Request, res: Response) {
          const orders = await prisma.order.findMany();
          res.json(orders);
        }
      `,
      errors: [
        {
          messageId: "directDbAccess",
        },
      ],
    },
    {
      name: "API route with raw SQL",
      filename: "/project/src/api/routes/orders.ts",
      code: `
        export async function getOrders(req: Request, res: Response) {
          const result = await db.query("SELECT * FROM orders");
          res.json(result.rows);
        }
      `,
      errors: [
        {
          messageId: "directDbAccess",
        },
      ],
    },
    {
      name: "API route with Knex query",
      filename: "/project/src/api/routes/orders.ts",
      code: `
        export async function getOrders(req: Request, res: Response) {
          const orders = await knex("orders").select("*");
          res.json(orders);
        }
      `,
      errors: [
        {
          messageId: "directDbAccess",
        },
      ],
    },
  ],
});
```

### Testing Semgrep Rules

```bash
# Test Semgrep rules against expected patterns
# Create test files with known violations

# tests/semgrep/no-database-outside-data-layer.py
# ruleid: no-database-outside-data-layer
session.query(User).filter_by(name="Alice")

# ok: no-database-outside-data-layer
# (this is in src/data/user_repository.py, so it's OK)

# Run tests
semgrep --config .semgrep/architecture.yml --test tests/semgrep/
```

### Coverage Checklist for Linter Tests

For each custom rule, test these scenarios:
- [ ] Valid case: Code that follows the rule (no errors)
- [ ] Invalid case: Code that violates the rule (error expected)
- [ ] Edge case: Code at the boundary of the rule (borderline)
- [ ] False positive check: Code that looks like a violation but isn't
- [ ] Error message quality: Verify the error message is helpful
- [ ] Multi-file: Test that the rule works across file boundaries (import resolution)

---

## Progressive Enforcement: Warn → Error → Block

New rules should be introduced gradually. Sudden strictness causes frustration and too many blocked PRs.

### The Three-Phase Rollout

**Phase 1: Warn (Week 1-2)**
```javascript
// .eslintrc.js — New rule as warning
{
  "arch-rules/enforce-dependency-direction": "warn",
}
```
- Runs in CI but doesn't block merges
- Produces visible output in PR checks
- Gives the team time to understand the rule
- Collects data on violation frequency

**Phase 2: Error (Week 3-4)**
```javascript
// .eslintrc.js — Escalate to error
{
  "arch-rules/enforce-dependency-direction": "error",
}
```
- Blocks merges in CI
- Existing violations are addressed (bulk fix)
- New violations are caught immediately

**Phase 3: Block (Week 5+)**
```javascript
// .eslintrc.js — Error + structural tests
{
  "arch-rules/enforce-dependency-direction": "error",
}
// Plus structural test for the same rule
// tests/architecture/dependency-direction.test.ts
```
- Double enforcement: linter + structural test
- The structural test catches violations the linter might miss
- Architecture documentation references the rule

### Handling Legacy Violations

When introducing a new rule to an existing codebase, you'll likely find existing violations. Handle them systematically:

```javascript
// .eslintrc.js — Gradual enforcement with suppression tracking
{
  "arch-rules/enforce-dependency-direction": ["error", {
    // Allow specific legacy violations with tracking
    knownViolations: [
      // Track these as tech debt
      "src/legacy/billing-import.ts",   // TODO: Refactor by Q2 2026
      "src/legacy/auth-bridge.ts",      // TODO: Remove after migration
    ],
  }],
}
```

```typescript
// src/legacy/billing-import.ts
// eslint-disable-next-line arch-rules/enforce-dependency-direction
// ARCH-DEBT: This file violates dependency direction. Tracking: JIRA-1234
import { BillingService } from "../services/billing";
```

Every suppressed violation should have:
1. A comment explaining *why* the suppression exists
2. A tracking reference (ticket number)
3. An expected resolution date

Run a weekly audit of suppressions:

```bash
# Find all eslint-disable comments for custom rules
grep -rn "eslint-disable.*arch-rules" src/ --include="*.ts" | \
  while read line; do
    ticket=$(echo "$line" | grep -o "JIRA-[0-9]*" || echo "NO-TICKET")
    echo "$ticket | $line"
  done | sort
```

---

## Creating a Linter Development Workflow

Building custom linters is a development activity like any other. It needs its own workflow:

### 1. Identify the Pattern

Start with a code review observation: "I keep seeing X in PRs." Track the frequency:

```bash
# Count occurrences of the pattern
grep -rn "session.query" src/api/ | wc -l
```

### 2. Write the Rule

Write the rule incrementally. Start simple, handle edge cases later:

```javascript
// Version 1: Simple pattern matching
module.exports = {
  create(context) {
    return {
      CallExpression(node) {
        if (isDBCall(node)) {
          context.report({ node, message: "No DB calls in API layer" });
        }
      },
    };
  },
};

// Version 2: Add exceptions
// Version 3: Add helpful error messages
// Version 4: Add autofix (if applicable)
```

### 3. Test the Rule

Write tests before deploying. The test suite is your regression safety net.

### 4. Roll Out Progressively

Follow the warn → error → block progression.

### 5. Review and Refine

Weekly review of:
- False positive rate (rules flagging valid code)
- False negative rate (violations the rule misses)
- Error message clarity (are agents understanding and fixing violations?)
- Violation frequency (is the rule catching fewer violations over time?)

---

## The Governance Dashboard

Track the health of your governance layer with a dashboard:

```typescript
// scripts/governance-report.ts
interface GovernanceMetrics {
  totalRules: number;
  activeViolations: number;
  violationsByRule: Record<string, number>;
  suppressionCount: number;
  suppressionAge: Record<string, number>; // Days since suppression was added
  falsePositiveReports: number;
  averageFixTime: number; // Minutes from violation to fix
}

async function generateGovernanceReport(): Promise<GovernanceMetrics> {
  const eslintOutput = await run("npx eslint src/ --format json");
  const violations = JSON.parse(eslintOutput);
  
  const violationsByRule: Record<string, number> = {};
  for (const v of violations) {
    for (const msg of v.messages) {
      violationsByRule[msg.ruleId] = (violationsByRule[msg.ruleId] || 0) + 1;
    }
  }
  
  // Count suppressions
  const suppressions = await countEslintDisableComments();
  
  return {
    totalRules: await countActiveRules(),
    activeViolations: Object.values(violationsByRule).reduce((a, b) => a + b, 0),
    violationsByRule,
    suppressionCount: suppressions.length,
    suppressionAge: computeSuppressionAges(suppressions),
    falsePositiveReports: await getFalsePositiveCount(),
    averageFixTime: await computeAverageFixTime(),
  };
}
```

This report, run weekly and posted to Slack or your team's channel, gives visibility into the health of your governance layer. Trends over time tell you whether the rules are working (violations decreasing) or need adjustment (high false positive rate).

## The Governance Operating Model

Linter rules and CI gates are tools. The governance operating model is the *process* that ensures these tools remain effective over time. Without a process, rules accumulate, decay, and eventually become noise.

### The Rule Lifecycle

Every custom rule has a lifecycle:

```
Proposal → Development → Testing → Rollout → Active → Deprecation → Removal
```

**Proposal**: Someone identifies a pattern that should be enforced. The proposal includes:
- The pattern being addressed
- Evidence that the pattern causes problems (code review comments, bugs, outages)
- The proposed enforcement mechanism (ESLint rule, Semgrep pattern, structural test)
- The expected impact (estimated number of violations, false positive rate)

**Development**: The rule is implemented with tests. A draft PR allows the team to review the rule itself.

**Testing**: The rule runs in "report only" mode (no CI blocking) for one week. The team reviews the output for false positives and false negatives.

**Rollout**: The rule is promoted from warning to error following the progressive enforcement pattern.

**Active**: The rule runs in CI, blocking PRs that violate it. The team monitors false positive reports and tunes the rule as needed.

**Deprecation**: When the rule is no longer relevant (the pattern has been eliminated, or the codebase has evolved), the rule is deprecated. It runs as a warning for two weeks, then is removed.

### Governance Meetings

Hold a monthly governance meeting to review:
1. **Rule health**: Which rules are catching violations? Which are silent?
2. **False positive rate**: Are any rules flagging valid code? 
3. **Violation trends**: Are violations increasing or decreasing for each rule?
4. **New proposals**: What patterns have been observed that need enforcement?
5. **Suppression audit**: Review all `eslint-disable` comments and their associated tickets.

This meeting keeps the governance layer aligned with the evolving codebase. Without it, rules drift from relevant to irrelevant, and the team loses trust in the enforcement system.

### The Governance-as-Code Repository

For larger organizations, consider maintaining governance rules in a separate repository:

```
governance/
├── eslint-plugin-org-rules/
│   ├── src/rules/
│   ├── tests/
│   └── package.json
├── semgrep-rules/
│   ├── architecture.yml
│   ├── security.yml
│   └── patterns.yml
├── structural-tests/
│   ├── dependency-graph.test.ts
│   ├── module-boundaries.test.ts
│   └── api-contracts.test.ts
├── docs/
│   ├── governance-process.md
│   ├── rule-lifecycle.md
│   └── architecture-decisions/
└── scripts/
    ├── audit-suppressions.sh
    ├── governance-report.ts
    └── dependency-metrics.ts
```

This repository is versioned, reviewed, and deployed through the same CI pipeline as application code. Changes to governance rules go through PR review, just like any other code change. This ensures that governance evolves deliberately, not accidentally.

## Connecting Governance to AGENTS.md

Your governance rules are only effective if agents know they exist. Reference them in AGENTS.md:

```markdown
# AGENTS.md

## Architecture Rules

This project enforces architectural rules through custom linters. All rules 
run in CI and will block your PR if violated.

### Key Rules

- **Dependency Direction**: Imports must flow inward. See: docs/adr-001-layered-architecture.md
- **No Database in API**: Route handlers must not access the database directly.
- **Structured Logging**: Use logger.info('event_name', { data }) format.
- **Error Handling**: All async operations must have typed error handling.
- **File Size**: No file should exceed 300 lines.
- **Import Depth**: No more than 2 levels of cross-module import depth.

When ESLint reports a violation, read the error message carefully. It includes:
1. What rule was violated
2. Why it matters
3. How to fix it

### Running Checks Locally

Before submitting a PR, run:
```bash
npm run lint           # ESLint with custom rules
npm run test:arch      # Structural architecture tests
npm run check:circular # Circular dependency detection
```
```

This ensures that every agent working in the codebase knows the rules exist and how to run them locally. The rules aren't hidden in CI—they're documented in the agent's instruction file.

## The Bigger Picture: Governance as a Competitive Advantage

In traditional development, governance is often seen as overhead—something that slows developers down. In agent-first development, governance is a competitive advantage. It enables:

1. **Higher agent autonomy**: When rules are mechanically enforced, agents can work independently without human review of every PR.
2. **Faster iteration**: Automated governance is instant. A linter error appears in seconds, not in a code review that takes hours.
3. **Consistent quality**: Mechanical enforcement doesn't have bad days, doesn't get tired, and doesn't miss violations because it was distracted.
4. **Scalable architecture**: As the team grows from 3 to 50 to 500, the governance layer scales with it. Every agent, every engineer, every team follows the same rules.
5. **Onboarding acceleration**: New agents (and new engineers) learn the architecture from the linter, not from tribal knowledge.

The Affirm team that retrained 800 engineers in one week understood this implicitly. Their single default toolchain, combined with enforced conventions, meant that every engineer was productive from day one—not because they memorized the architecture, but because the architecture was enforced by their tools.

The governance layer is the architectural constraint pillar made concrete—the mechanism by which taste becomes enforceable, principles become guarantees, and architecture becomes self-sustaining.[^1]

[^1]: Fowler frames harness engineering around three pillars: context engineering, architectural constraints, and garbage collection (Chapter 2).

## Case Study: Building a Governance Layer from Scratch

Let's walk through the complete process of building a governance layer for a new project. This case study is based on a real team's experience building a medium-complexity order management system with agent-first development.

### Week 1: Observation

The team started with a blank repository and let the agent build the first few features without any governance. During code review, the architect observed these patterns:

- Database queries appeared in 3 out of 5 route handlers
- Error handling was inconsistent: some routes returned 500, some returned detailed error objects
- Logging was unstructured: messages like "order created" and "it worked" appeared in the same service
- Two files exceeded 400 lines
- The agent created circular imports between the order and payment modules

### Week 2: Naming and Documenting

The architect wrote down the rules:

```markdown
# docs/architecture-rules.md

1. Route handlers must not contain database queries. Use services.
2. All errors must use AppError subclasses with error codes and remediation.
3. All logs must use structured format: logger.info('event_name', { context })
4. No file should exceed 300 lines.
5. No circular dependencies between modules.
6. All cross-module imports must go through barrel files (index.ts).
```

These rules were added to AGENTS.md and discussed in a team meeting.

### Week 3: Mechanizing (Phase 1)

The architect wrote ESLint rules for the most critical violations:

1. `no-database-in-api` — Catches database queries in route handlers
2. `enforce-structured-logging` — Catches unstructured log messages
3. `enforce-error-handling` — Catches bare catch blocks and missing error types

All rules were deployed as **warnings** (non-blocking). The team monitored the output:

```
Day 1: 23 warnings
Day 2: 18 warnings
Day 3: 12 warnings
Day 4: 8 warnings (agent learning from messages)
Day 5: 5 warnings (remaining false positives)
```

### Week 4: Escalating (Phase 2)

The three core rules were promoted to **errors** (CI-blocking). Two more rules were added:

4. `max-file-size` — Flags files exceeding 300 lines
5. `enforce-barrel-imports` — Prevents deep cross-module imports

A structural test was added for circular dependency detection.

### Week 5-8: Maturing (Phase 3)

The governance layer expanded to include:

- Dependency direction enforcement (`layer-dependency-direction`)
- Module naming conventions (`enforce-file-naming`)
- Import complexity limits (`max-import-depth`)
- Semgrep rules for SQL injection prevention
- Contract tests for API stability

### Results After 8 Weeks

- **0 architectural violations** in CI (down from 23 in Week 3)
- **95% reduction** in code review comments about architecture
- **3x faster** PR turnaround (less back-and-forth about style)
- **Agent productivity** stable at 15-20 PRs per day without quality degradation

The governance layer didn't slow the agent down—it *enabled* the agent to work faster by providing immediate, clear feedback on what was expected.

## The Economics of Linter Development

Writing custom linter rules is an investment. Here's the economic analysis:

**Cost of a custom rule**:
- Development: 2-8 hours per rule (depending on complexity)
- Testing: 1-4 hours per rule
- Maintenance: 0.5 hours per month per rule

**Cost of NOT having the rule**:
- Code review time spent catching the violation: ~15 minutes per occurrence
- Agent rework time: ~30 minutes per occurrence
- Bug risk from uncaught violations: varies, but potentially hours per incident

**Break-even calculation**:
- If a rule catches 5 violations per week and saves 30 minutes per violation...
- Weekly savings: 2.5 hours
- Cost to develop: ~8 hours
- **Break-even: 3.2 weeks**

At agent throughput (15-20 PRs per day), even niche rules break even quickly. The most frequently violated rules (dependency direction, error handling, logging) pay for themselves within days.

## Advanced Semgrep Patterns

Let's explore some more advanced Semgrep patterns that go beyond the basics:

### Pattern: Enforce Authorization Checks

```yaml
# .semgrep/auth-checks.yml
rules:
  - id: require-authorization
    languages: [typescript]
    severity: ERROR
    message: |
      Route handler is missing authorization check.
      Add @requireAuth() decorator or manual permission check.
      Example: @requireAuth('orders:read')
    patterns:
      # Match route handlers that DON'T have an auth decorator
      - pattern: |
          router.$METHOD($PATH, async (req, res) => { ... })
      - pattern-not: |
          router.$METHOD($PATH, $MIDDLEWARE, async (req, res) => { ... })
      - pattern-not-inside: |
          router.use($PATH, requireAuth(...))
    paths:
      include:
        - src/api/routes/**
      exclude:
        - src/api/routes/health.ts
        - src/api/routes/public/**
```

### Pattern: Enforce Input Validation

```yaml
rules:
  - id: require-input-validation
    languages: [typescript]
    severity: WARNING  
    message: |
      Route handler accesses req.body without validation.
      Add a validation middleware before accessing request body.
      Example: router.post('/orders', validate(CreateOrderSchema), handler)
    patterns:
      - pattern: req.body.$FIELD
      - pattern-not-inside: |
          router.$METHOD($PATH, validate(...), ...)
    paths:
      include:
        - src/api/routes/**
```

### Pattern: Prevent Direct State Mutation

```yaml
rules:
  - id: no-direct-state-mutation
    languages: [typescript]
    severity: ERROR
    message: |
      Direct state mutation detected. State changes must go through
      the domain service to enforce business rules and emit events.
      Use: orderService.updateStatus(orderId, newStatus)
      Not: order.status = newStatus; repo.save(order)
    patterns:
      - pattern-either:
          - pattern: |
              $OBJ.status = $VALUE
          - pattern: |
              $OBJ.total = $VALUE
      - pattern-not-inside: |
          class $CLASS { $METHOD(...) { ... } }
    paths:
      exclude:
        - src/domain/**  # Domain layer is allowed to mutate state
        - tests/**
```

These patterns demonstrate the power of Semgrep for cross-cutting concerns that would be difficult to express as AST-based linter rules.

## Multi-Language Linter Strategies

Most production codebases aren't monoglot. A typical microservices architecture might use TypeScript for the API gateway, Python for ML pipelines, Go for high-throughput services, and Java for legacy systems. Each language has its own linter ecosystem, but the architectural rules—the ones that matter most for governance—are the same across all of them: dependencies must flow inward, business logic must not leak into UI code, and data access must stay in the data layer.

The question is: do you write the same rule three times in three different linter frameworks, or is there a better way?

The answer is both. Some rules are best expressed in language-specific AST-based linters (where you get precise, fast, editor-integrated feedback). Other rules are best expressed once in a cross-language tool like Semgrep (where you get consistency at the cost of some precision). The most effective governance layers use a hybrid approach.

Let's look at the same architectural rule—"no business logic in the UI layer"—implemented across all three approaches.

### ESLint (TypeScript/JavaScript): Dependency Direction Rule

The ESLint `enforce-dependency-direction` rule from earlier in this chapter is the most precise implementation. It traverses the AST, resolves import paths, maps files to architectural layers, and reports violations with exact line numbers and remediation guidance. It runs in milliseconds inside the developer's editor.

```typescript
// Summary of the rule logic (full implementation shown earlier):
//
// 1. On ImportDeclaration, resolve the import source
// 2. Determine the "from layer" from the current file path
// 3. Determine the "to layer" from the import source
// 4. If toLayer is higher (closer to UI) than fromLayer, report violation
//
// Layer hierarchy:
//   ui(0) → api(1) → services(2) → domain(3) → data(4) → config(5)
//
// Benefits:
// - Runs in <100ms on large codebases
// - Integrates with VS Code for instant feedback
// - Supports auto-fix (can suggest the correct import path)
// - Handles TypeScript path aliases and barrel exports
```

### Ruff (Python): Banned API Imports + Semgrep Fallback

Python doesn't have an ESLint equivalent with the same custom rule expressiveness. As discussed earlier, Ruff's built-in `TID251` (banned API) rule handles the most common case—banning specific modules from being imported in certain layers:

```toml
# ruff.toml — Prevent UI imports in service layer
[lint.flake8-tidy-imports.banned-api]
"src.ui".msg = "Services must not import UI. Dependencies flow inward. See: docs/architecture.md"
"src.templates".msg = "Services must not import templates. Use dependency inversion."
"src.components".msg = "Services must not import UI components. This violates layer boundaries."
```

This handles the "service layer imports UI component" case, but it can't detect more subtle violations like a route handler that contains business logic (as opposed to merely importing from the wrong layer). For those cases, use Semgrep.

### Semgrep (Language-Agnostic): One Rule, Many Languages

Semgrep's pattern-matching engine works across 30+ languages with the same YAML syntax. Here's a single rule that enforces "no business logic in UI handlers" across TypeScript routes, Python Flask views, and Go HTTP handlers:

```yaml
# .semgrep/no-business-logic-in-ui.yml
rules:
  - id: no-business-logic-in-ui-layer
    languages: [typescript, python, go]
    severity: ERROR
    message: |
      Business logic detected in the UI/presentation layer.
      Move calculations, data transformations, and state mutations
      to the service layer. UI code should only handle request/response
      orchestration and delegate to services.
      See: docs/architecture.md#layer-responsibilities
    patterns:
      - pattern-either:
          # TypeScript: calculation in route handler
          - pattern: |
              router.$METHOD($PATH, async ($REQ, $RES) => {
                $CALC = $EXPR;
                ...
              })
          # Python: business logic in Flask view
          - pattern: |
              @app.$METHOD($PATH)
              def $HANDLER(...):
                  $RESULT = $OBJ.$COMPUTE(...)
                  ...
                  return $RESULT
          # Go: business logic in HTTP handler
          - pattern: |
              func $HANDLER(w http.ResponseWriter, r *http.Request) {
                  $RESULT := $OBJ.$COMPUTE(...)
                  ...
              }
      - pattern-not-inside: |
          src/services/...
      - pattern-not-inside: |
          src/domain/...
    paths:
      include:
        - src/api/**
        - src/routes/**
        - src/handlers/**
        - src/views/**
```

### Choosing the Right Tool for Each Rule

Use this decision framework:

| Rule Characteristic | Best Tool | Why |
|---|---|---|
| Language-specific AST pattern (e.g., TypeScript decorators) | ESLint / Ruff | Needs language-aware parsing |
| Import path or module boundary | ESLint / Ruff `TID251` | Fast, editor-integrated, auto-fixable |
| Same rule across 3+ languages | Semgrep | Write once, run everywhere |
| Security-sensitive pattern (SQL injection, hardcoded secrets) | Semgrep | Mature security rulesets, CI-first |
| Complex data-flow analysis | CodeQL or custom AST linter | Requires inter-procedural analysis |
| Performance-critical (editor-time) | ESLint / Ruff | Must run in <200ms |

The hybrid approach works because governance rules have different precision requirements. Import boundary rules need to be fast and auto-fixable (ESLint/Ruff). Security rules need to be comprehensive and well-curated (Semgrep). Cross-language consistency rules need to work everywhere from a single definition (Semgrep). Don't pick one tool—layer them.

### A Practical Multi-Language Governance Stack

For a polyglot codebase, the governance stack looks like this:

```yaml
# .github/workflows/governance.yml
name: Governance
on: [pull_request]

jobs:
  lint-typescript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: ESLint custom rules
        run: npx eslint src/ --max-warnings=0

  lint-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install ruff
      - name: Ruff (built-in rules + banned imports)
        run: ruff check src/

  lint-cross-language:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Semgrep (cross-language rules)
        uses: returntocorp/semgrep-action@v1
        with:
          config: >
            p/security-audit
            .semgrep/architecture.yml
            .semgrep/no-business-logic-in-ui.yml
```

Each tool handles what it's best at. The CI job runs in parallel, so there's no performance penalty from using three tools instead of one. And the governance rules are consistent across languages because the Semgrep rules provide the cross-language baseline, while the language-specific linters add precision and speed for their respective ecosystems.

---

> **Sidebar: Uber's Validator — Linting at Enterprise Scale**
>
> In 2025, Uber's Developer Platform team faced a governance challenge at a scale most companies never encounter: 5,000 engineers, hundreds of millions of lines of code, and 33 million daily trips depending on code quality. Their answer was Validator—an IDE-integrated linting agent that combines deterministic static analysis with LLM-powered code review.
>
> Validator embeds directly into the developer's IDE and operates as a LangGraph agent graph. When a developer opens a file, Validator analyzes the code in real time through two parallel pathways:
>
> 1. **Deterministic sub-agents** run traditional static analysis tools—the same kind of linting rules discussed throughout this chapter. These catch known patterns: security violations, style issues, and best-practice violations. They're fast, reliable, and produce zero false positives.
>
> 2. **LLM sub-agents** evaluate code against curated best-practice prompts. These catch subtle violations that pattern-based rules miss—for example, detecting that a temporary test file is being created insecurely and could leak into the host system.
>
> The hybrid architecture is the key insight. Pure LLM analysis is creative but unreliable—it hallucinates violations and misses obvious patterns. Pure deterministic analysis is reliable but blind to anything not explicitly coded. Validator's agent graph merges both, using deterministic tools for what they're good at and LLMs for what they're good at, with the results unified into a single IDE experience.
>
> **AutoCover: Test Generation as a Governance Extension**
>
> Uber didn't stop at linting. Their AutoCover agent extends governance into test generation. When a developer right-clicks a source file, AutoCover launches a multi-agent workflow:
>
> - A **scaffolder agent** prepares the test environment and identifies business cases to cover
> - A **generator agent** writes test cases
> - An **executor agent** runs builds, executes tests, and measures coverage
> - **Validator itself** runs as a sub-agent to verify that generated tests meet the same quality standards as human-written code
>
> The system can execute up to 100 parallel test generations and 100 concurrent test executions per file—scale that would be impossible without the multi-agent architecture. AutoCover achieved 2–3× better coverage in half the time compared to competing agentic tools, and contributed to a 10% increase in overall developer platform test coverage.
>
> **The Numbers**
>
> The combined impact of Validator and AutoCover: approximately 21,000 developer hours saved. Validator generates thousands of fix interactions daily. AutoCover generates thousands of tests monthly. These aren't pilot program numbers—this is production-scale adoption across Uber's entire engineering organization.
>
> **Lessons for Governance at Any Scale**
>
> Uber's approach reveals several principles that apply regardless of company size:
>
> 1. **Meet developers where they work.** Validator and AutoCover are IDE-integrated, not separate dashboards. The governance layer appears as inline diagnostics—the same UX as a regular linter.
>
> 2. **Compose agents from deterministic and generative parts.** Don't use LLMs for problems that static analysis solves reliably. Use LLMs for the gaps. The agent graph architecture makes composition natural.
>
> 3. **Build reusable primitives.** Uber wrapped LangGraph and LangChain into an internal framework called "LangEffect" that provides standardized agent patterns. Validator, AutoCover, Security ScoreBot, and their internal U-Review tool all share the same primitives. Your governance agents should similarly share rule definitions, violation reporting, and fix application logic.
>
> 4. **Let domain experts contribute without AI expertise.** Uber's security team contributes rules to Validator without understanding LangGraph or agent architecture. The governance layer's abstraction boundary—"write a rule, get IDE integration"—democratizes rule authorship.
>
> 5. **Governance agents beget governance agents.** Uber repurposed Validator's architecture to build Security ScoreBot (conversational security checks), Picasso's Genie (workflow assistance), and U-Review (AI-powered code review). A well-designed governance foundation becomes a platform for an entire ecosystem of quality tools.
>
> For teams building their first governance layer, the lesson is clear: start with deterministic linting rules (this chapter), add Semgrep for cross-language coverage, and consider the LLM-augmented path when your rule count exceeds what deterministic tools can reasonably maintain. Uber didn't start with LLMs—they started with the same ESLint, Semgrep, and custom linter patterns described here. The AI layer came after the deterministic foundation was solid.¹

---

## The Governance Evolution Path

Governance layers evolve over time. Here's a typical progression:

### Stage 1: Reactive ("We keep seeing this bug")
- Rules are added in response to specific incidents
- Coverage is incomplete
- False positives are common
- Team size: 1 architect + part-time contributions

### Stage 2: Proactive ("Let's prevent this class of bugs")
- Rules are organized by category (security, architecture, style)
- Coverage is comprehensive for known patterns
- False positive rate is monitored and reduced
- Team size: 1-2 architects + contributions from the team

### Stage 3: Strategic ("Our governance encodes our architecture")
- Rules are linked to ADRs and architecture documentation
- Coverage includes both known and emerging patterns
- Rules are tuned for agent readability (clear messages, helpful guidance)
- Team size: 2-3 architects + contributions from the team + agent-assisted rule writing

### Stage 4: Self-Improving ("Our governance gets better on its own")
- Agents help write and maintain governance rules
- Violation patterns are automatically analyzed for new rule opportunities
- Rules are automatically deprecated when violation frequency drops to zero
- Team size: 1-2 architects overseeing agent-maintained governance

Most teams should target Stage 2-3. Stage 4 is the cutting edge, where agents not only follow rules but help create and maintain them.

---

## Summary

- **AST-based linting** provides precise, structure-aware rule enforcement
- **ESLint custom rules** are the primary tool for JavaScript/TypeScript enforcement; write them for dependency direction, barrel imports, structured logging, error handling, and data access patterns
- **Ruff's built-in rules** (banned imports, complexity limits) cover most Python governance needs; Semgrep fills the gap for custom rules until Ruff's plugin API ships
- **Go/ast** provides native linting for Go without external tools
- **Semgrep** enables cross-language pattern matching with YAML-based rules—ideal for polyglot codebases and the cornerstone of multi-language governance strategies
- **Error messages are teaching tools**: every message should explain what's wrong, why it matters, and how to fix it
- **Build-time enforcement** (editor, pre-commit) provides fast feedback; **CI-time enforcement** provides complete coverage
- **Test your linters** with comprehensive RuleTester suites covering valid cases, invalid cases, edge cases, and false positive scenarios
- **Progressive enforcement** (warn → error → block) eases adoption and reduces frustration
- **Legacy violations** should be tracked as tech debt with tickets and resolution dates
- **The governance dashboard** tracks rule health, violation trends, and false positive rates
- Together, these tools form the **automated governance layer** that keeps agent-generated code architecturally sound without human review bottlenecks

---

¹ Uber Engineering, "uReview: AI-Powered Code Review at Uber," 2025–2026. https://www.uber.com/blog/ureview

---

The governance layer is the capstone of Parts III and IV. Application legibility (Chapters 8-9) ensures agents can observe the system. Architecture enforcement (Chapters 10-12) ensures agents can't break the system. Together, they create the foundation for autonomous, high-velocity agent development.

In Part V, we'll build on this foundation to explore multi-agent orchestration—how to coordinate teams of agents working in parallel on complex tasks, using worktree isolation, coordinator patterns, and the orchestration APIs that make it all possible.
