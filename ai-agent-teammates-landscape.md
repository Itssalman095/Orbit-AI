# AI Agent Teammates — Market Landscape Research

Compiled 2026-10-11 via Firecrawl searches + scrapes. Raw evidence in `.firecrawl/` (`search-teammates.json`, `search-features.json`, `search-coding.json`, `search-enterprise.json`, `builderio.md`, `coworker.md`, `asana.md`, `devin.md`, `teammatesai.md`).

## Companies building AI Agent Teammates

### Horizontal "AI teammate / AI employee" products
| Company | Product | Role |
|---|---|---|
| xAI | Grok Bot (x.ai/bot) | AI teammates with their own cloud computer |
| Asana | AI Teammates + Dash (AI Chief of Staff) | 30+ prebuilt teammates inside Work Graph |
| Coworker.ai | Coworker | AI coworkers w/ organizational memory (OM2) |
| Teammates.ai | Raya / Adam / Sara | AI employees: support, sales, recruiting |
| Zamp AI | AI teammate/digital worker line | job-to-end digital workers |
| Klark.ai | AI agents as employees | employee-style agent deployment |
| Enjo.ai | Support agents | customer-support agents |

### Enterprise suites shipping "teammate" agents
- Salesforce — Agentforce (digital labor)
- Zoom — AI Teammates / Custom AI Companion
- Atlassian — Rovo
- ServiceNow — AI Agents
- HubSpot — Breeze Agents
- Slack (Salesforce) — AI workforce in channels
- Microsoft — Copilot agents (Nadella: "tapestry of AI agents acting on our behalf")
- Google — Gemini agentic tools / Jules

### Coding-agent teammates (vertical)
- Cognition — Devin ("your teammate's favorite teammate")
- Cursor — background agents
- GitHub — Copilot Coding Agent + Agent HQ
- Builder.io — Builder (UI-heavy agent, Figma-connected)
- Anthropic — Claude Code
- (Reddit's r/AI_Agents maps 100+ companies in this space — post blocked from scraping, so list here is the evidence-backed subset.)

## Most common features (ranked by prevalence across evidence)

1. **Signs into / acts inside your real tools** — read+write to 50+ connectors (Coworker), GitHub/GitLab/Jira/Linear/Slack (Cursor, Devin, Builder), "signs into your tools" (Grok Bot), Asana integrations. Universal.
2. **End-to-end multi-step task completion** — "problem to merged PR" (Devin), "come back with finished work" (Grok Bot), "finishes multi-step work" (Coworker), "complete business functions" (Teammates.ai).
3. **Runs 24/7 on its own compute / cloud environment** — "own computer" (Grok Bot, Devin), cloud repo clones (Cursor), "keeps working when your laptop is closed."
4. **Persistent memory & learning** — shared memory + Work Graph context (Asana), organizational memory OM2 (Coworker), "keep context… get smarter over time" (Grok Bot), "learn from experience" (Teammates.ai).
5. **Proactive triggers: chat @-mentions, tickets, schedules** — @Devin in thread, watches for issues proactively; Slack/Linear triggers (Cursor); routines on a schedule (Grok Bot); schedule-or-trigger agents (Coworker).
6. **Human-in-the-loop approval gates on risky actions** — approval gates before CRM writes/ticket creation/PR merges (Coworker, Devin, Grok Bot's "nothing sent without approval").
7. **Reports back in your channels** — Slack/Jira updates, chat threads, multi-channel support.
8. **Prebuilt role-based teammates marketplace** — 30+ (Asana), Raya/Adam/Sara, Grok Bot marketplace (Sales Outbound, Talent Scout, Expense Manager, Chief of Staff).
9. **Teaching / onboarding by demonstration or company knowledge** — "Show a Bot how it's done" screen-recording → routine (Grok Bot), "train your teammate" (Teammates.ai), memory synthesis from Slack/CRM/docs (Coworker).
10. **Multi-agent collaboration & handoff** — "Connect the Bots… pass work between themselves" (Grok Bot), teams of Teammates (Asana).
11. **Enterprise security & governance** — fine-grained controls (Devin), SOC 2 Type II / GDPR / CASA (Coworker), CodeQL + repo governance (Copilot), SSO/DLP/encryption (Grok Bot).
12. **Multilingual + multi-channel** — 50+ languages (Teammates.ai), voice/chat/email channels.
13. **Model-agnostic routing across frontier models** — "gets the best from every frontier model" (Devin), routes across OpenAI/Anthropic/Google (Coworker).

## Category taxonomy observed
Chatbot → AI assistant/copilot (one app, session memory) → **AI coworker/teammate (cross-tool, persistent memory, follow-through, approval gates)** → fully autonomous agent (no checkpoints; considered not yet reliable enough to run unsupervised per IBM/Gartner commentary).
