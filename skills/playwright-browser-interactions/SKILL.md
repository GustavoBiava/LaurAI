---
name: playwright-browser-interactions
description: Handle dialogs, iframes, file uploads and downloads, popups and new tabs, keyboard and mouse input, multiple contexts, and device/locale/geolocation emulation in Playwright. Use when a page does something beyond plain clicks and form fills.
---

# Playwright Browser Interactions

Set up event waits **before** the action that triggers them (no `await` on the promise until after the action).

## Input

```ts
await page.getByLabel("Name").fill("Ada"); // clears then sets value
await page.getByLabel("Search").pressSequentially("pw"); // types keystroke by keystroke, only if keys matter
await page.getByLabel("Search").press("Enter");
await page.getByRole("checkbox", { name: "Terms" }).check();
await page.getByLabel("Country").selectOption("br"); // <select>, by value/label
await page.getByRole("button").hover();
await page.getByRole("button").dblclick();
await page.getByRole("button").click({ button: "right" });
await page.getByRole("button").click({ modifiers: ["Shift"] });
await source.dragTo(target);
await page.keyboard.press("Control+A");
await locator.scrollIntoViewIfNeeded();
await locator.focus();
```

Use `fill` instead of typing; it is faster and clears existing content.

## Dialogs (alert / confirm / prompt)

Dialogs are auto-dismissed unless a handler exists. Once you register a handler, it **must** accept or dismiss, or the action stalls.

```ts
page.once("dialog", async (dialog) => {
  expect(dialog.message()).toBe("Delete this item?");
  await dialog.accept(); // or dialog.dismiss(), dialog.accept("prompt text")
});
await page.getByRole("button", { name: "Delete" }).click();
```

## Iframes

```ts
const frame = page.frameLocator("#payment-frame");
await frame.getByLabel("Card number").fill("4242 4242 4242 4242");
await frame.getByRole("button", { name: "Pay" }).click();
```

Use `frameLocator` (auto-waiting) rather than `page.frame()`.

## File upload

```ts
await page.getByLabel("Upload file").setInputFiles(path.join(__dirname, "fixtures/report.pdf"));
await page.getByLabel("Upload files").setInputFiles([fileA, fileB]);
await page.getByLabel("Upload file").setInputFiles([]); // clear

// From memory
await page.getByLabel("Upload file").setInputFiles({
  name: "file.txt",
  mimeType: "text/plain",
  buffer: Buffer.from("hello"),
});

// No <input> in the DOM: intercept the chooser
const chooserPromise = page.waitForEvent("filechooser");
await page.getByRole("button", { name: "Attach" }).click();
await (await chooserPromise).setFiles(path.join(__dirname, "fixtures/report.pdf"));
```

## Downloads

```ts
const downloadPromise = page.waitForEvent("download");
await page.getByRole("link", { name: "Export CSV" }).click();
const download = await downloadPromise;
expect(download.suggestedFilename()).toBe("export.csv");
await download.saveAs(path.join(testInfo.outputPath(), download.suggestedFilename()));
```

Downloaded files are deleted when the context closes; save before that.

## Popups and new tabs

```ts
const popupPromise = page.waitForEvent("popup");
await page.getByText("Open help").click();
const popup = await popupPromise;
await popup.waitForLoadState();
await expect(popup).toHaveTitle("Help");

// Any new page in the context (target=_blank, window.open)
const pagePromise = context.waitForEvent("page");
```

## Multiple users / contexts

```ts
const adminContext = await browser.newContext({ storageState: "playwright/.auth/admin.json" });
const userContext = await browser.newContext({ storageState: "playwright/.auth/user.json" });
const adminPage = await adminContext.newPage();
const userPage = await userContext.newPage();
// ... interact independently, then:
await adminContext.close();
await userContext.close();
```

Each context is an isolated profile, ideal for chat/collaboration scenarios.

## Emulation

Project-level device presets:

```ts
projects: [{ name: "iphone", use: { ...devices["iPhone 14"] } }];
```

Per-file or per-test:

```ts
test.use({
  viewport: { width: 1600, height: 1200 },
  locale: "pt-BR",
  timezoneId: "America/Sao_Paulo",
  colorScheme: "dark",
  geolocation: { latitude: -23.55, longitude: -46.63 },
  permissions: ["geolocation"],
});
```

Change at runtime: `await page.setViewportSize({ width: 375, height: 667 })`, `await context.setOffline(true)`, `await context.grantPermissions([...])`, `await context.setGeolocation({...})`, `await page.emulateMedia({ media: "print" })`. Fake the clock with `page.clock` (`install`, `fastForward`, `setFixedTime`) to test timers and dates deterministically.

## Browser storage and cookies

`await context.addCookies([...])`, `await context.cookies()`, `await context.storageState()`, `await page.evaluate(() => localStorage.setItem('k', 'v'))`. Prefer `storageState` over manual seeding.

## Evaluating page code

`await page.evaluate(() => window.scrollY)` runs in the page; values must be serializable. Use `locator.evaluate(el => ...)` sparingly; prefer assertions and user-level actions.
