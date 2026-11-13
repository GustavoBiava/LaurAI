---
name: playwright-debugging-and-reports
description: Debug and triage failing or flaky Playwright tests with the Trace Viewer, UI mode, Inspector, codegen, console and network logs, plus configure traces, screenshots, video and reporters. Use when a Playwright test fails, flakes, or times out.
---

# Playwright Debugging and Reports

## Triage workflow

1. **Reproduce narrowly.** `npx playwright test path/to/file.spec.ts:42 --project=chromium --workers=1` (or `-g "title"`). Add `--repeat-each=20` to expose flakiness and `--retries=0` to see the first failure.
2. **Read the error and call log.** It lists each actionability check and why it was waiting (e.g., "element is not enabled", "intercepts pointer events", "strict mode violation").
3. **Open the trace.** Most failures are explained there in a minute.
4. **Fix the cause**: wrong locator, missing wait on a condition, shared state, unawaited promise, unmocked network. Not a longer timeout.
5. **Prove the fix**: re-run with `--repeat-each` and in parallel.

## Trace Viewer (primary tool)

A trace has a timeline, DOM snapshots before/after each action, network, console, source, and errors.

```ts
// playwright.config.ts
use: {
  trace: "on-first-retry";
} // or 'retain-on-failure'
```

```sh
npx playwright show-trace test-results/<test>/trace.zip
# or open from the HTML report (the "Trace" attachment)
```

Modes: `'on'` (every run, slow), `'retain-on-failure'`, `'on-first-retry'` (recommended for CI), `'on-all-retries'`, `'off'`. Inspect the action list, click an action to see "Before/After" snapshots, and use the locator picker to try selectors against a frozen DOM.

Programmatic tracing outside the test runner: `context.tracing.start({ screenshots: true, snapshots: true })` … `context.tracing.stop({ path: 'trace.zip' })`.

## UI mode

```sh
npx playwright test --ui
```

Watch mode, time-travel through steps, pick locators, filter by project/tag, and see traces live. Best for local authoring and debugging.

## Inspector and debug mode

```sh
npx playwright test --debug                 # headed, 1 worker, no timeout, Inspector
npx playwright test --debug my.spec.ts:20
```

- `await page.pause();` stops execution at that line and opens the Inspector (step over, pick locator, edit and re-run locators).
- `PWDEBUG=console` exposes a `playwright` object in the browser DevTools console (`playwright.locator(...)`, `playwright.selector(...)`).
- PowerShell: `$env:PWDEBUG="console"; npx playwright test`. Bash: `PWDEBUG=console npx playwright test`.
- VS Code extension: run/debug tests, set breakpoints, "Pick locator", "Record new", "Record at cursor", live trace viewer.

## Codegen (record and pick locators)

```sh
npx playwright codegen https://example.com
npx playwright codegen --device="iPhone 13" --viewport-size=800,600 --save-storage=auth.json https://example.com
```

Records clicks and typing into code and offers assertions (visibility, text, value, ARIA snapshot). Treat the output as a draft: rename, extract page objects, replace brittle locators, and add real assertions.

## Logs and artifacts

```ts
page.on("console", (m) => console.log(`[${m.type()}]`, m.text()));
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
page.on("requestfailed", (r) => console.log("REQ FAILED", r.url(), r.failure()?.errorText));
```

```ts
use: {
  screenshot: "only-on-failure",
  video: "retain-on-failure", // or 'on-first-retry'
  trace: "retain-on-failure",
}
```

Artifacts land in `test-results/` (override with `outputDir`). Attach your own: `await testInfo.attach("response", { body: JSON.stringify(data), contentType: "application/json" })`. Take a manual shot: `await page.screenshot({ path, fullPage: true })`.

## Reporters

```ts
reporter: [
  ["list"],                                   // concise console output
  ["html", { open: "never" }],                // rich report: traces, screenshots, steps
  ["junit", { outputFile: "results.xml" }],   // CI systems
  ["json", { outputFile: "results.json" }],
  ["github"],                                 // GitHub Actions annotations
  ["blob"],                                   // mergeable, for sharded CI
],
```

Open the HTML report: `npx playwright show-report`. Merge shard blobs: `npx playwright merge-reports --reporter html ./all-blob-reports`. Tests that pass only on retry are reported as **flaky**; treat flaky as a bug to fix (`--fail-on-flaky-tests` makes it fail the run).

## Common causes of flakiness

| Symptom                          | Likely cause and fix                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| Passes alone, fails in suite     | Shared state or data collision; isolate, use unique data                                      |
| Passes locally, fails in CI      | Slower machine, different OS fonts/viewport, missing `--with-deps`, snapshots from another OS |
| Intermittent "element not found" | Locator too specific, or asserting before the UI updates; use web-first assertions            |
| "intercepts pointer events"      | Modal/toast/overlay covering it; wait for it to close or fix the overlay                      |
| Random order-dependent failures  | Missing `await`; enable `no-floating-promises` lint                                           |
| Timeouts on first navigation     | Cold dev server; use `webServer.url` readiness and `reuseExistingServer`                      |
| Animation-related misclicks      | Disable animations in test mode (`reducedMotion: 'reduce'`), rely on actionability            |
| Time-dependent failures          | Use `page.clock` to control time                                                              |

Quarantine a known-flaky test with `test.fixme(true, 'JIRA-123')` or a `@flaky` tag while you fix it; never leave it silently retrying.

## CLI cheatsheet

```sh
npx playwright test --headed
npx playwright test --last-failed
npx playwright test --only-changed=origin/main
npx playwright test --list                  # list tests without running
npx playwright test --repeat-each=10 -g "checkout"
npx playwright test --max-failures=1 -x
npx playwright test --trace=on
npx playwright test --update-snapshots
npx playwright show-report
npx playwright show-trace trace.zip
```
