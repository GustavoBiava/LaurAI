---
name: playwright-ci-and-scaling
description: Run Playwright in CI (GitHub Actions, Docker), tune workers and parallelism, shard tests across machines, merge blob reports, and cache browsers. Use when adding Playwright to a pipeline or when the suite is too slow.
---

# Playwright in CI and Scaling

## CI-ready config

```ts
export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // fail if test.only was committed
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["blob"], ["github"]] : "html",
  use: { trace: "on-first-retry" },
});
```

Always use `npm ci` (lockfile-exact installs) in CI. Browsers are not part of `npm ci`; install them explicitly.

## GitHub Actions (single job)

```yaml
name: Playwright Tests
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/* }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

- `--with-deps` installs OS libraries that browsers need on Linux. Restrict to what you test: `npx playwright install --with-deps chromium`.
- Always upload the report with `if: ${{ !cancelled() }}` so failures keep their traces.
- Set secrets as environment variables from the CI secret store, never in the workflow file.
- Use a `webServer` block in the config so CI starts the app itself, or point `BASE_URL` at a deployed preview.

## Sharding across machines

Split the suite into N parts; each machine runs `--shard=i/N`. Use the `blob` reporter per shard and merge afterwards.

```yaml
jobs:
  playwright-tests:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/* }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: blob-report-${{ matrix.shardIndex }}
          path: blob-report
          retention-days: 1

  merge-reports:
    if: ${{ !cancelled() }}
    needs: [playwright-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/* }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v4
        with:
          name: html-report--attempt-${{ github.run_attempt }}
          path: playwright-report
          retention-days: 14
```

For even shard balance, set `fullyParallel: true` (sharding is by test instead of by file).

## Parallelism

- Files run in parallel across workers; tests inside a file run in order unless `fullyParallel: true` or `mode: 'parallel'`.
- Workers default to 50% of CPU cores. Override with `workers` / `--workers=4` / `--workers=50%`. Start low on shared CI runners.
- Each worker is a separate process with its own browser. Tests must not share mutable data. For one-account-per-worker setups use `testInfo.parallelIndex` / `workerIndex`.
- Run only what changed on PRs: `npx playwright test --only-changed=origin/main`.
- Run a fast tagged subset on every PR (`--grep @smoke`) and the full suite on main or nightly.
- Re-run failures only: `npx playwright test --last-failed`.

## Browser caching

Cache `~/.cache/ms-playwright` (Linux) keyed on the Playwright version to skip the download, but still run `npx playwright install-deps` for system packages. The key must include the exact `@playwright/test` version from the lockfile.

## Docker

Use the official image matching your `@playwright/test` version exactly, so browsers and system libraries are present:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.59.0-noble
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npx", "playwright", "test"]
```

Pin the version tag to your installed Playwright version. Inside containers run as a non-root user or follow the image notes about `--ipc=host` (Chromium can need it) and a seccomp profile for sandboxing. Visual-snapshot baselines should be generated in the same image CI uses.

## Other CI systems

The same pattern applies to GitLab CI, Azure Pipelines, Jenkins and CircleCI: install deps with a lockfile, `npx playwright install --with-deps`, run `npx playwright test`, publish `playwright-report/` and `test-results/` as artifacts, and publish JUnit (`results.xml`) to the platform's test tab. For GitLab, set `parallel: N` and use `--shard=$CI_NODE_INDEX/$CI_NODE_TOTAL`.

## Checklist

- [ ] `forbidOnly`, retries on CI, `trace: 'on-first-retry'`
- [ ] Browsers installed with `--with-deps`; Playwright version and image/cache aligned
- [ ] Reports and traces uploaded even on failure
- [ ] Secrets from the CI store; `.auth` files not committed
- [ ] Global job timeout and `globalTimeout` set
- [ ] Flaky tests tracked and fixed, not just retried
