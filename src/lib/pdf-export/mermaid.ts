import { type JsPdf, PDF_FONT_NAME } from "@/lib/pdf-export/fonts";
import { COLORS, ensureSpace, type Layout } from "@/lib/pdf-export/style";

function numericAttribute(svg: SVGSVGElement, name: string): number | null {
  const raw = svg.getAttribute(name);
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function viewBoxSize(svg: SVGSVGElement): { width: number; height: number } | null {
  const raw = svg.getAttribute("viewBox");
  if (!raw) return null;
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [, , width, height] = parts;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

interface SvgBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function finiteNumber(value: string | null, fallback = 0): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function contentBox(svg: SVGSVGElement): SvgBox | null {
  if (typeof svg.getBBox !== "function") return null;
  try {
    const box = svg.getBBox();
    if (box.width <= 0 || box.height <= 0) return null;
    const padding = Math.max(8, Math.min(box.width, box.height) * 0.05);
    return {
      x: box.x - padding,
      y: box.y - padding,
      width: box.width + padding * 2,
      height: box.height + padding * 2,
    };
  } catch {
    return null;
  }
}

function svgSize(svg: SVGSVGElement): { width: number; height: number } {
  const content = contentBox(svg);
  if (content) return { width: content.width, height: content.height };

  const box = viewBoxSize(svg);
  if (box) return box;

  const attrWidth = numericAttribute(svg, "width");
  const attrHeight = numericAttribute(svg, "height");
  if (attrWidth && attrHeight) return { width: attrWidth, height: attrHeight };

  const rect = svg.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) return { width: rect.width, height: rect.height };

  return { width: 640, height: 360 };
}

function normalizeLabelLines(label: string): string[] {
  return label
    .split(/\n+/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

function labelLines(node: SVGForeignObjectElement): string[] {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const lines: string[] = [];
  let current = "";
  let previousWasBreak = false;

  const pushLine = () => {
    lines.push(current);
    current = "";
  };

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    if (currentNode.nodeType === Node.TEXT_NODE) {
      current += currentNode.textContent ?? "";
      previousWasBreak = false;
      continue;
    }

    const element = currentNode as Element;
    if (element.tagName.toLowerCase() === "br") {
      pushLine();
      previousWasBreak = true;
      continue;
    }

    const style = window.getComputedStyle(element);
    if (!previousWasBreak && current.trim() && style.display === "block") {
      pushLine();
    }
    previousWasBreak = false;
  }

  if (current.trim()) {
    lines.push(current);
  }

  return normalizeLabelLines(lines.join("\n"));
}

function foreignObjectToText(node: SVGForeignObjectElement): SVGTextElement | null {
  const lines = labelLines(node);
  if (lines.length === 0) return null;

  const x = finiteNumber(node.getAttribute("x"));
  const y = finiteNumber(node.getAttribute("y"));
  const width = finiteNumber(node.getAttribute("width"));
  const height = finiteNumber(node.getAttribute("height"));
  const fontSize = 16;
  const lineHeight = fontSize * 1.2;
  const totalLineHeight = lineHeight * lines.length;
  const firstBaseline = y + (height - totalLineHeight) / 2 + fontSize * 0.95;
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", String(x + width / 2));
  text.setAttribute("y", String(firstBaseline));
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-family", PDF_FONT_NAME);
  text.setAttribute("font-size", String(fontSize));
  text.setAttribute("font-weight", "400");
  text.setAttribute("fill", "#1f2328");

  for (const [index, line] of lines.entries()) {
    const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    tspan.setAttribute("x", String(x + width / 2));
    if (index > 0) {
      tspan.setAttribute("dy", String(lineHeight));
    }
    tspan.textContent = line;
    text.appendChild(tspan);
  }

  return text;
}

function cloneSvgForPdf(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const box = contentBox(svg);
  if (box) {
    clone.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
  }
  clone.querySelectorAll("foreignObject").forEach((node) => {
    const text = foreignObjectToText(node);
    if (!text) {
      node.remove();
      return;
    }
    node.replaceWith(text);
  });
  return clone;
}

export async function addMermaidDiagram(
  pdf: JsPdf,
  layout: Layout,
  el: HTMLElement,
): Promise<boolean> {
  const svg = el.querySelector<SVGSVGElement>("svg");
  if (!svg) return false;

  const { width, height } = svgSize(svg);
  const aspectRatio = width / Math.max(height, 1);
  const maxHeight = Math.min(95, layout.pageHeight - layout.margin - 24);
  let drawWidth = layout.contentWidth;
  let drawHeight = drawWidth / Math.max(aspectRatio, 0.1);
  if (drawHeight > maxHeight) {
    drawHeight = maxHeight;
    drawWidth = drawHeight * aspectRatio;
  }

  const startY = layout.y;
  const startPageCount = pdf.getNumberOfPages();
  ensureSpace(pdf, layout, drawHeight + 12);
  const top = layout.y - 2;
  const x = layout.x + (layout.contentWidth - drawWidth) / 2;

  pdf.setFillColor("#ffffff");
  pdf.setDrawColor(COLORS.border);
  pdf.setLineWidth(0.25);
  pdf.rect(x - 2, top - 2, drawWidth + 4, drawHeight + 4, "FD");

  const { svg2pdf } = await import("svg2pdf.js");
  try {
    await svg2pdf(cloneSvgForPdf(svg), pdf, {
      x,
      y: top,
      width: drawWidth,
      height: drawHeight,
    });
  } catch (error) {
    console.warn("Mermaid SVG PDF conversion failed", error);
    if (pdf.getNumberOfPages() === startPageCount) {
      layout.y = startY;
    }
    return false;
  }

  layout.y = top + drawHeight + 8;
  return true;
}
