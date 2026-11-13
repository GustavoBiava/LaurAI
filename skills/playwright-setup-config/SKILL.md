---
name: playwright-setup-config
description: Install and configure Playwright Test, write playwright.config.ts (projects, webServer, retries, workers, reporters, baseURL, trace) and organize the test folder. Use when setting up Playwright in a project or tuning its configuration.
---

# Playwright Setup and Configuration

## Install

```sh
npm init playwright@latest        # interactive: config, example test, optional CI workflow
# or manually
npm install -D @playwright/test
npx playwright install            # download browsers (add --with-deps on Linux CI)
npx playwright install chromium   # only one browser
```

`npm init playwright@latest` creates `playwright.config.ts`, a `tests/` folder, and an example spec. Commit the config; keep `test-results/`, `playwright-report/`, `blob-report/`, and `playwright/.auth/` in `.gitignore`.

## Recommended `playwright.config.ts`

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",

  // Run all tests (even within one file) in parallel.
  fullyParallel: true,
  // Fail the build if test.only is left in the source.
  forbidOnly: !!process.env.CI,
  // Retry on CI only; local runs should fail fast and loud.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Never hang forever.
  globalTimeout: 60 * 60 * 1000,

  reporter: process.env.CI ? [["blob"], ["list"]] : "html",

  use: {
    baseURL: "http://localhost:3000",
    // Collect a trace only when a test is retried.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],

  // Start the app before the tests; reuse it locally.
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

Notes:

- **Runner options are top-level**, not inside `use`. `use` holds browser/context options (`baseURL`, `trace`, `viewport`, `locale`, `storageState`, ...).
- `baseURL` lets tests call `page.goto('/login')` and makes `page.route('/api/**')` resolve against it.
- `webServer.url` is polled until it responds; `command` can be an array via multiple entries (`webServer: [{...}, {...}]`) for frontend + API.
- `workers: process.env.CI ? 1 : undefined` is a safe default for small CI runners; raise it (or shard) once the suite is stable. See `playwright-ci-and-scaling`.

## Per-environment config

```ts
use: { baseURL: process.env.BASE_URL ?? "http://localhost:3000" },
```

Run against another environment: `BASE_URL=https://staging.example.com npx playwright test`. On PowerShell: `$env:BASE_URL="https://staging.example.com"; npx playwright test`. Load `.env` files with `dotenv` at the top of the config. Never commit secrets.

## Useful `use` options

| Option                                                              | Purpose                                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `trace`                                                             | `'on-first-retry'` (default recommendation), `'retain-on-failure'`, `'on'`, `'off'` |
| `screenshot`                                                        | `'only-on-failure'`, `'on'`, `'off'`                                                |
| `video`                                                             | `'on-first-retry'`, `'retain-on-failure'`, `'off'`                                  |
| `actionTimeout`/`navigationTimeout`                                 | Per-action / per-navigation limits (default: none / none)                           |
| `locale`, `timezoneId`, `colorScheme`, `geolocation`, `permissions` | Emulation (see `playwright-browser-interactions`)                                   |
| `storageState`                                                      | Reuse a logged-in session                                                           |
| `extraHTTPHeaders`                                                  | Headers added to every request, incl. `request` fixture                             |
| `testIdAttribute`                                                   | Change the attribute used by `getByTestId` (default `data-testid`)                  |
| `ignoreHTTPSErrors`                                                 | Accept self-signed certs in dev                                                     |

## Suggested layout

```
playwright.config.ts
tests/
  auth.setup.ts          # setup project: logs in, saves storageState
  fixtures.ts            # custom test = base.extend<...>()
  pages/                 # page objects
  e2e/*.spec.ts
  api/*.spec.ts
playwright/.auth/        # generated, git-ignored
```

## Timeouts (defaults)

- Test: 30 s (`timeout`), `expect`: 5 s (`expect.timeout`), hooks/fixtures count toward the test timeout.
- Override: `test.setTimeout(60_000)`, `test.slow()` (3x), or `test.describe.configure({ timeout })`.
- Do not raise global timeouts to hide a slow or flaky step; fix the cause.

## Running

```sh
npx playwright test                       # all tests, headless, all projects
npx playwright test tests/e2e/cart.spec.ts
npx playwright test -g "adds an item"     # by title
npx playwright test --project=chromium
npx playwright test --headed --workers=1
npx playwright test --ui                  # UI mode
npx playwright test --last-failed
npx playwright show-report
```

Keep the Playwright package and the downloaded browsers in sync: re-run `npx playwright install` after upgrading `@playwright/test`.
