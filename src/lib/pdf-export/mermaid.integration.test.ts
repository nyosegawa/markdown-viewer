import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderMarkdownPdfBytes } from "@/lib/pdf-export/renderer";

vi.mock("@/assets/fonts/NotoSansJP-Bold.ttf?url", () => ({
  default: "/assets/NotoSansJP-Bold.ttf",
}));
vi.mock("@/assets/fonts/NotoSansJP-Black.ttf?url", () => ({
  default: "/assets/NotoSansJP-Black.ttf",
}));
vi.mock("@/assets/fonts/NotoSansJP-Regular.ttf?url", () => ({
  default: "/assets/NotoSansJP-Regular.ttf",
}));

async function fontBytes(url: string): Promise<ArrayBuffer> {
  const filename = url.split("/").at(-1);
  if (!filename) throw new Error(`missing font filename for ${url}`);
  // @ts-expect-error Node built-in types are intentionally not part of the app tsconfig.
  const { readFile } = (await import("node:fs/promises")) as {
    readFile(path: string): Promise<Uint8Array>;
  };
  const cwd = (globalThis as unknown as { process: { cwd(): string } }).process.cwd();
  const bytes = await readFile(`${cwd}/src/assets/fonts/${filename}`);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function makeRootWithMermaidSvg(): HTMLElement {
  const body = document.createElement("article");
  body.className = "markdown-body";
  const figure = document.createElement("figure");
  figure.className = "mermaid-diagram";
  figure.dataset.mermaidStatus = "rendered";
  figure.dataset.mermaidSource = "flowchart TD\nA[Markdown source] --> B[Mermaid SVG]";
  figure.innerHTML = `
    <svg viewBox="0 0 300 120">
      <rect x="20" y="20" width="120" height="40" fill="#ffffff" stroke="#8c959f" />
      <foreignObject x="20" y="20" width="120" height="40"><div>Markdown source</div></foreignObject>
      <rect x="160" y="20" width="120" height="40" fill="#ffffff" stroke="#8c959f" />
      <foreignObject x="160" y="20" width="120" height="40"><div>Mermaid SVG</div></foreignObject>
      <path d="M140 40L160 40" stroke="#57606a" />
    </svg>
  `;
  body.appendChild(figure);
  document.body.appendChild(body);
  return body;
}

describe("renderMarkdownPdfBytes Mermaid integration", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const value = url instanceof Request ? url.url : String(url);
        if (value.startsWith("/assets/")) {
          return {
            ok: true,
            arrayBuffer: async () => fontBytes(value),
          };
        }
        return realFetch(url);
      }),
    );
  });

  it("writes Mermaid diagrams as PDF vector content without image XObjects", async () => {
    const bytes = await renderMarkdownPdfBytes(makeRootWithMermaidSvg(), "/docs/diagram.md");
    const pdfText = new TextDecoder("latin1").decode(bytes);

    expect(pdfText).not.toContain("/Subtype /Image");
    expect(pdfText).toContain("/Subtype /Type1");
  });
});
