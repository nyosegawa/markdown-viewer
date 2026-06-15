import { basename, splitFilename } from "@/lib/path-label";
import { renderMarkdownPdfBytes } from "@/lib/pdf-export/renderer";
import { invokeWriteBinaryFile, isTauri } from "@/lib/tauri";

export interface ExportMarkdownPdfOptions {
  root: HTMLElement;
  sourcePath: string;
}

export { renderMarkdownPdfBytes };

function defaultPdfName(sourcePath: string): string {
  const name = basename(sourcePath);
  const parts = splitFilename(name);
  return `${parts.stem || "document"}.pdf`;
}

async function selectTauriPdfTarget(filename: string): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  return save({
    defaultPath: filename,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
}

async function saveBrowserPdf(bytes: Uint8Array, filename: string): Promise<void> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function savePdf(bytes: Uint8Array, filename: string, target: string | null): Promise<void> {
  if (isTauri()) {
    if (!target) return;
    await invokeWriteBinaryFile(target, bytes);
    return;
  }
  await saveBrowserPdf(bytes, filename);
}

function isExportBodyReady(element: HTMLElement): boolean {
  return !element.textContent?.trim().startsWith("Loading");
}

async function waitForPdfExportElement(root: HTMLElement): Promise<HTMLElement | null> {
  for (let i = 0; i < 120; i += 1) {
    const element = root.querySelector<HTMLElement>(".markdown-body");
    if (element && isExportBodyReady(element)) return element;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return null;
}

export async function exportMarkdownPdf({
  root,
  sourcePath,
}: ExportMarkdownPdfOptions): Promise<void> {
  const filename = defaultPdfName(sourcePath);
  const target = isTauri() ? await selectTauriPdfTarget(filename) : null;
  if (isTauri() && !target) return;

  const element = await waitForPdfExportElement(root);
  if (!element) throw new Error("PDF export surface did not finish rendering");

  await savePdf(await renderMarkdownPdfBytes(element, sourcePath), filename, target);
}
