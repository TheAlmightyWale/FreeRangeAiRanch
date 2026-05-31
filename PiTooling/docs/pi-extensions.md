# Pi Extensions

> Source: https://pi.dev/docs/latest/extensions

Extensions are TypeScript modules that expand the agent's capabilities through custom tools, event handling, UI interactions, and command registration. They run with full system permissions — only install from trusted sources.

---

## Discovery

Pi auto-discovers extensions from:

| Location | Scope |
|---|---|
| `~/.pi/agent/extensions/*.ts` | Global (all sessions) |
| `.pi/extensions/*.ts` | Project-local |
| `pi.extensions` in `package.json` | Pi packages |
| `--extension <path>` CLI flag | Per-invocation |
| `extensions` array in `settings.json` | Explicit config |

---

## Factory Pattern

Every extension exports a default factory function that receives the `ExtensionAPI` object:

```typescript
export default function (pi: ExtensionAPI) {
  // register tools, subscribe to events, etc.
}
```

Factories can be `async` to do initialization (e.g. fetch remote config) before the session starts.

---

## Custom Tools

Register tools that the LLM can call:

```typescript
pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does",
  parameters: Type.Object({
    input: Type.String({ description: "The input" }),
  }),
  async execute(args, ctx) {
    return {
      content: "result text sent to LLM",
      details: { /* state for branching support */ },
    };
  },
  renderCall(args, ctx) { /* optional TUI rendering */ },
  renderResult(result, ctx) { /* optional TUI rendering */ },
});
```

Key points:
- Parameters use **TypeBox** schemas (`Type.Object`, `Type.String`, etc.)
- Use `StringEnum` from `@earendil-works/pi-ai` for enum params
- Truncate output to ~50 KB / 2000 lines to avoid context bloat
- Return `details` for any state the tool needs to survive branching
- Implement `prepareArguments()` for backward-compat when params change
- Participate in the file mutation queue to avoid race conditions with other tools
- Add `promptSnippet` and `promptGuidelines` to inject guidance into the system prompt

---

## Event System

Subscribe to lifecycle events via `pi.on(eventName, handler)`.

### Event Sequence (normal prompt cycle)

```
session_start
  └─ resources_discover

input (user types)
  └─ [optional expansion]

before_agent_start   ← inject system prompt additions here
agent_start

  turn_start
    message_start
    message_update (×N, streaming deltas)
    message_end

    [for each tool call]
    tool_execution_start
    tool_execution_update (×N)
    tool_execution_end
  turn_end

agent_end

[session switch]
session_before_switch
session_shutdown
```

### Notable Events for Extension Authors

| Event | Use |
|---|---|
| `session_start` | Reconstruct extension state from past session entries |
| `resources_discover` | Modify the resource discovery set before loading |
| `input` | Intercept / transform user input before skill expansion |
| `before_agent_start` | Inject messages or replace system prompt content |
| `agent_start` / `agent_end` | Lifecycle hooks around the full agent run |
| `tool_result` | Modify tool results before they reach the LLM (chainable across extensions) |
| `session_before_switch` / `session_shutdown` | Clean up before session replacement |

---

## ExtensionContext API (`ctx`)

Available inside event handlers and tool `execute` functions:

### Utilities
| Member | Description |
|---|---|
| `ctx.ui` | Dialogs (`select`, `confirm`, `input`), notifications, status, widgets |
| `ctx.cwd` | Current working directory |
| `ctx.signal` | `AbortSignal` — cancel long work when the session aborts |
| `ctx.sessionManager` | Read-only access to session history |
| `ctx.modelRegistry` | Information about available models |

### Control
| Method | Description |
|---|---|
| `ctx.isIdle()` | True when no agent is running |
| `ctx.abort()` | Cancel the current agent run |
| `ctx.shutdown()` | Shut down the pi process |
| `ctx.compact()` | Trigger context compaction |
| `ctx.getSystemPrompt()` | Read the current system prompt |
| `ctx.getContextUsage()` | Token counts / usage stats |

### Command-only (not available inside tools)
| Method | Description |
|---|---|
| `ctx.waitForIdle()` | Await current agent completion |
| `ctx.newSession()` | Open a fresh session |
| `ctx.fork()` | Branch at a previous message |
| `ctx.navigateTree()` | Move to a different node in the session tree |
| `ctx.switchSession()` | Load a different session file |
| `ctx.reload()` | Reload pi (extensions, settings) |

---

## State Management

Extension state should live in tool result `details`, not in memory, so it survives:
- Session restarts
- Session branching (tree navigation)

On `session_start`, scan past session entries and reconstruct in-memory state from the `details` fields of previous tool results.

---

## Advanced Features

### Provider Registration

```typescript
pi.registerProvider({
  id: "my-provider",
  // OAuth, custom endpoints, streaming implementation
});
```

### Input Interception

The `input` event fires before skill expansion. Return a modified value, handle it entirely, or pass it through unchanged.

### Tool Result Modification

The `tool_result` event lets extensions transform a tool's output before the LLM sees it. Multiple extensions chain their modifications.

### Custom Message Renderers

```typescript
pi.registerMessageRenderer({
  type: "my_message_type",
  render(message, ctx) { /* TUI component */ },
});
```

---

## Mode Awareness

`ctx.hasUI` is `false` in RPC and print modes. Extensions should guard any interactive UI calls behind this flag so they degrade gracefully when running headless.
