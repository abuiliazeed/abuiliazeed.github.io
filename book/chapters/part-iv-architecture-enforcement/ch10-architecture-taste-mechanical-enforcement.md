# Chapter 10: Architecture, Taste, and Mechanical Enforcement

> "The best architecture is the one your agents cannot violate."

In March 2025, an engineering team at a Series C startup noticed something disturbing. Their codebase had been primarily written by Claude Code for three months. The application worked perfectly—every test passed, every feature was delivered on time. But the architecture had decayed. Not broken, just... wrong.

Database queries appeared in React components. Business logic leaked into API route handlers. Two services communicated through a shared database table instead of an API. A utility module imported domain models, creating a circular dependency that only manifested as a 30-second startup delay.

The team had been careful. They had code reviews. They had architecture decision records. They had a senior architect who reviewed every PR. But the agent submitted 15-20 PRs per day, and the human reviews became superficial. The agent didn't know the rules. It couldn't *taste* the architecture.

The solution wasn't more code review. It was **mechanical enforcement**—encoding architectural rules into linters, tests, and CI gates that the agent could not bypass. Within two weeks of deploying custom ESLint rules and structural tests, the architectural violations stopped entirely. Not reduced. Stopped.

This chapter is about how to encode architectural taste into mechanical constraints that work at the speed of agent development.

---

## What is Taste in Code?

Architecture taste is the ability to recognize that some code structures are better than others, even when both produce the same output. It's knowing that:

- Business logic belongs in the domain layer, not in API handlers
- Dependencies should point inward, from UI to domain, never the reverse
- A 2,000-line file is a sign that something is wrong
- Circular dependencies are never acceptable
- Import depth reveals coupling problems before they become architecture problems

Taste is subjective in the general case but objective in the specific. Within a team, taste is the set of shared agreements about how code should be structured. These agreements are often implicit—passed down through code review comments, verbal corrections, and the example of existing code.

In agent-first development, implicit agreements don't work. An agent can't absorb culture through osmosis. It can't learn from a disappointed "this isn't how we do things here" in a code review comment. It needs rules that are explicit, unambiguous, and mechanically enforceable.

### From Implicit to Explicit to Mechanical

The progression from implicit taste to mechanical enforcement has four stages:

1. **Implicit**: "We just know that business logic shouldn't be in controllers"
2. **Explicit**: "We have a document that says business logic shouldn't be in controllers"
3. **Linted**: "Our linter warns when business logic appears in controllers"
4. **Enforced**: "Our CI blocks PRs where business logic appears in controllers"

Most teams are at stage 2. They have architecture decision records, CONTRIBUTING.md files, and onboarding docs. But these documents are invisible to agents unless they're referenced in the agent's instruction file—and even then, the agent might not follow them consistently under pressure.

The goal of this chapter is to move you to stage 4. Every architectural principle that matters should be enforced by a machine, not a human.

---

## Mechanical Enforcement as the Foundation

Mechanical enforcement means using automated tools to verify that code adheres to architectural rules. The tools range from simple (file size checks) to complex (custom AST-based linters), but they share a common principle: **if a rule isn't checked by a machine, it isn't a rule—it's a suggestion.**

### The Three Layers of Mechanical Enforcement

```
┌──────────────────────────────────────────┐
│          CI Gate (hard block)             │
│  "This PR cannot be merged"               │
│  - Custom linter errors                   │
│  - Structural test failures               │
│  - Dependency violations                  │
├──────────────────────────────────────────┤
│          Build Time (soft block)          │
│  "This code won't compile/deploy"         │
│  - Type errors                            │
│  - Import cycle detection                 │
│  - Module boundary violations             │
├──────────────────────────────────────────┤
│          Editor Time (warnings)           │
│  "This looks suspicious"                  │
│  - Linter warnings                        │
│  - IDE inspections                        │
│  - Pre-commit hooks                       │
└──────────────────────────────────────────┘
```

Each layer catches violations at a different point in the development cycle. Editor-time warnings provide immediate feedback. Build-time checks prevent bad code from compiling. CI gates prevent bad code from merging.

For agent-first development, the CI gate is the most important layer. Agents don't read warnings. They don't feel embarrassment when they write bad code. They just keep going until they hit a hard stop. The CI gate is that hard stop.

---

## Custom Linters

Custom linters are the workhorse of mechanical enforcement. They analyze your code's abstract syntax tree (AST) and flag violations of your architectural rules.

### Why Custom Linters?

Standard linters (ESLint, Ruff, Pylint) catch common code quality issues: unused variables, missing semicolons, overly complex functions. But they don't know *your* architecture. They don't know that in your codebase, controllers should never import database models directly. They don't know that service A shouldn't depend on service B.

Custom linters encode your team's specific architectural rules into automated checks.

### Example: Dependency Direction Enforcement

This ESLint custom rule enforces the dependency direction convention that dependencies must point inward—from UI/API layers toward domain/data layers, never the reverse:

