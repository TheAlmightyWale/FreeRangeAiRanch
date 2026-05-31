# Pi Packages

> Source: https://pi.dev/docs/latest/packages

Pi packages bundle extensions, skills, prompt templates, and themes for sharing via npm or git.

---

## Installing Packages

```bash
pi install npm:@foo/bar@1.0.0          # pinned npm package
pi install git:github.com/user/repo@v1  # git tag/commit
pi install https://github.com/user/repo # HTTPS git
pi install /absolute/path/to/package    # local path
pi install ./relative/path              # relative path (local dev)
```

Flags:
- `-l` — write to project settings (`.pi/settings.json`) for team sharing
- Default — writes to user settings (`~/.pi/agent/settings.json`)
- `-e npm:@foo/bar` — test a package temporarily without persisting

---

## Managing Packages

```bash
pi remove npm:@foo/bar    # uninstall
pi list                   # show installed packages
pi update                 # refresh pi and all packages
pi update --self          # update only the pi CLI
pi config                 # enable/disable individual resources per package
```

---

## Package Sources

### npm
Format: `npm:@scope/pkg@1.2.3`
- Installs to `~/.pi/agent/npm/` (user) or `.pi/npm/` (project)
- Versioned specs stay pinned during `pi update`
- Unversioned specs update freely

### Git
Formats: `git:github.com/user/repo@v1`, `https://...@v1`, `ssh://git@...@v1`
- Both HTTPS and SSH supported (SSH uses configured keys automatically)
- Refs pin to tags or commits
- Clones to `~/.pi/agent/git/<host>/<path>`

### Local paths
- Single `.ts` / `.js` file → loaded as an extension directly
- Directory → uses package discovery rules

---

## Creating a Package

Minimal `package.json`:

```json
{
  "name": "my-pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

Include `"pi-package"` in `keywords` to appear in the gallery.

Paths support glob patterns and exclusions:

```json
{
  "pi": {
    "extensions": ["./extensions/**/*.ts", "!./extensions/legacy.ts"]
  }
}
```

---

## Conventional Directory Structure

Without a `pi` manifest key, pi auto-discovers from standard directories:

```
my-package/
├── extensions/     ← .ts and .js files loaded as extensions
├── skills/         ← directories containing SKILL.md
├── prompts/        ← .md files loaded as prompt templates
└── themes/         ← .json files loaded as themes
```

---

## Dependencies

- Core pi packages (`@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, etc.) go in `peerDependencies` with `"*"` range — do not bundle them
- Other pi packages you depend on must be bundled and referenced through `node_modules/` paths (packages load with separate module roots)

---

## User Filtering of Package Resources

Users can filter what a package contributes to their session:

```json
{
  "source": "npm:my-package",
  "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
  "skills": [],
  "prompts": ["prompts/review.md"],
  "themes": ["+themes/legacy.json"]
}
```

| Syntax | Meaning |
|---|---|
| `"pattern"` | Include matching paths |
| `"!pattern"` | Exclude matching paths |
| `"+path"` | Force-include |
| `"-path"` | Force-exclude |
| `[]` | Load nothing of that type |

---

## Scope and Deduplication

When the same package appears in both global and project settings, the project entry takes precedence. Identity matching uses:
- npm → package name
- git → repository URL without ref
- local → resolved absolute path

---

## Gallery Metadata

```json
{
  "pi": {
    "video": "https://example.com/demo.mp4",
    "image": "https://example.com/screenshot.png"
  }
}
```

Video (MP4 only) takes precedence over image and autoplays on hover. Images: PNG, JPEG, GIF, WebP.

---

## Security

Pi packages run with full system access. Extensions execute arbitrary code, and skills can instruct the model to run executables. Review source before installing third-party packages.
