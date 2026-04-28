# Appendix H: References and Further Reading

---

## Primary Sources

### OpenAI
- "Harness Engineering: Leveraging Codex in an Agent-First World." *OpenAI Blog*, 2025.  
  https://openai.com/index/harness-engineering/
- InfoQ coverage: "OpenAI Introduces Harness Engineering." February 2026.  
  https://www.infoq.com/news/2026/02/openai-harness-engineering-codex/
- Ryan Lopopolo, OpenAI Engineering. Quoted in InfoQ coverage.

### Anthropic
- Claude Code Documentation and Agent SDK.  
  https://docs.anthropic.com/
- Model Context Protocol (MCP) Specification.  
  https://modelcontextprotocol.io/

### METR (Model Evaluation and Threat Research)
- "We Are Changing Our Developer Productivity Experiment Design." February 2026.  
  https://metr.org/blog/2026-02-24-uplift-update/
- "Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity." 2025.
- Research page: https://metr.org/research

### AGENTS.md Standard
- AGENTS.md Official Site.  
  https://agents.md/
- Linux Foundation Press Release: "Formation of the Agentic AI Foundation." December 9, 2025.  
  https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation

### GitHub
- GitHub analysis of 2,500+ repositories using AGENTS.md. Referenced in AGENTS.md documentation.
- GitHub Copilot Documentation. https://docs.github.com/en/copilot

---

## Security Research

### Prompt Injection
- "Prompt Injection Attacks on Agentic Coding Assistants: A Systematic Analysis of Vulnerabilities in Skills, Tools, and Protocol Ecosystems." arXiv:2601.17548, 2026.
- "The Landscape of Prompt Injection Threats in LLM Agents: From Taxonomy to Analysis." arXiv:2602.10453, 2026.
- CVE-2025-53773 — GitHub Copilot vulnerability.
- CVE-2025-59944 — Cursor vulnerability.

### Security Frameworks
- OWASP Top 10 for LLM Applications. https://owasp.org/www-project-top-10-for-large-language-model-applications/
- NIST AI Risk Management Framework. https://www.nist.gov/artificial-intelligence

---

## Case Studies

### Wix AirBot
- "When AI Becomes Your On-Call Teammate: Inside Wix's AirBot That Saves 675 Engineering Hours a Month." *Wix Engineering Blog*.  
  https://www.wix.engineering/post/when-ai-becomes-your-on-call-teammate-inside-wix-s-airbot-that-saves-675-engineering-hours-a-month

### Affirm
- "How Affirm Retooled its Engineering Organization for Agentic Software Development in One Week." *Affirm Technology Blog*, Medium.  
  https://medium.com/@affirmtechnology/how-affirm-retooled-its-engineering-organization-for-agentic-software-development-in-one-week-1fd35268fde6

### Morgan Stanley
- Morgan Stanley DevGen.AI: 280,000 hours reclaimed across 9M lines. Referenced in multiple industry reports.

### Faros AI
- Cost per incremental PR benchmark: $37.50. Referenced in Augment Code harness engineering guide.

### Augment Code
- "Harness Engineering for AI Coding Agents: Constraints That Ship."  
  https://www.augmentcode.com/guides/harness-engineering-ai-coding-agents

---

## Foundational Concepts

### Software Architecture
- Martin Fowler. "Patterns of Enterprise Application Architecture." Addison-Wesley, 2002.
- Robert C. Martin. "Clean Architecture: A Craftsman's Guide to Software Structure and Design." Prentice Hall, 2017.

### Observability
- Charity Majors, Liz Fong-Jones, and George Miranda. "Observability Engineering." O'Reilly, 2022.
- OpenTelemetry Documentation. https://opentelemetry.io/

### DevOps and DORA Metrics
- Nicole Forsgren, Jez Humble, and Gene Kim. "Accelerate: The Science of Lean Software and DevOps." IT Revolution Press, 2018.
- DORA State of DevOps Report. Annual. https://dora.dev/

