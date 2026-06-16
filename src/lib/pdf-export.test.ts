import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  invokeWriteBinaryFile: vi.fn(async () => undefined),
  isTauri: vi.fn(() => true),
}));

const dialogMocks = vi.hoisted(() => ({
  save: vi.fn(async (): Promise<string | null> => "/tmp/export.pdf"),
}));

const pdfMocks = vi.hoisted(() => {
  const instances: FakePdf[] = [];

  class FakePdf {
    pages = 1;
    textCalls: string[] = [];
    rectCalls = 0;
    fontFiles: string[] = [];
    internal = {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    };

    addPage() {
      this.pages += 1;
    }

    addFileToVFS(filename: string) {
      this.fontFiles.push(filename);
    }

    addFont() {}
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    setFillColor() {}
    setLineWidth() {}
    line() {}
    setPage() {}
    circle() {}

    rect() {
      this.rectCalls += 1;
    }

    getNumberOfPages() {
      return this.pages;
    }

    getTextWidth(text: string) {
      return text.length * 2;
    }

    splitTextToSize(text: string, maxWidth: number) {
      const chunkSize = Math.max(1, Math.floor(maxWidth / 2));
      const lines: string[] = [];
      for (let i = 0; i < text.length; i += chunkSize) {
        lines.push(text.slice(i, i + chunkSize));
      }
      return lines.length > 0 ? lines : [""];
    }

    text(text: string) {
      this.textCalls.push(text);
    }

    output() {
      return new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer;
    }
  }

  return {
    instances,
    jsPDF: vi.fn(function jsPDF(this: FakePdf) {
      const pdf = new FakePdf();
      instances.push(pdf);
      return pdf;
    }),
  };
});

vi.mock("@/lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/plugin-dialog", () => dialogMocks);
vi.mock("@/assets/fonts/NotoSansJP-Bold.ttf?url", () => ({
  default: "/assets/NotoSansJP-Bold.ttf",
}));
vi.mock("@/assets/fonts/NotoSansJP-Black.ttf?url", () => ({
  default: "/assets/NotoSansJP-Black.ttf",
}));
vi.mock("@/assets/fonts/NotoSansJP-Regular.ttf?url", () => ({
  default: "/assets/NotoSansJP-Regular.ttf",
}));
vi.mock("jspdf", () => ({ jsPDF: pdfMocks.jsPDF }));

import { exportMarkdownPdf } from "./pdf-export";

function makeExportRoot(repeat = 1): HTMLElement {
  const root = document.createElement("div");
  const body = document.createElement("article");
  body.className = "markdown-body";
  body.appendChild(Object.assign(document.createElement("h1"), { textContent: "Ready document" }));
  body.appendChild(
    Object.assign(document.createElement("p"), {
      textContent: "日本語を含む PDF export paragraph with mixed English text.".repeat(repeat),
    }),
  );
  const inlineCodeParagraph = document.createElement("p");
  inlineCodeParagraph.append("Long inline code ");
  inlineCodeParagraph.appendChild(
    Object.assign(document.createElement("code"), {
      textContent:
        "veryLongInlineCodeIdentifier.with.deep.property.access.andNoNaturalBreakpoints1234567890",
    }),
  );
  inlineCodeParagraph.append(" followed by a URL https://example.com/very/long/path/abcdefg");
  body.appendChild(inlineCodeParagraph);
  const list = document.createElement("ul");
  list.appendChild(Object.assign(document.createElement("li"), { textContent: "List item" }));
  body.appendChild(list);
  const pre = document.createElement("pre");
  pre.textContent =
    "const ok = true;\n\tconst tabbed = 'expands tabs';\nkey\tvalue\n  const aligned  = 'keeps spaces';\n\n// 日本語コメント\nconsole.log('日本語');";
  body.appendChild(pre);
  root.appendChild(body);
  document.body.appendChild(root);
  return root;
}

describe("exportMarkdownPdf", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })),
    );
    dialogMocks.save.mockClear();
    dialogMocks.save.mockResolvedValue("/tmp/export.pdf");
    tauriMocks.invokeWriteBinaryFile.mockClear();
    tauriMocks.isTauri.mockReturnValue(true);
    pdfMocks.jsPDF.mockClear();
    pdfMocks.instances.length = 0;
  });

  it("asks for a target, embeds the PDF font, and writes the generated PDF", async () => {
    const root = makeExportRoot();

    await exportMarkdownPdf({ root, sourcePath: "/docs/readme.md" });

    expect(dialogMocks.save).toHaveBeenCalledWith({
      defaultPath: "readme.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    expect(fetch).toHaveBeenCalledWith("/assets/NotoSansJP-Regular.ttf");
    expect(fetch).toHaveBeenCalledWith("/assets/NotoSansJP-Bold.ttf");
    expect(fetch).toHaveBeenCalledWith("/assets/NotoSansJP-Black.ttf");
    expect(pdfMocks.instances[0].fontFiles).toContain("NotoSansJP-Regular.ttf");
    expect(pdfMocks.instances[0].fontFiles).toContain("NotoSansJP-Bold.ttf");
    expect(pdfMocks.instances[0].fontFiles).toContain("NotoSansJP-Black.ttf");
    expect(pdfMocks.instances[0].textCalls.join(" ")).toContain("Ready document");
    expect(pdfMocks.instances[0].textCalls).toContain("    const tabbed = 'expands tabs';");
    expect(pdfMocks.instances[0].textCalls).toContain("key value");
    expect(pdfMocks.instances[0].textCalls).toContain("  const aligned  = 'keeps spaces';");
    expect(pdfMocks.instances[0].textCalls).toContain("");
    expect(pdfMocks.instances[0].textCalls.join(" ")).toContain("日本語コメント");
    expect(
      pdfMocks.instances[0].textCalls.some((call) =>
        call.includes(
          "veryLongInlineCodeIdentifier.with.deep.property.access.andNoNaturalBreakpoints1234567890",
        ),
      ),
    ).toBe(false);
    expect(pdfMocks.instances[0].textCalls.join(" ")).toContain("veryLongInlineCodeIdentifier");
    expect(tauriMocks.invokeWriteBinaryFile).toHaveBeenCalledWith(
      "/tmp/export.pdf",
      expect.any(Uint8Array),
    );
  });

  it("paginates long documents without rendering giant canvases", async () => {
    const root = makeExportRoot(220);
    const startedAt = performance.now();

    await exportMarkdownPdf({ root, sourcePath: "/docs/long.md" });

    expect(performance.now() - startedAt).toBeLessThan(2_000);
    expect(pdfMocks.instances[0].pages).toBeGreaterThan(1);
    expect(tauriMocks.invokeWriteBinaryFile).toHaveBeenCalledTimes(1);
  });

  it("does not render or write when the save dialog is cancelled", async () => {
    dialogMocks.save.mockResolvedValueOnce(null);
    const root = makeExportRoot();

    await exportMarkdownPdf({ root, sourcePath: "/docs/readme.md" });

    expect(pdfMocks.jsPDF).not.toHaveBeenCalled();
    expect(tauriMocks.invokeWriteBinaryFile).not.toHaveBeenCalled();
  });
});
