# Chapter 11: Designing the Dependency Graph

> "A well-designed dependency graph is the difference between a codebase that ages gracefully and one that collapses under its own weight."

In a traditional codebase, dependency graphs evolve organically—engineers add imports where convenient, and the graph gradually becomes a tangled web. In agent-first development, this process accelerates dramatically. An agent making 15–20 PRs per day can create more dependency chaos in a week than a human team creates in a month.

This chapter is about designing, enforcing, and maintaining a clean dependency graph—one that agents can navigate without creating architectural decay. The layer architecture introduced in Chapter 10 (Types → Config → Data → Services → Runtime → UI) provides our running example: a directed acyclic graph (DAG) of dependencies that the OpenAI team used to guide their million-line agent-generated codebase.

---

## The Layer Architecture

A layer architecture defines a hierarchy of modules where each layer can only depend on layers below it (the full rationale and design principles are in Chapter 10). The six-layer model:

```
┌──────────────────────────────────────┐
│                UI                     │  Layer 0 — Presentation
│  React components, templates, CSS    │  "What the user sees"
├──────────────────────────────────────┤
│              Runtime                  │  Layer 1 — Orchestration
│  Server entry points, middleware,    │  "How the application runs"
│  request routing                     │
├──────────────────────────────────────┤
│             Services                  │  Layer 2 — Business Orchestration
│  Application services, use cases,    │  "What the application does"
│  workflow coordination               │
├──────────────────────────────────────┤
│              Data                     │  Layer 3 — Data Access
│  Repositories, queries, ORM models,  │  "How data is stored and retrieved"
│  database migrations                 │
├──────────────────────────────────────┤
│             Config                    │  Layer 4 — Configuration
│  Environment settings, feature       │  "How the application is configured"
│  flags, dependency injection setup   │
├──────────────────────────────────────┤
│              Types                    │  Layer 5 — Shared Definitions
│  Domain types, interfaces, value     │  "What things are"
│  objects, constants                  │
└──────────────────────────────────────┘

Dependency direction: ↑ can import ↓
                     ↓ cannot import ↑
```

Each layer has a clear responsibility. **Types** (Layer 5) contains shared type definitions and interfaces with no dependencies on other layers. **Config** (Layer 4) holds environment configuration and feature flags, importing only from Types. **Data** (Layer 3) contains repositories and database queries, importing from Config and Types. **Services** (Layer 2) holds business logic and use cases, importing from Data, Config, and Types. **Runtime** (Layer 1) wires everything together—server entry points, middleware, routing. **UI** (Layer 0) contains presentation logic, importing from Services and Types in practice.

### Implementing the Layer Architecture

Here's how to implement this in a TypeScript project:

```typescript
// src/types/index.ts — Layer 5: Shared definitions
// This module has ZERO imports from other layers

export interface Order {
  id: OrderId;
  customerId: CustomerId;
  items: OrderItem[];
  status: OrderStatus;
  total: Money;
  createdAt: Date;
}

export type OrderId = string & { readonly __brand: unique symbol };
export type CustomerId = string & { readonly __brand: unique symbol };

export interface OrderItem {
  productId: string;
  quantity: PositiveInteger;
  unitPrice: Money;
}

export enum OrderStatus {
  Pending = "pending",
  Confirmed = "confirmed",
  Shipped = "shipped",
  Delivered = "delivered",
  Cancelled = "cancelled",
}

export interface Money {
  amount: number;
  currency: string;
}

export type PositiveInteger = number & { readonly __brand: unique symbol };

// Repository interface (implemented by Data layer)
export interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  findByCustomerId(customerId: CustomerId): Promise<Order[]>;
  save(order: Order): Promise<void>;
  delete(id: OrderId): Promise<void>;
}
```

```typescript
// src/config/index.ts — Layer 4: Configuration
// Can import from: types

import type { Money } from "../types";

export interface DatabaseConfig {
  url: string;
  poolSize: number;
  sslEnabled: boolean;
}

export interface AppConfig {
  database: DatabaseConfig;
  redisUrl: string;
  environment: "development" | "staging" | "production";
  logLevel: "debug" | "info" | "warn" | "error";
  defaultCurrency: Money["currency"];
  maxOrderItems: number;
}

export function loadConfig(): AppConfig {
  return {
    database: {
      url: required("DATABASE_URL"),
      poolSize: number("DB_POOL_SIZE", 10),
      sslEnabled: boolean("DB_SSL", false),
    },
    redisUrl: required("REDIS_URL"),
    environment: required("APP_ENV"),
    logLevel: string("LOG_LEVEL", "info"),
    defaultCurrency: string("DEFAULT_CURRENCY", "USD"),
    maxOrderItems: number("MAX_ORDER_ITEMS", 100),
  };
}

// ... helper functions for environment variable parsing
```