```javascript
// eslint-rules/enforce-dependency-direction.js
/**
 * Enforces dependency direction: layers can only import from 
 * layers below them in the hierarchy.
 * 
 * Layer hierarchy (high → low):
 *   ui → api → services → domain → data → config
 * 
 * A file in "api" can import from "services", "domain", "data", "config"
 * A file in "domain" can import from "data", "config"
 * A file in "domain" CANNOT import from "services", "api", "ui"
 */
const LAYER_HIERARCHY = {
  "ui": 0,
  "api": 1,
  "services": 2,
  "domain": 3,
  "data": 4,
  "config": 5,
};

// Extract layer from file path: src/api/routes/orders.ts → "api"
function getLayer(filePath) {
  const match = filePath.match(/src\/([^/]+)/);
  if (!match) return null;
  return match[1];
}

// Resolve relative imports to absolute paths.
// Uses Node's enhanced-resolve (the same resolver webpack uses internally)
// to handle aliases (tsconfig paths), extension resolution, and directory
// index files. Install: npm install enhanced-resolve
let _resolver = null;
function resolveImport(fromFilePath, importPath) {
  // Skip external (node_modules) imports
  if (!importPath.startsWith(".") && !importPath.startsWith("src/")) {
    return importPath;
  }
  try {
    if (!_resolver) {
      const enhancedResolve = require("enhanced-resolve");
      _resolver = enhancedResolve.create.sync({
        extensions: [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"],
        aliasFields: [],
      });
    }
    const cwd = process.cwd();
    const resolved = _resolver(cwd, importPath);
    return resolved || importPath; // fallback to raw path if unresolvable
  } catch {
    // Fallback: naive relative resolution for cases where enhanced-resolve
    // is unavailable (e.g., ESLint running in a lightweight context)
    const path = require("path");
    const dir = path.dirname(fromFilePath);
    return path.resolve(dir, importPath);
  }
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce unidirectional dependency flow between layers",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      illegalDependency: (
        "Layer '{{fromLayer}}' cannot import from '{{toLayer}}'. " +
        "Dependency direction must flow inward (high layer → low layer). " +
        "See: docs/architecture.md#dependency-direction"
      ),
    },
    schema: [
      {
        type: "object",
        properties: {
          layers: {
            type: "object",
            description: "Layer name to hierarchy level mapping",
          },
          allowList: {
            type: "array",
            description: "Allowed cross-layer imports that bypass the hierarchy",
          },
        },
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const layers = options.layers || LAYER_HIERARCHY;
    const allowList = options.allowList || [];
    const filePath = context.getFilename();
    const fromLayer = getLayer(filePath);

    if (!fromLayer || !(fromLayer in layers)) return {};

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;
        
        // Skip external packages (node_modules)
        if (!importPath.startsWith(".") && !importPath.startsWith("src/")) return;
        
        // Resolve relative import to full path
        const resolvedPath = resolveImport(filePath, importPath);
        const toLayer = getLayer(resolvedPath);
        
        if (!toLayer || !(toLayer in layers)) return;
        
        // Same layer is always allowed
        if (fromLayer === toLayer) return;
        
        // Check allow list
        if (allowList.some(pattern => {
          const regex = new RegExp(pattern);
          return regex.test(`${fromLayer}->${toLayer}`);
        })) return;
        
        // Enforce hierarchy: can only import from lower layers (higher number)
        const fromLevel = layers[fromLayer];
        const toLevel = layers[toLayer];
        
        if (toLevel < fromLevel) {
          context.report({
            node,
            messageId: "illegalDependency",
            data: { fromLayer, toLayer },
          });
        }
      },
    };
  },
};
```

Register it in your ESLint config:

```javascript
// .eslintrc.js
module.exports = {
  plugins: [
    "custom-rules", // Your plugin containing custom rules
  ],
  rules: {
    "custom-rules/enforce-dependency-direction": ["error", {
      layers: {
        "ui": 0,
        "api": 1,
        "services": 2,
        "domain": 3,
        "data": 4,
        "config": 5,
      },
      allowList: [
        "api->config",      // API layer can always read config
        "services->config",  // Services can always read config
      ],
    }],
  },
};
```

Now, when an agent writes:

```typescript
// src/domain/order.ts
import { EmailService } from "../services/email"; // VIOLATION: domain → services
```

ESLint produces:

```
src/domain/order.ts
  2:1  error  Layer 'domain' cannot import from 'services'.
             Dependency direction must flow inward (high layer → low layer).
             See: docs/architecture.md#dependency-direction
             custom-rules/enforce-dependency-direction
```

The error message doesn't just say "bad"—it tells the agent *why* it's bad and *where* to learn more.

### Example: File Size Enforcement

Large files are a code smell that indicates responsibility consolidation. Enforce a maximum file size:

```javascript
// eslint-rules/max-file-size.js
/**
 * Enforces maximum file size (lines of code).
 * Large files indicate too many responsibilities.
 */
const fs = require("fs");

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce maximum file size to prevent god objects",
      category: "Architecture",
    },
    messages: {
      fileTooLarge: (
        "File has {{lineCount}} lines, exceeding maximum of {{maxLines}}. " +
        "Large files indicate multiple responsibilities. " +
        "Consider extracting into focused modules."
      ),
    },
    schema: [
      {
        type: "object",
        properties: {
          maxLines: { type: "number", default: 300 },
          excludePatterns: { type: "array", items: { type: "string" } },
        },
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const maxLines = options.maxLines || 300;
    const excludePatterns = (options.excludePatterns || []).map(
      p => new RegExp(p)
    );
    const filePath = context.getFilename();
    
    // Skip excluded files
    if (excludePatterns.some(p => p.test(filePath))) return {};
    
    // Count lines at the end of the file
    return {
      Program(node) {
        const lineCount = node.loc.end.line;
        if (lineCount > maxLines) {
          context.report({
            loc: { line: 1, column: 0 },
            messageId: "fileTooLarge",
            data: { lineCount, maxLines },
          });
        }
      },
    };
  },
};
```

### Example: Import Complexity Enforcement

Deep import chains create fragile coupling. This rule limits the depth of imports from other modules:

```javascript
// eslint-rules/max-import-depth.js
/**
 * Limits the depth of cross-module imports.
 * Prevents agents from reaching deep into other modules' internals.
 * 
 * Good:  import { OrderService } from "../services/orders"
 * Bad:   import { helper } from "../services/orders/internal/utils/helpers"
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Limit depth of cross-module imports",
      category: "Architecture",
    },
    messages: {
      importTooDeep: (
        "Import depth {{depth}} exceeds maximum of {{maxDepth}}. " +
        "Deep imports create fragile coupling. " +
        "Import from the module's public API instead: '{{suggestedPath}}'"
      ),
    },
    schema: [
      {
        type: "object",
        properties: {
          maxDepth: { type: "number", default: 2 },
        },
      },
    ],
  },

  create(context) {
    const maxDepth = (context.options[0] || {}).maxDepth || 2;
    const filePath = context.getFilename();
    
    // Get the module root (first directory under src/)
    const moduleMatch = filePath.match(/src\/([^/]+)/);
    if (!moduleMatch) return {};
    const currentModule = moduleMatch[1];
    
    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;
        if (!importPath.startsWith(".")) return;
        
        const resolvedPath = resolveImport(filePath, importPath);
        
        // Check if importing from a different module
        const importModuleMatch = resolvedPath.match(/src\/([^/]+)/);
        if (!importModuleMatch) return;
        const importModule = importModuleMatch[1];
        
        if (importModule === currentModule) return; // Same module, OK
        
        // Count depth after module name
        const afterModule = resolvedPath.split(`src/${importModule}/`)[1];
        if (!afterModule) return; // Module root import, OK
        
        const depth = afterModule.split("/").length;
        
        if (depth > maxDepth) {
          const suggestedPath = resolvedPath
            .split("/")
            .slice(0, -depth + 1)
            .join("/");
          
          context.report({
            node,
            messageId: "importTooDeep",
            data: {
              depth,
              maxDepth,
              suggestedPath,
            },
          });
        }
      },
    };
  },
};
```

### Example: Naming Convention Enforcement

Naming conventions are the most basic form of architectural taste. This rule enforces that files in specific directories follow naming patterns:

```javascript
// eslint-rules/enforce-file-naming.js
/**
 * Enforces file naming conventions:
 * - API routes: kebab-case (order-items.ts)
 * - Domain models: singular noun (order.ts)
 * - Tests: match source file name with .test suffix (order.test.ts)
 * - Utilities: descriptive verb-noun (parse-date.ts)
 */
const path = require("path");

const CONVENTIONS = {
  "src/api/routes": {
    pattern: /^[a-z][a-z0-9-]*\.ts$/,
    example: "order-items.ts",
    description: "kebab-case route files",
  },
  "src/domain": {
    pattern: /^[a-z][a-z0-9-]*\.ts$/,
    example: "order.ts or order-item.ts",
    description: "singular noun, kebab-case",
  },
  "src/services": {
    pattern: /^[a-z][a-z0-9-]*\.service\.ts$/,
    example: "order.service.ts",
    description: "kebab-case with .service suffix",
  },
  "src/infrastructure": {
    pattern: /^[a-z][a-z0-9-]*\.(repository|gateway|client)\.ts$/,
    example: "order.repository.ts",
    description: "kebab-case with type suffix (.repository, .gateway, .client)",
  },
};

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce file naming conventions by directory",
      category: "Architecture",
    },
    messages: {
      invalidFileName: (
        "File '{{fileName}}' in '{{directory}}' does not follow naming convention. " +
        "Expected: {{description}} (e.g., {{example}})"
      ),
    },
  },

  create(context) {
    const filePath = context.getFilename();
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    
    // Skip test files, index files, and config files
    if (fileName.includes(".test.") || fileName === "index.ts" || 
        fileName.startsWith(".") || fileName.includes(".config.")) {
      return {};
    }
    
    // Find matching convention
    for (const [prefix, convention] of Object.entries(CONVENTIONS)) {
      if (dir.includes(prefix.replace(/\//g, path.sep))) {
        if (!convention.pattern.test(fileName)) {
          context.report({
            loc: { line: 1, column: 0 },
            messageId: "invalidFileName",
            data: {
              fileName,
              directory: prefix,
              description: convention.description,
              example: convention.example,
            },
          });
        }
        break;
      }
    }
    
    return {};
  },
};
```

---

## Structural Tests

Structural tests verify architectural properties as testable invariants. Unlike unit tests that verify behavior, structural tests verify *form*—the shape and organization of your code.

### Architecture Fitness Functions

The concept of architecture fitness functions, popularized by Neal Ford and Rebecca Parsons in *Building Evolutionary Architectures*, is directly applicable to agent-first development. A fitness function is a test that evaluates an architectural characteristic:

```typescript
// tests/architecture/dependency-direction.test.ts
import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";

describe("Architecture: Dependency Direction", () => {
  const project = new Project({
    tsConfigFilePath: "./tsconfig.json",
  });

  const LAYER_ORDER = [
    "ui",
    "api",
    "services",
    "domain",
    "data",
    "config",
  ] as const;

  it("should not have circular dependencies between layers", () => {
    const cycles = detectCircularDependencies(project);
    expect(cycles).toHaveLength(0);
  });

  it("domain layer should not import from services layer", () => {
    const violations: string[] = [];
    
    const domainFiles = project.getSourceFiles("src/domain/**/*.ts");
    
    for (const file of domainFiles) {
      const imports = file.getImportDeclarations();
      
      for (const imp of imports) {
        const moduleSpecifier = imp.getModuleSpecifierValue();
        if (moduleSpecifier.includes("src/services") || 
            moduleSpecifier.includes("../services")) {
          violations.push(
            `${file.getBaseName()} imports from services: ${moduleSpecifier}`
          );
        }
      }
    }
    
    expect(violations).toHaveLength(0);
  });

  it("data layer should not import from API layer", () => {
    const violations: string[] = [];
    
    const dataFiles = project.getSourceFiles("src/data/**/*.ts");
    
    for (const file of dataFiles) {
      const imports = file.getImportDeclarations();
      
      for (const imp of imports) {
        const moduleSpecifier = imp.getModuleSpecifierValue();
        if (moduleSpecifier.includes("src/api") || 
            moduleSpecifier.includes("../api")) {
          violations.push(
            `${file.getBaseName()} imports from api: ${moduleSpecifier}`
          );
        }
      }
    }
    
    expect(violations).toHaveLength(0);
  });

  it("no file should exceed 300 lines", () => {
    const violations: string[] = [];
    
    const allFiles = project.getSourceFiles("**/*.ts");
    
    for (const file of allFiles) {
      // Skip test files and generated files
      if (file.getFilePath().includes(".test.") || 
          file.getFilePath().includes("node_modules") ||
          file.getFilePath().includes("__generated__")) {
        continue;
      }
      
      const lineCount = file.getEndLineNumber();
      if (lineCount > 300) {
        violations.push(
          `${file.getFilePath()}: ${lineCount} lines (max 300)`
        );
      }
    }
    
    expect(violations).toHaveLength(0);
  });

  it("each module should export a public API barrel file", () => {
    const modules = ["api", "services", "domain", "data"];
    
    for (const mod of modules) {
      const barrelFile = project.getSourceFile(`src/${mod}/index.ts`);
      expect(
        barrelFile,
        `Module '${mod}' is missing an index.ts barrel file`
      ).toBeDefined();
    }
  });

  it("service files should follow naming convention", () => {
    const serviceFiles = project.getSourceFiles("src/services/**/*.ts");
    
    for (const file of serviceFiles) {
      const name = file.getBaseName();
      if (name === "index.ts") continue;
      
      expect(name).toMatch(
        /^[a-z][a-z0-9-]*\.service\.ts$/,
        `Service file '${name}' should match pattern: name.service.ts`
      );
    }
  });
});
```

### Module Boundary Tests

Module boundaries define the edges of cohesive units of code. Tests can verify that modules don't leak internals:

```typescript
// tests/architecture/module-boundaries.test.ts
describe("Architecture: Module Boundaries", () => {
  it("API layer should not access database models directly", () => {
    const violations: string[] = [];
    
    const apiFiles = project.getSourceFiles("src/api/**/*.ts");
    
    for (const file of apiFiles) {
      const imports = file.getImportDeclarations();
      
      for (const imp of imports) {
        const specifier = imp.getModuleSpecifierValue();
        // API should import from services, not data layer
        if (specifier.includes("src/data/") || 
            specifier.includes("../data/")) {
          violations.push(
            `${file.getFilePath()}: ${specifier}`
          );
        }
      }
    }
    
    expect(violations).toHaveLength(0);
  });

  it("domain models should not depend on infrastructure", () => {
    const violations: string[] = [];
    
    const domainFiles = project.getSourceFiles("src/domain/**/*.ts");
    const infraPatterns = [
      "src/infrastructure/",
      "../infrastructure/",
      "axios",
      "knex",
      "pg",
      "redis",
      "amqplib",
    ];
    
    for (const file of domainFiles) {
      const imports = file.getImportDeclarations();
      
      for (const imp of imports) {
        const specifier = imp.getModuleSpecifierValue();
        
        for (const pattern of infraPatterns) {
          if (specifier.includes(pattern)) {
            violations.push(
              `${file.getFilePath()}: ${specifier}`
            );
          }
        }
      }
    }
    
    expect(violations).toHaveLength(0);
  });
});
```