### AI Safety
- Stuart Russell. "Human Compatible: Artificial Intelligence and the Problem of Control." Viking, 2019.
- Brian Christian. "The Alignment Problem." W.W. Norton, 2020.

---

## Research Papers

- "Lost in the Middle: How Language Models Use Long Contexts." Liu et al., 2023. Stanford/Berkeley.
- "An Automatic Prompt Generation System for Tabular Data: The Case of ChatGPT." Various, 2023.
- "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?" Princeton University, 2023.
- ISO/IEC 42001:2023 — Artificial Intelligence Management System. International Organization for Standardization.

---

## Blogs and Newsletters

- *Engineering.fyi* — Engineering blog aggregator with harness engineering coverage.  
  https://www.engineering.fyi/
- *The Pragmatic Engineer* — Gergely Orosz's newsletter on software engineering.  
  https://blog.pragmaticengineer.com/
- *Sourcegraph Blog* — Cody and AI coding agent development.  
  https://sourcegraph.com/blog
- *Anthropic Research Blog* — AI safety and capability research.  
  https://www.anthropic.com/research

---

## Books

- Martin Kleppmann. "Designing Data-Intensive Applications." O'Reilly, 2017.
- Michael T. Nygard. "Release It!: Design and Deploy Production-Ready Software." Pragmatic Bookshelf, 2018 (2nd ed.).
- Kelsey Hightower. "Kubernetes: Up and Running." O'Reilly, 2019 (2nd ed.).
- Steve Yegge. Various blog posts on AI-assisted development progression.  
  https://steve-yegge.blogspot.com/

---

## Standards and Frameworks

- SOC 2 (System and Organization Controls 2) — AICPA
- ISO/IEC 27001 — Information Security Management
- ISO/IEC 42001:2023 — AI Management Systems
- SAE J3016 — Levels of Driving Automation (inspiration for autonomy spectrum)

---

## Communities

- Agentic AI Foundation (Linux Foundation) — https://aai.foundation/
- AGENTS.md GitHub Discussions — https://github.com/orgs agents-md/discussions
- r/ChatGPTCoding — Reddit community for AI-assisted development
- AI Engineer Foundation — https://aiengineerfoundation.org/

---

### AI Agent Platforms and Tools

- **Devin (Cognition)** — Autonomous AI software engineer. First demonstration of an end-to-end AI agent capable of independently building and deploying features.
  https://www.cognition.ai/devin

- **Cursor** — AI-first code editor with agent mode, project-level rules (.cursorrules), and multi-file editing capabilities. One of the earliest tools to support project-level agent instructions.
  https://cursor.sh/

- **Windsurf (Codeium)** — AI-powered IDE with Cascade agent system. Supports multi-step reasoning and project-aware code generation.
  https://codeium.com/windsurf

- **OpenAI Codex** — Cloud-based coding agent with CLI and macOS app. Supports subagents, worktree isolation, and multi-agent workflows. The platform that inspired the term "harness engineering."
  https://openai.com/codex/

- **Claude Code (Anthropic)** — CLI-based coding agent with Agent SDK for building multi-agent orchestration systems. Supports teammates, async execution, and remote agent deployment.
  https://docs.anthropic.com/en/docs/claude-code

---

## Annotated Bibliography

The following annotations explain why each source is relevant to harness engineering and where its ideas appear in this book.

### Primary Sources (Annotated)

**OpenAI. "Harness Engineering: Leveraging Codex in an Agent-First World." 2025.**
The foundational document for this book. Describes how OpenAI's team built a million-line product using Codex agents as primary implementers. Key contributions: the concept of the harness as a discipline, depth-first development, ephemeral per-worktree observability, and the QA bottleneck insight. Reprinted with annotations in Appendix A.
*Chapters referenced: 1, 2, 3, 8, 10, 16.*

