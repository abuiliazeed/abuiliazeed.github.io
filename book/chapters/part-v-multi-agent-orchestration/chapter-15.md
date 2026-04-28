# Chapter 15: Orchestrator Patterns

> "Orchestration is the art of making many agents feel like one."
> — Distributed systems wisdom, adapted

---

## The Coordinator/Specialist/Verifier Pattern

We introduced the Coordinator/Specialist/Verifier pattern in Chapter 13 as one of six coordination patterns. Now we dive deep into its implementation—how the roles communicate, how work flows between them, and how to build a production-grade orchestrator using this pattern.

### Deep Dive: The Coordinator Role

The coordinator is the brain of the operation. It doesn't write code—it manages the process of writing code. Its responsibilities are:

1. **Task decomposition**: Break a feature request into implementable tasks
2. **Dependency analysis**: Determine which tasks depend on which
3. **Agent assignment**: Route each task to the appropriate specialist
4. **Progress tracking**: Monitor which tasks are complete, which are in progress, and which have failed
5. **Integration**: Merge completed tasks in the correct order
6. **Escalation**: Identify tasks that need human intervention

```
┌──────────────────────────────────────────────────┐
│           Coordinator State Machine               │
│                                                  │
│  ┌──────────┐                                    │
│  │ RECEIVE  │                                    │
│  │  TASK    │                                    │
│  └────┬─────┘                                    │
│       │                                          │
│       v                                          │
│  ┌──────────┐    ┌───────────┐                  │
│  │DECOMPOSE │───▶│ BUILD     │                  │
│  │          │    │ TASK      │                  │
│  └──────────┘    │ GRAPH     │                  │
│                  └─────┬─────┘                  │
│                        │                        │
│                        v                        │
│                  ┌───────────┐                  │
│                  │ ASSIGN    │                  │
│                  │ SPECIALIST│◀──────┐          │
│                  └─────┬─────┘       │          │
│                        │             │          │
│                        v             │          │
│                  ┌───────────┐       │          │
│                  │ MONITOR   │       │          │
│                  │ PROGRESS  │───────┘          │
│                  └─────┬─────┘  (next task)     │
│                        │                        │
│              ┌─────────┼──────────┐             │
│              v         v          v             │
│          ┌───────┐ ┌───────┐ ┌──────────┐      │
│          │SUCCESS│ │FAILED │ │ BLOCKED  │      │
│          └───┬───┘ └───┬───┘ └────┬─────┘      │
│              │         │          │             │
│              v         v          v             │
│          ┌─────────┐ ┌──────┐ ┌───────────┐   │
│          │VERIFY   │ │RETRY │ │ESCALATE   │   │
│          │& MERGE  │ │OR    │ │TO HUMAN   │   │
│          └─────────┘ │REASSIGN┘└───────────┘   │
│                      └──────┘                   │
└──────────────────────────────────────────────────┘
```

**Coordinator implementation**:

```typescript
// orchestrator/coordinator.ts

interface Task {
  id: string;
  description: string;
  dependencies: string[];  // Task IDs this depends on
  specialist: 'implementor' | 'tester' | 'reviewer';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  assignee?: string;
  result?: TaskResult;
  retryCount: number;
  maxRetries: number;
}

interface TaskResult {
  success: boolean;
  filesChanged: string[];
  testsAdded: string[];
  prUrl?: string;
  error?: string;
  lessons: string[];  // For Ralph Wiggum Loop
}

class Coordinator {
  private tasks: Map<string, Task> = new Map();
  private completedTasks: Set<string> = new Set();
  private maxConcurrentAgents: number;
  private activeAgents: number = 0;

  constructor(maxConcurrentAgents: number = 4) {
    this.maxConcurrentAgents = maxConcurrentAgents;
  }

  async processFeature(featureDescription: string): Promise<void> {
    // Step 1: Decompose the feature into tasks
    const tasks = await this.decompose(featureDescription);

    // Step 2: Build the task graph
    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }

    // Step 3: Execute the task graph
    await this.executeTaskGraph();

    // Step 4: Final verification
    await this.finalVerification();
  }

  private async decompose(description: string): Promise<Task[]> {
    // Use a strong model for decomposition (requires architectural reasoning)
    const response = await callAgent({
      model: 'claude-opus-4',
      systemPrompt: `You are a task decomposer. Break features into implementable tasks.
Each task must specify:
- id: unique identifier (e.g., "task-1")
- description: what to implement
- dependencies: list of task IDs that must complete first
- specialist: which specialist to assign ("implementor", "tester", "reviewer")

Rules:
- Each task should touch ≤5 files
- Tasks should be completable in a single agent session (30 min)
- Separate type/config changes from implementation from tests
- Return valid JSON array of tasks.`,
      prompt: `Decompose this feature into tasks:
${description}

Context about the codebase:
- Follows layered architecture: Types → Config → Data → Services → Runtime → UI
- All changes must pass lint, typecheck, tests, and arch checks
- Files must be under 200 lines
- Dependencies flow downward (UI → Services → Data → Types, never reverse)`,
    });

    return JSON.parse(response);
  }

  private async executeTaskGraph(): Promise<void> {
    while (this.completedTasks.size < this.tasks.size) {
      // Find ready tasks (all dependencies completed, not yet started)
      const readyTasks = this.getReadyTasks();

      if (readyTasks.length === 0 && this.activeAgents === 0) {
        // Deadlock or all remaining tasks are blocked
        const blockedTasks = [...this.tasks.values()]
          .filter(t => t.status === 'pending' || t.status === 'blocked');
        throw new Error(
          `Deadlock: ${blockedTasks.length} tasks cannot proceed. ` +
          `Task IDs: ${blockedTasks.map(t => t.id).join(', ')}`
        );
      }

      // Launch agents for ready tasks (up to concurrency limit)
      const availableSlots = this.maxConcurrentAgents - this.activeAgents;
      const toLaunch = readyTasks.slice(0, availableSlots);

      await Promise.all(toLaunch.map(task => this.executeTask(task)));
    }
  }

  private getReadyTasks(): Task[] {
    return [...this.tasks.values()].filter(task =>
      task.status === 'pending' &&
      task.dependencies.every(depId => this.completedTasks.has(depId))
    );
  }

  private async executeTask(task: Task): Promise<void> {
    task.status = 'in_progress';
    this.activeAgents++;

    try {
      // Create isolated worktree
      const worktree = await createWorktree(task.id);

      // Select specialist based on task type
      const specialist = this.getSpecialist(task.specialist);

      // Execute with Ralph Wiggum Loop
      const result = await this.executeWithRetry(
        specialist, task, worktree, task.maxRetries
      );

      if (result.success) {
        // Run verifier
        const verified = await this.verify(worktree, result);
        if (verified) {
          task.status = 'completed';
          task.result = result;
          this.completedTasks.add(task.id);

          // Merge the worktree
          await mergeWorktree(worktree);
        } else {
          task.status = 'failed';
          task.result = { success: false, filesChanged: [], testsAdded: [],
                         error: 'Verification failed', lessons: [] };
        }
      } else {
        task.status = 'failed';
        task.result = result;
      }
    } catch (error) {
      task.status = 'failed';
      task.result = {
        success: false, filesChanged: [], testsAdded: [],
        error: String(error), lessons: []
      };
    } finally {
      this.activeAgents--;
    }
  }

  private async executeWithRetry(
    specialist: Specialist,
    task: Task,
    worktree: string,
    maxRetries: number
  ): Promise<TaskResult> {
    const lessons: string[] = [];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const prompt = lessons.length > 0
        ? `${task.description}\n\nLessons from previous attempts:\n${lessons.join('\n')}`
        : task.description;

      const result = await specialist.execute(prompt, worktree);

      if (result.success) {
        return result;
      }

      // Accumulate lessons for Ralph Wiggum Loop
      if (result.error) {
        lessons.push(`- Attempt ${attempt + 1}: ${result.error}`);
      }
    }

    return {
      success: false,
      filesChanged: [],
      testsAdded: [],
      error: `Failed after ${maxRetries + 1} attempts`,
      lessons,
    };
  }

  private async verify(worktree: string, result: TaskResult): Promise<boolean> {
    // Run automated quality gates
    const gates = [
      { name: 'lint', command: 'npm run lint' },
      { name: 'typecheck', command: 'npx tsc --noEmit' },
      { name: 'test', command: 'npm test' },
      { name: 'arch', command: 'npm run test:arch' },
    ];

    for (const gate of gates) {
      const passed = await runInWorktree(worktree, gate.command);
      if (!passed) {
        console.error(`Gate "${gate.name}" failed for worktree ${worktree}`);
        return false;
      }
    }

    return true;
  }
}
```

### Deep Dive: The Specialist Role

Specialists are workers optimized for specific types of tasks. The key to specialist design is **scope restriction**: a specialist should be *incapable* of doing things outside its scope. A test specialist shouldn't be able to modify implementation code. A documentation specialist shouldn't be able to modify tests.

This isn't about trust—it's about error prevention. A specialist with a narrow scope makes fewer mistakes because it has fewer options.

```typescript
// orchestrator/specialists.ts

interface Specialist {
  name: string;
  model: string;
  systemPrompt: string;
  allowedPaths: string[];     // Glob patterns for files it can modify
  deniedPaths: string[];      // Glob patterns for files it cannot modify
  allowedCommands: string[];  // Commands it can run
}

const specialists: Record<string, Specialist> = {
  implementor: {
    name: 'implementor',
    model: 'claude-sonnet-4',
    systemPrompt: `You are an implementation specialist.