### API Contract Stability Tests

When modules communicate through APIs, the contracts between them should be stable. Structural tests can verify that public APIs don't change unexpectedly:

```typescript
// tests/architecture/api-stability.test.ts
describe("Architecture: API Contract Stability", () => {
  it("public API surface should not shrink without major version bump", () => {
    const currentExports = getPublicExports(project, "src/services/index.ts");
    const previousExports = loadBaseline("services-api-baseline.json");
    
    const removedExports = previousExports.filter(
      e => !currentExports.includes(e)
    );
    
    if (removedExports.length > 0) {
      const pkg = JSON.parse(
        fs.readFileSync("package.json", "utf-8")
      );
      const version = pkg.version;
      const isMajorBump = /^\d+\.\d+\.\d+$/.test(version) && 
        version.split(".")[0] !== previousVersion.split(".")[0];
      
      if (!isMajorBump) {
        expect(
          removedExports,
          `Public exports removed without major version bump: ${removedExports.join(", ")}`
        ).toHaveLength(0);
      }
    }
  });
});
```

---

## Encoding Taste: The Golden Principles

Based on the patterns we've discussed, here are ten core architectural principles that should be mechanically enforced in every agent-first codebase:

### The 10 Golden Principles

**1. Dependency Direction**: Dependencies flow inward, from UI to domain, never the reverse.

```
UI → API → Services → Domain → Data → Config
```

**2. Single Responsibility per File**: Each file has one job. If it exceeds 300 lines, split it.

**3. No Cross-Layer Shortcuts**: API handlers call services. Services call domain logic. Domain logic calls data access. No skipping layers.

**4. Explicit Public APIs**: Each module exports a public API through an `index.ts` barrel file. Other modules import from the barrel, not from internal files.

**5. No God Objects**: No class or module depends on more than 7 other modules.

**6. Bounded Contexts**: Code is organized by business domain, not by technical layer alone. Related code lives together.

**7. Stateless Services**: Service classes don't hold mutable state. State lives in databases, caches, or request scope.

**8. Error Propagation**: Errors are either handled at the current layer or wrapped and re-thrown. Never silently swallowed.

**9. Testability**: Domain logic has no external dependencies. It can be tested in isolation with pure functions.

**10. No Speculative Generality**: Don't create abstractions for future needs. Create them when you have three concrete use cases.

### Encoding Principle 5: No God Objects

```javascript
// eslint-rules/max-dependencies.js
/**
 * Limits the number of modules a file can import.
 * Prevents "god objects" that depend on everything.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Limit number of imports per file to prevent god objects",
      category: "Architecture",
    },
    messages: {
      tooManyDependencies: (
        "File imports {{count}} modules, exceeding maximum of {{max}}. " +
        "This indicates a god object with too many responsibilities. " +
        "Consider splitting into focused modules."
      ),
    },
    schema: [
      {
        type: "object",
        properties: {
          max: { type: "number", default: 7 },
          excludeExternal: { type: "boolean", default: true },
        },
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const maxDeps = options.max || 7;
    const excludeExternal = options.excludeExternal !== false;
    
    const imports = new Set();
    
    return {
      ImportDeclaration(node) {
        const specifier = node.source.value;
        
        // Optionally skip external packages
        if (excludeExternal && !specifier.startsWith(".")) return;
        
        imports.add(specifier);
      },
      "Program:exit"() {
        if (imports.size > maxDeps) {
          context.report({
            loc: { line: 1, column: 0 },
            messageId: "tooManyDependencies",
            data: { count: imports.size, max: maxDeps },
          });
        }
      },
    };
  },
};
```

---

## The Taste Feedback Loop

Mechanical enforcement doesn't emerge fully formed. It develops through a feedback loop:

```
Observe → Name → Document → Mechanize → Verify
    ↑                                         │
    └─────────────────────────────────────────┘
```

1. **Observe**: Notice a pattern in code review or during development. "We keep putting database queries in API handlers."

2. **Name**: Give the pattern a name. "Cross-layer data access."

3. **Document**: Write down the rule. "API handlers must not import from the data layer. They should use service classes instead."

4. **Mechanize**: Write a linter or structural test that enforces the rule.

5. **Verify**: Run the enforcement in CI. If it catches a violation, the loop is working.

6. **Repeat**: Observe new patterns, add new rules.

This loop is ongoing. As your codebase evolves, your enforcement rules evolve with it. New patterns emerge, old patterns become irrelevant, and the enforcement keeps pace.

### When to Accept Imperfection

Not every rule needs to be enforced immediately. In the early stages of a project, strict enforcement can slow down exploration. Use progressive enforcement:

1. **Week 1-2**: Document the rules in AGENTS.md and architecture docs
2. **Week 3-4**: Add linter rules as **warnings** (non-blocking)
3. **Week 5-8**: Promote warnings to **errors** (blocking in CI)
4. **Week 8+**: Add structural tests for the most important invariants

This progression gives the team time to internalize the rules before they become hard constraints. It also gives you time to tune the rules—removing false positives, adjusting thresholds, and refining error messages.

---

---

## Anti-Patterns in Mechanical Enforcement

### Over-Enforcement

Not everything needs a linter rule. Over-enforcement creates a culture of rule-following that stifles creativity and creates friction. Focus enforcement on rules that:
- Are violated frequently (not theoretical concerns)
- Have significant consequences when violated (not style preferences)
- Can be checked reliably (not subjective judgments)

### Undiscoverable Rules

A linter rule that produces an unhelpful error message is worse than no rule at all. Every error message should include:
- What was violated
- Why it matters
- How to fix it
- Where to learn more

### Unmaintained Rules

Rules decay. As the codebase evolves, rules that were once important become obsolete. Review your enforcement rules quarterly. Remove rules that no longer catch real violations. Update rules that produce false positives.

### Testing Your Linters

Linter rules are code, and code needs tests. Here's how to test a custom ESLint rule:

```typescript
// tests/eslint-rules/enforce-dependency-direction.test.ts
import { RuleTester } from "eslint";
import rule from "../../eslint-rules/enforce-dependency-direction";

const ruleTester = new RuleTester({
  parser: require.resolve("@typescript-eslint/parser"),
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("enforce-dependency-direction", rule, {
  valid: [
    {
      // API importing from services is OK (inward dependency)
      filename: "/project/src/api/routes/orders.ts",
      code: `import { OrderService } from "../../services/orders";`,
    },
    {
      // Services importing from domain is OK
      filename: "/project/src/services/orders.ts",
      code: `import { Order } from "../domain/order";`,
    },
    {
      // External package import is OK
      filename: "/project/src/domain/order.ts",
      code: `import { v4 as uuid } from "uuid";`,
    },
    {
      // Same-layer import is OK
      filename: "/project/src/domain/order.ts",
      code: `import { Money } from "./money";`,
    },
  ],
  
  invalid: [
    {
      // Domain importing from services is BAD (outward dependency)
      filename: "/project/src/domain/order.ts",
      code: `import { EmailService } from "../services/email";`,
      errors: [
        {
          messageId: "illegalDependency",
          data: { fromLayer: "domain", toLayer: "services" },
        },
      ],
    },
    {
      // Domain importing from API is BAD
      filename: "/project/src/domain/order.ts",
      code: `import { formatResponse } from "../api/helpers";`,
      errors: [
        {
          messageId: "illegalDependency",
          data: { fromLayer: "domain", toLayer: "api" },
        },
      ],
    },
    {
      // Data layer importing from services is BAD
      filename: "/project/src/data/order-repository.ts",
      code: `import { CacheService } from "../services/cache";`,
      errors: [
        {
          messageId: "illegalDependency",
          data: { fromLayer: "data", toLayer: "services" },
        },
      ],
    },
  ],
});
```

Testing linter rules ensures they catch the right violations without false positives. When an agent encounters a linter error, you want confidence that the error is real and the remediation guidance is accurate.

---

## Putting It All Together: The Enforcement Pipeline

Here's how all the pieces fit together in a CI pipeline:

```yaml
# .github/workflows/architecture.yml
name: Architecture Enforcement

on: [pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Run ESLint with custom rules
        run: npx eslint src/ --max-warnings=0
        # Custom rules will fail the build on:
        # - Dependency direction violations
        # - File size violations
        # - Import depth violations
        # - File naming violations
        # - God object detection

  structural-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Run structural architecture tests
        run: npx vitest run tests/architecture/
        # Tests verify:
        # - No circular dependencies
        # - Layer isolation
        # - Module boundary integrity
        # - API contract stability
        # - Naming conventions

  semgrep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/default
            p/security-audit
            .semgrep.yml
        # Custom Semgrep rules verify:
        # - No SQL in non-data layers
        # - No hard-coded credentials
        # - Error handling patterns
        # - Logging patterns
```

Every PR now runs through three enforcement layers:
1. **ESLint** catches AST-level violations (dependency direction, file size, naming)
2. **Structural tests** catch architectural violations (circular deps, layer isolation)
3. **Semgrep** catches pattern-level violations (SQL in wrong layers, missing error handling)

A PR that passes all three layers is architecturally sound. The human reviewer can focus on intent, design, and business logic—knowing that the mechanical aspects are already verified.

## The Architecture Decision Record as Enforcement Seed

Architecture Decision Records (ADRs) are a well-established practice for documenting architectural decisions. In agent-first development, ADRs serve a dual purpose: they document the decision *and* they seed the enforcement mechanism.

Here's the pattern:

```markdown
# ADR-001: Layered Architecture

## Status: Accepted

## Context
We need a clear separation of concerns between presentation, business logic, 
and data access layers.

## Decision
We adopt a layered architecture with the following layers:
- UI (Layer 0) → Runtime (Layer 1) → Services (Layer 2) → Domain (Layer 3) → Data (Layer 4) → Config (Layer 5)

Dependencies must flow inward: higher-numbered layers cannot import from lower-numbered layers.

## Enforcement
- ESLint rule: `custom-rules/layer-dependency-direction`
- Structural test: `tests/architecture/dependency-direction.test.ts`
- CI gate: Architecture Enforcement workflow

## Consequences
- Clear separation of concerns
- Testable business logic in isolation
- Agents cannot violate dependency direction
- New modules must follow the layer convention
```

The "Enforcement" section is the key innovation. It creates a direct link from the architectural decision to the mechanism that enforces it. When a new engineer (or agent) wants to understand *why* a linter rule exists, they can trace it back to the ADR.

This pattern transforms ADRs from passive documentation into active governance. The ADR doesn't just describe the architecture—it *is* the architecture, enforced by the tools it references.

## When Taste Conflicts With Pragmatism

Not every architectural decision is clear-cut. Sometimes pragmatism demands a temporary violation of the rules. The key is to make these exceptions *explicit* and *tracked*:

```javascript
// src/legacy/billing-bridge.ts
// eslint-disable-next-line custom-rules/layer-dependency-direction
// ARCH-DEBT: Billing module imports from services layer for backward compatibility.
// This violation is tracked in JIRA-1234 and will be resolved by Q3 2026.
// See: docs/architecture/adr-015-billing-migration.md
import { BillingService } from "../services/billing";
```

Every suppressed violation should have:
1. The specific rule being suppressed
2. A comment explaining *why*
3. A tracking reference (ticket, ADR)
4. An expected resolution timeline

Run a weekly audit:

```bash
#!/bin/bash
# scripts/audit-suppressions.sh

echo "=== Architecture Suppression Audit ==="
echo ""

# Find all eslint-disable comments for custom rules
grep -rn "eslint-disable.*custom-rules" src/ --include="*.ts" | while read line; do
    file=$(echo "$line" | cut -d: -f1)
    lineno=$(echo "$line" | cut -d: -f2)
    ticket=$(grep -o "JIRA-[0-9]*" "$file" | head -1 || echo "NO-TICKET")
    age=$(git log -1 --format="%ai" -- "$file")
    
    echo "[$ticket] $file:$lineno (last modified: $age)"
done

echo ""
echo "Suppressions without tickets need attention."
```

This ensures that "temporary" exceptions don't become permanent. Every suppression has a ticket, and every ticket has a resolution date.

## Real-World Case Study: The Affirm Architecture Enforcement

Affirm's retraining of 800 engineers for agentic development in one week provides a compelling case study in architecture enforcement at organizational scale. Their approach combined a single default toolchain (ensuring enforcement rules applied universally), local-first development (baking linter rules into every agent's environment), and explicit human checkpoints for judgment calls. Within weeks, their agents were producing code that consistently followed architectural conventions—not because the agents understood them, but because the enforcement layer made violations impossible. (For the full Affirm case study, see Chapter 4.)