**METR. "Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity." 2025.**
Rigorous controlled trial finding that AI tools made experienced developers 19% slower when used without context engineering governance. This finding is central to the book's argument that AI tools without harnesses reduce productivity. The study design and methodology are discussed in Chapter 22.
*Chapters referenced: 22, 23.*

**METR. "We Are Changing Our Developer Productivity Experiment Design." February 2026.**
Follow-up acknowledging design flaws in earlier AI productivity studies. Introduces transcript analysis methodology showing 1.5x–13x time savings as an upper bound. Important for understanding the true ROI range of agent-first development.
*Chapters referenced: 22.*

**Anthropic. Claude Code Documentation and Agent SDK.**
Documentation for Claude Code's CLI agent and the Agent SDK used to build multi-agent orchestration systems. The Agent SDK's primitives (fork, async, teammates, remote) inform the orchestration patterns in Part V.
*Chapters referenced: 13, 14, 15, 25.*

**Anthropic. Model Context Protocol (MCP) Specification.**
Open protocol for connecting AI models to external tools and data. Relevant for understanding tool integration patterns and the security implications of tool access discussed in Chapters 20 and 21.
*Chapters referenced: 20, 21, 25.*

**AGENTS.md Official Site. Linux Foundation / Agentic AI Foundation.**
The open standard for project-level agent instructions, adopted by 60,000+ repositories. Central to the context engineering discussion in Part II and the templates in Appendix B.
*Chapters referenced: 5, 7, 26.*

### Case Studies (Annotated)

**Wix Engineering. "When AI Becomes Your On-Call Teammate: Inside Wix's AirBot."**
Detailed case study of Wix's AI-powered on-call automation tool. Key data: 675 engineering hours/month saved, $0.30 per interaction, 35-50x ROI. Demonstrates that agent-first development applies to operational automation, not just code generation.
*Chapters referenced: 22, 23.*

**Affirm Technology Blog. "How Affirm Retooled its Engineering Organization for Agentic Software Development in One Week."**
Case study of large-scale organizational change: 800 engineers retrained in one week. Demonstrates that the transition to agent-first development is primarily a cultural and process change, not a technology change. Key lesson: single default toolchain reduces cognitive overhead.
*Chapters referenced: 23, 24.*

**Morgan Stanley DevGen.AI.**
Enterprise-scale deployment of AI code generation across 9 million lines of code, reclaiming 280,000 hours. Demonstrates that harness engineering principles apply at the largest organizational scale.
*Chapters referenced: 22, 23.*

**Augment Code. "Harness Engineering for AI Coding Agents: Constraints That Ship."**
Practical guide that independently arrived at many of the same conclusions as this book. Key contribution: the $37.50 cost-per-incremental-PR benchmark and the concept of constraints as the primary lever for agent quality.
*Chapters referenced: 22, 26.*

### Security Research (Annotated)

**"Prompt Injection Attacks on Agentic Coding Assistants." arXiv:2601.17548, 2026.**
The Systematization of Knowledge (SoK) paper cataloging 42 distinct prompt injection attack techniques against coding agents. Key finding: 85%+ attack success rates against current defenses. This paper forms the empirical basis for the security discussion in Part VIII.
*Chapters referenced: 20, 21.*

**"The Landscape of Prompt Injection Threats in LLM Agents." arXiv:2602.10453, 2026.**
Comprehensive taxonomy of prompt injection threats in agent systems. Introduces the classification of direct, indirect, and protocol-level injection vectors used in Chapter 20.
*Chapters referenced: 20.*

**CVE-2025-53773 (GitHub Copilot) and CVE-2025-59944 (Cursor).**
Real-world CVEs demonstrating that prompt injection is not theoretical. These case studies show how agent tools can be exploited through indirect injection vectors, supporting the defense-in-depth approach advocated in Chapter 21.
*Chapters referenced: 20.*

### Foundational Books (Annotated)

