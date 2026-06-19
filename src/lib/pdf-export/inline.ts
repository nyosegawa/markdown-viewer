import { type JsPdf, PDF_FONT_BOLD_NAME, PDF_FONT_NAME } from "@/lib/pdf-export/fonts";
import { drawMathSvg, renderMathSvg } from "@/lib/pdf-export/math";
import {
  COLORS,
  childText,
  drawBoldText,
  drawText,
  ensureSpace,
  type Layout,
  setTextColor,
  splitTextToLines,
} from "@/lib/pdf-export/style";

const INLINE_CODE_X_PADDING = 2.1;
const INLINE_CODE_Y_PADDING = 1.15;
const INLINE_CODE_GAP = 0.7;
const INLINE_MATH_HEIGHT = 4.3;

type InlineKind = "normal" | "bold" | "italic" | "code" | "math";

interface InlineSegment {
  text: string;
  kind: InlineKind;
}

function inlineText(text: string): string {
  return text.replace(/\s+/g, " ");
}

export function mathSourceText(el: Element): string {
  const annotation = el.querySelector("annotation[encoding='application/x-tex']");
  return childText(annotation ?? el);
}

function collectInlineSegments(node: Node, inheritedKind: InlineKind = "normal"): InlineSegment[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = inlineText(node.textContent ?? "");
    return text ? [{ text, kind: inheritedKind }] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const el = node as HTMLElement;
  const tag = el.tagName;
  const kind: InlineKind =
    tag === "STRONG" || tag === "B"
      ? "bold"
      : tag === "EM" || tag === "I"
        ? "italic"
        : tag === "CODE"
          ? "code"
          : el.classList.contains("katex")
            ? "math"
            : inheritedKind;

  if (kind === "code" || kind === "math") {
    const text = kind === "math" ? mathSourceText(el) : childText(el);
    return text ? [{ text, kind }] : [];
  }

  return Array.from(el.childNodes).flatMap((child) => collectInlineSegments(child, kind));
}

function setInlineFont(pdf: JsPdf, segment: InlineSegment, fontSize: number) {
  if (segment.kind === "bold") {
    pdf.setFont(PDF_FONT_BOLD_NAME, "normal");
  } else if (segment.kind === "code") {
    pdf.setFont(PDF_FONT_NAME, "normal");
  } else if (segment.kind === "math") {
    pdf.setFont(PDF_FONT_NAME, "normal");
  } else {
    pdf.setFont(PDF_FONT_NAME, "normal");
  }
  pdf.setFontSize(segment.kind === "code" || segment.kind === "math" ? fontSize * 0.9 : fontSize);
}

function splitInlineText(text: string): string[] {
  return text.match(/[^\s]+|\s+/g) ?? [];
}

async function splitOversizeSegment(
  pdf: JsPdf,
  segment: InlineSegment,
  maxWidth: number,
): Promise<InlineSegment[]> {
  const measured = await measureSegment(pdf, segment);
  if (measured <= maxWidth) return [segment];
  if (segment.kind === "math") return [segment];

  const textWidth = Math.max(
    1,
    maxWidth - (segment.kind === "code" ? INLINE_CODE_X_PADDING * 2 : 0),
  );
  return splitTextToLines(pdf, segment.text, textWidth).map((text) => ({ ...segment, text }));
}

async function measureSegment(pdf: JsPdf, segment: InlineSegment): Promise<number> {
  if (segment.kind === "code") {
    return pdf.getTextWidth(segment.text) + INLINE_CODE_X_PADDING * 2 + INLINE_CODE_GAP;
  }
  if (segment.kind === "math") {
    const rendered = await renderMathSvg(segment.text, false);
    return Math.min(46, INLINE_MATH_HEIGHT * (rendered?.aspectRatio ?? 4));
  }
  return pdf.getTextWidth(segment.text);
}

async function drawInlineSegment(
  pdf: JsPdf,
  segment: InlineSegment,
  x: number,
  y: number,
  fontSize: number,
): Promise<number> {
  setInlineFont(pdf, segment, fontSize);
  if (segment.kind === "code") {
    const width = pdf.getTextWidth(segment.text);
    const textX = x + INLINE_CODE_X_PADDING;
    pdf.setFillColor(COLORS.soft);
    pdf.setDrawColor(COLORS.border);
    pdf.setLineWidth(0.18);
    pdf.rect(x, y - 4.05, width + INLINE_CODE_X_PADDING * 2, 4.95 + INLINE_CODE_Y_PADDING, "FD");
    setTextColor(pdf, COLORS.text);
    drawText(pdf, segment.text, textX, y);
    return width + INLINE_CODE_X_PADDING * 2 + INLINE_CODE_GAP;
  }
  if (segment.kind === "math") {
    const rendered = await renderMathSvg(segment.text, false);
    if (rendered) {
      const width = Math.min(46, INLINE_MATH_HEIGHT * rendered.aspectRatio);
      await drawMathSvg(pdf, rendered, x, y - INLINE_MATH_HEIGHT + 0.7, width, INLINE_MATH_HEIGHT);
      return width + 1.2;
    }
  }
  setTextColor(pdf, COLORS.text);
  if (segment.kind === "bold") drawBoldText(pdf, segment.text, x, y);
  else if (segment.kind === "italic") drawText(pdf, segment.text, x + 0.18, y);
  else drawText(pdf, segment.text, x, y);
  return pdf.getTextWidth(segment.text);
}

export async function addInlineBlock(
  pdf: JsPdf,
  layout: Layout,
  el: HTMLElement,
  options: {
    fontSize: number;
    lineHeight: number;
    before?: number;
    after?: number;
    indent?: number;
    width?: number;
  },
) {
  const segments = collectInlineSegments(el).flatMap((segment) =>
    splitInlineText(segment.text).map((text) => ({ ...segment, text })),
  );
  if (segments.length === 0) return;
  const before = options.before ?? 0;
  const after = options.after ?? 3;
  const indent = options.indent ?? 0;
  const width = options.width ?? layout.contentWidth - indent;
  let cursorX = layout.x + indent;
  layout.y += before;
  ensureSpace(pdf, layout, options.lineHeight);
  const pushLine = () => {
    layout.y += options.lineHeight;
    ensureSpace(pdf, layout, options.lineHeight);
    cursorX = layout.x + indent;
  };
  for (const [index, segment] of segments.entries()) {
    if (/^\s+$/.test(segment.text)) {
      setInlineFont(pdf, { ...segment, text: " " }, options.fontSize);
      const spaceWidth = Math.min(pdf.getTextWidth(" "), 1.8);
      if (cursorX > layout.x + indent && cursorX + spaceWidth > layout.x + indent + width) {
        pushLine();
      } else {
        cursorX += spaceWidth;
      }
      continue;
    }
    setInlineFont(pdf, segment, options.fontSize);
    const drawableSegments = await splitOversizeSegment(pdf, segment, width);
    for (const [partIndex, part] of drawableSegments.entries()) {
      setInlineFont(pdf, part, options.fontSize);
      const segmentWidth = await measureSegment(pdf, part);
      if (cursorX > layout.x + indent && cursorX + segmentWidth > layout.x + indent + width) {
        pushLine();
      }
      cursorX += await drawInlineSegment(pdf, part, cursorX, layout.y, options.fontSize);
      if (partIndex < drawableSegments.length - 1) pushLine();
    }
    const next = segments[index + 1];
    if (next && !/^\s+$/.test(next.text) && segment.kind !== next.kind) cursorX += 0.9;
  }
  layout.y += options.lineHeight + after;
}
