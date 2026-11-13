<pre>
░██                                           ░███    ░██████
░██                                          ░██░██     ░██
░██          ░██████   ░██    ░██ ░██░████  ░██  ░██    ░██
░██               ░██  ░██    ░██ ░███     ░█████████   ░██
░██          ░███████  ░██    ░██ ░██      ░██    ░██   ░██
░██         ░██   ░██  ░██   ░███ ░██      ░██    ░██   ░██
░██████████  ░█████░██  ░█████░██ ░██      ░██    ░██ ░██████
</pre>

# LaurAI

Import sets of AI agent Skills into your current folder with a single command.

> **Status:** MVP in development. The commands below describe the intended behavior.

## Usage

```sh
npx laurai
```

The CLI is interactive:

1. Pick one or more **Agents** (Claude Code, Codex, Opencode, Kilo Code).
2. Pick one or more **Packs** from the Catalog.
3. Review the summary and confirm.
4. The Skills of the chosen Packs are copied into the current directory.

Requires Node.js 20 or newer and network access.

### Where Skills are copied

| Agent       | Folder             |
| ----------- | ------------------ |
| Claude Code | `.claude/skills/`  |
| Codex       | `.agents/skills/`  |
| Opencode    | `.agents/skills/`  |
| Kilo Code   | `.agents/skills/`  |

Nothing is written outside the current directory. If a Skill folder already exists, the CLI asks whether to overwrite or skip it.

## How it works

The CLI downloads this repository's `main` branch at runtime, so new Skills and Packs are available without a new npm release (see [ADR 0001](docs/adr/0001-fetch-catalog-at-runtime-from-github-main.md)). Everything is validated in a temporary folder first, and the current directory is only written to if the whole import succeeds.

## Concepts

See [GLOSSARY.md](GLOSSARY.md) for the project language: **Skill**, **Pack**, **Agent**, **Catalog**, **Import**.

## Repository layout

```
skills/<name>/SKILL.md   Skills
packs.json               The Catalog: Packs, descriptions and their Skills
src/                     The CLI (TypeScript)
docs/adr/                Architecture decision records
```

## License

MIT