> ### Sidebar: Architecture Enforcement at Google — AlphaEvolve and CodeMender
>
> If you think mechanical enforcement is only for teams struggling to manage agent output, consider this: Google DeepMind — arguably the world's most sophisticated AI research organization — uses architectural constraints as the *primary mechanism* for controlling its own coding agents.
>
> **AlphaEvolve: Constrained Evolution for Algorithm Discovery**
>
> Google DeepMind's AlphaEvolve is an evolutionary coding agent powered by Gemini models. It generates candidate improvements to algorithms, submits them to automated evaluators, and iterates on the most promising variants. Since early 2025, AlphaEvolve has been running continuously in Google's production environment.
>
> What makes AlphaEvolve work at scale is not the raw intelligence of its language model. It is the architectural constraints that govern what the agent can propose. AlphaEvolve does not freely mutate code and hope for the best. Its evolutionary framework enforces strict boundaries:
>
> - **Structural constraints** ensure that proposed changes preserve the interface contracts of existing systems — no renaming public APIs, no changing function signatures without updating every caller.
> - **Evaluation constraints** act as mechanical fitness functions: every candidate improvement must pass automated correctness tests, performance benchmarks, and integration checks before it advances to the next generation.
> - **Sandbox constraints** isolate each mutation so that a bad proposal cannot corrupt the evaluation environment or interfere with other evolutionary branches.
>
> These constraints are not suggestions or guidelines. They are mechanically enforced gates that the agent cannot bypass. The result: AlphaEvolve recovered approximately 0.7% of Google's total global compute capacity by optimizing critical infrastructure algorithms — including discovering a novel 4×4 complex matrix multiplication algorithm requiring only 48 scalar multiplications, breaking a 56-year-old record set by Strassen's algorithm.¹ It also accelerated training processes by 23% across multiple internal systems.
>
> Without architectural constraints, AlphaEvolve would be a random code mutator. With them, it is a disciplined engineering agent that produces verifiable improvements at scale.
>
> **CodeMender: Architectural Patterns for Security Fixes**
>
> Google DeepMind's CodeMender agent takes a different approach to the same principle. CodeMender is designed to automatically detect, fix, and rewrite code to eliminate security vulnerabilities. Built on Gemini Deep Think models, it operates in two modes: *reactive* (generating instant patches for newly discovered vulnerabilities) and *proactive* (rewriting existing code to prevent entire classes of vulnerabilities).
>
> What distinguishes CodeMender from a naive "find bug, patch bug" tool is its use of architectural patterns to constrain security fixes. When CodeMender patches a vulnerability, it does not simply insert a one-line fix. It reasons about the code's architectural context — the layer the vulnerability sits in, the dependencies it touches, the error propagation paths available — and generates a patch that conforms to the existing architecture. A fix in the data access layer stays in the data access layer. A fix that requires cross-cutting changes is decomposed into per-layer patches, each respecting the dependency direction of the surrounding code.
>
> CodeMender has already upstreamed 72 security fixes to open-source projects, including large codebases with millions of lines of code.² Its success rate is not a product of raw model capability alone — it is the product of architectural constraints that ensure every fix is structurally sound, not just functionally correct.
>
> **The Lesson: Mechanical Enforcement Is Not a Compromise — It's the Pattern**
>
> Google's experience with both AlphaEvolve and CodeMender demonstrates a principle that extends far beyond Google: **the most capable AI organizations use mechanical enforcement not because they lack sophistication, but because mechanical enforcement is what makes sophistication tractable at scale.**
>
> AlphaEvolve's architectural constraints do not limit its creativity — they channel it. Without constraints, the search space of possible code mutations is unbounded and the agent spends its compute exploring dead ends. With constraints, the search space is structured and the agent can explore deeply within productive regions. CodeMender's architectural patterns do not slow down its security fixes — they ensure that fixes are maintainable, testable, and composable rather than brittle one-off patches.
>
> If Google — with its research budget, its custom infrastructure, and its Gemini models — needs mechanical enforcement to make coding agents reliable, then every team working with agents needs it too. The scale differs; the principle does not.
>
> ---

¹ Google DeepMind, "AlphaEvolve: A Gemini-powered coding agent for designing advanced algorithms," 2025. https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms

² Google DeepMind, "Introducing CodeMender: An AI agent for code security," 2025. https://deepmind.google/blog/introducing-codemender-an-ai-agent-for-code-security

## The Philosophical Dimension: Why Enforcement Liberates

There's a philosophical counter-argument to mechanical enforcement that deserves addressing: "Doesn't strict enforcement stifle creativity?"

In traditional development, this concern has merit. A rigid set of rules can prevent engineers from exploring innovative approaches. But in agent-first development, the calculus is different:

1. **Agents don't experience stifling**: An agent doesn't feel frustrated when a linter rejects its code. It just reads the error message and tries again. There's no emotional cost to enforcement.

2. **Enforcement focuses creativity**: When the mechanical aspects are handled by rules, agents (and humans) can focus their creative energy on the aspects that matter—business logic, user experience, and novel algorithms. The rules handle the "where" and "how" of code organization; the agent handles the "what" and "why."

3. **Enforcement scales**: A rule that runs in CI applies to every PR from every agent at every time of day. A human reviewer who catches architectural violations applies to the PRs they review during working hours. At agent throughput (15-20 PRs per day), human review doesn't scale; enforcement does.

4. **Enforcement documents**: Every rule is a document of an architectural decision. When a new engineer or agent joins the team, they don't need to absorb the architecture through osmosis—they can read the rules.

The liberating effect of enforcement is one of the most surprising findings in agent-first development. Teams that implement strict enforcement report that their agents produce *more* creative solutions, not fewer, because the agents spend their token budget on business problems instead of architectural navigation.

---

## Structural Testing Deep Dive

Let's go deeper into structural testing patterns, covering more complex scenarios that arise in real codebases.

### The Architecture Fitness Function Suite

A complete fitness function suite tests multiple architectural characteristics simultaneously:

