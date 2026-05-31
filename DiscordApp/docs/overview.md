# AiRanch Discord Bot — Project Overview

## Goal

A Discord bot that acts as an observable interface for a PI coding agent. Users submit tasks via Discord; the agent runs locally and streams its progress into a dedicated thread. Multiple bot instances run on the same Discord server, each assigned to its own channel, so different agents or projects can operate independently and visibly.

---

## Phase 1 — Single Repo, Defined Context

A working end-to-end pipeline for one specific repository.

**What a user does:**
1. Types `/task <description>` in a bot's designated channel
2. A thread is created automatically in that channel for that task
3. The PI agent starts and its activity appears in the thread in real time
4. When the agent finishes, the thread receives a completion summary

**What the user does not do:**
- Interact mid-task (fire and forget)
- Approve or deny individual tool calls

---

## Phase 2 — Generic Automated Task System

The pipeline becomes repo-agnostic and task intake becomes automated.

Each task submitted to the system specifies:
- **Repository** — URL or local path to clone/checkout
- **Context package** — project documentation, relevant file excerpts, task-specific instructions
- **Task description** — what the agent should accomplish

Tasks may arrive from Discord or from an automated source (CI event, scheduled job, external API call). The agent is provisioned with enough context to compensate for the lower reasoning capacity of the model.

---

## Multi-Bot Design

Multiple instances of this bot run concurrently on the same Discord server. Each instance:
- Is a **separate Discord application** with its own token and public key
- Is assigned to exactly **one Discord channel** via configuration
- Creates all task threads within that channel
- Only responds to `/task` commands issued in its assigned channel

This gives each project or agent its own visible space in the server without them interfering with each other.

```
Discord Server
├── #agent-alpha      ← Bot A (Repo X, Qwen3.6 35B)
│     └── threads...
├── #agent-beta       ← Bot B (Repo Y, Qwen3.6 35B)
│     └── threads...
└── #agent-gamma      ← Bot C (future / Phase 2)
      └── threads...
```

### Per-Instance Configuration

Each bot instance is configured via environment variables (`.env`):

| Variable | Description |
|---|---|
| `APP_ID` | Discord application ID for this bot |
| `DISCORD_TOKEN` | Bot token for this bot |
| `PUBLIC_KEY` | Public key for verifying Discord requests |
| `CHANNEL_ID` | The Discord channel ID this bot instance owns |
| `PORT` | HTTP port for this instance (must be unique per instance) |
| `AGENT_WORK_DIR` | Filesystem path the agent operates in |
| `AGENT_SYSTEM_PROMPT` | Additional system prompt injected into every agent session |
| `OLLAMA_MODEL` | Model ID as registered in Ollama (must match `ollama list`) |

Channel enforcement is handled in the interactions handler: commands sent from any channel other than `CHANNEL_ID` are silently ignored.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Discord Server                                         │
│                                                         │
│  #agent-alpha                                           │
│    /task "fix the login bug"  ────────────────────┐    │
│                                                   │    │
│    Thread: "fix the login bug"                    │    │
│      [Running: bash...]                           │    │
│      [Running: write_file...]                     │    │
│      ╔══════════════════════════╗                 │    │
│      ║  Task complete  ✓        ║  (summary)      │    │
│      ╚══════════════════════════╝                 │    │
└───────────────────────────────────────────────────┼────┘
                                                    │
                                        ┌───────────▼──────────┐
                                        │  Bot Instance A       │
                                        │  (Node.js / Express)  │
                                        │  PORT=3001            │
                                        │  CHANNEL_ID=abc123    │
                                        │                       │
                                        │  POST /interactions   │
                                        │                       │
                                        │  PI AgentSession      │
                                        │  (in-process)         │
                                        └───────────┬───────────┘
                                                    │ HTTP
                                        ┌───────────▼───────────┐
                                        │  Ollama               │
                                        │  Model: Qwen3.6 35B   │
                                        └────────────────────────┘
```

---

## Components

### Discord Bot (`app.js`)

- Receives slash commands via `POST /interactions`
- Enforces that commands only run in `CHANNEL_ID`
- Manages a task queue; dequeues and starts one task at a time
- Starts a PI `AgentSession` for each task (in-process, no subprocess)
- Subscribes to PI session events and posts progress to the task's thread
- Posts a structured completion summary when the agent calls `report_result`

### PI Coding Agent

- Runs in-process via the `@earendil-works/pi-coding-agent` SDK
- Uses Qwen3.6 35B through Ollama (OpenAI-compatible API)
- Events (tool start, tool end, session end) arrive via `session.subscribe()`
- A custom `report_result` tool allows the agent to explicitly report structured output (summary, PR URLs, notes) back to Discord

### Context Package (Phase 1)

Since the model is lower-powered relative to the task complexity, each agent run is provisioned with:
- A project-level `AGENTS.md` describing the repo, conventions, and constraints
- A task-specific instruction block prepended to the prompt
- Relevant file excerpts or summaries where needed

---

## Discord UX Design

- **One channel per bot instance** — each agent or project has its own space
- **One thread per task** — output is isolated and readable per task
- **Plain messages for routine progress** — tool calls, status updates
- **Structured summary on completion** — the agent explicitly calls `report_result` with a summary, URLs, and notes
- **Thread auto-archives** after 60 minutes of inactivity
- Bot silently ignores commands outside its assigned channel

---

## Resolved Design Decisions

### Agent Harness — PI SDK (in-process)

The bot uses the `@earendil-works/pi-coding-agent` SDK directly rather than spawning an agent subprocess. The `AgentSession` is created in-process and events arrive as native objects via `session.subscribe()`. This removes subprocess management, IPC serialization, and the need for a separate webhook receiver endpoint.

Ollama is configured via `~/.pi/agent/models.json` (not env vars). The `OLLAMA_MODEL` env var is passed to `createAgentSession` at runtime to select the model.

### Concurrency — One Task at a Time

Each bot instance processes one task at a time. Additional `/task` commands received while a task is running are queued and started when the current task's session ends.

This keeps state management simple and avoids resource contention between agent sessions on the same machine.

### Output Verbosity — Milestone Events Only

The bot subscribes to tool start and tool end events, posting a short message for each. Full tool output is not forwarded to Discord — the agent's explicit `report_result` call is the primary structured output channel.

### Bot Provisioning (Phase 2) — Undecided

Deferred. Will be revisited when Phase 2 scope is defined.

---

## Open Questions

- **Repo provisioning (Phase 2):** Clone fresh per task, or maintain a working copy and reset between tasks?
- **Context delivery (Phase 2):** Static `AGENTS.md` file, or dynamically assembled context from a database of project/task templates?