Given a task description:
1. Read the relevant code files
2. Implement the required changes
3. Follow all patterns in AGENTS.md strictly
4. Keep files under 200 lines
5. Follow the dependency layer order
6. Write clear, descriptive commit messages

Do NOT:
- Modify test files (that's the tester's job)
- Modify CI/CD configuration
- Add new dependencies without approval`,
    allowedPaths: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js'],
    deniedPaths: ['src/**/*.test.*', '.github/**', 'terraform/**'],
    allowedCommands: ['npm run build', 'npm run lint', 'npx tsc --noEmit'],
  },

  tester: {
    name: 'tester',
    model: 'claude-haiku',  // Cheaper model for test writing
    systemPrompt: `You are a testing specialist.
Given implemented code:
1. Read the implementation files
2. Write comprehensive tests
3. Target 90%+ coverage for new code
4. Follow the existing test patterns in the codebase
5. Include edge cases and error scenarios

Do NOT:
- Modify implementation code
- Change business logic
- Add new dependencies`,
    allowedPaths: ['tests/**/*.ts', 'src/**/*.test.ts'],
    deniedPaths: ['src/**/*.ts', '!src/**/*.test.ts'],
    allowedCommands: ['npm test', 'npm run test:coverage'],
  },

  reviewer: {
    name: 'reviewer',
    model: 'claude-sonnet-4',
    systemPrompt: `You are a code reviewer specialist.
Review changes for:
1. Pattern consistency with the codebase
2. Architectural constraint violations
3. Missing error handling
4. Security concerns
5. Performance implications

Provide structured feedback:
- APPROVE if all checks pass
- REQUEST_CHANGES with specific file:line references if issues found

Do NOT:
- Modify any files
- Run any commands that change state`,
    allowedPaths: [],  // Read-only
    deniedPaths: ['**/*'],
    allowedCommands: ['npm run lint', 'npx tsc --noEmit', 'git diff'],
  },
};
```

### Deep Dive: The Verifier Role

The verifier is the quality gatekeeper. Unlike the reviewer specialist (which provides qualitative feedback), the verifier runs automated checks and produces a binary pass/fail result.

The verifier's power comes from its *mechanical* nature. It doesn't exercise judgment—it executes rules. This makes it predictable, auditable, and free from the bias that can affect human (or agent) reviewers.

```typescript
// orchestrator/verifier.ts

interface VerificationResult {
  passed: boolean;
  gateResults: GateResult[];
  summary: string;
}

interface GateResult {
  gate: string;
  passed: boolean;
  output: string;
  duration: number;  // milliseconds
}

class Verifier {
  private gates: Gate[];

  constructor(gates: Gate[]) {
    this.gates = gates;
  }

  async verify(worktreePath: string): Promise<VerificationResult> {
    const results: GateResult[] = [];

    for (const gate of this.gates) {
      // Short-circuit: if a gate fails, skip remaining gates
      // (cheaper gates run first for efficiency)
      const start = Date.now();
      const result = await this.runGate(gate, worktreePath);
      results.push({
        gate: gate.name,
        passed: result.success,
        output: result.output,
        duration: Date.now() - start,
      });

      if (!result.success && gate.blocking) {
        break;  // Short-circuit on blocking gate failure
      }
    }

    const allPassed = results.every(r => r.passed);
    const summary = this.buildSummary(results);

    return { passed: allPassed, gateResults: results, summary };
  }

  private async runGate(gate: Gate, worktreePath: string): Promise<{
    success: boolean;
    output: string;
  }> {
    try {
      const output = await executeInWorktree(worktreePath, gate.command);
      return { success: true, output };
    } catch (error) {
      return { success: false, output: String(error) };
    }
  }

  private buildSummary(results: GateResult[]): string {
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const lines = [
      `Verification: ${passed}/${total} gates passed`,
      '',
    ];

    for (const result of results) {
      const icon = result.passed ? '✅' : '❌';
      lines.push(`${icon} ${result.gate} (${result.duration}ms)`);
      if (!result.passed) {
        lines.push(`   ${result.output.split('\n')[0]}`);
      }
    }

    return lines.join('\n');
  }
}

// Standard verification gates (ordered cheap → expensive)
const standardGates: Gate[] = [
  { name: 'ESLint', command: 'npm run lint', blocking: true },
  { name: 'TypeScript', command: 'npx tsc --noEmit', blocking: true },
  { name: 'Unit Tests', command: 'npm test', blocking: true },
  { name: 'Architecture', command: 'npm run test:arch', blocking: true },
  { name: 'Coverage', command: 'npm run test:coverage -- --check', blocking: false },
];
```

---

## Synchronous (Task Wait) vs. Asynchronous (Fire-and-Forget)

Orchestrators can dispatch work to agents in two modes: synchronous (wait for the result) or asynchronous (fire and forget, check back later). The choice affects throughput, error handling, and complexity.

### Synchronous: Task Wait

In synchronous mode, the orchestrator dispatches a task to an agent and *waits* for the result before proceeding. The orchestrator is blocked until the agent completes (or fails).

```
Synchronous (Task Wait):

Timeline ──────────────────────────────────────────▶

Orchestrator: ─[dispatch A]─[wait...]─[result A]─[dispatch B]─[wait...]─[result B]
Agent A:                      ─[execute]─┘
Agent B:                                                            ─[execute]─┘
```