**Martin Fowler. "Patterns of Enterprise Application Architecture." Addison-Wesley, 2002.**
The foundational text on layered architecture, which underpins the dependency direction enforcement described in Chapter 11. Fowler's concepts of service layers, data mappers, and repository patterns directly inform the architectural patterns that make codebases legible to agents.
*Chapters referenced: 10, 11.*

**Robert C. Martin. "Clean Architecture." Prentice Hall, 2017.**
The dependency inversion principle and the concept of architectural boundaries are central to the layer enforcement patterns described in Chapters 10 and 11. Martin's assertion that architecture is about intent, not frameworks, aligns with the harness engineering principle that constraints encode taste.
*Chapters referenced: 10, 11, 12.*

**Nicole Forsgren, Jez Humble, and Gene Kim. "Accelerate." IT Revolution Press, 2018.**
The scientific basis for DORA metrics, which this book adapts for agent-first development. Key finding: software delivery performance predicts organizational performance. The four DORA metrics (deployment frequency, lead time, change failure rate, MTTR) form the measurement foundation of Chapter 22.
*Chapters referenced: 16, 17, 22.*

**Charity Majors, Liz Fong-Jones, and George Miranda. "Observability Engineering." O'Reilly, 2022.**
The definitive guide to observability. Directly informs the observability-for-agents pattern in Chapter 8, where agents gain access to the same telemetry (logs, metrics, traces) that human engineers use.
*Chapters referenced: 8, 9.*

**Martin Kleppmann. "Designing Data-Intensive Applications." O'Reilly, 2017.**
The gold standard for understanding data systems architecture. Relevant to Chapter 11's discussion of data layer design and Chapter 9's patterns for deterministic test fixtures and reproducible environments.
*Chapters referenced: 9, 11.*

**Michael T. Nygard. "Release It!" Pragmatic Bookshelf, 2018 (2nd ed.).**
Patterns for production-ready software including circuit breakers, bulkheads, and timeouts. These patterns are particularly relevant for agent-generated code, which often lacks the defensive patterns that experienced engineers would add.
*Chapters referenced: 9, 17.*

**Stuart Russell. "Human Compatible." Viking, 2019.**
AI safety framework arguing for designing systems that are provably beneficial to humans. The concept of "provably beneficial" maps to the harness engineering principle of mechanical enforcement — making correct behavior provable through automated checks.
*Chapters referenced: 20, 21, 27.*

**Brian Christian. "The Alignment Problem." W.W. Norton, 2020.**
Accessible exploration of AI alignment challenges. Relevant to the discussion of agent autonomy levels (Chapter 18) and the broader question of how to ensure agents act in accordance with human intent.
*Chapters referenced: 18, 27.*

### Research Papers (Annotated)

**"Lost in the Middle: How Language Models Use Long Contexts." Liu et al., 2023.**
Empirical finding that LLMs pay less attention to information in the middle of their context window. This directly informs the context architecture patterns in Chapter 6 — the recommendation to put the most important information at the beginning and end of context files.
*Chapters referenced: 6.*

**"SWE-bench: Can Language Models Resolve Real-World GitHub Issues?" Princeton University, 2023.**
Benchmark for evaluating AI coding agents on real-world tasks. Informs the discussion of agent capability measurement in Chapter 22 and the autonomy level framework in Chapter 18.
*Chapters referenced: 18, 22.*

**ISO/IEC 42001:2023 — Artificial Intelligence Management System.**
International standard for AI management systems. Provides the governance framework referenced in the enterprise deployment playbook (Chapter 23) and the compliance discussion in Chapter 24.
*Chapters referenced: 23, 24.*

---

## Reading Guide by Role

Different readers may want to prioritize different references based on their role:

### For Engineering Managers
1. Start with: METR productivity studies, Affirm case study, DORA metrics (Accelerate)
2. Then read: Wix AirBot case study, Morgan Stanley DevGen.AI, enterprise deployment (Chapter 23)
3. Reference: ROI measurement (Chapter 22), quality scorecard (Appendix F)