```typescript
// src/data/order-repository.ts — Layer 3: Data access
// Can import from: config, types

import type { OrderRepository, Order, OrderId, CustomerId } from "../types";
import type { DatabaseConfig } from "../config";
import { DatabaseClient } from "../infrastructure/database";

export class PostgresOrderRepository implements OrderRepository {
  constructor(private db: DatabaseClient) {}

  async findById(id: OrderId): Promise<Order | null> {
    const row = await this.db.query(
      "SELECT * FROM orders WHERE id = $1",
      [id]
    );
    return row ? this.toDomain(row) : null;
  }

  async findByCustomerId(customerId: CustomerId): Promise<Order[]> {
    const rows = await this.db.query(
      "SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC",
      [customerId]
    );
    return rows.map(this.toDomain);
  }

  async save(order: Order): Promise<void> {
    await this.db.query(
      `INSERT INTO orders (id, customer_id, items, status, total, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         items = EXCLUDED.items,
         total = EXCLUDED.total`,
      [order.id, order.customerId, JSON.stringify(order.items),
       order.status, order.total.amount, order.createdAt]
    );
  }

  private toDomain(row: any): Order {
    return {
      id: row.id as OrderId,
      customerId: row.customer_id as CustomerId,
      items: JSON.parse(row.items),
      status: row.status,
      total: { amount: row.total, currency: "USD" },
      createdAt: row.created_at,
    };
  }
}
```

```typescript
// src/services/order-service.ts — Layer 2: Business orchestration
// Can import from: data, config, types

import type { Order, OrderId, CustomerId, OrderItem } from "../types";
import type { OrderRepository } from "../types";
import type { AppConfig } from "../config";

export class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private config: AppConfig,
  ) {}

  async createOrder(customerId: CustomerId, items: OrderItem[]): Promise<Order> {
    // Validate business rules
    if (items.length > this.config.maxOrderItems) {
      throw new BusinessError(
        "ORDER_TOO_LARGE",
        `Orders cannot have more than ${this.config.maxOrderItems} items`
      );
    }

    if (items.some(item => item.quantity <= 0)) {
      throw new BusinessError(
        "INVALID_QUANTITY",
        "All items must have a positive quantity"
      );
    }

    const total = this.calculateTotal(items);

    const order: Order = {
      id: generateId<OrderId>(),
      customerId,
      items,
      status: OrderStatus.Pending,
      total,
      createdAt: new Date(),
    };

    await this.orderRepo.save(order);
    return order;
  }

  private calculateTotal(items: OrderItem[]): Money {
    const amount = items.reduce(
      (sum, item) => sum + item.unitPrice.amount * item.quantity,
      0
    );
    return { amount, currency: this.config.defaultCurrency };
  }
}
```

Notice the dependency flow: `OrderService` depends on `OrderRepository` (an interface defined in Types) and `AppConfig` (from Config). It doesn't know about PostgreSQL, HTTP requests, or React components. It's pure business logic.

---

## Dependency Direction Enforcement

The layer architecture only works if the dependency direction is enforced. Without enforcement, the graph will inevitably develop violations—especially when agents are writing code at high throughput.

### ESLint Rule: Layer Dependency Direction

We introduced this rule in Chapter 10. Here's the complete, production-ready version:

```javascript
// eslint-rules/layer-dependency-direction.js
/**
 * Enforces one-way dependency flow in a layered architecture.
 * 
 * Configuration:
 *   layers: { [layerName]: number } — Lower number = higher layer
 *   allowList: string[] — Regex patterns for allowed exceptions
 *   strict: boolean — If true, same-layer imports are also checked
 */
const path = require("path");

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce unidirectional layer dependencies",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      illegalLayerDependency: (
        "DEPENDENCY VIOLATION: '{{fromLayer}}' (layer {{fromLevel}}) cannot " +
        "import from '{{toLayer}}' (layer {{toLevel}}). " +
        "Dependencies must flow from higher layers to lower layers. " +
        "{{guidance}}"
      ),
    },
    schema: [
      {
        type: "object",
        properties: {
          layers: { type: "object" },
          allowList: { type: "array", items: { type: "string" } },
          strict: { type: "boolean", default: false },
          guidance: { type: "object" },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const layers = options.layers || {};
    const allowList = (options.allowList || []).map(p => new RegExp(p));
    const guidance = options.guidance || {};
    
    const filePath = context.getFilename();
    const normalizedPath = filePath.replace(/\\/g, "/");
    
    function getLayerInfo(importPath) {
      for (const [layerName, level] of Object.entries(layers)) {
        if (importPath.includes(`/src/${layerName}/`)) {
          return { name: layerName, level };
        }
      }
      return null;
    }
    
    const fromLayer = getLayerInfo(normalizedPath);
    if (!fromLayer) return {};

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;
        
        // Skip external packages
        if (!importPath.startsWith(".") && !importPath.startsWith("src/")) return;
        
        // Resolve relative paths
        const resolvedPath = importPath.startsWith("./") || importPath.startsWith("../")
          ? path.resolve(path.dirname(normalizedPath), importPath).replace(/\\/g, "/")
          : importPath;
        
        const toLayer = getLayerInfo(resolvedPath);
        if (!toLayer) return;
        
        // Same layer is allowed (unless strict mode)
        if (fromLayer.name === toLayer.name && !options.strict) return;
        
        // Check allow list
        const importKey = `${fromLayer.name}->${toLayer.name}`;
        if (allowList.some(pattern => pattern.test(importKey))) return;
        
        // Enforce: can only import from lower layers (higher level number)
        if (toLayer.level < fromLayer.level) {
          const specificGuidance = guidance[importKey] || 
            `Move the shared code to '${toLayer.name}' or introduce an interface.`;
          
          context.report({
            node,
            messageId: "illegalLayerDependency",
            data: {
              fromLayer: fromLayer.name,
              fromLevel: fromLayer.level,
              toLayer: toLayer.name,
              toLevel: toLayer.level,
              guidance: specificGuidance,
            },
          });
        }
      },
    };
  },
};
```

Configuration:

```javascript
// .eslintrc.js
module.exports = {
  plugins: ["custom-rules"],
  rules: {
    "custom-rules/layer-dependency-direction": ["error", {
      layers: {
        "ui": 0,
        "runtime": 1,
        "services": 2,
        "data": 3,
        "config": 4,
        "types": 5,
      },
      allowList: [
        "^ui->types$",          // UI can always import types
        "^runtime->types$",     // Runtime can always import types
        "^services->types$",
        "^data->types$",
        "^config->types$",
      ],
      guidance: {
        "ui->runtime": "UI components should not import server-side code. Use API calls instead.",
        "data->services": "Data layer should not depend on services. The dependency should be reversed: services depend on data, not the other way around. If you need shared logic, move it to the types layer.",
        "data->runtime": "Data layer should not depend on runtime. Database code should be framework-agnostic.",
        "config->services": "Configuration should not depend on business logic. Move the dependency to services importing from config.",
      },
    }],
  },
};
```

---

## Module Boundary Design

Layers define the vertical structure of your codebase. Module boundaries define the horizontal structure—how code within a layer is organized into cohesive units.

### Module Design Principles

1. **High cohesion**: Everything in a module is related to a single business concept
2. **Low coupling**: Modules communicate through well-defined interfaces
3. **Encapsulation**: Internal details are hidden behind a public API
4. **Stability**: Module interfaces change less frequently than implementations

### The Module Structure

```
src/
├── types/                     # Shared type definitions
│   ├── order.ts
│   ├── customer.ts
│   ├── product.ts
│   └── index.ts               # Public API barrel file
├── config/                    # Configuration
│   ├── index.ts
│   └── validation.ts
├── data/                      # Data access layer
│   ├── orders/
│   │   ├── order-repository.ts   # Implements OrderRepository interface
│   │   ├── order-queries.ts      # SQL queries
│   │   ├── order-mapper.ts       # DB row → domain object mapping
│   │   └── index.ts              # Public API
│   ├── customers/
│   │   ├── customer-repository.ts
│   │   ├── customer-queries.ts
│   │   └── index.ts
│   └── index.ts                  # Data layer public API
├── services/                  # Business orchestration
│   ├── orders/
│   │   ├── order-service.ts
│   │   ├── order-validator.ts
│   │   ├── order-events.ts
│   │   └── index.ts
│   ├── customers/
│   │   ├── customer-service.ts
│   │   └── index.ts
│   └── index.ts
├── runtime/                   # Server orchestration
│   ├── server.ts
│   ├── routes.ts
│   ├── middleware/
│   └── index.ts
└── ui/                        # Presentation
    ├── components/
    ├── pages/
    └── index.ts
```

Each module (orders, customers, products) has:
- A **barrel file** (`index.ts`) that exports its public API
- **Implementation files** that are internal to the module
- **No imports from other modules' internal files**

### Barrel File Enforcement

Enforce that cross-module imports go through barrel files:

```javascript
// eslint-rules/enforce-barrel-imports.js
/**
 * Enforces that cross-module imports use barrel files (index.ts).
 * Prevents agents from importing internal implementation details.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce barrel file imports across modules",
      category: "Architecture",
    },
    messages: {
      deepImport: (
        "Deep import into module '{{module}}'. " +
        "Import from the module's public API instead: " +
        "'{{suggestedPath}}'"
      ),
    },
  },

  create(context) {
    const filePath = context.getFilename().replace(/\\/g, "/");
    
    // Determine current module
    const moduleMatch = filePath.match(/src\/([^/]+)\/([^/]+)/);
    if (!moduleMatch) return {};
    const [, currentLayer, currentModule] = moduleMatch;

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;
        if (!importPath.startsWith(".")) return;
        
        const resolved = resolvePath(filePath, importPath);
        
        // Check if importing from a different module's internals
        const importMatch = resolved.match(/src\/([^/]+)\/([^/]+)\/(.+)/);
        if (!importMatch) return;
        
        const [, importLayer, importModule, deepPath] = importMatch;
        
        // Same module — OK
        if (importLayer === currentLayer && importModule === currentModule) return;
        
        // Importing from barrel file (index.ts) — OK
        if (!deepPath || deepPath === "index.ts") return;
        
        // Deep import from another module — VIOLATION
        context.report({
          node,
          messageId: "deepImport",
          data: {
            module: `${importLayer}/${importModule}`,
            suggestedPath: importPath.replace(/\/.+/g, ""),
          },
        });
      },
    };
  },
};
```

---

## API Contract Stability

When modules communicate through interfaces, those interfaces become contracts. Changing a contract breaks every consumer. In agent-first development, where changes happen rapidly, contract stability is critical.

### Interface Segregation

Define minimal interfaces that expose only what consumers need:

```typescript
// src/types/index.ts — Focused interfaces

// What the order service needs from the data layer
export interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  findByCustomerId(customerId: CustomerId): Promise<Order[]>;
  save(order: Order): Promise<void>;
}

// What the notification service needs from the order domain
export interface OrderNotifier {
  onOrderCreated(order: Order): Promise<void>;
  onOrderShipped(order: Order): Promise<void>;
  onOrderCancelled(order: Order): Promise<void>;
}

// What the UI needs from the order service
export interface OrderQueryService {
  getOrderDetails(id: OrderId): Promise<OrderDetails>;
  listOrders(filter: OrderFilter): Promise<PaginatedResult<OrderSummary>>;
}
```

Each interface is tailored to its consumer. The notification service doesn't need to know about database queries. The UI doesn't need to know about order creation. This is the Interface Segregation Principle (the "I" in SOLID) applied to module boundaries.

### Contract Testing

Verify that implementations conform to their interface contracts:

```typescript
// tests/contracts/order-repository.contract.ts
/**
 * Generic contract tests for OrderRepository implementations.
 * Run this against every implementation (Postgres, InMemory, etc.)
 */
import { describe, it, expect } from "vitest";

export function orderRepositoryContract(
  name: string,
  createRepository: () => Promise<OrderRepository>
) {
  describe(`OrderRepository contract: ${name}`, () => {
    let repo: OrderRepository;

    beforeEach(async () => {
      repo = await createRepository();
    });

    it("should save and retrieve an order", async () => {
      const order = createTestOrder();
      
      await repo.save(order);
      const retrieved = await repo.findById(order.id);
      
      expect(retrieved).toEqual(order);
    });

    it("should return null for non-existent order", async () => {
      const result = await repo.findById("non-existent-id" as OrderId);
      
      expect(result).toBeNull();
    });

    it("should find orders by customer ID", async () => {
      const order1 = createTestOrder({ customerId: "cust-001" as CustomerId });
      const order2 = createTestOrder({ customerId: "cust-001" as CustomerId });
      const order3 = createTestOrder({ customerId: "cust-002" as CustomerId });
      
      await repo.save(order1);
      await repo.save(order2);
      await repo.save(order3);
      
      const results = await repo.findByCustomerId("cust-001" as CustomerId);
      
      expect(results).toHaveLength(2);
      expect(results.map(o => o.id)).toContainEqual(order1.id);
      expect(results.map(o => o.id)).toContainEqual(order2.id);
    });

    it("should update an existing order", async () => {
      const order = createTestOrder();
      await repo.save(order);
      
      order.status = OrderStatus.Confirmed;
      await repo.save(order);
      
      const retrieved = await repo.findById(order.id);
      expect(retrieved?.status).toBe(OrderStatus.Confirmed);
    });
  });
}

// Run against real implementation
orderRepositoryContract("PostgresOrderRepository", async () => {
  const db = await createTestDatabase();
  return new PostgresOrderRepository(db);
});

// Run against in-memory implementation (for fast unit tests)
orderRepositoryContract("InMemoryOrderRepository", async () => {
  return new InMemoryOrderRepository();
});
```

Contract tests guarantee that every implementation of an interface behaves identically. When an agent creates a new implementation (e.g., a Redis-based cache for order lookups), the contract tests verify it conforms to the expected behavior.

---

## Preventing Circular Dependencies

Circular dependencies are the arch-enemy of a clean dependency graph. When module A imports from module B, and module B imports from module A, neither can be understood in isolation. This makes testing difficult, refactoring dangerous, and agent comprehension impossible.

### Detection with Structural Tests

```typescript
// tests/architecture/no-circular-dependencies.test.ts
import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";

interface DependencyNode {
  file: string;
  imports: string[];
}

function buildDependencyGraph(project: Project): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  
  const sourceFiles = project.getSourceFiles("src/**/*.ts");
  
  for (const file of sourceFiles) {
    const filePath = file.getFilePath();
    if (filePath.includes(".test.") || filePath.includes("node_modules")) continue;
    
    const imports = new Set<string>();
    
    for (const imp of file.getImportDeclarations()) {
      const specifier = imp.getModuleSpecifierValue();
      if (specifier.startsWith(".") || specifier.startsWith("src/")) {
        // Use ts-morph's built-in module resolution (handles path aliases, etc.)
        const resolved = imp.getModuleSpecifierSourceFile()?.getFilePath();
        if (resolved) imports.add(resolved);
      }
    }
    
    graph.set(normalizePath(filePath), imports);
  }
  
  return graph;
}

function findCycles(graph: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function dfs(node: string, path: string[]) {
    visited.add(node);
    recursionStack.add(node);
    
    const neighbors = graph.get(node) || new Set();
    
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
      }
    }
    
    recursionStack.delete(node);
  }
  
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, [node]);
    }
  }
  
  return cycles;
}

describe("Architecture: No Circular Dependencies", () => {
  it("should have no circular dependencies in the codebase", () => {
    const project = new Project({ tsConfigFilePath: "./tsconfig.json" });
    const graph = buildDependencyGraph(project);
    const cycles = findCycles(graph);
    
    if (cycles.length > 0) {
      const cycleDescriptions = cycles.map(cycle => 
        cycle.map(p => p.replace(/.*src\//, "src/")).join(" → ") + 
        " → " + cycle[0].replace(/.*src\//, "src/")
      );
      
      expect.fail(
        `Found ${cycles.length} circular dependencies:\n` +
        cycleDescriptions.join("\n")
      );
    }
    
    expect(cycles).toHaveLength(0);
  });
});
```

### Prevention with madge

For a simpler approach, use the `madge` tool to detect circular dependencies:

```bash
# Install madge
npm install --save-dev madge

# Check for circular dependencies
npx madge --circular src/

# Output:
# ✖ Found 2 circular dependencies!
# 1) src/services/orders.ts > src/domain/order.ts > src/services/orders.ts
# 2) src/data/cache.ts > src/services/notifications.ts > src/data/cache.ts
```

Add it to your CI pipeline:

```yaml
# .github/workflows/architecture.yml
jobs:
  circular-deps:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Check for circular dependencies
        run: npx madge --circular --extensions ts src/
```

---

## The DAG Imperative

Your dependency graph must be a Directed Acyclic Graph (DAG). Not "mostly" a DAG. Not "except for these two legacy modules." A pure DAG.

Why? Because:

1. **Build optimization**: DAGs enable parallel builds. Cycles force sequential builds.
2. **Test isolation**: DAGs enable isolated testing. Cycles force integrated testing.
3. **Agent comprehension**: DAGs are easy to reason about. Cycles create mental loops that confuse agents.
4. **Refactoring safety**: DAGs enable incremental refactoring. Cycles make every change a potential cascade.

### Resolving Circular Dependencies

When you find a circular dependency, resolve it using one of these techniques:

**Technique 1: Extract Shared Code to a Lower Layer**

If modules A and B both depend on code in each other, the shared code belongs in a lower layer:

```typescript
// Before: Circular dependency
// src/services/orders.ts imports from src/services/customers.ts
// src/services/customers.ts imports from src/services/orders.ts

// After: Extract shared types to types layer
// src/types/order-customer-shared.ts
export interface CustomerOrderSummary {
  customerId: CustomerId;
  orderCount: number;
  totalSpent: Money;
}

// Now both services import from types, not from each other
```

**Technique 2: Use Dependency Inversion**

If a lower layer needs functionality from a higher layer, define an interface in the lower layer and implement it in the higher layer:

```typescript
// src/types/index.ts — Define interface in types (lowest layer)
export interface NotificationService {
  sendOrderConfirmation(order: Order): Promise<void>;
  sendShippingUpdate(order: Order): Promise<void>;
}

// src/services/orders.ts — Use the interface
export class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private notifier: NotificationService, // Injected, not imported
  ) {}
  
  async confirmOrder(id: OrderId): Promise<Order> {
    const order = await this.orderRepo.findById(id);
    if (!order) throw new OrderNotFoundError(id);
    
    order.status = OrderStatus.Confirmed;
    await this.orderRepo.save(order);
    
    // Call through interface, not direct dependency
    await this.notifier.sendOrderConfirmation(order);
    return order;
  }
}

// src/services/notifications.ts — Implement the interface
export class EmailNotificationService implements NotificationService {
  async sendOrderConfirmation(order: Order): Promise<void> {
    await this.emailClient.send({
      to: order.customerId,
      subject: `Order ${order.id} confirmed`,
      body: `Your order totaling $${order.total.amount} has been confirmed.`,
    });
  }
  
  async sendShippingUpdate(order: Order): Promise<void> {
    // ...
  }
}
```

Dependency inversion is the "D" in SOLID, and it's the most important principle for maintaining clean dependency graphs. High-level modules should not depend on low-level modules. Both should depend on abstractions.

**Technique 3: Use Events/Message Passing**

If modules need to react to each other's actions without direct dependencies, use an event system:

```typescript
// src/types/events.ts — Event definitions in the types layer
export interface OrderEvents {
  "order.created": { orderId: OrderId; customerId: CustomerId };
  "order.confirmed": { orderId: OrderId };
  "order.shipped": { orderId: OrderId; trackingNumber: string };
  "order.cancelled": { orderId: OrderId; reason: string };
}

export interface EventBus {
  publish<K extends keyof OrderEvents>(
    event: K, 
    payload: OrderEvents[K]
  ): Promise<void>;
  
  subscribe<K extends keyof OrderEvents>(
    event: K,
    handler: (payload: OrderEvents[K]) => Promise<void>
  ): void;
}
```

```typescript
// src/services/orders.ts — Publishes events
export class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private eventBus: EventBus, // Interface from types layer
  ) {}
  
  async createOrder(customerId: CustomerId, items: OrderItem[]): Promise<Order> {
    const order = /* ... create order ... */;
    await this.orderRepo.save(order);
    
    // Publish event — no dependency on notification service
    await this.eventBus.publish("order.created", {
      orderId: order.id,
      customerId: order.customerId,
    });
    
    return order;
  }
}
```

```typescript
// src/services/notifications.ts — Subscribes to events
export class NotificationService {
  constructor(private eventBus: EventBus) {
    this.eventBus.subscribe("order.created", this.onOrderCreated.bind(this));
  }
  
  private async onOrderCreated(payload: OrderEvents["order.created"]) {
    // React to order creation without importing OrderService
    await this.sendWelcomeEmail(payload.customerId);
  }
}
```

Now `OrderService` and `NotificationService` have no direct dependency on each other. They communicate through the event bus, which is an interface defined in the types layer. The dependency graph remains a clean DAG.

---

## Technology Selection for Agent Legibility

The technologies you choose affect how easy it is for agents to work with your codebase. Some technologies are inherently more legible than others.

### Prefer Explicit Over Implicit

```typescript
// Implicit: Magic framework behavior
@Controller("/orders")  // What does this do? What's injected?
export class OrdersController {
  @Post()
  async create(@Body() body: any) { // What type is body?
    // ...
  }
}

// Explicit: Clear dependencies and behavior
export class OrderRoutes {
  constructor(
    private orderService: OrderService, // Explicit dependency
    private validator: OrderValidator,
  ) {}
  
  register(router: Router): void {
    router.post(
      "/api/v1/orders",
      validateBody(CreateOrderSchema), // Explicit validation
      async (req: Request, res: Response) => {
        const result = await this.orderService.createOrder(
          req.body.customerId,
          req.body.items,
        );
        res.status(201).json(result);
      }
    );
  }
}
```

### Prefer Static Over Dynamic

TypeScript over JavaScript. Typed Python over untyped Python. Go over Ruby for services where type safety matters. Static types give agents more information to work with and catch more errors at compile time.

### Prefer Simple Over Clever

```typescript
// Clever: Hard for agents to understand
const result = pipe(
  data,
  filter(x => x.active),
  map(transform),
  reduce(aggregate, {}),
  Object.entries,
  sortBy(([_, v]) => v.priority),
  fromEntries,
);

// Simple: Easy for agents to understand and modify
const activeItems = data.filter(x => x.active);
const transformed = activeItems.map(transform);
const aggregated = aggregate(transformed);
const sorted = Object.entries(aggregated)
  .sort((a, b) => a[1].priority - b[1].priority);
const result = Object.fromEntries(sorted);
```

Both versions produce the same result. The simple version is easier for agents to understand, debug, and modify. Save functional programming patterns for domains where they genuinely reduce complexity, not for general data transformation.

---

## When to Reimplement Instead of Import

Sometimes the right architectural decision is to reimplement functionality rather than import a library. This is especially true in agent-first development, where:

1. **Third-party code is invisible to your linters**: Your dependency direction rules can't see inside `node_modules`
2. **Complex libraries have many implicit behaviors**: Agents struggle with "magic" behavior
3. **Small utilities are cheaper to maintain than dependencies**: A 50-line utility you own is better than a 50KB dependency you don't

### The Reimplementation Decision Framework

Reimplement when:
- The functionality is < 100 lines of straightforward code
- The library adds significant dependency weight (> 100KB)
- The library has implicit behavior that confuses agents
- Your usage is a small subset of the library's API
- The library's type definitions are incomplete or incorrect

Keep the library when:
- The functionality is complex and well-tested (e.g., cryptography, parsing)
- The library is a de facto standard (e.g., React, Express)
- Your usage covers most of the library's API
- The library provides significant performance benefits

### Example: Simple Validation

Consider importing Zod (12KB) for simple validation. For a project with only a few schemas, a lightweight 30-line custom validator — one that agents can read, understand, and modify — is often better than a dependency they can't see inside. For complex validation with async rules, schema composition, or nested error reporting, keep Zod. The principle: choose the option that makes the most boundaries visible to your enforcement tools.

---

## The Complete Enforcement Pipeline

Here's the complete CI pipeline for dependency graph enforcement:

```yaml
# .github/workflows/dependency-graph.yml
name: Dependency Graph Enforcement
on: [pull_request]

jobs:
  lint-and-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: ESLint — dependency direction, barrel imports
        run: npx eslint src/ --rule 'custom-rules/layer-dependency-direction: error' --rule 'custom-rules/enforce-barrel-imports: error'
      - name: Circular dependency detection
        run: npx madge --circular --extensions ts src/
      - name: Structural architecture tests
        run: npx vitest run tests/architecture/
      - name: dependency-cruiser — layer rules & coupling
        run: npx depcruise --validate .dependency-cruiser.js src/
```

Four checks, one job, every PR. An agent that creates a dependency violation sees clear, actionable errors pointing to the exact file and the rule it broke.

## Dependency Graph Visualization and Metrics with `dependency-cruiser`

Rather than writing custom visualization scripts, use [`dependency-cruiser`](https://github.com/sverweij/dependency-cruiser) — a mature, open-source tool that validates and visualizes JavaScript and TypeScript dependency graphs. It handles module resolution (including TypeScript path aliases, monorepo packages, and webpack aliases) out of the box, so you don't need to implement your own `resolveModule()` logic.

Install and generate a baseline configuration:

```bash
# Install dependency-cruiser
npm install --save-dev dependency-cruiser

# Auto-generate a configuration with sensible defaults
npx depcruise --init
```

Here's a `.dependency-cruiser.js` configuration that enforces the six-layer architecture from this chapter:

```javascript
// .dependency-cruiser.js
module.exports = {
  forbidden: [
    // Rule 1: UI must not import runtime, services, or data directly
    {
      name: "ui-no-lower-layers",
      comment: "UI should only import from services and types",
      severity: "error",
      from: { path: "^src/ui/" },
      to: {
        path: ["^src/runtime/", "^src/services/", "^src/data/", "^src/config/"],
        pathNot: "^src/types/",
      },
    },
    // Rule 2: Data layer must not import services or runtime
    {
      name: "data-no-higher-layers",
      comment: "Data layer should not depend on services or runtime",
      severity: "error",
      from: { path: "^src/data/" },
      to: {
        path: ["^src/services/", "^src/runtime/", "^src/ui/"],
      },
    },
    // Rule 3: Config must not import services, data, or runtime
    {
      name: "config-no-higher-layers",
      comment: "Config should only depend on types",
      severity: "error",
      from: { path: "^src/config/" },
      to: {
        path: ["^src/services/", "^src/data/", "^src/runtime/", "^src/ui/"],
        pathNot: "^src/types/",
      },
    },
    // Rule 4: No circular dependencies
    {
      name: "no-circular",
      comment: "Circular dependencies make modules impossible to understand in isolation",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    // Rule 5: Services must not import UI
    {
      name: "services-no-ui",
      comment: "Business logic should not depend on presentation",
      severity: "error",
      from: { path: "^src/services/" },
      to: { path: "^src/ui/" },
    },
    // Rule 6: Types layer must have no internal dependencies
    {
      name: "types-standalone",
      comment: "Shared types must be dependency-free",
      severity: "error",
      from: { path: "^src/types/" },
      to: {
        path: ["^src/config/", "^src/data/", "^src/services/", "^src/runtime/", "^src/ui/"],
      },
    },
  ],
  options: {
    tsConfig: {
      fileName: "./tsconfig.json",
    },
    // Externals don't need to be checked
    doNotFollow: {
      path: "node_modules",
    },
  },
};
```

Run validation on your source:

```bash
npx depcruise --validate .dependency-cruiser.js src/
```

Output when a violation is found:

```
error  data-no-higher-layers: src/data/order-repository.ts → src/services/order-service.ts
  Data layer should not depend on services or runtime

✖ 1 dependency violation (1 error, 0 warnings). 53 modules, 54 dependencies cruised.
```

Generate visual graphs for human review:

```bash
# Generate a DOT graph (viewable with GraphViz or online tools)
npx depcruise src/ --output-type dot > docs/dependency-graph.dot

# Generate an HTML report with an interactive dependency map
npx depcruise src/ --output-type html > docs/dependency-report.html

# Generate a Mermaid diagram (embeddable in markdown)
npx depcruise src/ --output-type mermaid > docs/dependency-graph.mmd
```

For coupling metrics, `dependency-cruiser` provides folder-level summaries:

```bash
# Show module counts and reachability per folder
npx depcruise src/ --output-type metrics

# Output:
# Module                              Dependencies  Reachable
# src/types/                           0             53
# src/config/                          3             50
# src/data/                            8             42
# src/services/                        15            27
# src/runtime/                         22            5
# src/ui/                              31            0
```

Track these metrics over time. If the dependency count in lower layers is growing, your agents are introducing upward dependencies — a sign that enforcement needs to be tightened. The `metrics` output gives you the same signal as the custom `DependencyMetrics` interface above, without needing to maintain your own graph-building code.

## Real-World Example: Refactoring a Tangled Dependency Graph

Let's walk through a concrete example of refactoring a tangled dependency graph into a clean DAG. This is based on a real scenario from a team that adopted agent-first development mid-project.

### The Starting State

The codebase had evolved organically over two years. The dependency graph looked like this:

```
src/
├── controllers/       # No clear separation between concerns
│   ├── order_controller.py
│   ├── user_controller.py
│   └── payment_controller.py
├── models/            # Database models mixed with business logic
│   ├── order.py       # Contains validation, calculation, AND persistence
│   ├── user.py        # Imports from order.py for recent_orders
│   └── payment.py     # Imports from order.py AND user.py
├── utils/             # Catch-all for "shared" code
│   ├── email.py       # Imports from models/user.py
│   ├── pdf.py         # Imports from models/order.py
│   └── logging.py
└── services/          # Some business logic, but incomplete
    ├── stripe.py      # Directly imports models/order.py
    └── notifications.py  # Imports from utils/email.py AND models/order.py
```

Running `madge --circular` revealed 8 circular dependencies:

```
1) models/order.py ↔ models/user.py
2) models/order.py ↔ models/payment.py
3) models/user.py ↔ models/payment.py
4) models/order.py ↔ utils/pdf.py
5) utils/email.py ↔ models/user.py
6: services/stripe.py ↔ models/order.py
7) services/notifications.py ↔ utils/email.py
8) services/notifications.py ↔ models/order.py
```

### The Refactoring Plan

The team followed a systematic approach:

**Step 1: Extract types** — Move all shared type definitions to a new `types/` module with zero dependencies:

```python
# src/types/order.py — Pure type definitions, no imports from other modules
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

@dataclass
class OrderItem:
    product_id: str
    quantity: int
    unit_price: float

@dataclass  
class Order:
    id: str
    customer_id: str
    items: List[OrderItem]
    status: str
    total: float
    created_at: str

# Repository interface — implemented in data layer
class OrderRepository:
    def find_by_id(self, order_id: str) -> Optional[Order]: ...
    def find_by_customer(self, customer_id: str) -> List[Order]: ...
    def save(self, order: Order) -> None: ...
```

**Step 2: Separate data access** — Create a clean data layer that only depends on types:

```python
# src/data/order_repository.py
from src.types.order import Order, OrderRepository
from src.infrastructure.database import Database

class PostgresOrderRepository(OrderRepository):
    def __init__(self, db: Database):
        self.db = db
    
    def find_by_id(self, order_id: str) -> Optional[Order]:
        row = self.db.query("SELECT * FROM orders WHERE id = %s", [order_id])
        return self._to_domain(row) if row else None
    
    def find_by_customer(self, customer_id: str) -> List[Order]:
        rows = self.db.query(
            "SELECT * FROM orders WHERE customer_id = %s", [customer_id]
        )
        return [self._to_domain(r) for r in rows]
    
    def save(self, order: Order) -> None:
        self.db.upsert("orders", order.__dict__)
```

**Step 3: Wire in the runtime layer** — Connect everything at the composition root:

```python
# src/runtime/server.py
from src.data.order_repository import PostgresOrderRepository
from src.services.order_service import OrderService
from src.api.routes import create_order_router

def create_app():
    db = Database.from_env()
    events = RabbitMQEventBus.from_env()
    order_service = OrderService(PostgresOrderRepository(db), events)
    app = FastAPI()
    app.include_router(create_order_router(order_service))
    return app
```

### The Result

After refactoring: **0 circular dependencies** (down from 8), clean layer separation (API → Services → Data → Types), each layer testable in isolation, and agent-friendly — an agent can add a new feature by following the layer pattern. The refactoring took two weeks, with agents handling the mechanical work (moving code, updating imports). Enforcement rules were deployed first, ensuring no new violations were introduced during the process.

## Module Coupling Metrics

Track the coupling between modules to ensure the graph remains healthy:

- **Afferent coupling (Ca)**: How many modules depend on this module. High Ca = the module is a bottleneck. Changes to it cascade widely.
- **Efferent coupling (Ce)**: How many modules this module depends on. High Ce = the module is fragile. Changes to any dependency might break it.
- **Instability (I)**: Ce / (Ca + Ce). Ranges from 0 (maximally stable) to 1 (maximally unstable). Stable modules (low I) should contain interfaces and types. Unstable modules (high I) should contain implementation.
- **Abstractness (A)**: Ratio of abstract types to total types. High A = the module defines contracts. Low A = the module implements behavior.
- **Distance from Main Sequence (D)**: |A + I - 1|. Ranges from 0 (balanced) to 1 (unbalanced). Modules with D near 0 are well-balanced. Modules with D near 1 are either too abstract with no dependents (zone of uselessness) or too concrete with many dependents (zone of pain).

Enforce these metrics with structural tests — for example, asserting that the types layer has instability below 0.2, that no module has efferent coupling above 7, and that all modules have a Distance from Main Sequence below 0.5. These tests give you a quantitative view of your dependency graph's health and detect coupling trends before they become architectural problems.

---

## Dependency Graphs at Scale: How Meta Manages Multi-Thousand-Module Systems

The techniques in this chapter work well for single-repo, single-language codebases with tens to hundreds of modules. But what happens at thousands of modules across multiple repositories, languages, and teams? Meta's internal developer infrastructure provides a window into dependency graph management at extreme scale.

Meta's codebase spans thousands of interconnected modules across languages including Hack, Python, C++, and JavaScript. A single data feature might touch configuration registries, routing logic, DAG composition, validation rules, generated C++ code, and automation scripts — six subsystems that must stay in sync. At this scale, the dependency graph isn't just a developer convenience; it's a survival mechanism.

### Automated Dependency Analysis at Meta

Meta's internal developer platform includes automated systems that continuously analyze the dependency graph across their entire monorepo. When a team introduces a new module or changes an existing one, automated checks validate that:

- **No illegal cross-layer imports** occur — modules in one product domain can't reach into the internals of another domain without going through a public API.
- **Deprecation edges are tracked** — when a module is deprecated, every module that depends on it is flagged for migration. This prevents "zombie dependencies" where deprecated code persists indefinitely because nothing tracks its consumers.
- **Transitive dependency depth is bounded** — deeply nested dependency chains increase build times and make failures harder to diagnose. Meta enforces maximum transitive depth per module.

These checks run automatically on every commit, not just in CI. The scale demands it: with thousands of engineers pushing code continuously, waiting for CI to catch violations would mean thousands of violations accumulate before detection.

### CodeCompose: Enforcing Import Rules at the IDE

Meta's CodeCompose system — an AI-powered code completion tool serving tens of thousands of developers across nine programming languages — acts as an additional layer of dependency enforcement. CodeCompose is based on the InCoder LLM and has been trained on Meta's internal codebase, which means it has learned the implicit dependency rules that govern the codebase.

When a developer (or an AI agent) begins typing an import statement, CodeCompose's suggestions are biased toward valid dependency directions. It won't suggest importing from a layer that the current module isn't allowed to depend on. This is subtle but powerful: rather than catching violations after they're written, CodeCompose prevents them from being written in the first place. In a 15-day measurement window, CodeCompose made 4.5 million suggestions with a 22% acceptance rate, meaning it influenced the shape of millions of import decisions.

CodeCompose also addresses a challenge unique to large-scale dependency graphs: *API discovery*. In a codebase with thousands of modules, engineers can't know every available API. CodeCompose helps developers discover the correct, dependency-safe APIs for their needs — reducing the temptation to import from a convenient but architecturally wrong module.

### The Pre-Compute Engine: Context for Agent-Scale Edits

In 2026, Meta described how they used a swarm of 50+ specialized AI agents to map tribal knowledge across one of their large-scale data processing pipelines — spanning four repositories, three languages, and over 4,100 files. The key insight was building a *pre-compute engine*: automated agents that systematically read every file and produced 59 concise context files encoding the dependency relationships and design decisions that previously lived only in engineers' heads.

The result: AI agents gained structured navigation guides covering 100% of the code modules (up from 5%), and documented 50+ "non-obvious patterns" — underlying design choices and dependency relationships not immediately apparent from the code alone. Preliminary tests showed 40% fewer AI agent tool calls per task because agents could navigate the dependency graph efficiently instead of exploring blindly.

This system also maintains itself. Every few weeks, automated jobs validate file paths, detect coverage gaps, re-run quality critics, and auto-fix stale references. The dependency knowledge base stays current without human intervention — a critical feature for agent-first development where the graph changes rapidly.

### Lessons from Meta's Approach

1. **Enforcement must be continuous, not periodic.** At scale, CI-only enforcement is too slow. Meta runs dependency checks on every commit, and CodeCompose provides real-time guidance in the editor.
2. **The dependency graph needs its own documentation layer.** At thousands of modules, the graph itself becomes a system that must be documented, navigated, and maintained — separate from the code it connects.
3. **Self-maintaining systems outperform manual curation.** Meta's pre-compute engine automatically refreshes dependency knowledge, which is essential when agents are modifying code faster than humans can update documentation.
4. **IDE-level prevention complements CI-level detection.** The best violation is the one that never gets written. CodeCompose's import suggestions guide developers and agents toward architecturally correct dependencies before a linter ever runs.

These lessons scale down. Even if your codebase has 50 modules instead of 5,000, the principles hold: continuous enforcement, explicit documentation of the dependency graph, automated maintenance of that documentation, and prevention at the point of authoring.¹

---

## Python Dependency Graphs: `import-linter` and `pydeps` in Practice

The examples in this chapter have been TypeScript-centric, reflecting the OpenAI team's original tooling. But the principles apply to any language. Let's see how to enforce a clean dependency graph in a Python service using real, production-ready tools.

### Enforcing Layer Architecture with `import-linter`

[`import-linter`](https://import-linter.readthedocs.io/) is a Python tool that lets you define architecture contracts as declarative configuration. It supports layered architecture contracts, forbidden import contracts, and custom contract types.

Consider a Python FastAPI service with a layered architecture:

```
orderservice/
├── api/             # Layer 0: HTTP routes, request/response models
├── services/        # Layer 1: Business logic, use cases
├── repositories/    # Layer 2: Database queries, data access
├── models/          # Layer 3: Domain types, value objects
└── config/          # Layer 4: Settings, environment
```

The dependency rule: higher layers can import from lower layers, but not the reverse. Here's the `import-linter` configuration enforcing this:

```toml
# pyproject.toml — import-linter configuration
[tool.importlinter]
root_packages = [
    "orderservice.api",
    "orderservice.services",
    "orderservice.repositories",
    "orderservice.models",
    "orderservice.config",
]

# Contract 1: Enforce layer ordering
[[tool.importlinter.contracts]]
name = "Layered architecture"
type = "layers"
layers = [
    "orderservice.api",
    "orderservice.services",
    "orderservice.repositories",
    "orderservice.models",
    "orderservice.config",
]

# Contract 2: Database queries must not leak into the API layer
[[tool.importlinter.contracts]]
name = "API layer must not access repositories directly"
type = "forbidden"
source_modules = [
    "orderservice.api",
]
forbidden_modules = [
    "orderservice.repositories",
]

# Contract 3: Business logic must not depend on the web framework
[[tool.importlinter.contracts]]
name = "Services must not import FastAPI"
type = "forbidden"
source_modules = [
    "orderservice.services",
    "orderservice.repositories",
    "orderservice.models",
]
forbidden_modules = [
    "fastapi",
]
include_external_packages = true
```

Running `lint-imports` produces clear, actionable output:

```bash
$ lint-imports
-----------
Keep the following contracts KEPT
-----------

Layered architecture KEPT
API layer must not access repositories directly KEPT
Services must not import FastAPI KEPT

Contracts: 3 kept, 0 broken.
```

When a violation occurs, the output pinpoints the exact file and line:

```bash
$ lint-imports
-----------
Layered architecture BROKEN
-----------

orderservice.repositories is not allowed to import orderservice.services:

   orderservice.repositories.order_repo
   -> orderservice.services.order_service (l.12)
```

### Visualizing Dependencies with `pydeps`

While `import-linter` enforces rules, [`pydeps`](https://github.com/thebjorn/pydeps) helps you *see* the graph. It generates dependency diagrams from Python package imports:

```bash
# Install pydeps
pip install pydeps

# Generate a dependency graph for your package
pydeps orderservice --max-bacon=3 -o docs/dependency-graph.svg
```

The `--max-bacon` parameter limits the depth of external dependencies shown (named after Kevin Bacon's six degrees of separation), keeping the diagram focused on your internal architecture rather than drowning in third-party imports.

### Running in CI

Combine both tools in your GitHub Actions workflow:

```yaml
# .github/workflows/dependency-graph.yml
jobs:
  dependency-enforcement:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install import-linter pydeps
      - name: Check dependency contracts
        run: lint-imports
      - name: Generate dependency graph
        run: pydeps orderservice --max-bacon=3 -o docs/dependency-graph.svg
```

This gives Python projects the same automated enforcement that `dependency-cruiser` and `madge` provide for TypeScript: every PR is validated against your architecture rules, and the visualization stays current automatically.

---

¹ Meta Engineering, "Ranking Engineer Agent (REA)," 2026. https://engineering.fb.com/2026/03/17/developer-tools/ranking-engineer-agent-rea

---

The key takeaway: the dependency graph principles in this chapter are language-agnostic. Whether you're using TypeScript with `dependency-cruiser`, Python with `import-linter`, or Java with ArchUnit, the pattern is the same — *declare the rules declaratively, enforce them mechanically, and visualize them automatically*.

---

## Summary

- The **layer architecture** (Types → Config → Data → Services → Runtime → UI) provides a clear dependency hierarchy
- **Dependency direction enforcement** via custom ESLint rules (or `dependency-cruiser`, `import-linter`) ensures imports flow only inward
- **Module boundaries** with barrel files and public APIs prevent agents from reaching into implementation details
- **Circular dependency prevention** through detection (`madge`, structural tests, `dependency-cruiser`) and resolution (extraction, inversion, events)
- The **DAG imperative**: your dependency graph must be a pure directed acyclic graph — not "mostly" a DAG
- **Dependency inversion** and **event-driven communication** break circular dependencies while maintaining loose coupling
- **Technology selection** should favor explicit, static, and simple approaches that agents can understand
- The **complete enforcement pipeline** (linting + circular detection + structural tests + coupling analysis) provides multiple layers of dependency verification
- At scale, **continuous enforcement** and **self-maintaining documentation** become essential — Meta's approach shows that the dependency graph itself becomes a system requiring its own infrastructure
