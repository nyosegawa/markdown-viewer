import { $, browser, expect } from "@wdio/globals";

describe("find in document", () => {
  it("Ctrl+F opens the search bar; typing populates counter; Escape closes", async () => {
    await $('[data-testid="markdown-body"] h1').waitForExist({ timeout: 20_000 });

    // Search bar should be absent at first.
    await expect(await $('[data-testid="search-bar"]').isExisting()).toBe(false);

    // Open search with Ctrl+F (works on Linux CI; app also accepts Cmd+F).
    await browser.action("key").down("Control").down("f").up("f").up("Control").perform();

    const input = await $('[data-testid="search-input"]');
    await input.waitForExist({ timeout: 5_000 });
    await input.setValue("Sample");

    const bar = await $('[data-testid="search-bar"]');
    const counter = await bar.$("span[aria-live]");
    await counter.waitForExist();
    const counterText = await counter.getText();
    await expect(counterText).toMatch(/\d+\s*\/\s*\d+/);

    // Close via Escape.
    await input.click();
    await browser.keys("Escape");
    await expect(await $('[data-testid="search-bar"]').isExisting()).toBe(false);
  });
});
