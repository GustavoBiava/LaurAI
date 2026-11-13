---
name: playwright-locators
description: Choose and write resilient Playwright locators (getByRole, getByLabel, getByText, getByTestId), filter and chain them, handle lists, strict mode, and shadow DOM. Use when finding elements, fixing "strict mode violation" or brittle selectors.
---

# Playwright Locators

A `Locator` is a lazy, re-resolving description of how to find an element. Every action and assertion re-queries the DOM, which is what makes auto-waiting and retries work. Never cache element handles (`page.$`, `elementHandle`); keep locators.

## Priority order

1. `page.getByRole(role, { name })` — how users and assistive tech perceive the page. Best default.
2. `page.getByLabel('Email')` — form fields by their label.
3. `page.getByPlaceholder('Search')`.
4. `page.getByText('Welcome')` — non-interactive content.
5. `page.getByAltText('Logo')` / `page.getByTitle('Close')`.
6. `page.getByTestId('checkout-submit')` — stable contract when no accessible name exists (`data-testid`; change with `testIdAttribute`).
7. `page.locator('css=...')` / XPath — last resort; avoid structure-dependent chains.

```ts
await page.getByRole("button", { name: "Sign in" }).click();
await page.getByLabel("Password").fill(password);
await page.getByRole("heading", { name: "Dashboard", level: 1 });
await page.getByRole("checkbox", { name: "Remember me" }).check();
await page.getByRole("link", { name: /pricing/i }).click();
```

Prefer `getByRole` with `name`; if the role query fails, the page probably has an accessibility problem worth fixing.

## Matching options

- `getByText('Welcome')` is substring, case-insensitive, whitespace-normalized. Use `{ exact: true }` for a full, case-sensitive match, or a regex.
- `getByRole('button', { name: 'Sign in', exact: true })`.
- Role state filters: `{ checked, disabled, expanded, pressed, selected, level, includeHidden }`.

## Filter and chain

Narrow with `filter()`; chain to scope into a container. Inner locators are **relative** to the outer one.

```ts
const row = page.getByRole("listitem").filter({ hasText: "Product 2" });
await row.getByRole("button", { name: "Add to cart" }).click();

await page
  .getByRole("listitem")
  .filter({ has: page.getByRole("heading", { name: "Product 2" }) })
  .getByRole("button", { name: "Add to cart" })
  .click();

// Exclusions and visibility
page.getByRole("listitem").filter({ hasNotText: "Out of stock" });
page.getByRole("listitem").filter({ hasNot: page.getByText("Sold out") });
page.getByRole("button").filter({ visible: true });
```

Wrong: `filter({ has: page.getByRole('list').getByText('Product 2') })` — the inner locator must not start from the page root.

Combine with `.and()` / `.or()`:

```ts
const saveOrCreate = page
  .getByRole("button", { name: "Save" })
  .or(page.getByRole("button", { name: "Create" }));
await saveOrCreate.click();
```

## Lists and strict mode

Locators are **strict**: an action on a locator that matches more than one element throws a "strict mode violation". Fix the locator instead of adding `.first()` by reflex.

```ts
await expect(page.getByRole("listitem")).toHaveCount(3);
await expect(page.getByRole("listitem")).toHaveText(["Apple", "Banana", "Cherry"]); // whole list, in order

page.getByRole("listitem").nth(1); // when order is part of the contract
page.getByRole("listitem").first();
page.getByRole("listitem").last();

for (const item of await page.getByRole("listitem").all()) {
  await expect(item).toBeVisible(); // .all() does not wait; assert the count first
}
```

## Frames and shadow DOM

- Iframes: `page.frameLocator('#payment').getByLabel('Card number')`.
- Open shadow DOM is pierced automatically by CSS and role/text locators. No special syntax.

## Generating and verifying locators

- `npx playwright codegen <url>` and the "Pick locator" tool suggest the best locator.
- UI mode and the Inspector highlight what a locator matches live.
- Debug: `await page.pause()` then try the locator in the Inspector.

## Quick checklist

- Did I use role/label/text before test id, and test id before CSS?
- Is the locator tied to user-facing text that may be translated? If the app is localized, use `getByTestId` or role with a stable name.
- Does it match exactly one element? If not, scope with `filter`/chaining.
- No `nth-child`, no long CSS chains, no auto-generated class names.
