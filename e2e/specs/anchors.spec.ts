import { $, browser, expect } from "@wdio/globals";

describe("heading anchors", () => {
  it("clicking a TOC link scrolls the target heading into view", async () => {
    await $('[data-testid="viewer-scroll"]').waitForExist({ timeout: 20_000 });
    await $('[data-testid="markdown-body"] h1').waitForExist({ timeout: 20_000 });

    // rehype-slug should have produced id="gfm-features" on the h2.
    const target = await $("#gfm-features");
    await target.waitForExist({ timeout: 10_000 });
    await expect(target).toHaveElementProperty("id", "gfm-features");

    // Scroll to top so the target is off-screen, then click the TOC link.
    await browser.execute(() => {
      document.querySelector('[data-testid="viewer-scroll"]')?.scrollTo({ top: 0 });
    });
    const link = await $('[data-testid="markdown-body"] a[href="#gfm-features"]');
    await link.click();

    // Wait for smooth-scroll to settle, then verify the heading is near the top.
    await browser.pause(600);
    const top = await browser.execute(() => {
      const scroll = document.querySelector('[data-testid="viewer-scroll"]') as HTMLElement;
      const h = document.getElementById("gfm-features");
      if (!scroll || !h) return Number.POSITIVE_INFINITY;
      return h.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
    });
    // The heading should now be within the top ~80px of the scroll viewport.
    await expect(top).toBeLessThan(80);
  });
});
