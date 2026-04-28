# Appendix G: Glossary

*Key terms used throughout this book.*

---

**AGENTS.md** — An open standard (stewarded by the Agentic AI Foundation under the Linux Foundation) for providing AI coding agents with project-specific instructions, coding conventions, build commands, and testing requirements. Adopted by 60,000+ repositories as of 2026.

**Agent-First Development** — A software development approach where AI coding agents are the primary implementers of code, and human engineers focus on designing environments, specifying intent, and verifying output.

**Architecture Fitness Function** — An automated test that verifies a specific architectural property, such as dependency direction, module coupling, or API contract stability.

**Autonomy Level** — A classification (Level 0–5) of how independently an agent operates, from manual autocomplete (L0) to fully self-directed feature development (L5).

**Blast Radius** — The scope of impact if an agent makes a mistake. Higher blast radius requires lower autonomy and more verification.

**CLAUDE.md** — Anthropic's project instruction file for Claude Code, functionally similar to AGENTS.md.

**Context Architecture** — The design of information systems that provide AI agents with the right information at the right time, organized for optimal consumption.

**Context Engineering** — The discipline of designing, organizing, and maintaining the information that AI coding agents need to work effectively. Distinct from prompt engineering (which focuses on individual interactions) in that it focuses on persistent, structured context.

**Coordinator/Specialist/Verifier Pattern** — A multi-agent orchestration pattern where a coordinator decomposes work, specialists execute, and a verifier checks results against specifications.

**Cursor Rules** — Cursor's project instruction format (stored in `.cursorrules`), providing agent-facing instructions similar to AGENTS.md.

**Defense-in-Depth** — A security approach using multiple layers of controls, so that if one layer fails, others still provide protection. Applied to agent security across organizational, runtime, process, code, and network layers.

**Dependency Direction** — The enforced rule that dependencies flow from higher layers (UI, routes) to lower layers (services, data, types), never the reverse.

**DORA Metrics** — The four DevOps Research and Assessment metrics: deployment frequency, lead time for changes, change failure rate, and mean time to recovery. Industry standard for software delivery performance.

**Entropy** — In the context of agent-first development, the tendency of codebases to accumulate disorder (duplicate patterns, dead code, documentation drift, over-abstraction) when agents generate code without sufficient constraints.

**Entropy Budget** — An explicit organizational limit on how much codebase disorder is acceptable, enforced through the development process.

**Execution Plan** — A structured document that decomposes a high-level goal into ordered tasks with dependencies, acceptance criteria, and verification steps. Used by agents at Level 3+ autonomy.

**Garbage Collection Agent** — An automated agent that runs on a schedule to clean up specific types of entropy: documentation drift, dead code, pattern variants, stale dependencies, or quality metric degradation.

**Golden Principles** — The team's non-negotiable rules for code quality, encoded as linter rules or structural tests. Typically 10–50 rules covering architecture, error handling, testing, security, and naming.

**Harness** — The complete system of constraints, context, verification mechanisms, and correction loops that makes AI coding agents reliable at scale.

**Harness Engineering** — The discipline of designing environments, constraints, and feedback loops that make AI coding agents reliable at scale. Named after OpenAI's blog post describing their approach.

**Knowledge Architecture** — The six-layer structure for organizing information in agent-first codebases: platform context, instruction layer, codebase structure, reference documentation, runtime state, and plans.

**Legibility** — The property of a codebase or system that makes it understandable and navigable by AI agents. Includes boot legibility, state legibility, behavior legibility, error legibility, and visual legibility.

**Linter** — A static analysis tool that checks code for style violations, pattern violations, and architectural rule violations. In agent-first development, linters are the primary enforcement mechanism for golden principles.

**Lost in the Middle** — A phenomenon where LLMs pay less attention to information in the middle of their context window, preferring content at the beginning and end. Has implications for how context files are structured.

**MCP (Model Context Protocol)** — An open protocol (stewarded by the Agentic AI Foundation) for connecting AI models to external tools, data, and applications.

**Mechanical Enforcement** — The practice of encoding architectural rules and quality standards as automated checks (linters, structural tests, CI gates) that run without human intervention.

**METR** — Model Evaluation and Threat Research, an organization that conducts rigorous controlled trials of AI coding productivity. Known for the 2025 finding that AI tools made experienced developers 19% slower.

