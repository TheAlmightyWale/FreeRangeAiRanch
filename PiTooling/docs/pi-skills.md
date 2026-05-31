# Pi Skills

> Source: https://pi.dev/docs/latest/skills

Pi implements the Agent Skills standard. Skills are self-contained capability packages that load on demand — they bundle specialized workflows, setup instructions, helper scripts, and reference documentation for specific tasks.

---

## Discovery Locations

Pi scans these locations in order:

| Location | Scope |
|---|---|
| `~/.pi/agent/skills/` | Global |
| `~/.agents/skills/` | Global (shared with other tools) |
| `.pi/skills/` | Project-local |
| `.agents/skills/` | Project-local (shared) |
| `skills/` in a Pi package | Package-provided |
| `pi.skills` entries in `package.json` | Package-provided |
| `skills` array in `settings.json` | Explicit config |
| `--skill <path>` CLI flag | Per-invocation |

**Discovery rules:**
- In `.pi/` directories: root `.md` files are individual skills
- In all locations: directories containing a `SKILL.md` are discovered recursively

---

## How Skills Load

1. At startup, Pi scans all locations and extracts `name` + `description` from each skill's frontmatter.
2. Available skills are listed in the system prompt in XML format.
3. When the agent determines a skill is relevant, the full `SKILL.md` body is loaded and followed.
4. Scripts and assets referenced from `SKILL.md` use relative paths within the skill directory.

---

## Skill Commands

Skills can be invoked directly by users via `/skill:name [args]` slash commands. Arguments are appended as user content. Enable this via `/settings` or in `settings.json`.

---

## SKILL.md Format

Every skill directory needs a `SKILL.md` file:

```markdown
---
name: my-skill                   # required: lowercase, hyphens, 1-64 chars
description: |                   # required: max 1024 chars — be specific
  Extracts text and tables from PDF files, fills PDF forms, and merges
  multiple PDFs. Use when working with PDF documents.
license: MIT                     # optional
compatibility: node>=18          # optional
metadata:                        # optional arbitrary key-value
  author: "Acme Corp"
allowed-tools:                   # optional pre-approved tools
  - bash
  - read
disable-model-invocation: true   # optional: hide from system prompt
---

# My Skill

Instructions for the agent go here. Reference scripts with relative paths:

```bash
node ./search.js "{{query}}"
```
```

---

## Name Rules

- Lowercase letters, numbers, hyphens only
- No leading, trailing, or consecutive hyphens
- 1–64 characters
- Must be unique across all discovered skills (first discovery wins on collision)

---

## Description Best Practices

Be specific about what the skill does and when to use it:

```
# Good
Extracts text and tables from PDF files, fills PDF forms, and merges
multiple PDFs. Use when working with PDF documents.

# Bad
Helps with PDFs.
```

---

## Example Directory Structure

```
brave-search/
├── SKILL.md         ← required
├── search.js        ← referenced from SKILL.md
└── content.js       ← supporting script
```

---

## Security

Skills can instruct the model to perform any action and may include executable code the model invokes. Review skill content before use, especially from third-party packages.

---

## Available Skill Repositories

| Source | Skills |
|---|---|
| Anthropic | Document processing (docx, pdf, pptx, xlsx), web development |
| Pi | Web search, browser automation, Google APIs, transcription |