**When to use synchronous mode**:
- Tasks have dependencies (Task B needs Task A's output)
- You need the result before making decisions
- Error handling must be immediate
- Sequential merge patterns

**Implementation**:

```typescript
// Synchronous agent execution
async function executeSynchronous(task: Task): Promise<TaskResult> {
  const agent = spawnAgent(task);
  const result = await agent.waitForCompletion();
  // Orchestrator is blocked here until agent finishes

  if (!result.success) {
    // Immediate error handling
    return await handleFailure(task, result);
  }

  return result;
}
```

### Asynchronous: Fire-and-Forget

In asynchronous mode, the orchestrator dispatches a task and immediately moves on. It checks back later (polling or event-driven) for results.

```
Asynchronous (Fire-and-Forget):

Timeline ──────────────────────────────────────────▶

Orchestrator: ─[dispatch A]─[dispatch B]─[dispatch C]─[check results]─[collect]
Agent A:       ─[execute...]─────────────────────┘
Agent B:                 ─[execute...]──────┘
Agent C:                          ─[execute...]────────────────┘
```

**When to use asynchronous mode**:
- Tasks are independent (no dependencies)
- You want maximum throughput
- Batch patterns with many parallel agents
- You have a separate verification step

**Implementation**:

```typescript
// Asynchronous agent execution
async function executeBatch(tasks: Task[]): Promise<Map<string, TaskResult>> {
  const results = new Map<string, Promise<TaskResult>>();

  // Fire off all agents immediately
  for (const task of tasks) {
    results.set(task.id, spawnAgentAsync(task));
    // Orchestrator moves on immediately
  }

  // Wait for all to complete (or use event-driven approach)
  const settled = await Promise.allSettled([...results.values()]);

  // Process results
  const finalResults = new Map<string, TaskResult>();
  for (const [id, result] of [...results.entries()].entries()) {
    const settledResult = settled[id];
    if (settledResult.status === 'fulfilled') {
      finalResults.set(tasks[id].id, settledResult.value);
    } else {
      finalResults.set(tasks[id].id, {
        success: false,
        error: String(settledResult.reason),
      });
    }
  }

  return finalResults;
}
```

### Hybrid: Wait for Dependencies, Fire-and-Forget Within Phases

The most practical approach for production orchestrators is hybrid: use synchronous waiting between dependency phases and asynchronous execution within each phase.

```typescript
// Hybrid execution: sync between phases, async within phases
async function executeHybrid(taskGraph: TaskGraph): Promise<void> {
  const phases = taskGraph.getExecutionPhases();

  for (const phase of phases) {
    // Fire-and-forget within a phase (all tasks in a phase are independent)
    const results = await Promise.allSettled(
      phase.tasks.map(task => spawnAgentAsync(task))
    );

    // Synchronous: wait for all phase tasks before proceeding
    // (implicitly handled by Promise.allSettled)

    // Check for failures
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      // Decide: retry failures or abort the pipeline
      await handlePhaseFailures(failures);
    }

    // Merge phase results before starting next phase
    await mergePhaseResults(phase);
  }
}
```

This is exactly how the spec-driven decomposition pattern (Chapter 13) works: Phase 1 tasks run in parallel (async), but the orchestrator waits for all Phase 1 tasks to complete and merge before starting Phase 2 (sync).

---

## Chain of Specialists Pipeline

The chain of specialists is a sequential pipeline where each specialist's output becomes the next specialist's input. It's the assembly line of multi-agent orchestration.

```
┌──────────────────────────────────────────────────┐
│          Chain of Specialists Pipeline            │
│                                                  │
│  Input ──▶ [Spec     ] ──▶ [Implementor] ──▶    │
│            [Writer   ]     [             ]       │
│                                │                │
│                                v                │
│            [Tester   ] ◀── [Reviewer   ] ◀──    │
│            [         ]     [           ]        │
│                                │                │
│                                v                │
│                           [ Integrator ] ──▶     │
│                           [           ]         │
│                                │                │
│                                v                │
│                            Final Output          │
└──────────────────────────────────────────────────┘
```

Each specialist in the chain performs one transformation:

1. **Spec Writer**: Takes a feature description and produces a detailed specification with task decomposition
2. **Implementor**: Takes a specification and produces implementation code
3. **Reviewer**: Takes implementation code and produces review feedback
4. **Tester**: Takes reviewed implementation and produces comprehensive tests
5. **Integrator**: Takes implementation and tests, runs all verification, produces a merge-ready PR

**Why chain instead of parallel?** Because each step's quality depends on the previous step's output. A tester can't write good tests without seeing the implementation. A reviewer can't review code that hasn't been written yet. The chain enforces this ordering naturally.

```typescript
// Chain of specialists pipeline
interface ChainStep {
  specialist: Specialist;
  inputTransform: (previousOutput: any) => string;
  outputTransform: (rawOutput: string) => any;
}

const implementationChain: ChainStep[] = [
  {
    specialist: specialists.specWriter,
    inputTransform: (featureDescription) => featureDescription,
    outputTransform: (output) => JSON.parse(output),  // Parse spec
  },
  {
    specialist: specialists.implementor,
    inputTransform: (spec) => `Implement the following specification:\n${JSON.stringify(spec, null, 2)}`,
    outputTransform: (output) => ({ implementation: output }),
  },
  {
    specialist: specialists.reviewer,
    inputTransform: ({ implementation }) =>
      `Review this implementation for quality and correctness:\n${implementation}`,
    outputTransform: (output) => ({ review: output }),
  },
  {
    specialist: specialists.tester,
    inputTransform: ({ implementation, review }) =>
      `Write tests for this implementation (addressing review feedback):\n${implementation}\n\nReview notes:\n${review}`,
    outputTransform: (output) => ({ tests: output }),
  },
];

async function executeChain(
  chain: ChainStep[],
  initialInput: any
): Promise<any> {
  let currentInput = initialInput;

  for (const step of chain) {
    const prompt = step.inputTransform(currentInput);
    const rawOutput = await callSpecialist(step.specialist, prompt);
    currentInput = step.outputTransform(rawOutput);

    // If any step fails, the chain stops
    if (currentInput.error) {
      throw new Error(`Chain failed at step: ${step.specialist.name}`);
    }
  }

  return currentInput;
}
```

### Chain Error Handling

The chain pattern requires careful error handling because a failure at any step invalidates all subsequent steps. There's no point running the tester if the implementation failed.

```typescript
async function executeChainWithRecovery(
  chain: ChainStep[],
  initialInput: any,
  maxRetries: number = 2
): Promise<any> {
  let currentInput = initialInput;

  for (let i = 0; i < chain.length; i++) {
    const step = chain[i];
    let success = false;
    let attempt = 0;

    while (!success && attempt <= maxRetries) {
      try {
        const prompt = step.inputTransform(currentInput);
        const rawOutput = await callSpecialist(step.specialist, prompt);
        const output = step.outputTransform(rawOutput);

        if (output.error) {
          attempt++;
          // Ralph Wiggum: add lesson and retry
          currentInput = {
            ...currentInput,
            lessons: [
              ...(currentInput.lessons || []),
              `Step ${step.specialist.name} attempt ${attempt}: ${output.error}`,
            ],
          };
          continue;
        }

        currentInput = { ...currentInput, ...output };
        success = true;
      } catch (error) {
        attempt++;
        if (attempt > maxRetries) {
          throw new Error(
            `Chain failed at step ${i} (${step.specialist.name}) ` +
            `after ${maxRetries + 1} attempts: ${error}`
          );
        }
      }
    }
  }

  return currentInput;
}
```

---

## Dependency Graph Execution and Fan-Out/Fan-In

The dependency graph executor manages execution order for complex features with many interdependent tasks---phasing tasks so that independent work runs in parallel while dependent work waits. The fan-out/fan-in pattern is a specialization of this approach: one task decomposes into many parallel subtasks, which then aggregate back into a single result.

Both patterns were introduced in Chapter 13 (Spec-Driven Decomposition and the six coordination patterns) and the worktree infrastructure that supports them was covered in Chapter 14. Rather than repeating those implementations here, we'll focus on the orchestrator-level concerns that arise when composing these patterns at scale: deadlock detection, cost optimization across parallel agents, and graceful degradation under failure.

The key insight is that **dependency graphs and fan-out/fan-in are not alternatives---they're layers**. A dependency graph orchestrates the overall workflow. Fan-out/fan-in operates within a single phase of that graph, dispatching independent tasks to parallel agents and collecting their results before the next phase begins. Your orchestrator needs both: the graph for ordering, fan-out/fan-in for throughput within each phase.

---

## Merge Conflict Resolution in Multi-Agent Workflows

When multiple agents work on the same codebase simultaneously, merge conflicts are inevitable. This isn't a flaw in the orchestration—it's a predictable consequence of parallelism. The question isn't whether conflicts will happen, but how your orchestrator handles them when they do.

Get this wrong and you'll spend more time untangling agent conflicts than you saved by running agents in parallel. Get it right and conflicts become a minor operational detail, handled automatically in most cases and escalated to humans only when necessary.

### Types of Conflicts Agents Create

Agents generate a different conflict profile than human developers. Understanding these types is essential to designing the right prevention and resolution strategies.

**1. Semantic Conflicts**

The most dangerous and hardest to detect. Two agents produce code that is individually correct but jointly broken. Agent A changes a function signature in `user_service.ts` while Agent B adds new callers in `order_service.ts` that expect the old signature. Both changes pass their individual quality gates. The conflict only surfaces at integration time—or worse, in production.

Semantic conflicts are particularly insidious because git merge succeeds cleanly. The code compiles, tests pass in isolation, but the combined behavior is wrong. A type system catches some of these (if the signature change is type-incompatible), but behavioral changes—different error handling, changed side effects, altered return semantics—slip through.

**2. Structural Conflicts**

Two agents reorganize the same area of the codebase in different ways. Agent A extracts a helper function from `utils.ts` into `string_utils.ts`. Agent B adds new functions to `utils.ts` and reorders the existing ones. Git sees conflicting line changes; the merge fails with traditional conflict markers.

Structural conflicts are the most common type in multi-agent workflows, especially during refactoring-heavy tasks. They're also the most straightforward to resolve mechanically—usually one agent's restructuring takes precedence and the other's additions are rebased on top.

**3. Import and Dependency Conflicts**

Agent A adds a new import to `package.json` and uses it in `feature_a.ts`. Agent B removes an unrelated dependency from `package.json` and cleans up its usage across `feature_b.ts`. When their branches merge, `package.json` has a merge conflict. If resolved incorrectly—missing Agent A's addition or Agent B's removal—the build breaks.

This category also includes conflicts in shared configuration files: `tsconfig.json`, `.eslintrc`, `docker-compose.yml`, database migration files. These files are high-traffic intersections where many agents' changes converge.

### Prevention Strategies

The best conflict is the one that never happens. Prevention is cheaper than resolution.

**Task Decomposition That Minimizes Overlap**

The most effective prevention happens at decomposition time. A well-decomposed task graph assigns each agent to a distinct module or service boundary, minimizing the surface area where agents touch the same files.

```typescript
// Task decomposition that minimizes conflicts
interface TaskBoundary {
  taskId: string;
  filePatterns: string[];    // Glob patterns this task can modify
  module: string;            // Logical module boundary
  sharedFiles: string[];     // Files this task shares with others
}

// Good decomposition: agents work on different modules
const boundaries: TaskBoundary[] = [
  {
    taskId: 'task-1',
    filePatterns: ['src/services/user/**/*.ts'],
    module: 'user-service',
    sharedFiles: ['src/types/user.ts'],  // Only shared type definitions
  },
  {
    taskId: 'task-2',
    filePatterns: ['src/services/order/**/*.ts'],
    module: 'order-service',
    sharedFiles: ['src/types/order.ts'],
  },
];

// Bad decomposition: agents would collide on the same files
const badBoundaries: TaskBoundary[] = [
  {
    taskId: 'task-1',
    filePatterns: ['src/**/*.ts'],  // All source files!
    module: 'everything',
    sharedFiles: ['src/**/*.ts'],
  },
  {
    taskId: 'task-2',
    filePatterns: ['src/**/*.ts'],  // Overlaps with task-1
    module: 'everything',
    sharedFiles: ['src/**/*.ts'],
  },
];
```

The decomposition agent should be explicitly prompted to minimize file overlap. Include a rule in your orchestrator's decomposition prompt: "Each task should modify files within a single module boundary. If two tasks must modify the same file, place them in the same dependency chain (one depends on the other) so they never execute in parallel."

**File-Locking Conventions**

For shared files that can't be avoided—type definitions, configuration, shared utilities—implement a soft file-locking convention. When an agent claims a task, it registers which shared files it intends to modify. Other agents working on files in the same module must wait.

```typescript
class FileLockManager {
  private locks: Map<string, string> = new Map();  // filePath -> taskId

  async acquireLock(taskId: string, filePaths: string[]): Promise<boolean> {
    // Check if any files are already locked by other tasks
    const conflicts = filePaths.filter(f =>
      this.locks.has(f) && this.locks.get(f) !== taskId
    );

    if (conflicts.length > 0) {
      return false;  // Can't acquire — another task holds these files
    }

    // Acquire all locks
    for (const path of filePaths) {
      this.locks.set(path, taskId);
    }
    return true;
  }

  releaseLocks(taskId: string): void {
    for (const [path, lockHolder] of this.locks.entries()) {
      if (lockHolder === taskId) {
        this.locks.delete(path);
      }
    }
  }
}
```

File locks aren't enforced by git—they're a coordination protocol enforced by the orchestrator. If an agent violates its lock (modifies a file it didn't declare), the quality gate should catch it.

**Staged Merging**

Instead of merging all agent branches at once, merge them one at a time in dependency order. After each merge, run the full quality gate suite. This turns an N-way merge problem into N sequential 2-way merges, which are far easier to handle and debug.

```typescript
async function stagedMerge(branches: string[], mainBranch: string): Promise<StagedMergeReport> {
  const report: StagedMergeReport = { merges: [], conflicts: [] };

  for (const branch of branches) {
    // Attempt merge
    const result = await gitMerge(mainBranch, branch);

    if (result.hasConflicts) {
      // Try automatic resolution
      const resolved = await autoResolveConflicts(result.conflicts);
      if (!resolved.allResolved) {
        report.conflicts.push({
          branch,
          unresolvedFiles: resolved.unresolvedFiles,
          conflictingAgents: resolved.conflictingAgents,
        });
        // Revert this merge and continue with next branch
        await gitMergeAbort();
        continue;
      }
    }

    // Run quality gates after each merge
    const gatesPassed = await runQualityGates();
    if (!gatesPassed) {
      await gitMergeAbort();
      report.conflicts.push({
        branch,
        unresolvedFiles: [],
        semanticConflict: true,
      });
      continue;
    }

    report.merges.push({ branch, success: true });
  }

  return report;
}
```

### Resolution Strategies

When prevention isn't enough, the orchestrator needs resolution strategies that minimize human involvement without sacrificing correctness.

**Coordinator Agent Reviews**

For structural and import conflicts, a dedicated conflict-resolution agent can review the conflicting changes and produce a merged version. This agent has access to both branches' diffs and the base commit, giving it full context to make informed merge decisions.

```typescript
async function coordinatorResolveConflict(
  conflict: MergeConflict,
  baseCommit: string,
  branchA: string,
  branchB: string
): Promise<ResolvedMerge> {
  const prompt = `You are resolving a merge conflict in ${conflict.filePath}.

Base version (commit ${baseCommit}):
${conflict.baseContent}

Branch A changes (${branchA}):
${conflict.branchAContent}

Branch B changes (${branchB}):
${conflict.branchBContent}

Rules:
- Preserve ALL functional changes from both branches
- If changes conflict functionally, prefer the more conservative approach
- Maintain consistent code style with the surrounding file
- Do not remove error handling or validation from either branch
- If you cannot resolve the conflict safely, respond with UNRESOLVABLE

Produce the complete merged file content.`;

  const result = await callAgent({ model: 'claude-sonnet-4', prompt });
  return { filePath: conflict.filePath, content: result, autoResolved: true };
}
```

The coordinator agent approach works well for structural and import conflicts, where the resolution is largely mechanical. It's less reliable for semantic conflicts, where the coordinator may not understand the full behavioral implications of each change.

**Conflict-Aware Task Assignment**

The most sophisticated prevention strategy is to make the orchestrator aware of potential conflicts *before* assigning tasks. After decomposition, the orchestrator analyzes the task graph for potential file overlaps and adjusts the dependency structure to prevent parallel execution on overlapping files.

```typescript
function detectFileOverlaps(tasks: Task[]): ConflictWarning[] {
  const warnings: ConflictWarning[] = [];
  const fileOwnership = new Map<string, string[]>();  // filePath -> taskIds

  for (const task of tasks) {
    const estimatedFiles = estimateTouchedFiles(task);
    for (const file of estimatedFiles) {
      if (fileOwnership.has(file)) {
        fileOwnership.get(file)!.push(task.id);
      } else {
        fileOwnership.set(file, [task.id]);
      }
    }
  }

  // Flag files touched by multiple independent tasks
  for (const [file, taskIds] of fileOwnership.entries()) {
    if (taskIds.length > 1) {
      warnings.push({
        file,
        conflictingTasks: taskIds,
        recommendation: `Add dependency between ${taskIds.join(' and ')} ` +
          `to prevent parallel execution on ${file}`,
      });
    }
  }

  return warnings;
}
```

**Last-Writer-Wins with Human Escalation**

For low-stakes conflicts in non-critical files (documentation, comments, non-shared configuration), a last-writer-wins strategy keeps the pipeline moving. The orchestrator merges the later branch over the earlier one, accepting its version of the conflicting file. If the conflict is in a critical file—shared types, database schemas, API contracts—the orchestrator escalates to a human reviewer instead.

```typescript
async function resolveWithEscalation(
  conflict: MergeConflict
): Promise<MergeResolution> {
  const criticality = assessFileCriticality(conflict.filePath);

  if (criticality === 'critical') {
    // Shared types, DB schemas, API contracts — always escalate
    return {
      strategy: 'escalate',
      reason: `${conflict.filePath} is a critical shared file — requires human review`,
      assignee: await findAvailableReviewer(),
    };
  }

  if (criticality === 'high') {
    // Try auto-resolve, but flag for post-merge review
    const resolved = await coordinatorResolveConflict(conflict);
    return {
      strategy: 'auto-resolve-with-review',
      content: resolved.content,
      flaggedForReview: true,
    };
  }

  // Low criticality — last writer wins
  return {
    strategy: 'last-writer-wins',
    content: conflict.branchBContent,  // Later branch
  };
}
```

### Stripe's Deterministic Approach

Stripe's engineering team provides the most instructive example of conflict prevention at scale. Their "Minions" system—autonomous agents that handle routine coding tasks—operates across a large Ruby and Scala codebase with remarkably few merge conflicts.

The key design decision: **each agent is constrained to a specific service or module boundary**. A minion working on the Payments service cannot modify files in the Risk service. This isn't just a convention—it's enforced by the task assignment system, which maps each task to an explicit set of file patterns before the agent starts.

Stripe further reduces conflicts through deterministic task scheduling. Tasks are assigned to agents in a strict order determined by the dependency graph. Independent tasks run in parallel but on non-overlapping file sets. Dependent tasks run sequentially. The orchestrator never assigns two agents to the same module simultaneously unless their tasks are explicitly linked.

The result: Stripe runs hundreds of autonomous agent tasks per week with a merge conflict rate under 5%. When conflicts do occur, they're almost always in shared configuration files (Gemfile, rubocop.yml) rather than in implementation code—precisely because the task boundaries prevent implementation-level overlap.

This deterministic approach trades some flexibility for reliability. You can't assign an agent to "fix all the tests" because that task crosses module boundaries. But you gain predictability: if the orchestrator says a task can run in parallel, it won't create conflicts.


## Orchestrator Error Handling and Retry

Error handling in multi-agent orchestrators is fundamentally different from error handling in traditional software. Agents fail in ways that services don't—they produce incorrect but syntactically valid code, they misunderstand requirements, they get stuck in loops. The orchestrator needs strategies for all of these.

### Error Categories

| Error Type | Description | Recovery Strategy |
|---|---|---|
| **Execution failure** | Agent process crashes or times out | Retry with fresh worktree |
| **Quality gate failure** | Code fails linting, tests, or arch checks | Ralph Wiggum Loop with lessons |
| **Semantic error** | Code passes gates but is logically wrong | Verifier agent + human review |
| **Derailment** | Agent goes off-track, making unrelated changes | Destroy worktree, restart with lessons |
| **Deadlock** | Tasks stuck waiting for each other | Timeout + re-evaluate dependency graph |
| **Resource exhaustion** | Out of tokens, disk space, or API quota | Queue and retry with backoff |

### Retry with Exponential Backoff

For transient failures (network errors, API rate limits), exponential backoff prevents overwhelming the system:

```typescript
async function callAgentWithBackoff(
  config: AgentConfig,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<TaskResult> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callAgent(config);
    } catch (error) {
      if (isTransientError(error) && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Circuit Breaker for Cascading Failures

When multiple agents start failing, it's often a sign of a systemic problem (broken CI, bad merge, environment issue). A circuit breaker prevents wasting resources on tasks that will likely fail:

```typescript
class AgentCircuitBreaker {
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number = 3,
    private resetTimeout: number = 60000  // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';  // Try one request
      } else {
        throw new Error('Circuit breaker is OPEN — too many recent failures');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      console.error(
        `Circuit breaker OPENED after ${this.failureCount} failures. ` +
        `Pausing for ${this.resetTimeout / 1000}s.`
      );
    }
  }
}
```

### Deadlock Detection

In dependency graph execution, deadlocks occur when tasks are waiting for each other in a cycle. A good orchestrator detects and breaks deadlocks:

```typescript
function detectDeadlock(
  nodes: Map<string, TaskNode>,
  completed: Set<string>,
  failed: Set<string>
): string[] | null {
  // Find all pending tasks
  const pending = [...nodes.values()].filter(
    n => !completed.has(n.id) && !failed.has(n.id)
  );

  if (pending.length === 0) return null;

  // Check for cycles in the dependency graph
  // (This shouldn't happen if the graph was built correctly, but
  // runtime issues can create effective deadlocks)
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  for (const node of pending) {
    if (hasCycle(node.id, nodes, visited, recursionStack, completed)) {
      // Return the cycle
      return [...recursionStack];
    }
  }

  // Check if all pending tasks are blocked by failed tasks
  const blockedByFailed = pending.filter(node =>
    [...node.dependsOn].some(dep => failed.has(dep))
  );

  if (blockedByFailed.length === pending.length) {
    return blockedByFailed.map(n => n.id);
  }

  return null;
}
```

---

## Orchestration Failure Modes and Recovery

Error handling in multi-agent orchestrators goes beyond the retry logic and circuit breakers we covered earlier. Agents fail in ways that are qualitatively different from traditional distributed systems—they can spiral into cost explosions, exhaust platform quotas silently, and cascade failures across dependent tasks in patterns that are hard to predict. Understanding these failure modes through real incidents is essential for building orchestrators that degrade gracefully rather than catastrophically.

### The \$4,200 Postmortem: 63 Hours of Unchecked Autonomy

In 2025, engineer Sattyam Jain documented a postmortem that has since become a cautionary tale in the AI engineering community.¹ An autonomous coding agent was given a task to refactor a module in a production codebase. The agent encountered an error—perhaps a failing test, a type mismatch, or an ambiguous requirement—and attempted to fix it. Its fix introduced a new error. It tried to fix that error. The cycle continued.

The agent ran for **63 hours straight**, looping through error-fix cycles without ever succeeding at the original task. Each cycle consumed API tokens. Each retry generated new context that fed into the next attempt. The total cost: **\$4,200 in API charges** for a task that, had a human intervened after the first 30 minutes, could have been resolved in a single session.

What went wrong:

1. **No timeout limit.** The orchestrator had no maximum runtime for individual tasks. The agent was allowed to run indefinitely.
2. **No cost budget.** There was no per-task or per-session spending cap. The agent kept spending without triggering an alert.
3. **No escalation trigger.** After N consecutive failures, the orchestrator should have escalated to a human. It didn't.
4. **No automatic rollback.** Each retry built on the previous attempt's (broken) state rather than starting fresh.

This isn't an edge case. It's the default behavior of an agent without guardrails. Agent loops are powerful when they converge (the Ralph Wiggum Loop), but when they diverge, they diverge *hard*. The cost curve isn't linear—it compounds as each failed attempt adds context that makes the next attempt more expensive and more confused.

**The fix**: Every orchestrator must enforce three hard limits on agent execution:

```typescript
interface AgentExecutionLimits {
  maxRuntime: number;       // Wall-clock time in seconds (e.g., 1800 = 30 min)
  maxRetries: number;       // Maximum attempts before escalation (e.g., 3)
  maxCostPerTask: number;   // Maximum spend in dollars (e.g., $5)
  maxTokensPerTask: number; // Maximum tokens consumed (e.g., 500K)
}
```

When any limit is hit, the orchestrator must:
1. Stop the agent immediately (cancel the API call if possible)
2. Destroy the worktree (don't leave broken state)
3. Record the failure with full context (what was attempted, what went wrong, how much it cost)
4. Escalate to a human with a concise summary

### Google Antigravity's "Agent Terminated" Crisis

A different failure mode was documented by engineer krishpat, working with Google's Antigravity platform for running AI agents at scale.² The issue wasn't a runaway loop—it was the opposite. Agents were being terminated prematurely due to capacity exhaustion and quota limits.

The pattern: An orchestrator would dispatch 10 agents in parallel. The platform would accept all 10, begin execution, and then—mid-task—terminate several agents because the system had hit its concurrent execution quota. The terminated agents' tasks would be marked as failed, triggering retries. The retries would also hit quota limits, creating a retry storm that further strained the system.

This is the **thundering herd problem** applied to agent orchestration. When an orchestrator dispatches too many concurrent agents, it can overwhelm the underlying platform, causing cascading failures that look like individual agent errors but are actually systemic capacity issues.

**Key symptoms of quota-driven failures**:
- Agents fail at random points during execution (not at the beginning)
- Failure messages reference quota, rate limits, or capacity
- Retries fail at similar rates to the original attempts
- The failure rate increases with the number of concurrent agents

**The fix**: Orchestrators must be quota-aware:

```typescript
class QuotaAwareDispatcher {
  private currentLoad: number = 0;
  private maxPlatformConcurrency: number;
  private failureRate: number = 0;
  private recentFailures: number[] = [];  // timestamps of recent failures