### For Staff/Principal Engineers (Architects)
1. Start with: OpenAI harness engineering post, Clean Architecture, Patterns of Enterprise Application Architecture
2. Then read: Fowler's architectural patterns, linter implementation (Appendix D), golden principles (Appendix C)
3. Reference: Dependency graph design (Chapter 11), mechanical enforcement (Chapter 10)

### For Security Engineers
1. Start with: Prompt injection SoK paper (arXiv:2601.17548), OWASP LLM Top 10
2. Then read: CVE case studies, defense-in-depth framework (Chapter 21)
3. Reference: Security pattern rules (Appendix D), Semgrep security rules

### For Individual Contributors New to Agent-First Development
1. Start with: AGENTS.md documentation, OpenAI harness engineering post
2. Then read: Claude Code or Codex documentation for your chosen platform
3. Reference: AGENTS.md templates (Appendix B), minimum viable harness (Chapter 26)

---

*This reference list will be updated as new research, tools, and case studies become available. Check the book's companion website for the latest updates.*

---

## New Sources by Chapter

The following sources were added to support new and expanded content throughout the book. They are organized by chapter for easy cross-referencing.

### Chapter 1: The Evidence Baseline

- Uber Engineering. "uReview: Scalable, Trustworthy GenAI for Code Review at Uber." 2025. https://www.uber.com/blog/ureview
- Uber Engineering. "Slashing CI Costs at Uber." https://www.uber.com/blog/slashing-ci-costs-at-uber
- Kariya, Avinash. "How Uber Built AI Agents That Saved 21,000 Developer Hours with LangGraph." *Medium*, 2025. https://medium.com/@avinashkariya05910/
- AI:PRODUCTIVITY. "Inside Uber's AI Dev Stack: 92% of Engineers Use Agents Monthly." 2026. https://aiproductivity.ai/news/uber-ai-development-inside-look

### Chapter 2: Four Pillars

- Cloudflare. "The AI engineering stack we built internally." https://blog.cloudflare.com/internal-ai-engineering-stack

### Chapter 3: Starting from Zero / When Not to Use Agents

- Fischman, Brian. "I Tried to Run an AI Coding Agent Overnight. Here's What Actually Happened." *Medium*, 2026. https://brianfischman.medium.com/i-tried-to-run-an-ai-coding-agent-overnight

### Chapter 4: Case Study — Affirm and the Solo Engineer

- Anthropic. "Customer story: Stripe." 2026. https://www.anthropic.com/customers/stripe
- Anthropic. "Customer story: Rakuten." 2026. https://anthropic.com/customers/rakuten
- Anthropic. "Customer story: CircleCI." 2026. https://www.anthropic.com/customers/circleci

### Chapter 12: Lint Error Messages Are Prompts

- Shopify. "Introducing Roast: Structured AI workflows made easy." *Shopify Engineering*, 2025. https://shopify.engineering/introducing-roast

### Chapter 14: Ralph Wiggum Loop (Canonical Home)

- Spotify Engineering. "1,500+ PRs Later: Spotify's Journey with Our Background Coding Agent (Honk, Part 1)." 2025. https://engineering.atspotify.com/2025/11/spotifys-background-coding-agent-part-1
- Spotify Engineering. "Background Coding Agents: Context Engineering (Honk, Part 2)." 2025. https://engineering.atspotify.com/2025/11/context-engineering-background-coding-agents-part-2
- Spotify Engineering. "Background Coding Agents: Predictable Results Through Strong Feedback Loops (Honk, Part 3)." 2025. https://engineering.atspotify.com/2025/12/feedback-loops-background-coding-agents-part-3

### Chapter 16: Throughput, Merges, and Norms

- Uber Engineering. "PerfInsights: Detecting Performance Optimization Opportunities in Go Code using Generative AI." https://www.uber.com/blog/perfinsights

