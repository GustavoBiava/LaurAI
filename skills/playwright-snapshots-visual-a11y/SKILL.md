---
name: playwright-snapshots-visual-a11y
description: Write Playwright visual regression tests (toHaveScreenshot), ARIA snapshot tests (toMatchAriaSnapshot), and accessibility checks. Use when asserting page structure or appearance, updating snapshots, or auditing accessibility.
---

# Playwright Snapshots, Visual Regression and Accessibility

## Visual comparisons: `toHaveScreenshot`

The first run writes the baseline PNG next to the spec; later runs compare against it. The assertion waits until two consecutive screenshots are identical, which stabilizes animations.

```ts
await expect(page).toHaveScreenshot("landing.png", { fullPage: true });
await expect(page.getByTestId("chart")).toHaveScreenshot();

await expect(page).toHaveScreenshot({
  animations: "disabled", // default; freezes CSS animations/transitions
  caret: "hide", // default
  mask: [page.getByTestId("clock"), page.locator(".avatar")], // dynamic regions
  maxDiffPixelRatio: 0.01, // or maxDiffPixels, threshold (0..1)
  stylePath: "tests/screenshot.css", // hide volatile elements
});
```

Make them stable:

- Mask or hide anything dynamic (dates, ads, avatars, random content); mock the data and the clock.
- Wait for fonts and images before shooting (assert visible state first).
- Baselines are **per OS and browser**: the filename includes project and platform (`-chromium-linux.png`). Generate and compare on the same environment, ideally the CI Docker image or a pinned runner, never mix a Windows/macOS baseline into a Linux CI.
- Set a shared default in config: `expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } }`.
- Keep screenshots small (component or section) rather than whole pages when possible.

Update baselines intentionally, then review the diff in the PR:

```sh
npx playwright test --update-snapshots
npx playwright test --update-snapshots --grep "landing"
```

Never run `--update-snapshots` to turn a red build green without looking at the changes. Failed comparisons attach expected/actual/diff images to the HTML report.

## ARIA snapshots: `toMatchAriaSnapshot`

Assert the accessibility tree as YAML. Resilient to styling changes, readable in code review, and doubles as a structure/accessibility check.

```ts
await expect(page.getByRole("navigation")).toMatchAriaSnapshot(`
  - navigation:
    - link "Home"
    - link "Pricing"
    - button "Sign in"
`);
```

- Matching is partial by default: unlisted siblings are ignored. Use `/children: equal` to require an exact list.
- Regex for variable text: `- heading /Welcome, .*/ [level=1]`.
- Attributes: `[checked]`, `[disabled]`, `[expanded]`, `[level=2]`, `[pressed]`, `[selected]`.
- Store in a file with `await expect(locator).toMatchAriaSnapshot({ name: "nav.aria.yml" })`; generate or update with `--update-snapshots` or via codegen's "assert snapshot".
- Prefer ARIA snapshots over brittle text/structure checks for large regions; prefer screenshots for pure appearance.

## Accessibility testing with axe

Automated checks catch only a subset of issues (roughly a third); combine with manual review and keyboard testing.

```sh
npm install -D @axe-core/playwright
```

```ts
import AxeBuilder from "@axe-core/playwright";

test("home has no detectable a11y violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("#third-party-widget")
    .analyze();
  expect(results.violations).toEqual([]);
});
```

- Scope with `.include('#main')`, disable known rules with `.disableRules(['color-contrast'])` and track each exclusion as a bug.
- Attach `results` to the report: `testInfo.attach('a11y', { body: JSON.stringify(results, null, 2), contentType: 'application/json' })`.
- Run it on key states (open modal, error form), not just page load.

Good locators are an accessibility check in themselves: if `getByRole('button', { name: ... })` cannot find a control, a screen reader cannot either. Also test keyboard flows with `page.keyboard.press('Tab')` and `toBeFocused()`.

## Text and value snapshots

`expect(value).toMatchSnapshot('name.txt')` stores arbitrary text/JSON/binary baselines; `toMatchSnapshot` does **not** retry, so use it only for already-final data (API payloads, generated files).