**Minimum Viable Context (MVC)** — The minimum set of information an agent needs before acting: project overview, architecture, commands, code style, testing requirements, and PR conventions.

**Pattern Replication** — An entropy pattern where agents copy existing code patterns with minor variations, creating a family of similar-but-not-identical implementations.

**Prompt Engineering** — The practice of crafting effective instructions for individual AI interactions. Distinct from context engineering (which focuses on persistent, structured context).

**Prompt Injection** — An attack where malicious instructions are embedded in data that the agent reads, causing the agent to execute unintended actions. A critical security concern in agent-first development.

**Quality Discount** — The 15–30% rework rate typically observed on AI-generated code, representing the cost of verifying and correcting agent output.

**Ralph Wiggum Loop** — A self-correction pattern where an agent iterates on its own output: generate → verify → fix → verify → repeat until tests pass or iteration limit is reached. Named by the OpenAI team.

**Recurring Agent** — An agent that runs on a schedule, performing specific maintenance tasks such as documentation updates, dead code removal, or dependency auditing.

**Self-Review** — The practice of having an agent review its own code before submitting a PR, checking for style compliance, test coverage, scope adherence, and pattern consistency.

**SoK Paper** — A Systematization of Knowledge paper that consolidates research on a specific topic. The arXiv paper cataloging 42 prompt injection attack techniques is an SoK paper.

**Structural Test** — A test that verifies architectural properties of the codebase (dependency direction, module boundaries, API contracts) rather than specific functional behavior.

**Taste** — In the context of software development, the collective judgment of a team about what constitutes good code. In agent-first development, taste is encoded as golden principles and enforced by linters.

**Throughput** — The rate at which a team produces merged, production-quality code. In agent-first development, throughput is often limited by review and verification capacity rather than implementation speed.

**Token Efficiency** — The ratio of useful output to tokens consumed by an agent. Higher token efficiency means lower cost per PR.

**Verification Tax** — The time engineers spend auditing AI-generated code, offsetting the generation speed. Calculated as the delta between time-to-first-commit and time-to-PR-approval.

**Worktree** — A Git worktree: an isolated working directory that shares the same .git repository. Used for per-agent sandboxing in multi-agent workflows.

**.cursorrules** — See Cursor Rules.

**Token Budget** — The maximum number of tokens an agent may consume for a single task. Used to prevent runaway costs and enforce scoping of agent work. Typical budgets range from 50K–200K tokens per task.

**Task Decomposition** — The process of breaking a high-level goal into smaller, ordered tasks with clear acceptance criteria. A core skill in harness engineering, as agents perform best with well-scoped, verifiable tasks.

**Specification** — A detailed description of what a feature or component should do, including inputs, outputs, edge cases, and acceptance criteria. In agent-first development, specifications replace line-by-line coding as the primary engineering output.

**Agent Audit Trail** — A chronological record of all actions taken by an AI coding agent, including prompts issued, files read, code generated, tests run, and decisions made. Critical for debugging, compliance, and security forensics.

**Convergence** — The point at which an agent's iterative output stabilizes and meets the acceptance criteria. Agents that don't converge within a set number of iterations should be stopped and the task re-scoped.

**Brownfield Migration** — The process of introducing harness engineering practices to an existing codebase that was not originally designed for agent-first development. Contrasts with greenfield development.

**Greenfield Development** — Building a new project from scratch with agent-first practices embedded from day one. The preferred starting point for harness engineering, as the codebase can be optimized for agent legibility from the beginning.

**Over-Abstraction** — An entropy pattern where agents introduce unnecessary abstraction layers, interfaces, or generic solutions where simple, concrete implementations would suffice. One of the most common forms of agent-driven entropy.

**Pattern Drift** — The gradual divergence of code patterns from established conventions, occurring when agents generate variations of existing code without strict enforcement of canonical patterns.

**Self-Healing Harness** — A harness that automatically detects and corrects common issues — for example, a linter that not only flags violations but provides auto-fix capability, or a CI pipeline that automatically applies formatting.

**Verification Layer** — A stage in the CI pipeline that checks agent output against defined standards. The six verification layers described in this book are: linting, unit tests, integration tests, structural tests, security scanning, and quality scoring.

**Approval Gate** — A checkpoint in the agent workflow that requires human approval before proceeding. Typically used for high-risk operations like deploying to production, modifying database schemas, or changing security-sensitive code.

