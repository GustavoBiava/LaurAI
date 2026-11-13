---
name: playwright-assertions-and-waiting
description: Use Playwright web-first assertions, auto-waiting, timeouts, expect.poll, expect.toPass and soft assertions correctly, and replace sleeps and manual waits. Use when tests are flaky, time out, or need to wait for async state.
---

# Playwright Assertions and Waiting

## Auto-waiting (actionability)

Before `click()`, `fill()`, `check()`, etc., Playwright waits until the element:

- resolves to exactly one element,
- is **visible**,
- is **stable** (not animating),
- **receives events** (not covered by another element),
- is **enabled** (and **editable** for `fill`).

If the checks do not pass within the action timeout, a `TimeoutError` is thrown with the failing check in the log. Read that log; it usually names the real cause (covered by a modal, disabled button, detached element).

`click({ force: true })` skips these checks. Use it only when you have proven the overlay is irrelevant (rare); otherwise it hides a bug.

## Web-first assertions

`expect(locator)` and `expect(page)` assertions **retry** until they pass or `expect.timeout` (5 s) elapses.

```ts
await expect(page.getByText("Welcome")).toBeVisible();
await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
await expect(page.getByLabel("Email")).toHaveValue("a@b.co");
await expect(page.getByRole("listitem")).toHaveCount(3);
await expect(page.getByTestId("status")).toHaveText(/paid/i);
await expect(page.locator("#toast")).toBeHidden();
await expect(page).toHaveURL(/\/dashboard$/);
await expect(page).toHaveTitle("Dashboard");
await expect(page.getByRole("checkbox")).toBeChecked();
await expect(locator).toHaveAttribute("aria-expanded", "true");
await expect(locator).toHaveClass(/active/);
await expect(locator).toHaveCSS("color", "rgb(0, 0, 0)");
await expect(locator).toContainText("partial");
await expect(locator).toBeFocused();
```

Negate with `.not`: `await expect(locator).not.toBeVisible()` or use `toBeHidden()`.

### Do not use snapshot-style checks for async state

```ts
// Bad: reads once, never retries
expect(await page.getByText("welcome").isVisible()).toBe(true);
expect(await page.locator("li").count()).toBe(3);
expect(await page.title()).toBe("Home");

// Good
await expect(page.getByText("welcome")).toBeVisible();
await expect(page.locator("li")).toHaveCount(3);
await expect(page).toHaveTitle("Home");
```

`isVisible()`, `textContent()`, `count()`, `innerText()` return immediately. Use them only to branch logic, never as assertions.

## Retrying arbitrary conditions

**`expect.poll`** — poll a value until the assertion passes (e.g., an API becoming consistent):

```ts
await expect
  .poll(async () => (await request.get("/api/jobs/42")).json().then((j) => j.status), {
    message: "job should finish",
    intervals: [500, 1_000, 2_000],
    timeout: 30_000,
  })
  .toBe("done");
```

**`expect(...).toPass()`** — retry a whole block of code until it stops throwing:

```ts
await expect(async () => {
  const res = await page.request.get("/api/export/42");
  expect(res.status()).toBe(200);
}).toPass({ intervals: [1_000, 2_000, 5_000], timeout: 30_000 });
```

Use `toPass` sparingly; prefer a precise assertion on the UI or a `waitForResponse`.

## Waiting on events (set up the wait **before** the trigger)

```ts
const responsePromise = page.waitForResponse(
  (r) => r.url().includes("/api/save") && r.status() === 200,
);
await page.getByRole("button", { name: "Save" }).click();
const response = await responsePromise;

await page.waitForURL("**/dashboard");
await locator.waitFor({ state: "hidden" }); // explicit state wait, when no assertion fits
```

Do not `await` the promise until after the action; otherwise the event may already have fired.

**Never** use `page.waitForTimeout()` (fixed sleeps) or `waitForLoadState('networkidle')` as a readiness check; both are discouraged and flaky. Assert on something the user can see.

## Soft assertions

Report several failures from one test without stopping at the first:

```ts
await expect.soft(page.getByTestId("status")).toHaveText("Success");
await expect.soft(page.getByTestId("eta")).not.toBeEmpty();
// test continues; the test is still marked failed at the end if any soft check failed
```

## Custom messages and configuration

```ts
await expect(locator, "login button should be enabled").toBeEnabled();
const slowExpect = expect.configure({ timeout: 15_000 });
await slowExpect(page.getByText("Report ready")).toBeVisible();
```

Global: `expect: { timeout: 10_000 }` in `playwright.config.ts`.

## Custom matchers

```ts
import { expect as baseExpect } from "@playwright/test";
export const expect = baseExpect.extend({
  async toHaveAmount(locator, expected: number, options?: { timeout?: number }) {
    /* implement with a retrying check; see Playwright docs on custom matchers */
  },
});
```

## Timeout hierarchy

| Level      | Default | Set with                                      |
| ---------- | ------- | --------------------------------------------- |
| Test       | 30 s    | `timeout`, `test.setTimeout()`, `test.slow()` |
| `expect`   | 5 s     | `expect.timeout`, per-call `{ timeout }`      |
| Action     | none    | `use.actionTimeout`, per-call `{ timeout }`   |
| Navigation | none    | `use.navigationTimeout`, `goto({ timeout })`  |
| Whole run  | none    | `globalTimeout`                               |

When something times out, fix the condition being waited on; raising timeouts is the last resort.
