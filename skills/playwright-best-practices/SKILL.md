---
name: playwright-best-practices
description: Core rules for writing reliable Playwright tests and the entry point to the other playwright-* Skills. Use whenever the user writes, reviews, or fixes Playwright (@playwright/test) tests, or asks how to make browser tests less flaky.
---

# Playwright Best Practices

Start here for any Playwright task. These rules apply to every test; the sibling Skills go deeper.

## The rules

1. **Test what the user sees.** Drive and assert through user-facing behavior (roles, labels, visible text), not implementation details like CSS classes, DOM depth, or component internals.
2. **Prefer role-based locators.** `getByRole` first, then `getByLabel`/`getByText`/`getByPlaceholder`, then `getByTestId`. CSS/XPath is the last resort. See `playwright-locators`.
3. **Use web-first assertions.** `await expect(locator).toBeVisible()` retries until it passes. Never `expect(await locator.isVisible()).toBe(true)`: it checks once and flakes. See `playwright-assertions-and-waiting`.
4. **Never sleep.** No `page.waitForTimeout()`. Playwright auto-waits for actionability; wait on a condition (assertion, response, URL) instead.
5. **Keep tests isolated.** Each test gets a fresh `BrowserContext` (cookies, storage, cache). A test must pass alone, in any order, and in parallel. Do not rely on state left by another test.
6. **Control what you do not own.** Mock third-party/flaky network calls with `page.route`. Do not test external sites you do not control. See `playwright-network-and-api`.
7. **Set up state through the API or storage state, not the UI.** Log in once in a setup project and reuse `storageState`; create data with `request` instead of clicking through forms. See `playwright-fixtures-and-pom`.
8. **Always `await` Playwright calls.** A missing `await` is the most common source of "random" failures. Enable the `@typescript-eslint/no-floating-promises` lint rule.
9. **Keep tests small and independent.** One behavior per test, descriptive titles, `test.step()` to structure long flows.
10. **Debug with traces, not guesses.** Record a trace on retry and open it in the Trace Viewer. See `playwright-debugging-and-reports`.

## Minimal good test

```ts
import { test, expect } from "@playwright/test";

test("adds an item to the cart", async ({ page }) => {
  await page.goto("/products");

  const product = page.getByRole("listitem").filter({ hasText: "Product 2" });
  await product.getByRole("button", { name: "Add to cart" }).click();

  await expect(page.getByRole("status")).toHaveText("1 item in cart");
});
```

## Anti-patterns to flag and fix

| Anti-pattern                                          | Replace with                                 |
| ----------------------------------------------------- | -------------------------------------------- |
| `await page.waitForTimeout(2000)`                     | A web-first assertion or `waitForResponse`   |
| `expect(await el.isVisible()).toBe(true)`             | `await expect(el).toBeVisible()`             |
| `page.locator('div > div:nth-child(3) .btn-primary')` | `page.getByRole('button', { name: '...' })`  |
| `click({ force: true })` to silence a failure         | Find why the element is covered/disabled     |
| Tests that depend on each other (`serial` by habit)   | Independent tests with their own setup       |
| Logging in through the UI in every test               | Setup project + `storageState`               |
| Hard-coded absolute URLs                              | `baseURL` in config and `page.goto('/path')` |
| `test.only` committed                                 | `forbidOnly: !!process.env.CI` in config     |
| Asserting on third-party live data                    | Mock the response with `page.route`          |

## Which Skill next?

| Task                                                    | Skill                               |
| ------------------------------------------------------- | ----------------------------------- |
| Install, configure, project layout                      | `playwright-setup-config`           |
| Finding elements                                        | `playwright-locators`               |
| Assertions, waits, timeouts, polling                    | `playwright-assertions-and-waiting` |
| Fixtures, page objects, auth, hooks, tags               | `playwright-fixtures-and-pom`       |
| Mocking, HAR, API testing                               | `playwright-network-and-api`        |
| Dialogs, iframes, uploads, downloads, popups, emulation | `playwright-browser-interactions`   |
| Screenshot and ARIA snapshots, accessibility            | `playwright-snapshots-visual-a11y`  |
| Failing or flaky tests, traces, reports                 | `playwright-debugging-and-reports`  |
| CI, sharding, Docker, parallelism                       | `playwright-ci-and-scaling`         |
| Scripting a browser, MCP, codegen, AI agents            | `playwright-agent-workflows`        |
