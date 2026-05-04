import { $, browser } from "@wdio/globals";

describe("markdown-viewer", () => {
  it("renders the sample file heading via CLI arg", async () => {
    const viewer = await $('[data-testid="viewer-scroll"]');
    await viewer.waitForExist({ timeout: 20_000 });

    const h1 = await $('[data-testid="markdown-body"] h1');
    await h1.waitForExist({ timeout: 20_000 });
    await expect(h1).toHaveText("Sample Title");
  });

  it("toggles edit mode when the Edit button is clicked", async () => {
    const modeBtn = await $('[data-testid="mode-btn"]');
    await modeBtn.waitForExist();
    await expect(modeBtn).toHaveAttribute("aria-label", "Switch to edit mode");
    await expect(modeBtn).toHaveAttribute("aria-pressed", "false");

    await modeBtn.click();
    const editorHost = await $('[data-testid="editor-host"]');
    await editorHost.waitForExist({ timeout: 20_000 });
    await expect(modeBtn).toHaveAttribute("aria-label", "Switch to view mode");
    await expect(modeBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("swaps the data-theme attribute when the theme button is clicked", async () => {
    const themeBtn = await $('[data-testid="theme-btn"]');
    const beforeTheme = await browser.execute(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    await themeBtn.click();
    const afterTheme = await browser.execute(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    await expect(afterTheme).not.toBe(beforeTheme);
    await expect(["light", "dark"]).toContain(afterTheme);
  });
});
