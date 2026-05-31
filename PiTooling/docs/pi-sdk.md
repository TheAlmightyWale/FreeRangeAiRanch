# Pi SDK

> Source: https://pi.dev/docs/latest/sdk

The Pi SDK embeds the agent programmatically in Node.js applications. It is the recommended integration path for custom interfaces, automated pipelines, and testing. The Discord bot in this repo uses the SDK directly rather than spawning a pi subprocess.

---

## Installation

```bash
npm install @earendil-works/pi-coding-agent
```

---

## Core Factory Functions

| Function | Purpose |
|---|---|
| `createAgentSession(options)` | Create a single agent session |
| `createAgentSessionRuntime(options)` | Manage session lifecycle across replacements (new session, fork, import, switch) |

For the Discord bot use case (one active session at a time, cwd-bound), `createAgentSession` is sufficient.

---

## createAgentSession() Options

```typescript
interface CreateAgentSessionOptions {
  // Directories
  cwd?: string;                      // Default: process.cwd()
  agentDir?: string;                 // Default: ~/.pi/agent

  // Model & Thinking
  model?: Model;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  scopedModels?: Array<{ model: Model; thinkingLevel: ThinkingLevel }>;

  // Auth & Registry
  authStorage: AuthStorage;          // Use AuthStorage.create()
  modelRegistry: ModelRegistry;      // Use ModelRegistry.create()

  // Tools
  tools?: string[];                  // e.g. ["read", "bash", "edit", "write", "grep", "find", "ls"]
  customTools?: ToolDefinition[];
  excludeTools?: string[];
  noTools?: "all" | "builtin";

  // Resource Loading
  resourceLoader?: ResourceLoader;   // Custom or DefaultResourceLoader

  // Session & Settings
  sessionManager: SessionManager;
  settingsManager?: SettingsManager;
}
```

**Auth priority:** runtime overrides → `auth.json` → environment variables → fallback resolver.

**Model config:** Ollama models are configured in `~/.pi/agent/models.json`, not via env vars. Pass the registered model ID to `modelRegistry.find()` at runtime.

---

## AgentSession Interface

### Prompting

```typescript
// Send a prompt and await completion
await session.prompt("fix the login bug");

// Options
await session.prompt("...", {
  expandPromptTemplates?: boolean,
  images?: ImageContent[],
  streamingBehavior?: "steer" | "followUp",
  source?: InputSource,
  preflightResult?: (success: boolean) => void,  // fires once per prompt()
});

// Queue during active streaming
await session.steer("focus on the auth module");
await session.followUp("also update the tests");
```

### Subscribing to Events

```typescript
const unsubscribe = session.subscribe((event) => {
  switch (event.type) {
    case "agent_start":   /* ... */ break;
    case "agent_end":     /* ... */ break;
    case "turn_start":    /* ... */ break;
    case "turn_end":      /* ... */ break;
    case "message_start": /* ... */ break;
    case "message_update":/* ... */ break;
    case "message_end":   /* ... */ break;
    case "tool_execution_start":  /* ... */ break;
    case "tool_execution_update": /* ... */ break;
    case "tool_execution_end":    /* ... */ break;
    case "queue_update":          /* ... */ break;
    case "compaction_start":      /* ... */ break;
    case "compaction_end":        /* ... */ break;
    case "auto_retry_start":      /* ... */ break;
    case "auto_retry_end":        /* ... */ break;
  }
});

// Clean up when done
unsubscribe();
```

### Model Management

```typescript
await session.setModel(model);
session.setThinkingLevel("medium");
await session.cycleModel();
session.cycleThinkingLevel();
```

### State Access

```typescript
session.model           // current Model
session.thinkingLevel   // current ThinkingLevel
session.messages        // AgentMessage[] history
session.isStreaming     // boolean
session.sessionId       // string
session.sessionFile     // string | undefined
```

### Navigation & Compaction

```typescript
// Branch from a previous message
await session.navigateTree(targetId, {
  summarize?: boolean,
  customInstructions?: string,
  label?: string,
});

// Compress context
await session.compact(customInstructions?);
session.abortCompaction();
```