```typescript
// tests/architecture/fitness-functions.test.ts
import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { execSync } from "child_process";

describe("Architecture Fitness Functions", () => {
  const project = new Project({ tsConfigFilePath: "./tsconfig.json" });

  describe("Response Time", () => {
    it("dependency graph should be analyzable in under 5 seconds", async () => {
      const start = Date.now();
      const graph = buildDependencyGraph(project);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000);
    });
  });

  describe("Scalability", () => {
    it("adding a new module should not increase existing coupling", () => {
      const baseline = loadCouplingBaseline();
      const current = computeCouplingMetrics(project);
      for (const module of Object.keys(baseline)) {
        expect(current[module].efferent).toBeLessThanOrEqual(
          baseline[module].efferent + 1,
          `Module ${module} increased efferent coupling from ${baseline[module].efferent} to ${current[module].efferent}`
        );
      }
    });
  });

  describe("Resilience", () => {
    it("removing any single module should not break more than 3 others", () => {
      const graph = buildDependencyGraph(project);
      for (const module of graph.modules) {
        const dependents = getDependentModules(graph, module);
        expect(dependents.length).toBeLessThanOrEqual(
          3,
          `Module ${module} has ${dependents.length} dependents`
        );
      }
    });
  });
});
```

### Enforcing Invariants Across Languages

In polyglot codebases, structural tests need to work across language boundaries. Here's a language-agnostic approach using file system analysis:

```python
# tests/architecture/cross_language_structure.py
"""Architecture tests that work across all languages in the repo."""
import os
import re
from pathlib import Path

def test_no_secrets_in_source():
    """No file in src/ should contain hard-coded credentials."""
    secret_patterns = [
        r'password\s*=\s*["\'][^"\']+["\']',
        r'api_key\s*=\s*["\'][^"\']+["\']',
        r'secret\s*=\s*["\'][^"\']+["\']',
        r'AKIA[0-9A-Z]{16}',  # AWS access key
    ]
    violations = []
    for path in Path('src').rglob('*'):
        if path.suffix not in ('.py', '.ts', '.js', '.go', '.java'):
            continue
        content = path.read_text()
        for pattern in secret_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                violations.append(f"{path}: found {pattern}")
    assert len(violations) == 0, f"Found potential secrets:\n" + "\n".join(violations)


def test_all_services_have_health_endpoints():
    """Every service directory should have a health check implementation."""
    services_dir = Path('services')
    if not services_dir.exists():
        return
    for service_dir in services_dir.iterdir():
        if not service_dir.is_dir():
            continue
        health_files = list(service_dir.rglob('*health*'))
        health_in_code = False
        for source_file in service_dir.rglob('*'):
            if source_file.suffix not in ('.py', '.ts', '.js', '.go', '.java'):
                continue
            if 'health' in source_file.read_text().lower():
                health_in_code = True
                break
        assert health_in_code or health_files, (
            f"Service {service_dir.name} is missing a health endpoint. "
            f"See: docs/architecture.md#health-checks"
        )
```

### The Architecture Test Pyramid

Just as there's a testing pyramid (unit → integration → E2E), there's an architecture test pyramid:

```
        ╱╲
       ╱    ╲
      ╱ Cross- ╲         — Few, slow, high-value
     ╱ Language ╲          Tests that span language boundaries
    ╱   Tests     ╲        (e.g., API contract between Python and TypeScript)
   ╱────────────────╲
  ╱                    ╲
 ╱   Structural Tests    ╲   — Moderate number, moderate speed
╱   (ts-morph, madge,       ╲    Tests that verify code structure
╱    pydeps, etc.)            ╲  (e.g., layer isolation, coupling metrics)
╱────────────────────────────────╲
╱                                    ╲
╱     Linter Rules (ESLint, Ruff,      ╲  — Many, fast, immediate feedback
╱     Semgrep, go vet, etc.)            ╲    Catch violations at AST level
╱────────────────────────────────────────────╲
```

The base of the pyramid is linter rules—fast, numerous, and catching the most common violations. The middle is structural tests—moderately fast, checking architectural properties. The top is cross-language tests—slow but comprehensive, checking contracts between systems written in different languages.

A healthy architecture enforcement layer has all three levels. Missing the base (no linters) means too many violations slip through. Missing the middle (no structural tests) means complex violations aren't caught. Missing the top (no cross-language tests) means contract violations between services go undetected.

---

## Summary
- The progression is **implicit → explicit → linted → enforced**; every important rule should reach the "enforced" stage
- **Custom linters** encode your team's specific architectural rules into automated checks
- Key linter rules include: dependency direction, file size, import complexity, naming conventions, and god object detection
- **Structural tests** verify architectural properties as testable invariants using tools like ts-morph
- The **10 golden principles** provide a starting framework for encoding taste
- The **taste feedback loop** (observe → name → document → mechanize → verify) keeps enforcement current
- **Progressive enforcement** (warn → error → block) eases adoption
- The **architect's role** shifts from reviewing code to writing enforcement rules
- **Testing your linters** ensures rules catch the right violations without false positives
- The **CI pipeline is the architecture document**—every rule encoded in CI is a guaranteed architectural decision

---

## Real-World Example: Building a Custom Linter from Scratch

Let's walk through the complete process of creating a custom ESLint rule that enforces a real architectural principle. This example shows the full cycle from observation to mechanical enforcement.

### The Problem

Your team has noticed that agents frequently import from the infrastructure layer directly in API route handlers, bypassing the domain layer. This violates your layer architecture (API → Domain → Infrastructure) and makes the code harder to test and maintain.

### Step 1: Observe and Name

You observe the pattern in several recent PRs and name it: "layer-bypass-import."

### Step 2: Write the Linter Rule

```javascript
// eslint-rules/layer-bypass-import.js
"use strict";

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent direct imports from infrastructure layer in API routes",
      category: "Architecture",
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      layerBypass:
        "API route '{{file}}' imports directly from infrastructure layer '{{import}}'. " +
        "Route handlers should import from the domain layer, which encapsulates " +
        "infrastructure concerns. Move the import to a domain service.",
    },
  },

  create(context) {
    const filePath = context.getFilename();
    
    // Only apply to API route files
    if (!filePath.includes("/api/routes/") && !filePath.includes("\\api\\routes\")) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;
        
        // Check for infrastructure imports
        if (
          importPath.includes("/infrastructure/") || 
          importPath.includes("\\infrastructure\\")
        ) {
          context.report({
            node,
            messageId: "layerBypass",
            data: {
              file: filePath.split(/[/\\]/).pop(),
              import: importPath,
            },
          });
        }
      },
    };
  },
};
```

### Step 3: Write Tests for the Linter

