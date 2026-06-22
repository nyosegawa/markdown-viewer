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

  interface TextDraw {
    text: string;
    x: number;
    y: number;
  }

  interface RectDraw {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  class FakePdf {
    pages = 1;
    textCalls: string[] = [];
    textDraws: TextDraw[] = [];
    rectDraws: RectDraw[] = [];
    rectCalls = 0;
    imageCalls = 0;
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
    addImage() {
      this.imageCalls += 1;
    }

    rect(x: number, y: number, width: number, height: number) {
      this.rectCalls += 1;
      this.rectDraws.push({ x, y, width, height });
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

    text(text: string, x = 0, y = 0) {
      this.textCalls.push(text);
      this.textDraws.push({ text, x, y });
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
vi.mock("svg2pdf.js", () => ({
  svg2pdf: vi.fn(async () => undefined),
}));

import { svg2pdf } from "svg2pdf.js";
import { exportMarkdownPdf } from "./pdf-export";

function makeRootWithBody(...children: HTMLElement[]): HTMLElement {
  const root = document.createElement("div");
  const body = document.createElement("article");
  body.className = "markdown-body";
  body.append(...children);
  root.appendChild(body);
  document.body.appendChild(root);
  return root;
}

function makeExportRoot(repeat = 1): HTMLElement {
  const children: HTMLElement[] = [];
  children.push(Object.assign(document.createElement("h1"), { textContent: "Ready document" }));
  children.push(
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
  children.push(inlineCodeParagraph);
  const list = document.createElement("ul");
  list.appendChild(Object.assign(document.createElement("li"), { textContent: "List item" }));
  children.push(list);
  const pre = document.createElement("pre");
  pre.textContent =
    "const ok = true;\n\tconst tabbed = 'expands tabs';\nkey\tvalue\n  const aligned  = 'keeps spaces';\n\n// 日本語コメント\nconsole.log('日本語');";
  children.push(pre);
  return makeRootWithBody(...children);
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
    vi.mocked(svg2pdf).mockClear();
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

  it("keeps inline code padding out of the surrounding text", async () => {
    const paragraph = document.createElement("p");
    paragraph.append("GCP では");
    paragraph.appendChild(Object.assign(document.createElement("code"), { textContent: ".auth/" }));
    paragraph.append("の扱いが設計上の要点。");
    const root = makeRootWithBody(paragraph);

    await exportMarkdownPdf({ root, sourcePath: "/docs/inline.md" });

    const pdf = pdfMocks.instances[0];
    const before = pdf.textDraws.find((draw) => draw.text === "では");
    const code = pdf.textDraws.find((draw) => draw.text === ".auth/");
    const after = pdf.textDraws.find((draw) => draw.text === "の扱いが設計上の要点。");
    const codeRect = pdf.rectDraws.find(
      (rect) => code && rect.x < code.x && code.x < rect.x + rect.width,
    );
    expect(before).toBeDefined();
    expect(code).toBeDefined();
    expect(after).toBeDefined();
    expect(codeRect).toBeDefined();
    expect(codeRect?.x).toBeGreaterThanOrEqual((before?.x ?? 0) + pdf.getTextWidth("では"));
    expect(code?.x).toBeGreaterThan(codeRect?.x ?? 0);
    expect(after?.x).toBeGreaterThan((codeRect?.x ?? 0) + (codeRect?.width ?? 0));
  });

  it("adds readable space after code blocks before drawing following paragraphs", async () => {
    const pre = document.createElement("pre");
    pre.textContent = "/app/runtime/.auth\n/app/runtime/state";
    const paragraph = Object.assign(document.createElement("p"), {
      textContent: "初期実装は repo root の既存 path に合わせる。",
    });
    const root = makeRootWithBody(pre, paragraph);

    await exportMarkdownPdf({ root, sourcePath: "/docs/code.md" });

    const pdf = pdfMocks.instances[0];
    const codeLine = pdf.textDraws.find((draw) => draw.text === "/app/runtime/state");
    const codeRect = pdf.rectDraws.find(
      (rect) =>
        codeLine &&
        rect.x < codeLine.x &&
        codeLine.x < rect.x + rect.width &&
        rect.y < codeLine.y &&
        codeLine.y < rect.y + rect.height,
    );
    const following = pdf.textDraws.find((draw) => draw.text === "初期実装は");
    expect(codeLine).toBeDefined();
    expect(codeRect).toBeDefined();
    expect(following).toBeDefined();
    expect((following?.y ?? 0) - ((codeRect?.y ?? 0) + (codeRect?.height ?? 0))).toBeGreaterThan(6);
  });

  it("exports rendered mermaid diagrams as vector SVG instead of code text", async () => {
    const figure = document.createElement("figure");
    figure.className = "mermaid-diagram";
    figure.dataset.mermaidSource = "graph TD\nA --> B";
    figure.dataset.mermaidStatus = "rendered";
    figure.innerHTML =
      '<div class="mermaid-diagram-svg"><svg viewBox="0 0 200 100"><path d="M0 0L200 100"/><foreignObject x="20" y="30" width="80" height="24"><div>Node A</div></foreignObject></svg></div>';
    const root = makeRootWithBody(figure);

    await exportMarkdownPdf({ root, sourcePath: "/docs/diagram.md" });

    expect(svg2pdf).toHaveBeenCalledTimes(1);
    const svg = vi.mocked(svg2pdf).mock.calls[0]?.[0] as SVGSVGElement;
    const text = svg.querySelector("text");
    expect(svg.querySelector("foreignObject")).toBeNull();
    expect(text?.textContent).toBe("Node A");
    expect(text?.getAttribute("x")).toBe("60");
    expect(text?.getAttribute("text-anchor")).toBe("middle");
    expect(Number(text?.getAttribute("y"))).toBeCloseTo(47.6, 1);
    expect(pdfMocks.instances[0].imageCalls).toBe(0);
    expect(pdfMocks.instances[0].textCalls.join(" ")).not.toContain("graph TD");
    expect(tauriMocks.invokeWriteBinaryFile).toHaveBeenCalledWith(
      "/tmp/export.pdf",
      expect.any(Uint8Array),
    );
  });

  it("preserves multi-line mermaid labels when converting foreignObject labels for PDF", async () => {
    const figure = document.createElement("figure");
    figure.className = "mermaid-diagram";
    figure.dataset.mermaidSource = "graph TD\nA[Line 1<br/>Line 2]";
    figure.dataset.mermaidStatus = "rendered";
    figure.innerHTML =
      '<div class="mermaid-diagram-svg"><svg viewBox="0 0 200 100"><foreignObject x="20" y="30" width="100" height="60"><div><span>Line 1</span><br><span>Line 2</span></div></foreignObject></svg></div>';
    const root = makeRootWithBody(figure);

    await exportMarkdownPdf({ root, sourcePath: "/docs/multiline-diagram.md" });

    const svg = vi.mocked(svg2pdf).mock.calls[0]?.[0] as SVGSVGElement;
    const text = svg.querySelector("text");
    const tspans = Array.from(svg.querySelectorAll("tspan"));
    expect(text?.getAttribute("x")).toBe("70");
    expect(Number(text?.getAttribute("y"))).toBeCloseTo(56, 1);
    expect(tspans.map((tspan) => tspan.textContent)).toEqual(["Line 1", "Line 2"]);
    expect(tspans[0]?.getAttribute("x")).toBe("70");
    expect(tspans[1]?.getAttribute("x")).toBe("70");
    expect(tspans[1]?.getAttribute("dy")).toBe("19.2");
  });

  it("waits for mermaid rendering before exporting", async () => {
    const figure = document.createElement("figure");
    figure.className = "mermaid-diagram";
    figure.dataset.mermaidStatus = "loading";
    figure.dataset.mermaidSource = "graph TD\nA --> B";
    const root = makeRootWithBody(figure);

    window.setTimeout(() => {
      figure.dataset.mermaidStatus = "rendered";
      figure.innerHTML = '<svg viewBox="0 0 200 100"><path d="M0 0L200 100"/></svg>';
    }, 20);

    await exportMarkdownPdf({ root, sourcePath: "/docs/wait.md" });

    expect(svg2pdf).toHaveBeenCalledTimes(1);
  });

  it("waits when a mermaid diagram is marked rendered before its SVG is inserted", async () => {
    const figure = document.createElement("figure");
    figure.className = "mermaid-diagram";
    figure.dataset.mermaidStatus = "rendered";
    figure.dataset.mermaidSource = "graph TD\nA --> B";
    const root = makeRootWithBody(figure);

    window.setTimeout(() => {
      figure.innerHTML = '<svg viewBox="0 0 200 100"><path d="M0 0L200 100"/></svg>';
    }, 20);

    await exportMarkdownPdf({ root, sourcePath: "/docs/render-race.md" });

    expect(svg2pdf).toHaveBeenCalledTimes(1);
  });

  it("falls back to readable mermaid source when SVG conversion fails", async () => {
    vi.mocked(svg2pdf).mockRejectedValueOnce(new Error("unsupported svg feature"));
    const figure = document.createElement("figure");
    figure.className = "mermaid-diagram";
    figure.dataset.mermaidSource = "graph TD\nA --> B";
    figure.dataset.mermaidStatus = "rendered";
    figure.innerHTML = '<svg viewBox="0 0 200 100"><path d="M0 0L200 100"/></svg>';
    const root = makeRootWithBody(figure);

    await exportMarkdownPdf({ root, sourcePath: "/docs/fallback.md" });

    expect(svg2pdf).toHaveBeenCalledTimes(1);
    expect(pdfMocks.instances[0].textCalls.join(" ")).toContain("graph TD");
    expect(tauriMocks.invokeWriteBinaryFile).toHaveBeenCalledWith(
      "/tmp/export.pdf",
      expect.any(Uint8Array),
    );
  });

  it("caps tall mermaid diagrams so ordinary documents do not jump to a new page", async () => {
    const heading = Object.assign(document.createElement("h1"), {
      textContent: "Mermaid PDF verification",
    });
    const before = Object.assign(document.createElement("p"), {
      textContent: "Before diagram paragraph.",
    });
    const figure = document.createElement("figure");
    figure.className = "mermaid-diagram";
    figure.dataset.mermaidSource = "flowchart TD\nA --> B\nB --> C";
    figure.dataset.mermaidStatus = "rendered";
    figure.innerHTML = '<svg viewBox="0 0 120 900"><path d="M0 0L120 900"/></svg>';
    const after = Object.assign(document.createElement("p"), {
      textContent: "After diagram paragraph.",
    });
    const root = makeRootWithBody(heading, before, figure, after);

    await exportMarkdownPdf({ root, sourcePath: "/docs/tall-mermaid.md" });

    expect(pdfMocks.instances[0].pages).toBe(1);
    expect(pdfMocks.instances[0].textCalls.join(" ")).toContain("After diagram paragraph.");
  });

  it("sizes mermaid PDF output from the drawn content box instead of whitespace-heavy viewBox", async () => {
    const figure = document.createElement("figure");
    figure.className = "mermaid-diagram";
    figure.dataset.mermaidSource = "flowchart TD\nA --> B";
    figure.dataset.mermaidStatus = "rendered";
    figure.innerHTML = '<svg viewBox="0 0 700 1000"><g><path d="M0 0L500 120"/></g></svg>';
    const svg = figure.querySelector("svg") as SVGSVGElement;
    svg.getBBox = () => new DOMRect(80, 430, 540, 120);
    const root = makeRootWithBody(figure);

    await exportMarkdownPdf({ root, sourcePath: "/docs/cropped-mermaid.md" });

    const pdf = pdfMocks.instances[0];
    const diagramRect = pdf.rectDraws.find((rect) => rect.width > 100);
    expect(diagramRect).toBeDefined();
    expect(diagramRect?.height).toBeLessThan(55);
    expect(svg2pdf).toHaveBeenCalledWith(
      expect.objectContaining({
        tagName: expect.stringMatching(/^svg$/i),
      }),
      pdf,
      expect.objectContaining({
        height: expect.any(Number),
        width: expect.any(Number),
      }),
    );
  });

  it("does not render or write when the save dialog is cancelled", async () => {
    dialogMocks.save.mockResolvedValueOnce(null);
    const root = makeExportRoot();

    await exportMarkdownPdf({ root, sourcePath: "/docs/readme.md" });

    expect(pdfMocks.jsPDF).not.toHaveBeenCalled();
    expect(tauriMocks.invokeWriteBinaryFile).not.toHaveBeenCalled();
  });
});