### Cleanup

```typescript
await session.abort();   // cancel current operation
session.dispose();       // release resources
```

---

## Event Reference

### Full Event Sequence (normal turn)

```
agent_start
  turn_start
    message_start
    message_update  (type: "text_delta")
    message_update  (type: "thinking_delta")
    message_update  (type: "toolcall_delta")
    message_end
    tool_execution_start
    tool_execution_update  ×N
    tool_execution_end
  turn_end
agent_end
```

### Event Payloads

| Event | Key Payload Fields |
|---|---|
| `agent_start` | minimal envelope |
| `agent_end` | `messages: AgentMessage[]` — all new messages from this run |
| `turn_start` | turn initialization marker |
| `turn_end` | `message` (assistant response), `toolResults: ToolResult[]` |
| `message_start` | message initialization |
| `message_update` | `assistantMessageEvent` with `type` field + delta payload |
| `message_end` | full message data |
| `tool_execution_start` | `toolName: string` |
| `tool_execution_update` | `toolCallId`, `toolName`, `args`, `partialResult` |
| `tool_execution_end` | `isError: boolean` |
| `queue_update` | `steering: string[]`, `followUp: string[]` |
| `compaction_start` | `reason: "manual" \| "threshold" \| "overflow"` |
| `compaction_end` | compaction result |
| `auto_retry_start` | `attempt: number`, `delayMs: number` |
| `auto_retry_end` | retry result |

### message_update delta types

| `type` | Meaning |
|---|---|
| `"text_delta"` | Streaming assistant text |
| `"thinking_delta"` | Streaming internal thinking |
| `"toolcall_delta"` | Streaming tool call arguments |

---

## Session Management

```typescript
// In-memory (no persistence, good for testing)
const sessionManager = SessionManager.inMemory();

// Persistent (saves to disk)
const sessionManager = await SessionManager.create(cwd);

// Continue the most recent session
const sessionManager = await SessionManager.continueRecent(cwd);

// List sessions
const sessions = await SessionManager.list(cwd);
const all = await SessionManager.listAll(cwd);
```

---

## Settings Management

```typescript
// Load from global + project JSON files (merged)
const settingsManager = await SettingsManager.create(cwd);

// In-memory (for testing)
const settingsManager = SettingsManager.inMemory();

// Persist any changes
await settingsManager.flush();
```

---

## Resource Loader Customization

```typescript
const resourceLoader = new DefaultResourceLoader({
  additionalExtensionPaths: ["./my-extensions"],
  extensionFactories: [(pi) => { /* inline extension */ }],
  systemPromptOverride: async (ctx) => "custom system prompt",
  skillsOverride: (skills) => skills.filter(...),
  agentsFilesOverride: (files) => [...files, myContextFile],
  promptsOverride: (prompts) => prompts,
  eventBus: sharedEventBus,   // for cross-extension communication
});
```

---

## Run Modes

Three higher-level modes built on `createAgentSessionRuntime()`:

| Mode | Description |
|---|---|
| `InteractiveMode` | Full TUI — for the pi CLI itself |
| `runPrintMode` | Single-shot, outputs result to stdout |
| `runRpcMode` | JSON-RPC subprocess integration (see RPC Mode docs) |

For the Discord bot, use `createAgentSession()` directly — it gives full event access without the overhead of the higher-level modes.

---

## Minimal Integration Example

```typescript
import {
  createAgentSession,
  AuthStorage,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const authStorage = await AuthStorage.create();
const modelRegistry = await ModelRegistry.create();
const sessionManager = SessionManager.inMemory();

const session = await createAgentSession({
  cwd: "/path/to/repo",
  authStorage,
  modelRegistry,
  sessionManager,
  model: modelRegistry.find("qwen3:35b"),
  tools: ["read", "bash", "edit", "write", "grep"],
});

const unsubscribe = session.subscribe((event) => {
  if (event.type === "tool_execution_start") {
    console.log(`Running: ${event.toolName}`);
  }
  if (event.type === "agent_end") {
    console.log("Done.");
  }
});

await session.prompt("fix the login bug");
unsubscribe();
session.dispose();
```