  constructor(maxPlatformConcurrency: number = 5) {
    this.maxPlatformConcurrency = maxPlatformConcurrency;
  }

  async dispatch(task: Task): Promise<TaskResult> {
    // Back off if recent failure rate is high
    if (this.getRecentFailureRate() > 0.3) {
      const backoffDelay = this.calculateBackoff();
      console.log(`High failure rate (${(this.failureRate * 100).toFixed(0)}%). ` +
        `Backing off for ${backoffDelay / 1000}s`);
      await sleep(backoffDelay);
    }

    // Wait for a slot
    while (this.currentLoad >= this.maxPlatformConcurrency) {
      await sleep(5000);  // Poll every 5 seconds
    }

    this.currentLoad++;
    try {
      const result = await executeTask(task);
      if (!result.success) {
        this.recordFailure();
      }
      return result;
    } finally {
      this.currentLoad--;
    }
  }

  private getRecentFailureRate(): number {
    const fiveMinutesAgo = Date.now() - 300000;
    const recentFails = this.recentFailures.filter(t => t > fiveMinutesAgo);
    return recentFails.length / Math.max(this.recentFailures.length, 1);
  }

  private calculateBackoff(): number {
    // Exponential backoff based on failure rate
    return Math.min(60000, 5000 * Math.pow(2, this.recentFailures.length));
  }

