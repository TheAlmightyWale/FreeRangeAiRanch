# Pi Themes

> Source: https://pi.dev/docs/latest/themes

Pi uses JSON theme files to customize TUI colors. Themes hot-reload on edit — no restart required.

---

## Theme Locations

| Location | Scope |
|---|---|
| Built-in `dark` / `light` | Always available |
| `~/.pi/agent/themes/*.json` | Global |
| `.pi/themes/*.json` | Project-local |
| `themes/` in a Pi package | Package-provided |
| `pi.themes` entries in `package.json` | Package-provided |
| `themes` array in `settings.json` | Explicit config |
| `--theme <path>` CLI flag | Per-invocation |
| `--no-themes` | Disables all discovery |

---

## Selecting a Theme

Via `/settings` menu, or in `settings.json`:

```json
{
  "theme": "my-theme"
}
```

Pi auto-detects terminal background on first launch and defaults to `dark` or `light` accordingly.

---

## Creating a Custom Theme

```bash
mkdir -p ~/.pi/agent/themes
vim ~/.pi/agent/themes/my-theme.json
```

Minimal structure:

```json
{
  "$schema": "https://pi.dev/schemas/theme.json",
  "name": "my-theme",
  "vars": {
    "base": "#1a1b26",
    "blue": "#7aa2f7"
  },
  "colors": {
    "accent": "blue",
    "text": "#c0caf5",
    "...": "..."
  }
}
```

---

## Color Value Formats

| Format | Example | Notes |
|---|---|---|
| Hex | `"#ff0000"` | 6-digit RGB |
| 256-color | `42` | Integer 0–255 from xterm palette |
| Variable reference | `"blue"` | References a key in `vars` |
| Default | `""` | Uses terminal's default color |

---

## All 51 Required Color Tokens

### Core UI (11)
`accent` `border` `borderAccent` `borderMuted` `success` `error` `warning` `muted` `dim` `text` `thinkingText`

### Backgrounds & Content (11)
`selectedBg` `userMessageBg` `userMessageText` `customMessageBg` `customMessageText` `customMessageLabel` `toolPendingBg` `toolSuccessBg` `toolErrorBg` `toolTitle` `toolOutput`

### Markdown (10)
`mdHeading` `mdLink` `mdLinkUrl` `mdCode` `mdCodeBlock` `mdCodeBlockBorder` `mdQuote` `mdQuoteBorder` `mdHr` `mdListBullet`

### Tool Diffs (3)
`toolDiffAdded` `toolDiffRemoved` `toolDiffContext`

### Syntax Highlighting (9)
`syntaxComment` `syntaxKeyword` `syntaxFunction` `syntaxVariable` `syntaxString` `syntaxNumber` `syntaxType` `syntaxOperator` `syntaxPunctuation`

### Thinking Level Borders (6)
`thinkingOff` `thinkingMinimal` `thinkingLow` `thinkingMedium` `thinkingHigh` `thinkingXhigh`

### Bash Mode (1)
`bashMode`

### HTML Export (optional)
`pageBg` `cardBg` `infoBg`

---

## Terminal Compatibility

Pi uses 24-bit RGB (truecolor). Supported terminals: iTerm2, Kitty, WezTerm, Windows Terminal, VS Code. Legacy 256-color terminals receive automatic approximation fallbacks.

Verify support: `echo $COLORTERM` should print `truecolor` or `24bit`.

VS Code users: set `terminal.integrated.minimumContrastRatio` to `1` for accurate color rendering.

---

## Best Practices

- Build a base palette in `vars` (e.g. Nord, Gruvbox, Tokyo Night) and reference those variables in `colors`
- Test across messages, tool states, markdown, and wrapped text
- Use bright/saturated colors for dark terminals; darker/muted for light terminals
