---
status: accepted
---

# Fetch the Catalog at runtime from the GitHub `main` branch

The CLI downloads the repository tarball from the `main` branch of `github.com/GustavoBiava/LaurAI` on every run, instead of bundling Skills and Packs inside the npm package. This way the Catalog and the Skills can change without publishing a new npm version, and users running `npx laurai` always see the current content.

## Considered Options

- **Bundle content in the npm tarball**: works offline and is versioned together with the CLI, but every content change requires an npm release.
- **Fetch from a Git tag matching the CLI version**: predictable, but the Catalog would only change on npm releases, losing the benefit of runtime fetching.
- **Fetch one file at a time via the GitHub API/raw URLs**: subject to the unauthenticated rate limit (60 requests/hour) and many round trips.
- **`git clone`**: requires git on the user's machine and downloads the whole history.

## Consequences

- The CLI code (npm) and the Catalog (GitHub) evolve independently, so `packs.json` carries a `schemaVersion`. If the CLI does not understand it, it aborts and tells the user to run `npx laurai@latest`.
- The CLI needs network access; there is no offline mode.
- A broken commit on `main` is immediately visible to every user, so the repository tests must check that every Skill referenced in `packs.json` exists in `skills/`.
- The CLI downloads and validates everything in a temporary folder and only writes to the current directory if it all succeeds.