  private recordFailure(): void {
    this.recentFailures.push(Date.now());
  }
}
```

### Design Patterns for Graceful Degradation

The two incidents above illustrate a broader principle: orchestrators must degrade gracefully under failure. Here are the essential design patterns.

**Timeout Limits**

Every agent execution must have a hard timeout. This is non-negotiable. The timeout should be generous enough for legitimate long-running tasks but short enough to catch runaway loops. A good default is 30 minutes for implementation tasks, 10 minutes for test writing, and 5 minutes for review tasks.

```typescript
async function executeWithTimeout(
  task: Task,
  timeoutMs: number
): Promise<TaskResult> {
  return Promise.race([
    executeTask(task),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Task timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}
```

**Cost Budgets**

Set per-task, per-session, and per-day spending caps. Track spending in real time and stop execution when budgets are exceeded. This prevents the $4,200 scenario: even if every other safeguard fails, the cost budget stops the bleeding.

```typescript
class CostBudget {
  private spent: number = 0;

  constructor(
    private perTaskLimit: number,    // e.g., $5
    private perSessionLimit: number,  // e.g., $50
    private perDayLimit: number       // e.g., $200
  ) {}

  checkBeforeExecution(estimatedCost: number): boolean {
    return this.spent + estimatedCost <= this.perSessionLimit;
  }

  recordSpend(amount: number): void {
    this.spent += amount;
    if (this.spent >= this.perDayLimit * 0.8) {
      this.alert(`Session spending at $${this.spent.toFixed(2)} — ` +
        `approaching daily limit of $${this.perDayLimit}`);
    }
  }
}
```

**Circuit Breakers**

We covered circuit breakers earlier in this chapter. For failure recovery specifically, circuit breakers prevent cascading failures by stopping execution when the failure rate exceeds a threshold. The critical configuration is the failure threshold (how many failures before opening the circuit) and the reset timeout (how long to wait before trying again).

**Automatic Rollback**

When a task fails, the orchestrator should automatically roll back to a clean state. This means destroying the worktree, discarding any partial changes, and recording what went wrong. The next agent that attempts the same task starts from a clean slate, not from the previous attempt's broken state.

```typescript
async function executeWithRollback(task: Task): Promise<TaskResult> {
  const worktree = await createWorktree(task.id);

  try {
    const result = await executeWithTimeout(task, task.timeoutMs);

    if (!result.success) {
      // Automatic rollback: destroy the worktree entirely
      await destroyWorktree(worktree);
      return result;
    }

    // Success: verify before keeping
    const verified = await runQualityGates(worktree);
    if (!verified) {
      await destroyWorktree(worktree);
      return { success: false, error: 'Quality gates failed' };
    }

    // All good: merge
    await mergeWorktree(worktree);
    return result;
  } catch (error) {
    // Timeout or unexpected error: rollback
    await destroyWorktree(worktree);
    return { success: false, error: String(error) };
  }
}
```

These patterns—timeout limits, cost budgets, circuit breakers, and automatic rollback—form the safety net that allows orchestrators to run autonomously without human supervision. Without them, you're one bad task decomposition away from a $4,200 bill or a quota-induced retry storm. With them, failures become bounded, observable, and recoverable.


## Cost Optimization Across Agents

Cost optimization isn't just about using cheaper models—it's about minimizing wasted work across the entire orchestrator.

### Strategy 1: Cheap Gates First

Order quality gates from cheapest to most expensive:

```typescript
const gates = [
  { name: 'lint', cost: 0.001, time: 5 },        // ~$0.001, ~5 seconds
  { name: 'typecheck', cost: 0.002, time: 10 },   // ~$0.002, ~10 seconds
  { name: 'unit-tests', cost: 0.01, time: 30 },   // ~$0.01, ~30 seconds
  { name: 'arch-tests', cost: 0.005, time: 15 },  // ~$0.005, ~15 seconds
  { name: 'integration', cost: 0.05, time: 120 }, // ~$0.05, ~2 minutes
];
```

If linting fails (cheapest gate), don't waste time running integration tests (most expensive). Short-circuit on the first failure.

### Strategy 2: Incremental Verification

Don't re-run the entire test suite for every task. Run only the tests relevant to the changed files:

```bash
# Instead of running all tests:
npm test

# Run only tests related to changed files:
npm test -- --findRelatedTests src/services/user.ts

# Or use a test runner that supports incremental testing:
npx jest --changedSince=main
```

### Strategy 3: Token Budget Management

Set per-task and per-session token budgets:

```typescript
interface TokenBudget {
  maxTokensPerTask: number;     // e.g., 200K
  maxTokensPerSession: number;  // e.g., 2M
  maxTokensPerDay: number;      // e.g., 10M
}

class TokenBudgetManager {
  private spent: { session: number; day: number } = { session: 0, day: 0 };

  canAfford(task: Task, estimatedTokens: number): boolean {
    if (estimatedTokens > this.budget.maxTokensPerTask) return false;
    if (this.spent.session + estimatedTokens > this.budget.maxTokensPerSession) return false;
    if (this.spent.day + estimatedTokens > this.budget.maxTokensPerDay) return false;
    return true;
  }

  recordUsage(tokens: number): void {
    this.spent.session += tokens;
    this.spent.day += tokens;
  }

  getReport(): string {
    return [
      `Session: ${this.spent.session.toLocaleString()} / ${this.budget.maxTokensPerSession.toLocaleString()} tokens`,
      `Day: ${this.spent.day.toLocaleString()} / ${this.budget.maxTokensPerDay.toLocaleString()} tokens`,
      `Session budget: ${((this.spent.session / this.budget.maxTokensPerSession) * 100).toFixed(1)}% used`,
    ].join('\n');
  }
}
```

### Strategy 4: Speculative Execution with Cancellation

For tasks where you're unsure of the approach, run two agents with different strategies and cancel the slower one:

```typescript
async function speculativeExecution(
  task: Task,
  strategies: string[]
): Promise<TaskResult> {
  // Run multiple strategies in parallel
  const promises = strategies.map((strategy, index) =>
    callAgent({
      ...task,
      prompt: `${task.description}\n\nApproach: ${strategy}`,
      label: `strategy-${index}`,
    })
  );

  // Use Promise.race with a quality check
  // The first to complete AND pass basic checks wins
  return new Promise((resolve, reject) => {
    let resolved = false;

    promises.forEach(async (promise, index) => {
      try {
        const result = await promise;
        if (!resolved && result.success) {
          resolved = true;
          // Cancel other strategies
          promises.forEach((_, i) => {
            if (i !== index) cancelStrategy(i);
          });
          resolve(result);
        }
      } catch (error) {
        // This strategy failed; others may still succeed
        console.log(`Strategy ${index} failed: ${error}`);
      }
    });

    // Timeout: if no strategy succeeds within the deadline, reject
    setTimeout(() => {
      if (!resolved) {
        reject(new Error('All strategies failed or timed out'));
      }
    }, 300000);  // 5 minutes
  });
}
```

**Cost caveat**: Speculative execution doubles (or more) the token cost for each task. Only use it for high-value tasks where the cost of delay exceeds the cost of duplicate work.

---

## Codex Subagents API

OpenAI's Codex platform provides a structured API for managing subagents—the building blocks of multi-agent orchestration on their platform. Understanding the Codex API parameters is essential for anyone using OpenAI's platform for agent orchestration.

### Key Parameters

```yaml
# codex-config.yaml
# Configuration for Codex multi-agent execution

agents:
  main:
    model: o3
    instructions: |
      You are the coordinator agent. Decompose tasks and delegate
      to specialist subagents. Do not implement directly.

subagents:
  max_threads: 4          # Maximum concurrent subagents
  max_depth: 3            # Maximum nesting depth
  job_max_runtime: 300    # Maximum seconds per subagent task (5 min)
  model: gpt-4o           # Default model for subagents
```

### Parameter Deep Dive

**`max_threads`** controls concurrency:

```
max_threads: 2         max_threads: 4         max_threads: 8

  T1  T2                 T1  T2  T3  T4         T1 T2 T3 T4 T5 T6 T7 T8
  ──  ──                 ──  ──  ──  ──         ── ── ── ── ── ── ── ──
       T3  T4                 T5  T6  T7  T8
       ──  ──                 ──  ──  ──  ──

  Serial pairs           4 at a time             8 at a time
  Lower throughput       Higher throughput       Max throughput
  Lower cost             Medium cost             Higher cost
```

**`max_depth`** prevents infinite recursion:

```
max_depth: 1         max_depth: 2            max_depth: 3

Coordinator            Coordinator              Coordinator
  └── Subagent A         └── Subagent A            └── Subagent A
  └── Subagent B             └── Sub-subagent         └── Sub-subagent
                                                    └── Subagent B
```

At `max_depth: 1`, the coordinator can spawn subagents but subagents can't spawn further. At `max_depth: 2`, subagents can spawn one level of sub-subagents. OpenAI recommends `max_depth: 3` as a reasonable default—deep enough for complex tasks but not so deep that recursion becomes a problem.

**`job_max_runtime`** prevents runaway agents:

An agent that's stuck in a loop or trying to solve an impossible problem will consume tokens indefinitely. The runtime limit acts as a circuit breaker. OpenAI's default of 300 seconds (5 minutes) is appropriate for most tasks. Increase it for complex tasks that genuinely need more time.

### Practical Codex Configuration

```yaml
# Production Codex configuration for a mid-size team
# Handles ~20 tasks per day with 2-3 agents running concurrently

environment:
  sandbox_image: ubuntu:22.04
  tools: [git, node, npm, python3]

orchestrator:
  model: o3
  max_threads: 3
  max_depth: 2
  job_max_runtime: 300

subagents:
  implementor:
    model: gpt-4o
    tools: [git, node, npm, file_read, file_write]
    max_runtime: 240

  tester:
    model: gpt-4o-mini    # Cheaper model for test writing
    tools: [git, node, npm, file_read, file_write, test_runner]
    max_runtime: 180

  reviewer:
    model: o3-mini
    tools: [git, file_read, shell]  # Read-only + shell for running checks
    max_runtime: 120

quality_gates:
  - name: lint
    command: npm run lint
    blocking: true
  - name: typecheck
    command: npx tsc --noEmit
    blocking: true
  - name: unit-tests
    command: npm test
    blocking: true
  - name: arch-tests
    command: npm run test:arch
    blocking: true
```

---

## Agent SDK Orchestration Patterns

Modern agent SDKs provide a different approach to multi-agent orchestration, built around the concepts of forking, async execution, teammates, and remote agents.

### Key Concepts

**Fork**: Creates a child session that inherits the parent's context. The child can diverge from the parent without affecting it.

```typescript
// Generic agent orchestration — adapt to your provider's SDK

// Fork the current agent session
const child = await fork({
  task: 'Write unit tests for the user service',
  model: 'claude-haiku',   // Use cheaper model for tests
  inheritContext: true,     // Child sees parent's context
});

// Parent continues while child works
// Later, collect the child's output
const result = await child.result();
```

**Async**: Runs a task in the background, returning a handle that can be checked later.

```typescript
// Generic async agent execution — adapt to your provider's SDK

// Fire-and-forget an async task
const handle = await async({
  task: 'Refactor the database layer',
  model: 'claude-sonnet-4',
  worktree: 'refactor-db',   // Isolated worktree
});

// Continue with other work...

// Check on the task later
const status = handle.status();  // 'running' | 'completed' | 'failed'
if (status === 'completed') {
  const result = handle.result();
  console.log('Refactoring complete:', result);
}
```

**Teammates**: Named, registered agents that work together as a team with a shared task board.

```typescript
// Generic team coordination — adapt to your provider's SDK

// Create a team with named teammates
const team = await Team.create({
  name: 'feature-team',
  members: [
    {
      name: 'architect',
      model: 'claude-opus-4',
      role: 'Decomposes features into tasks and manages the task board',
    },
    {
      name: 'implementor',
      model: 'claude-sonnet-4',
      role: 'Implements code changes per task specifications',
    },
    {
      name: 'tester',
      model: 'claude-haiku',
      role: 'Writes tests for implemented code',
    },
  ],
  hooks: {
    onTaskCreated: {
      // Auto-assign tasks to available teammates
      autoAssign: true,
    },
    onTaskCompleted: {
      // Require test files before completing implementation tasks
      requireFiles: ['**/*.test.ts'],
      // Block tasks matching this pattern from completion without review
      blockPattern: 'security-*',
    },
    onTeammateIdle: {
      // Alert if a teammate is idle for more than 30 seconds
      maxIdleMs: 30000,
      // Auto-assign next available task
      autoAssign: true,
    },
  },
  sharedBoard: true,  // All teammates see the same task board
});

// Add tasks to the team's board
await team.addTask({
  title: 'Implement user registration',
  description: 'Add POST /api/users endpoint with email validation',
  priority: 'high',
  tags: ['backend', 'api'],
});

await team.addTask({
  title: 'Write registration tests',
  description: 'Integration tests for the user registration flow',
  priority: 'medium',
  tags: ['testing'],
  dependencies: ['Implement user registration'],  // Waits for first task
});

// Teammates pick up and work through tasks automatically
```

**Remote**: Agents running on remote infrastructure, managed through the SDK.

```typescript
// Generic remote agent deployment — adapt to your provider's SDK

// Deploy an agent to remote infrastructure
const remoteAgent = await Remote.deploy({
  task: 'Run comprehensive E2E test suite',
  infrastructure: {
    type: 'container',
    image: 'ubuntu:22.04',
    resources: { cpu: 4, memory: '16GB' },
  },
  timeout: 600,  // 10 minutes
});

// Monitor from local machine
const status = await remoteAgent.status();
console.log(`Remote agent: ${status.state}, ${status.progress}% complete`);
```

### Team Communication Patterns

The Claude Code SDK provides several communication patterns for teammates:

**Shared Task Board**: The simplest and most common pattern. Teammates claim tasks, update their status, and complete them. Communication happens through the task board—no direct messages needed.

```typescript
// Teammate claims a task
await team.claimTask('implementor', 'task-123');

// Teammate updates task status
await team.updateTask('task-123', {
  status: 'in-progress',
  notes: 'Implementing registration endpoint',
});

// Teammate completes a task
await team.completeTask('task-123', {
  filesChanged: ['src/routes/users.ts', 'src/services/user_service.ts'],
  prUrl: 'https://github.com/org/repo/pull/456',
});
```

**Direct Messaging**: For coordination that doesn't fit the task board pattern:

```typescript
// Send a message to another teammate
await team.sendMessage({
  from: 'implementor',
  to: 'tester',
  message: 'Registration endpoint is ready for testing. See PR #456.',
  attachments: [
    { type: 'context', name: 'changes', content: 'PR #456 diff summary...' },
  ],
});
```

**Event Hooks**: React to events in the team's lifecycle:

```typescript
const team = await Team.create({
  name: 'event-driven-team',
  members: [...],
  hooks: {
    onTaskCreated: {
      // Automatically assign security tasks to the most experienced agent
      autoAssign: true,
    },
    onTaskCompleted: {
      // Block completion if no tests exist
      requireFiles: ['**/*.test.ts'],
      // Block completion of security-sensitive tasks without human approval
      blockPattern: 'security-*',
    },
    onTeammateIdle: {
      // Alert if a teammate has been idle for more than 30 seconds
      maxIdleMs: 30000,
      // Auto-assign next task from the board
      autoAssign: true,
    },
  },
});
```

### Putting the Claude Code SDK Together

Here's a complete orchestrator using the Claude Code Agent SDK:

```typescript
// orchestrator/claude-code-orchestrator.ts

// Generic orchestration primitives — adapt to your provider's SDK

async function orchestrateFeature(featureSpec: string): Promise<void> {
  // 1. Create the team
  const team = await Team.create({
    name: `feature-${Date.now()}`,
    members: [
      { name: 'architect', model: 'claude-opus-4',
        role: 'Decomposes features into tasks' },
      { name: 'implementor', model: 'claude-sonnet-4',
        role: 'Implements code changes' },
      { name: 'tester', model: 'claude-haiku',
        role: 'Writes tests' },
      { name: 'verifier', model: 'claude-sonnet-4',
        role: 'Verifies all changes pass quality gates' },
    ],
    hooks: {
      onTaskCompleted: {
        requireFiles: ['**/*.test.ts'],
      },
      onTeammateIdle: {
        maxIdleMs: 30000,
        autoAssign: true,
      },
    },
  });

  // 2. Architect decomposes the feature
  const decomposition = await fork({
    task: `Decompose this feature into tasks: ${featureSpec}`,
    model: 'claude-opus-4',
  });

  const tasks = JSON.parse(await decomposition.result());

  // 3. Add all tasks to the board
  for (const task of tasks) {
    await team.addTask({
      title: task.title,
      description: task.description,
      priority: task.priority || 'medium',
      tags: task.tags || [],
      assignee: task.specialist,
    });
  }

  // 4. Let the team work (auto-assignment handles the rest)
  console.log(`Team working on ${tasks.length} tasks...`);

  // 5. Monitor until all tasks are done
  await team.waitForCompletion({
    timeout: 3600000,  // 1 hour max
    onProgress: (progress) => {
      console.log(
        `Progress: ${progress.completed}/${progress.total} tasks complete`
      );
    },
  });

  // 6. Final verification
  const report = await team.getReport();
  console.log('Team completed:', report);

  // 7. Cleanup
  await team.shutdown();
}
```

---

## Production Orchestrator Monitoring and Observability

A multi-agent orchestrator running in production is a distributed system. Like any distributed system, it needs monitoring, alerting, and observability to run reliably. This section covers the metrics, logs, and dashboards that make orchestrators debuggable and maintainable.

### Key Metrics to Track

Every orchestrator should track these metrics in real time:

**Throughput Metrics**:
- Tasks completed per hour/day
- Average task duration (p50, p90, p99)
- Agent utilization rate (active time / total time)
- Merge success rate (PRs merged / PRs created)

**Quality Metrics**:
- Quality gate pass rate per gate (lint, typecheck, test, arch, coverage)
- First-attempt success rate (tasks that pass all gates on first try)
- Ralph Wiggum retry distribution (how many attempts per task, on average)
- Rework rate (PRs that need additional changes after initial review)

**Cost Metrics**:
- Tokens consumed per task (input + output)
- Cost per task (in dollars)
- Cost per merged PR
- Model distribution (percentage of tasks per model tier)

**Health Metrics**:
- Active worktree count
- Worktree disk usage
- Queue depth (pending tasks / active agents)
- Circuit breaker state (open/closed/half-open)
- Error rate by error type

### Monitoring Dashboard

Here's a practical monitoring configuration for a multi-agent orchestrator:

```yaml
# monitoring/orchestrator-dashboard.yaml
# Grafana dashboard configuration

dashboard:
  title: "Multi-Agent Orchestrator"
  panels:
    - title: "Task Throughput"
      query: "rate(tasks_completed_total[1h])"
      visualization: graph
      alert:
        condition: "rate < 1 per hour during work hours"
        message: "Orchestrator throughput has dropped below expected levels"

    - title: "Quality Gate Pass Rate"
      query: "sum(rate(gate_passed_total[1h])) / sum(rate(gate_attempted_total[1h]))"
      visualization: gauge
      thresholds:
        green: "> 85%"
        yellow: "70-85%"
        red: "< 70%"

    - title: "Cost per PR"
      query: "sum(token_cost_dollars) / count(prs_merged)"
      visualization: stat
      target: "< $40 per PR"  # Based on Faros AI benchmark

    - title: "Active Agents"
      query: "count(active_agents)"
      visualization: stat
      max: 10  # Your max concurrency

    - title: "Worktree Disk Usage"
      query: "sum(worktree_disk_mb)"
      visualization: gauge
      alert:
        condition: "> 5GB"
        message: "Worktree disk usage exceeds 5GB limit"

    - title: "Retry Distribution"
      query: "histogram_quantile(0.9, rate(task_attempts_bucket[24h]))"
      visualization: histogram
      note: "Should be centered around 1-2 attempts"

    - title: "Token Usage by Model"
      query: "sum by (model) (rate(tokens_consumed_total[1h]))"
      visualization: pie_chart
      note: "Should show model routing distribution"
```

### Structured Logging for Agent Sessions

Each agent session should produce structured logs that can be queried and analyzed:

```typescript
// logging/agent-logger.ts

interface AgentLogEntry {
  timestamp: string;
  sessionId: string;
  taskId: string;
  event: 'session_start' | 'context_loaded' | 'execution_start' |
         'execution_complete' | 'gate_check' | 'gate_pass' | 'gate_fail' |
         'retry' | 'session_end' | 'error';
  model: string;
  tokensUsed?: number;
  cost?: number;
  duration?: number;
  details?: string;
  filesChanged?: string[];
}

class AgentLogger {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  log(entry: Omit<AgentLogEntry, 'timestamp' | 'sessionId'>): void {
    const fullEntry: AgentLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
    };

    // Write to structured log file
    fs.appendFileSync(
      `logs/agent-${this.sessionId}.jsonl`,
      JSON.stringify(fullEntry) + '\n'
    );

    // Also emit to monitoring system
    emitMetric('agent_event', fullEntry);
  }
}

// Usage in orchestrator:
const logger = new AgentLogger(sessionId);

logger.log({
  event: 'session_start',
  taskId: 'task-123',
  model: 'claude-sonnet-4',
  details: 'Implementing user registration endpoint',
});

// ... agent executes ...

logger.log({
  event: 'gate_check',
  taskId: 'task-123',
  model: 'claude-sonnet-4',
  details: 'Running lint gate',
});

logger.log({
  event: 'gate_pass',
  taskId: 'task-123',
  model: 'claude-sonnet-4',
  duration: 3200,  // ms
});

logger.log({
  event: 'session_end',
  taskId: 'task-123',
  model: 'claude-sonnet-4',
  tokensUsed: 145000,
  cost: 0.58,
  duration: 45000,  // ms
  filesChanged: ['src/routes/users.ts', 'src/services/user_service.ts'],
});
```

These structured logs serve multiple purposes:
- **Debugging**: When a task fails, the log shows exactly where it failed and what the agent was doing.
- **Cost analysis**: Aggregating token counts and costs across sessions identifies expensive patterns.
- **Quality analysis**: Gate pass/fail rates per task type reveal where the harness needs improvement.
- **Capacity planning**: Duration distributions help predict how many agents you need for a given workload.

### Alerting Rules

Production orchestrators need alerting for abnormal conditions:

```yaml
# monitoring/alerts.yaml
alerts:
  - name: orchestrator_high_failure_rate
    condition: "task_failure_rate_1h > 0.3"
    message: "Orchestrator failure rate is {{ $value }}% — investigate agent health"
    severity: warning

  - name: orchestrator_circuit_breaker_open
    condition: "circuit_breaker_state == 'open'"
    message: "Circuit breaker is open — all agent execution paused"
    severity: critical

  - name: worktree_disk_exhaustion
    condition: "worktree_disk_usage_gb > 4"
    message: "Worktree disk at {{ $value }}GB — approaching 5GB limit"
    severity: warning

  - name: token_budget_exceeded
    condition: "daily_token_usage > daily_token_budget * 0.8"
    message: "Token usage at {{ $value }}% of daily budget"
    severity: warning

  - name: agent_quality_regression
    condition: "gate_pass_rate_24h < 0.7"
    message: "Quality gate pass rate dropped to {{ $value }}% — possible harness issue"
    severity: critical
    note: "Often indicates a bad merge that broke shared types or lint rules"
```

The quality regression alert deserves special attention. When the gate pass rate drops below 70%, it usually means something changed in the codebase that agents aren't adapting to—a new lint rule that agents don't know about, a type change that breaks existing patterns, or a dependency update that requires code changes. This is where the harness engineering feedback loop (observe → name → document → mechanize) kicks in: the alert triggers a human investigation, the finding gets documented in AGENTS.md, and the quality gate catches the issue going forward.

### Observability Anti-Patterns

**Silent failures**: The worst thing an orchestrator can do is fail silently. Every failure should be logged, every timeout should trigger an alert, and every quality gate failure should produce actionable feedback. If you can't see it, you can't fix it.

**Metric overload**: Tracking too many metrics is as bad as tracking none. Focus on the metrics that drive decisions: throughput, quality, cost, and health. Everything else is noise.

**Log without structure**: Free-text logs are useful for human debugging but useless for automated analysis. Use structured logging (JSON lines) for machine-readable output and human-readable summaries for interactive debugging.

---

## Choosing Between Orchestrator Approaches

We've covered two major orchestrator platforms—Codex and generic agent SDKs—along with general patterns that apply to any orchestrator. How do you choose?

### Decision Matrix

| Factor | Codex | Claude Code SDK | Custom Orchestrator |
|---|---|---|---|
| **Setup effort** | Low (YAML config) | Medium (TypeScript SDK) | High (full implementation) |
| **Flexibility** | Limited to Codex API | Moderate (SDK primitives) | Unlimited |
| **Model diversity** | OpenAI models only | Varies by SDK provider | Any model via API |
| **Sandboxing** | Built-in cloud sandbox | Varies by SDK provider | Your responsibility |
| **Cost model** | Per-task pricing | Token-based pricing | Variable |
| **Production readiness** | High (managed service) | Varies by SDK provider | Depends on your implementation |
| **Debugging** | Logs and traces | Provider debugging tools | Your monitoring infrastructure |

### Recommendation

1. **Start with what your team already uses.** If you're on OpenAI, use Codex. If you're on Anthropic, use the Anthropic API directly with the orchestration patterns described here. The best orchestrator is the one your team can be productive with immediately.

2. **Don't build a custom orchestrator until you've outgrown the platform options.** The patterns in this chapter give you the conceptual framework. The platforms give you the implementation. Use the platform until it genuinely can't do what you need.

3. **The patterns are portable.** Whether you use Codex, Claude Code, or a custom orchestrator, the coordination patterns (spec-driven decomposition, worktree isolation, coordinator/specialist/verifier, fan-out/fan-in) apply universally. Learn the patterns first, then map them to your platform.

4. **Plan for multi-platform.** The most mature teams eventually use multiple platforms—Codex for some tasks, your provider's SDK for others—orchestrated through a shared task board and quality gate pipeline. Design your harness to be platform-agnostic from the start.

---

## The Orchestrator's Role in the Harness

The orchestrator is the connective tissue between your harness (AGENTS.md, linters, architecture tests) and your agents (the workers that produce code). It's not part of the harness itself—it's the runtime that *applies* the harness.

```
┌──────────────────────────────────────────────────┐
│     Orchestrator's Position in the Harness        │
│                                                  │
│  ┌──────────────────┐                            │
│  │   HarnSES         │                            │
│  │  • AGENTS.md      │                            │
│  │  • Custom linters │     ┌───────────────────┐ │
│  │  • Arch tests     │────▶│   ORCHESTRATOR    │ │
│  │  • Quality gates  │     │                   │ │
│  └──────────────────┘     │  Reads harness    │ │
│                            │  Applies to agents│ │
│  ┌──────────────────┐     │  Manages workflow │ │
│  │   AGENTS          │────▶│  Handles errors   │ │
│  │  • Codex         │     │  Optimizes cost   │ │
│  │  • Claude Code   │     └───────────────────┘ │
│  │  • Custom         │                            │
│  └──────────────────┘                            │
│                                                  │
│  ┌──────────────────┐                            │
│  │   OUTPUT          │                            │
│  │  • PRs           │                            │
│  │  • Quality reports│                            │
│  │  • Cost metrics   │                            │
│  └──────────────────┘                            │
└──────────────────────────────────────────────────┘
```

The orchestrator:
- **Reads** AGENTS.md and passes it as context to each agent
- **Runs** linters and architecture tests as quality gates
- **Enforces** the dependency graph and merge order
- **Manages** worktree creation and cleanup
- **Tracks** token usage and cost
- **Reports** progress to the human architect

It's the bridge between the static harness (your rules, patterns, and constraints) and the dynamic agents (the workers that produce code). Without the orchestrator, the harness is just documentation. Without the harness, the orchestrator has nothing to enforce.

---

## Key Takeaways

1. **The coordinator/specialist/verifier pattern is the workhorse of production orchestrators.** It provides separation of concerns, model optimization, and a natural quality pipeline.

2. **Synchronous execution for dependencies, asynchronous for throughput.** Use Task Wait when tasks depend on each other. Use Fire-and-Forget for independent batch work. Use hybrid for complex dependency graphs.

3. **The chain of specialists pipeline produces the highest quality output.** Each specialist refines the previous specialist's work, creating a progressive quality improvement. Use it for high-stakes tasks where quality matters more than speed.

4. **Fan-out/fan-in maximizes throughput for independent work.** It's the map-reduce of agent orchestration—apply the same task to many inputs in parallel, then aggregate.

5. **Error handling must account for agent-specific failure modes.** Derailment, semantic errors, and quality gate failures require different strategies than traditional error handling. The Ralph Wiggum Loop is your primary recovery tool.

6. **Cost optimization is an orchestrator responsibility.** Cheap gates first, incremental verification, token budgets, and per-task model routing keep costs manageable even at high throughput.

7. **Codex and agent SDKs provide different but complementary orchestration primitives.** Codex excels at structured subagent management with infrastructure-level safety. Agent SDKs excel at flexible team coordination with rich communication patterns. Both implement the same underlying patterns.

8. **The orchestrator is the bridge between harness and agents.** It applies your static rules to dynamic agent execution. Design your harness to be orchestrator-friendly—clear rules, automatable gates, and explicit dependency declarations.

With the coordination patterns from Chapter 13, the isolation techniques from Chapter 14, and the orchestrator patterns from this chapter, you have everything you need to build production multi-agent systems. The next part of this book covers throughput and engineering norms—how to merge agent output at scale, design CI pipelines that keep pace with agent velocity, and maintain engineering quality when your codebase is growing 10x faster than before.

---

## Further Reading

- OpenAI Codex documentation — Subagents API reference (max_threads, max_depth, job_max_runtime)
- Your provider's agent SDK documentation — Fork, async, teammates, remote primitives (adapt patterns shown here)
- Augment Code, "Harness Engineering Guide" — Coordinator-Implementor-Verifier pattern
- OpenAI, "Harness Engineering" blog post (2026) — Ralph Wiggum Loop and orchestrator patterns
- Affirm Engineering case study — Enterprise orchestrator deployment at scale
- Martin Fowler, "Patterns of Enterprise Application Architecture" — Foundation for dependency graph and fan-out/fan-in patterns

---

¹ Sattyam Jain, "The Agent That Burned $4,200 in 63 Hours," 2025. https://medium.com/@sattyamjain96/the-agent-that-burned-4-200-in-63-hours

² Krish Patil, "Google Antigravity's Recurring Agent Terminated Crisis," 2025. https://medium.com/@krishpatil120/google-antigravitys-recurring-agent-terminated-crisis