**Context Window** — The maximum amount of text (measured in tokens) that an LLM can process in a single interaction. Context engineering is fundamentally about fitting the most useful information within this constraint.

**Fan-Out/Fan-In** — A multi-agent orchestration pattern where a coordinator distributes subtasks to multiple agents in parallel (fan-out), then collects and merges the results (fan-in).

**Merge Queue** — A CI mechanism that serializes PR merges to prevent merge conflicts at scale. Essential for agent-first teams where multiple agents may submit PRs simultaneously.

**Model Routing** — The practice of assigning different AI models to different tasks based on complexity, cost, and capability. For example, using a fast model for linting and a capable model for architecture decisions.

**Prompt Injection Defense** — Security measures designed to prevent or mitigate prompt injection attacks. Includes input sanitization, output validation, capability scoping, and sandboxed execution.

**Agent SDK** — A software development kit for building agent orchestration systems. Examples include the Claude Code Agent SDK and the Codex subagents API. Provides primitives for spawning, managing, and communicating with agents.

**Thin Slice** — A minimal but complete vertical implementation of a feature, from UI to database. Building a thin slice first gives agents a reference implementation to follow for subsequent features.

**MCP Gateway** — A centralized service that brokers access to Model Context Protocol (MCP) tool servers, providing authentication, rate limiting, auditing, and policy enforcement for agent tool usage across an organization. See Chapter 21.

**Toolshed** — An internal marketplace or registry of vetted tools that AI coding agents can discover and use. Analogous to an internal package registry but for agent capabilities. Ensures agents only access approved, audited tools.

**Devbox** — A reproducible, declarative development environment definition (popularized by Jetpack.io's Devbox). In agent-first development, devboxes ensure every agent worktree gets an identical, pre-configured environment, eliminating "works on my machine" discrepancies.

**Honk** — Spotify's background coding agent system, documented in a three-part engineering blog series (2025). Honk operates as a fleet of autonomous agents that handle large-scale code migrations and refactoring in the background. Key innovation: strong feedback loops with deterministic verification. See Chapter 22.

**Minions** — Stripe's one-shot, end-to-end coding agent architecture. Minions decompose tasks into deterministic agentic nodes with explicit inputs, outputs, and verification steps. The blueprint architecture emphasizes determinism over autonomy. See Chapter 22.

**REA (Ranking Engineer Agent)** — Meta's autonomous AI agent that accelerates ads ranking innovation. REA works autonomously for days to weeks on complex optimization tasks, operating within carefully defined constraints. Demonstrates the highest autonomy levels in production. See Chapter 22.

**Clinejection** — A supply chain attack vector where a malicious GitHub issue title or body contains prompt injection payloads that compromise AI coding agents (Claude Code, specifically) reading the issue, leading to credential theft or code manipulation. Documented by Securing Agents (2026). See Chapter 20.

**Comment and Control** — A prompt injection technique discovered by researcher Aonan Guan (2026) that exploits GitHub comments to extract credentials from Claude Code, Gemini CLI, and GitHub Copilot through a single injected prompt. See Chapter 20.

**Roast** — Shopify's open-source framework for building structured AI workflows. Roast provides deterministic node-based orchestration for coding agents, emphasizing predictable results over open-ended generation. See Chapter 22.

**DevMate** — Meta's internal agent marketplace architecture that allows engineering teams to publish, discover, and compose AI coding agents for specific domains. Enables organization-wide reuse of specialized agent capabilities.

**AlphaEvolve** — Google DeepMind's Gemini-powered coding agent designed for discovering and optimizing advanced algorithms. Represents the frontier of AI agents tackling novel problem-solving, not just code generation. See Chapter 27.

**CodeMender** — Google DeepMind's AI agent for automated code security remediation. CodeMender identifies vulnerabilities and generates verified fixes, demonstrating agent-assisted security at scale. See Chapter 21.

**PerfInsights** — Uber's internal tool that uses generative AI to detect performance optimization opportunities in Go code. Demonstrates domain-specific agents focused on non-functional code quality. See Chapter 22.

**AutoCover** — An automated test coverage improvement agent that identifies untested code paths and generates tests to close coverage gaps. Represents the class of "quality maintenance agents" that operate continuously to prevent entropy.
