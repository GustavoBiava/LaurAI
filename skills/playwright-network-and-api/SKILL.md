---
name: playwright-network-and-api
description: Mock, intercept, record and wait for network traffic in Playwright (page.route, route.fulfill, HAR, waitForResponse) and write API tests with the request fixture. Use when isolating tests from backends, testing APIs, or preparing test data through HTTP.
---

# Playwright Network and API Testing

## Mock a response

Register routes **before** navigating or triggering the request.

```ts
test("shows a mocked fruit", async ({ page }) => {
  await page.route("**/api/v1/fruits", async (route) => {
    await route.fulfill({ json: [{ name: "Strawberry", id: 21 }] });
  });
  await page.goto("/");
  await expect(page.getByText("Strawberry")).toBeVisible();
});
```

Route actions: `route.fulfill({ status, json | body, headers, contentType, path })`, `route.continue({ headers, postData, url })`, `route.abort('failed')`, `route.fallback()` (pass to the next matching handler).

### Modify a real response

```ts
await page.route("**/api/v1/fruits", async (route) => {
  const response = await route.fetch(); // real request
  const json = await response.json();
  json.push({ name: "Playwright", id: 100 });
  await route.fulfill({ response, json });
});
```

### Simulate failures and slow networks

```ts
await page.route("**/api/orders", (route) =>
  route.fulfill({ status: 500, json: { error: "boom" } }),
);
await page.route("**/*.{png,jpg,jpeg}", (route) => route.abort()); // block images
await page.route("**/api/search", async (route) => {
  await new Promise((r) => setTimeout(r, 2_000)); // artificial latency in the handler
  await route.continue();
});
```

Use `context.route` to apply to all pages of a context (including popups). Route patterns are globs, regexes, or predicates; use `{ times: 1 }` to apply once. Remove with `page.unroute(url)`.

## Record and replay with HAR

```ts
// Record (once), then commit the .har if it is small and free of secrets
await page.routeFromHAR("tests/hars/fruit.har", { url: "**/api/**", update: true });

// Replay
await page.routeFromHAR("tests/hars/fruit.har", { url: "**/api/**", notFound: "abort" });
```

HAR replay matches URL, method and POST payload strictly. HARs can contain tokens and personal data: review and scrub before committing.

## Wait for / inspect traffic

```ts
const responsePromise = page.waitForResponse("**/api/fetch_data"); // no await yet
await page.getByRole("button", { name: "Update" }).click();
const response = await responsePromise;
expect(response.ok()).toBeTruthy();

const requestPromise = page.waitForRequest(
  (r) => r.url().endsWith("/api/save") && r.method() === "POST",
);
await page.getByRole("button", { name: "Save" }).click();
expect((await requestPromise).postDataJSON()).toMatchObject({ title: "x" });

page.on("requestfailed", (r) => console.log("FAILED", r.url(), r.failure()?.errorText));
page.on("console", (m) => m.type() === "error" && console.log(m.text()));
```

Prefer asserting on the UI; wait on responses only when there is no visible signal.

## API testing (no browser)

The `request` fixture is an isolated `APIRequestContext`. It uses `baseURL` and `extraHTTPHeaders` from config.

```ts
// playwright.config.ts
use: {
  baseURL: "https://api.example.com",
  extraHTTPHeaders: {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.API_TOKEN}`,
  },
},
```

```ts
import { test, expect } from "@playwright/test";

test("creates and reads an item", async ({ request }) => {
  const created = await request.post("/items", { data: { title: "Test" } });
  await expect(created).toBeOK(); // 2xx
  const { id } = await created.json();

  const fetched = await request.get(`/items/${id}`);
  expect(await fetched.json()).toMatchObject({ id, title: "Test" });

  await request.delete(`/items/${id}`); // clean up
});
```

Other forms: `request.put/patch/head`, `{ params: {...} }` for query strings, `{ form: {...} }` for urlencoded, `{ multipart: {...} }` for uploads, `{ failOnStatusCodes: true }` to throw on non-2xx.

### Standalone context (hooks, shared across tests)

```ts
let api: APIRequestContext;
test.beforeAll(async ({ playwright }) => {
  api = await playwright.request.newContext({ baseURL: "https://api.example.com" });
});
test.afterAll(async () => {
  await api.dispose();
});
```

### Mix API and UI

Create preconditions with the API, verify in the UI (and the reverse):

```ts
test("new issue appears first", async ({ page, request }) => {
  await request.post("/issues", { data: { title: "[Feature] request 1" } });
  await page.goto("/issues");
  await expect(page.getByRole("link").first()).toHaveText("[Feature] request 1");
});
```

`page.request` and `context.request` share cookies with the browser context; `request` (fixture) does not.

## Rules of thumb

- Mock what you do not own (payment, maps, analytics); keep at least some end-to-end tests against the real backend.
- Mocked payloads must match the real contract; validate with a schema or contract test, or the mock will lie.
- Never put real tokens in tests or HARs; read them from the environment.
- Assert on status **and** body; `toBeOK()` alone is a weak check.
