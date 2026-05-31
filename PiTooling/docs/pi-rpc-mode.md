# Pi RPC Mode

> Source: https://pi.dev/docs/latest/rpc

RPC mode runs pi as a headless subprocess controlled via a JSON protocol over `stdin`/`stdout`. It is the integration path for non-Node environments or when you cannot use the SDK directly.

**For this Discord bot (Node.js), prefer the SDK (`createAgentSession`) over RPC mode.** The SDK gives native event objects without serialization overhead and without subprocess management. RPC mode is documented here for completeness and for understanding the event model, which mirrors the SDK exactly.

---

## Protocol

- **Transport:** stdin (commands) / stdout (responses + events)
- **Framing:** strict JSONL — one JSON object per line, `\n` as sole delimiter
  - Strip trailing `\r` to handle Windows line endings
- **Correlation:** commands may include an optional `"id"` field; responses echo it

---

## Command → Response

Send a command to stdin:

```json
{"type": "prompt", "text": "fix the login bug", "id": "cmd-1"}
```

Response arrives on stdout:

```json
{"type": "response", "id": "cmd-1", "success": true}
```

On failure:

```json
{"type": "response", "id": "cmd-1", "success": false, "error": "description"}
```

---

## Commands Reference

### Prompting

| Command | Fields | Notes |
|---|---|---|
| `prompt` | `text`, `images?`, `streamingBehavior?` | Main input; `streamingBehavior` is `"steer"` or `"followUp"` if agent is active |
| `steer` | `text` | Queue directional message during execution; delivered after current tool calls |
| `follow_up` | `text` | Queue message for post-completion processing |
| `abort` | — | Cancel current operation |

### State

| Command | Fields | Notes |
|---|---|---|
| `get_state` | — | Returns model, thinking level, streaming status, session metadata |
| `get_messages` | — | Returns full conversation history |
| `set_session_name` | `name` | Label the current session |

### Model

| Command | Fields |
|---|---|
| `set_model` | `provider`, `model` |
| `cycle_model` | — |
| `get_available_models` | — |

### Session

| Command | Fields |
|---|---|
| `new_session` | — |
| `switch_session` | `sessionFile` |
| `fork` | — (branches from previous user message) |
| `clone` | — |
| `export_html` | — |

### Context

| Command | Fields | Notes |
|---|---|---|
| `compact` | `customInstructions?` | Manual context reduction |
| `set_auto_compaction` | `enabled: boolean` | Toggle automatic compaction |

### Execution

| Command | Fields | Notes |
|---|---|---|
| `bash` | `command` | Run shell command; result included on next `prompt`, not as an event |
| `abort_bash` | — | Stop running bash command |

---

## Event Lifecycle

Events stream asynchronously to stdout. They do **not** include `"id"` fields.

### Typical Sequence

```
{"type": "agent_start"}
{"type": "turn_start"}
{"type": "message_start"}
{"type": "message_update", ...}   ← repeated, streaming deltas
{"type": "message_update", ...}
{"type": "message_end", ...}
{"type": "tool_execution_start", "toolName": "bash"}
{"type": "tool_execution_update", ...}   ← repeated
{"type": "tool_execution_end", "isError": false}
{"type": "turn_end", "message": {...}, "toolResults": [...]}
{"type": "agent_end", "messages": [...]}
```

### Multi-tool turns

If the agent calls multiple tools in one turn, the `tool_execution_*` triplet repeats for each tool before `turn_end` fires.

---

## Event Schemas

### agent_start

```json
{"type": "agent_start"}
```

Fires when the agent begins processing a prompt. No payload beyond `type`.

---

### agent_end

```json
{
  "type": "agent_end",
  "messages": [
    /* array of all new AgentMessage objects produced this run */
  ]
}
```

Fires when all processing is complete. `messages` includes assistant messages and tool result messages from this run.

---

### turn_start

```json
{"type": "turn_start"}
```

Opens a new conversation turn (one LLM response + its tool calls). No payload.

---

### turn_end

```json
{
  "type": "turn_end",
  "message": { /* AssistantMessage */ },
  "toolResults": [
    { /* ToolResultMessage */ },
    ...
  ]
}
```

Closes the turn. Contains the full assistant message and all tool results for this turn.

---

### message_start

