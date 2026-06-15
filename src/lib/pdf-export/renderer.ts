import { installPdfFonts, type PdfFontBytes } from "@/lib/pdf-export/fonts";
import { renderMarkdownLayout } from "@/lib/pdf-export/layout";

export async function renderMarkdownPdfBytes(
  element: HTMLElement,
  sourcePath: string,
  fontBytes?: PdfFontBytes,
): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  await installPdfFonts(pdf, fontBytes);
  await renderMarkdownLayout(pdf, element, sourcePath);
  return new Uint8Array(pdf.output("arraybuffer"));
}