```javascript
// eslint-rules/__tests__/layer-bypass-import.test.js
const rule = require("../layer-bypass-import");
const { RuleTester } = require("eslint");

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
});

ruleTester.run("layer-bypass-import", rule, {
  valid: [
    // Domain import from API route — allowed
    {
      filename: "src/api/routes/orders.ts",
      code: `import { OrderService } from "../../domain/orders";`,
    },
    // Infrastructure import from domain — allowed
    {
      filename: "src/domain/orders.ts",
      code: `import { OrderRepository } from "../infrastructure/database/orders";`,
    },
    // Any import from non-route files — allowed
    {
      filename: "src/utils/helpers.ts",
      code: `import { db } from "../infrastructure/database/connection";`,
    },
  ],
  invalid: [
    // Direct infrastructure import from API route — NOT allowed
    {
      filename: "src/api/routes/orders.ts",
      code: `import { OrderRepository } from "../../infrastructure/database/orders";`,
      errors: [{ messageId: "layerBypass" }],
    },
    // Direct cache import from API route — NOT allowed
    {
      filename: "src/api/routes/users.ts",
      code: `import { cache } from "../../infrastructure/cache/redis";`,
      errors: [{ messageId: "layerBypass" }],
    },
  ],
});
```

### Step 4: Register and Deploy

```javascript
// .eslintrc.js
module.exports = {
  plugins: ["custom-rules"],
  rules: {
    "custom-rules/layer-bypass-import": "warn",  // Start as warn
  },
};
```

### Step 5: Progressive Enforcement

- **Week 1**: Deploy as `warn`. Monitor for false positives.
- **Week 2**: Fix false positives and existing violations.
- **Week 3**: Upgrade to `error`. CI now fails on violations.
- **Week 4**: Add to AGENTS.md: "API routes must import from domain, not infrastructure."

This is the taste feedback loop in action: observe → name → document → mechanize → verify. Each step is small, but the compound effect is a codebase where the architectural rule is mechanically enforced and cannot be violated — by humans or agents.

---

## The Architect's Role in Agent-First Teams

In traditional software development, the architect reviews PRs, draws diagrams, and makes decisions about technology choices. In agent-first development, the architect's role shifts fundamentally. The architect no longer reviews code — they write the rules that review code.

### From Reviewer to Rule Writer

Consider the traditional workflow:
1. Agent (or developer) submits PR
2. Architect reviews PR for architectural compliance
3. Architect requests changes if rules are violated
4. Developer (or agent) fixes the code
5. Repeat until approved

At agent throughput (20+ PRs per day), this workflow breaks down. No architect can review 20 PRs per day with the depth needed to catch subtle architectural violations.

The agent-first workflow:
1. Architect writes a linter rule encoding the architectural principle
2. Agent submits PR
3. CI runs the linter rule automatically
4. If the rule fails, the agent gets a specific error message explaining what's wrong and how to fix it
5. The agent fixes the code and resubmits

The architect reviews the *rule*, not every PR. The rule is written once and applied to every future PR — by humans and agents alike. This scales infinitely.

### The Architecture Decision Record (ADR) as Linter Specification

Every architecture decision should be documented as an ADR, and every enforceable ADR should have a corresponding linter rule:

| ADR | Enforceable? | Linter Rule |
|---|---|---|
| ADR-001: Use PostgreSQL for all relational data | Partial | No SQLite imports in production code |
| ADR-002: Domain layer has no external dependencies | Yes | `layer-bypass-import` rule |
| ADR-003: All APIs follow REST conventions | Yes | `enforce-route-naming` rule |
| ADR-004: Files must be under 300 lines | Yes | `max-file-size` rule |
| ADR-005: Use event-driven communication between services | Partial | `no-direct-service-calls` rule (in progress) |
| ADR-006: No circular dependencies between modules | Yes | Structural test with madge |

When a new architecture decision is made, the architect asks: "Can this be mechanically enforced?" If yes, a linter rule or structural test is created. If no, the decision is documented but relies on human review — which makes it a candidate for future mechanization.

### The Architect's Toolkit

The agent-first architect needs a different toolkit than the traditional architect:

- **AST manipulation tools**: ts-morph (TypeScript), ast (Python), go/ast (Go) — for writing custom linters
- **Dependency analysis tools**: madge (JavaScript), pydeps (Python), godepgraph (Go) — for visualizing and enforcing dependency graphs
- **Pattern matching tools**: Semgrep — for cross-language pattern detection
- **Structural testing frameworks**: Jest + ts-morph (TypeScript), pytest + ast (Python) — for testing architectural invariants
- **CI configuration**: GitHub Actions, CircleCI — for deploying enforcement at the right stage

The architect who masters these tools becomes a force multiplier for the entire team. Every rule they write catches violations forever — in every PR, by every developer and every agent.

### The Anti-Pattern: The Architecture Review Board

Many organizations have an Architecture Review Board (ARB) that reviews proposed changes. In agent-first development, the ARB is an anti-pattern. It's a bottleneck that can't keep pace with agent throughput.

Instead, encode architectural decisions as rules and let CI enforce them. If a decision is important enough to require review, it's important enough to mechanize. If it can't be mechanized, it's not architectural — it's a judgment call that can be made at the team level.

This doesn't mean architects become unnecessary. It means they become *more* important — they make the decisions that define the system's character, and they encode those decisions in a form that scales.

---

## Common Architecture Enforcement Anti-Patterns

### Anti-Pattern 1: The Unenforced Convention

"We always put tests next to the code they test." This is a convention — but if it's not enforced, agents won't follow it consistently. The convention needs a structural test or linter rule.

### Anti-Pattern 2: The Overly Broad Rule

"No imports from outside the current module." This is too strict — it prevents legitimate shared code imports. Rules should be specific enough to catch violations without blocking valid patterns.

### Anti-Pattern 3: The Silent Linter

A linter that runs but whose output is buried in CI logs. Rules should be visible — use error messages that teach, not just flag. Include the "why" and the "how to fix" in every message.

### Anti-Pattern 4: The One-Time Review

"I'll review the architecture once a quarter." In agent-first development, architectural violations accumulate daily. Enforcement must be continuous, not periodic.

### Anti-Pattern 5: The Unreachable Standard

"All code must be perfect." Perfection is the enemy of enforcement. Start with rules that catch the most impactful violations, and progressively add more. An imperfect rule that's enforced is better than a perfect rule that's not.

### The ROI of Architecture Enforcement

Quantifying the return on investment for architecture enforcement is straightforward. Track these metrics before and after implementing each rule:

- **Time spent on architectural review**: Should decrease as rules automate the review
- **Number of architectural violations per PR**: Should decrease over time
- **False positive rate**: Should be <10% for well-designed rules
- **Agent cycle time**: Should decrease as agents get faster feedback
- **Developer satisfaction**: Should increase as developers spend less time on reviews

The most valuable metric is the last one: when developers (and agents) report that the rules *help* them write better code rather than *hinder* them, you know the enforcement is well-designed.

---
