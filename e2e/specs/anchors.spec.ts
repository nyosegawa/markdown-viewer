import { $, browser, expect } from "@wdio/globals";

describe("heading anchors", () => {
  it("clicking a TOC link scrolls the target heading into view", async () => {
    await $('[data-testid="viewer-scroll"]').waitForExist({ timeout: 20_000 });
    await $('[data-testid="markdown-body"] h1').waitForExist({ timeout: 20_000 });

    // rehype-slug should have produced id="gfm-features" on the h2.
    const target = await $("#gfm-features");
    await target.waitForExist({ timeout: 10_000 });
    await expect(target).toHaveElementProperty("id", "gfm-features");

    await browser.execute(() => {
      document.querySelector('[data-testid="viewer-scroll"]')?.scrollTo({ top: 0 });
    });

    const link = await $('[data-testid="markdown-body"] a[href="#gfm-features"]');
    await link.click();
    await browser.pause(600); // let smooth-scroll settle

    // Heading must be fully inside the viewer viewport after clicking.
    const inViewport = await browser.execute(() => {
      const scroll = document.querySelector('[data-testid="viewer-scroll"]') as HTMLElement;
      const h = document.getElementById("gfm-features");
      if (!scroll || !h) return false;
      const hr = h.getBoundingClientRect();
      const sr = scroll.getBoundingClientRect();
      return hr.top >= sr.top - 1 && hr.bottom <= sr.bottom + 1;
    });
    await expect(inViewport).toBe(true);
  });
});