```json
{"type": "message_start"}
```

Assistant message begins streaming. No payload.

---

### message_update

```json
{
  "type": "message_update",
  "message": { /* full AssistantMessage so far */ },
  "assistantMessageEvent": {
    "type": "text_delta",   /* or "thinking_delta" | "toolcall_delta" */
    /* delta-specific fields */
  }
}
```

Fires repeatedly during streaming. The `assistantMessageEvent.type` field identifies what changed:

| `assistantMessageEvent.type` | Meaning |
|---|---|
| `"text_delta"` | New assistant text chunk |
| `"thinking_delta"` | New internal thinking chunk |
| `"toolcall_delta"` | Tool call arguments accumulating |

---

### message_end

```json
{"type": "message_end", /* full message data */}
```

Streaming complete for this message.

---

### tool_execution_start

```json
{
  "type": "tool_execution_start",
  "toolName": "bash"
}
```

Fires when the agent invokes a tool. Key field: `toolName`.

---

### tool_execution_update

```json
{
  "type": "tool_execution_update",
  "toolCallId": "tc_abc123",
  "toolName": "bash",
  "args": {"command": "npm test"},
  "partialResult": "Running tests...\n✓ auth"
}
```

Fires repeatedly as the tool produces incremental output. `partialResult` is the accumulated output so far.

---

### tool_execution_end

```json
{
  "type": "tool_execution_end",
  "isError": false
}
```

Fires when the tool finishes. `isError: true` if the tool raised an error.

---

### queue_update

```json
{
  "type": "queue_update",
  "steering": ["message queued via steer()"],
  "followUp": ["message queued via followUp()"]
}
```

Fires when messages are queued during streaming.

---

### compaction_start

```json
{
  "type": "compaction_start",
  "reason": "threshold"   /* "manual" | "threshold" | "overflow" */
}
```

---

### compaction_end

```json
{"type": "compaction_end", "result": { /* CompactionResult */ }}
```

---

### auto_retry_start / auto_retry_end

```json
{"type": "auto_retry_start", "attempt": 2, "delayMs": 3000}
{"type": "auto_retry_end", "attempt": 2}
```

---

## Message Type Definitions

### UserMessage

```typescript
{
  role: "user",
  content: string | ContentBlock[],
  timestamp: string,
  attachments?: Attachment[],
}
```

### AssistantMessage

```typescript
{
  role: "assistant",
  content: Array<TextBlock | ThinkingBlock | ToolCallBlock>,
  usage: { inputTokens: number, outputTokens: number },
  stopReason: string,
  timestamp: string,
}
```

### ToolResultMessage

```typescript
{
  role: "toolResult",
  toolCallId: string,
  toolName: string,
  content: ContentBlock[],
  isError: boolean,
}
```

### BashExecutionMessage

Separate from LLM tool calls (produced by the `bash` command):

```typescript
{
  role: "bashExecution",
  command: string,
  output: string,
  exitCode: number,
  cancelled: boolean,
  truncated: boolean,
}
```

---

## Extension UI Protocol (RPC)

When an extension needs user interaction, it sends an `extension_ui_request` event to stdout:

```json
{
  "type": "extension_ui_request",
  "id": "ui-abc",
  "method": "select",
  "timeout": 30000,
  "options": [...]
}
```

The client responds via stdin matching the `id`:

```json
{"type": "extension_ui_response", "id": "ui-abc", "value": "option-a"}
```

**Dialog methods** (require a response): `select`, `confirm`, `input`, `editor`

**Fire-and-forget** (no response): `notify`, `setStatus`, `setWidget`, `setTitle`, `set_editor_text`

---

## Discord Bot Relevance

For the AiRanch Discord bot, the critical events for driving thread updates are:

| Event | Discord Action |
|---|---|
| `agent_start` | Post "Task started" to thread |
| `tool_execution_start` | Post `[Running: toolName...]` to thread |
| `tool_execution_end` | Optionally update/react to the tool message |
| `agent_end` | Post completion summary; parse `report_result` tool output from `messages` |

The bot uses the SDK (`session.subscribe()`) rather than RPC mode, but the events and payloads are identical — the SDK delivers them as native objects instead of JSONL strings.

See [overview.md](./overview.md) for the full bot architecture.
