---
name: playwright-fixtures-and-pom
description: Structure Playwright suites with custom fixtures, Page Object Models, authentication via storageState and setup projects, hooks, tags, annotations, and parameterized tests. Use when organizing test code, sharing login state, or reducing duplication.
---

# Playwright Fixtures, Page Objects and Auth

## Built-in fixtures

`page`, `context`, `browser`, `browserName`, `request` (API context), `baseURL`. Each test gets a fresh `context`/`page`; that is the isolation guarantee. Only request the fixtures you use.

## Custom fixtures (preferred over `beforeEach` duplication)

Fixtures are lazy, composable, and tear themselves down after `use()`.

```ts
// tests/fixtures.ts
import { test as base, expect } from "@playwright/test";
import { TodoPage } from "./pages/todo-page";

type Fixtures = { todoPage: TodoPage };

export const test = base.extend<Fixtures>({
  todoPage: async ({ page }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await use(todoPage);
    // teardown (runs even if the test failed)
    await todoPage.removeAll();
  },
});

export { expect };
```

```ts
import { test, expect } from "./fixtures";

test("adds a todo", async ({ todoPage }) => {
  await todoPage.addToDo("buy milk");
  await expect(todoPage.items).toHaveText(["buy milk"]);
});
```

- **Scope:** default is per-test. Use `{ scope: 'worker' }` for expensive shared resources (one per worker process, e.g., a DB connection or a per-worker account).
- **Auto fixtures:** `[async ({ page }, use) => {...}, { auto: true }]` run for every test (e.g., fail on console errors).
- **Options fixtures:** `[defaultValue, { option: true }]` make values configurable per project via `use`.
- Combine suites with `mergeTests(testA, testB)`.

## Page Object Model

Wrap a page's locators and actions in a class; keep assertions mostly in tests (or in clearly named `expect...` helpers).

```ts
import type { Page, Locator } from "@playwright/test";

export class TodoPage {
  readonly input: Locator;
  readonly items: Locator;

  constructor(public readonly page: Page) {
    this.input = page.getByPlaceholder("What needs to be done?");
    this.items = page.getByTestId("todo-item");
  }

  async goto() {
    await this.page.goto("/todomvc/");
  }

  async addToDo(text: string) {
    await this.input.fill(text);
    await this.input.press("Enter");
  }

  async remove(text: string) {
    const todo = this.items.filter({ hasText: text });
    await todo.hover();
    await todo.getByLabel("Delete").click();
  }
}
```

Guidelines: define locators once in the constructor, expose intent-level methods (`login`, `addToDo`), do not hide waits, and do not build a framework: only extract a page object when two tests need it.

## Authentication: log in once, reuse state

A **setup project** logs in and saves `storageState`; test projects depend on it.

```ts
// tests/auth.setup.ts
import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_USER!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Wait for the final state so all cookies are set after redirects.
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
```

```ts
// playwright.config.ts
projects: [
  { name: "setup", testMatch: /.*\.setup\.ts/ },
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
    dependencies: ["setup"],
  },
],
```

- Add `playwright/.auth/` to `.gitignore`. The file contains live session secrets.
- Credentials come from environment variables or a secret store; never hard-code them in the repo.
- Reset per test or file: `test.use({ storageState: { cookies: [], origins: [] } })` to test as an anonymous user.
- Multiple roles: one setup test and one file per role; select with `test.use({ storageState: 'playwright/.auth/admin.json' })`.
- Parallel tests that **mutate** the same account interfere. Use a worker-scoped fixture with one account per `testInfo.parallelIndex`.
- API login is faster: `await request.post('/api/login', {...})` then `request.storageState({ path })`.

## Global setup/teardown

Prefer **project dependencies** over `globalSetup`: they show up in reports and traces.

```ts
projects: [
  { name: "setup db", testMatch: /global\.setup\.ts/, teardown: "cleanup db" },
  { name: "cleanup db", testMatch: /global\.teardown\.ts/ },
  { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup db"] },
],
```

## Hooks

`test.beforeEach`/`afterEach` (per test), `test.beforeAll`/`afterAll` (per worker per file; do not use the `page` fixture there). Prefer fixtures when setup needs teardown or is shared across files.

## Grouping, tags, annotations

```ts
test.describe("checkout", () => {
  test("pays by card @smoke", async ({ page }) => {});
  test("pays by invoice", { tag: ["@slow", "@billing"] }, async ({ page }) => {});
});

test.skip(({ browserName }) => browserName === "webkit", "not supported in Safari");
test.fixme("known bug #123", async () => {});
test.slow(); // triple timeout for this test
test("flaky external", { annotation: { type: "issue", description: "JIRA-1" } }, async () => {});
```

Select by tag: `npx playwright test --grep @smoke`, exclude: `--grep-invert @slow`.

Structure long flows with steps, which show up in the report and trace:

```ts
await test.step("fill shipping", async () => {
  await page.getByLabel("Address").fill("Main St 1");
});
```

## Execution modes

- Default: files in parallel, tests within a file in order.
- `fullyParallel: true` or `test.describe.configure({ mode: 'parallel' })`: everything parallel.
- `mode: 'serial'`: tests depend on each other and retry together. Discouraged; prefer isolated tests.
- Prevent concurrent use of a shared resource with `test.describe.configure({ lock: 'user-settings' })` (shared named lock across workers).

## Parameterized tests

```ts
for (const { role, canDelete } of [
  { role: "admin", canDelete: true },
  { role: "viewer", canDelete: false },
]) {
  test(`${role} delete permission`, async ({ page }) => {
    /* ... */
  });
}
```

Generate titles deterministically; do not call `test()` inside hooks or asynchronously.

## Test data

Create data through the API in a fixture, use unique values (`crypto.randomUUID()`), and clean up in teardown. Do not rely on seed data that other tests may change.
