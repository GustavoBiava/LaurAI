# LaurAI

A CLI run via `npx` that imports sets of Skills, published in the project's own repository, into the user's current folder.

## Language

**Skill**:
A folder with a `SKILL.md` (and optional supporting files) that teaches an AI coding agent how to perform a task.
_Avoid_: Plugin, command, prompt

**Pack**:
A named set of Skills, with a description, that the user picks as a whole. It is the unit of choice in the CLI.
_Avoid_: Bundle, kit, collection, package (reserved for the npm package)

**Agent**:
An AI coding tool that reads Skills from its own folder inside the current directory (Claude Code, Codex, Opencode, Kilo Code). The user picks one or more target Agents before picking Packs.
_Avoid_: Assistant, tool, IDE, target

**Catalog**:
The list of all available Packs, defined in the repository's `packs.json` manifest.
_Avoid_: Registry, index

**Import**:
To copy the Skills of a chosen Pack into the user's current folder.
_Avoid_: Install, clone