### Chapter 17: CI/CD for Agent-First Teams

- Perttu. "How Claude Silently Inflates Your Pipeline Token Costs." 2026. https://dontcodethisathome.com/how-claude-p-silently-inflates-your-pipeline-token-costs

### Chapter 18: Autonomy Levels (Canonical Home)

- Meta Engineering. "Ranking Engineer Agent (REA): The Autonomous AI Agent Accelerating Meta's Ads Ranking Innovation." 2026. https://engineering.fb.com/2026/03/17/developer-tools/ranking-engineer-agent-rea
- Meta Engineering. "KernelEvolve: How Meta's Ranking Engineer Agent Optimizes AI Infrastructure." 2026. https://engineering.fb.com/2026/04/02/developer-tools/kernelevolve
- Lavaee, Alex. "Google DeepMind's Delegation Framework for Coding Agent Architecture." 2026. https://alexlavaee.me/blog/intelligent-agent-delegation

### Chapter 19: Entropy and Garbage Collection (Canonical Home)

- Kurten, Angel. "75% of AI Agents Break Code They Maintain." 2026. https://angelkurten.com/blog/ai-agents-breaking-codebases
- BSWEN. "Why Does AI-Generated Code Fail in Production?" 2026. https://docs.bswen.com/blog/2026-03-14-ai-code-failure-mode

### Chapter 20: Prompt Injection and Agent Security

- Guan, Aonan. "Comment and Control: Prompt Injection to Credential Theft in Claude Code, Gemini CLI, and GitHub Copilot." 2026. https://oddguan.com/blog/comment-and-control-prompt-injection-credential-theft
- Securing Agents. "Clinejection: How a GitHub Issue Title Compromised 4,000 Developer Machines." 2026. https://securingagents.com/articles/clinejection-how-a-github-issue-title-compromised-4000-developer-machines
- VentureBeat. "Three AI coding agents leaked secrets through a single prompt injection." 2026. https://venturebeat.com/security/ai-agent-runtime-security-system-card-audit-comment-and-control-2026
- Cyber Security News. "Claude Code, Gemini CLI, and GitHub Copilot Vulnerable to Prompt Injection via GitHub Comments." 2026. https://cybersecuritynews.com/prompt-injection-via-github-comments
- Snyk. "How 'Clinejection' Turned an AI Bot into a Supply Chain Attack." *Medium*, 2026. https://medium.com/@snyksec/how-clinejection-turned-an-ai-bot-into-a-supply-chain-attack
- Google DeepMind. "Introducing CodeMender: an AI agent for code security." https://deepmind.google/blog/introducing-codemender-an-ai-agent-for-code-security

### Chapter 21: Defense in Depth / Tiered Review (Canonical Home)

- Microsoft. "Microsoft Agent 365: The control plane for AI agents." *Microsoft 365 Blog*, 2025. https://www.microsoft.com/en-us/microsoft-365/blog/2025/11/18/microsoft-agent-365-the-control-plane-for-ai-agents
- Google Cloud. "Scion — Agent orchestration framework." https://github.com/GoogleCloudPlatform/scion

### Chapter 22: Measuring ROI

