import type { JsPdf } from "@/lib/pdf-export/fonts";

export const COLORS = {
  ink: "#1f2328",
  text: "#24292f",
  muted: "#57606a",
  quoteText: "#24292f",
  border: "#c5ced8",
  quoteBorder: "#b6c2cf",
  rule: "#d0d7de",
  soft: "#f6f8fa",
  quoteFill: "#f3f6f9",
  softer: "#fafbfc",
};

export const TYPE = {
  bodySize: 11,
  bodyLine: 6.4,
  smallSize: 9,
  tableSize: 9.2,
  tableLine: 5.4,
  codeSize: 8.7,
  codeLine: 4.8,
};

export interface Layout {
  x: number;
  y: number;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
}

export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function childText(el: Element): string {
  return cleanText(el.textContent ?? "");
}

export function setTextColor(pdf: JsPdf, color = COLORS.text) {
  pdf.setTextColor(color);
}

export function drawText(pdf: JsPdf, text: string, x: number, y: number) {
  pdf.text(text, x, y, { renderingMode: "fill" });
}

export function drawBoldText(pdf: JsPdf, text: string, x: number, y: number) {
  pdf.text(text, x, y, { renderingMode: "fill" });
}

export function ensureSpace(pdf: JsPdf, layout: Layout, height: number) {
  if (layout.y + height <= layout.pageHeight - layout.margin) return;
  pdf.addPage();
  layout.y = 22;
}