- Stripe. "Minions: Stripe's one-shot, end-to-end coding agents." *Stripe Engineering Blog*, 2025. https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents
- Stripe. "Minions: Stripe's one-shot, end-to-end coding agents — Part 2." *Stripe Engineering Blog*, 2025. https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2
- The Pragmatic Engineer. "How Uber uses AI for development: inside look." 2026. https://newsletter.pragmaticengineer.com/p/how-uber-uses-ai-for-development
- DevopsFlow. "Uber: Leading Engineering Through an Agentic Shift." 2026. https://devopsflow.net/uber-leading-agentic-shift
- GeekTak. "Build Deterministic AI Coding Workflows: Stripe Minions Architecture." 2026. https://www.geektak.com/blog/build-deterministic-ai-coding-workflows-stripe
- MindStudio. "What Is Stripe Minions' Blueprint Architecture?" 2026. https://www.mindstudio.ai/blog/stripe-minions-blueprint-architecture-deterministic-agentic-nodes
- Lilting. "Inside the Architecture of Stripe's AI Coding Agent 'Minions'." 2026. https://lilting.ch/en/articles/stripe-minions-agent-architecture
- Wasowski, Jarosław. "Spotify Honk Fleet Management AI Coding System Complete Guide." *Medium*, 2026. https://medium.com/@wasowski.jarek/spotify-honk-fleet-management-ai-coding-system-complete-guide
- Ry Walker Research. "Stripe Minions." 2026. http://rywalker.com/research/stripe-minions
- Ry Walker Research. "Uber AI Coding Agents." 2026. http://rywalker.com/research/uber-coding-agents

### Chapter 23: Enterprise Deployment Playbook

- Madusanka, Chamith. "How We Integrated Claude Code Into Our GitHub Workflow." *Medium*, 2026. https://medium.com/@chamith/how-we-integrated-claude-code-into-our-github-workflow-97a5db8bcb8e

### Chapter 24: Scaling Governance

- Meta Engineering. "Capacity Efficiency at Meta: How Unified AI Agents Optimize Performance at Hyperscale." 2026. https://engineering.fb.com/2026/04/16/developer-tools/capacity-efficiency-at-meta
- Business Insider. "Meta's AI Week Encourages Staff to Build AI Agents and Code With Claude." 2026. https://www.techinsider.io/meta-ai-week-employee-training-claude-agents-vibe-coding-2026-3

### Chapter 25: Tools and Platforms

- Anthropic. "Claude Managed Agents Launch." *Evermx*, 2026. https://evermx.com/case/claude-managed-agents-launch-2026
- Maurya, Abhishek. "How We Turned Claude Code Into a Self-Improving AI Engineering Platform." *Medium*, 2026. https://akmnitt.medium.com/how-we-turned-claude-code-into-a-self-improving-ai-engineering-platform

### Chapter 26: The Brownfield Harness / Minimum Viable Harness

- Shopify. "Shopify AI Toolkit." https://shopify.dev/docs/apps/build/ai-toolkit
- Shopify. "Shopify AI Toolkit — GitHub Repository." https://github.com/shopify/shopify-ai-toolkit

### Chapter 27: The Future of Harness Engineering

- Google DeepMind. "AlphaEvolve: A Gemini-powered coding agent for designing advanced algorithms." 2025. https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms
- Wasowski, Jarosław. "Meta DevMate Agent Marketplace Architecture." *Medium*, 2026. https://medium.com/@wasowski.jarek/meta-devmate-agent-marketplace-architecture
- Lanham, Micheal. "Meta's AI Agent Worked Autonomously for Weeks." *Medium*, 2026. https://medium.com/@Micheal-Lanham/metas-ai-agent-worked-autonomously-for-weeks
- Ry Walker Research. "Meta REA." 2026. http://rywalker.com/research/meta-rea

### Failure Stories and Postmortems (Cross-Chapter)

- Jain, Sattyam. "The Agent That Burned $4,200 in 63 Hours: A Production AI Postmortem." *Medium*, 2026. https://medium.com/@sattyamjain96/the-agent-that-burned-4-200-in-63-hours
- Krishpatil. "Google Antigravity's Recurring 'Agent Terminated' Crisis." *Medium*, 2026. https://medium.com/@krishpatil120/google-antigravitys-recurring-agent-terminated-crisis
- Danilchenko. "GitHub's AI Agent Problem: 17 Million PRs, Five Outages, and a Kill Switch." 2026. https://danilchenko.dev/posts/2026-04-11-github-ai-agents-pull-requests

---

*All URLs were verified as of the publication date. If a URL has changed, search for the title and author name to locate the current source.*
