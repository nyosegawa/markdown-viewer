import { basename } from "@/lib/path-label";
import {
  type JsPdf,
  PDF_FONT_BOLD_NAME,
  PDF_FONT_HEADING_NAME,
  PDF_FONT_NAME,
} from "@/lib/pdf-export/fonts";
import { addInlineBlock, mathSourceText } from "@/lib/pdf-export/inline";
import { drawMathSvg, renderMathSvg } from "@/lib/pdf-export/math";
import {
  COLORS,
  childText,
  cleanText,
  drawBoldText,
  drawText,
  ensureSpace,
  type Layout,
  setTextColor,
  splitPreservedTextToLines,
  splitTextToLines,
  TYPE,
} from "@/lib/pdf-export/style";

const QUOTE_TEXT_BASELINE_OFFSET = 4.65;
const DISPLAY_MATH_HEIGHT = 11;
const CODE_BLOCK_AFTER = 7.2;

function drawRule(pdf: JsPdf, layout: Layout, y: number, color = COLORS.rule) {
  pdf.setDrawColor(color);
  pdf.setLineWidth(0.25);
  pdf.line(layout.x, y, layout.x + layout.contentWidth, y);
}

function addTextBlock(
  pdf: JsPdf,
  layout: Layout,
  text: string,
  options: {
    fontSize: number;
    lineHeight: number;
    before?: number;
    after?: number;
    indent?: number;
    color?: string;
    width?: number;
  },
) {
  const normalized = cleanText(text);
  if (!normalized) return;
  const before = options.before ?? 0;
  const after = options.after ?? 3;
  const indent = options.indent ?? 0;
  layout.y += before;
  pdf.setFont(PDF_FONT_NAME, "normal");
  pdf.setFontSize(options.fontSize);
  setTextColor(pdf, options.color);
  const width = options.width ?? layout.contentWidth - indent;
  const lines = splitTextToLines(pdf, normalized, width);
  for (const line of lines) {
    ensureSpace(pdf, layout, options.lineHeight);
    drawText(pdf, line, layout.x + indent, layout.y);
    layout.y += options.lineHeight;
  }
  layout.y += after;
}

function addHeading(pdf: JsPdf, layout: Layout, el: HTMLElement) {
  const level = Number(el.tagName.slice(1));
  const fontSize = level === 1 ? 21 : level === 2 ? 15.5 : level === 3 ? 12.5 : 11;
  const lineHeight = fontSize * 0.5 + 1.2;
  const before = level === 1 ? (layout.y > 24 ? 9 : 0) : 6.5;
  const after = level <= 2 ? 5.5 : 3.5;
  layout.y += before;
  pdf.setFont(PDF_FONT_HEADING_NAME, "normal");
  pdf.setFontSize(fontSize);
  setTextColor(pdf, COLORS.ink);
  const lines = splitTextToLines(pdf, childText(el), layout.contentWidth);
  ensureSpace(pdf, layout, lines.length * lineHeight + after + 2);
  for (const line of lines) {
    drawBoldText(pdf, line, layout.x, layout.y);
    layout.y += lineHeight;
  }
  if (level <= 2) {
    drawRule(pdf, layout, layout.y, COLORS.rule);
    layout.y += 2;
  }
  layout.y += after;
}

function listItemOwnText(item: Element): string {
  const parts: string[] = [];
  for (const node of Array.from(item.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? "");
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const child = node as Element;
    if (child.tagName === "UL" || child.tagName === "OL") continue;
    if (child.tagName === "INPUT") continue;
    parts.push(child.textContent ?? "");
  }
  return cleanText(parts.join(" "));
}

function drawListMarker(
  pdf: JsPdf,
  marker: string,
  markerRightX: number,
  baselineY: number,
  options: { ordered: boolean; checkbox?: HTMLInputElement | null },
) {
  if (options.checkbox) {
    const size = 3.4;
    const x = markerRightX - size;
    const y = baselineY - 3.4;
    pdf.setDrawColor(COLORS.text);
    pdf.setLineWidth(0.28);
    pdf.rect(x, y, size, size);
    if (options.checkbox.checked) {
      pdf.setLineWidth(0.35);
      pdf.line(x + 0.65, y + 1.8, x + 1.4, y + 2.55);
      pdf.line(x + 1.4, y + 2.55, x + 2.75, y + 0.8);
    }
    setTextColor(pdf, COLORS.text);
    return;
  }
  if (!options.ordered) {
    pdf.setFillColor(COLORS.text);
    pdf.circle(markerRightX - 1.35, baselineY - 1.8, 0.55, "F");
    setTextColor(pdf, COLORS.text);
    return;
  }
  const markerWidth = pdf.getTextWidth(marker);
  drawText(pdf, marker, markerRightX - markerWidth, baselineY);
}

function addList(pdf: JsPdf, layout: Layout, el: HTMLElement, depth = 0) {
  const ordered = el.tagName === "OL";
  const items = Array.from(el.children).filter((child) => child.tagName === "LI");
  for (const [index, item] of items.entries()) {
    const checkbox = item.querySelector<HTMLInputElement>(":scope > input[type='checkbox']");
    const marker = checkbox ? (checkbox.checked ? "☑" : "☐") : ordered ? `${index + 1}.` : "•";
    const text = listItemOwnText(item);
    pdf.setFont(PDF_FONT_NAME, "normal");
    pdf.setFontSize(TYPE.bodySize);
    setTextColor(pdf);
    const indent = Math.min(depth * 5.2, 16);
    const markerX = layout.x + 4.2 + indent;
    const textX = layout.x + (ordered ? 8.8 : 7.2) + indent;
    const lineHeight = 6.4;
    if (text) {
      const lines = splitTextToLines(pdf, text, layout.contentWidth - 10 - indent);
      for (const [lineIndex, line] of lines.entries()) {
        ensureSpace(pdf, layout, lineHeight);
        if (lineIndex === 0) {
          drawListMarker(pdf, marker, markerX, layout.y, { ordered, checkbox });
        }
        drawText(pdf, line, textX, layout.y);
        layout.y += lineHeight;
      }
      layout.y += 0.8;
    }
    for (const nested of Array.from(item.children).filter(
      (child) => child.tagName === "UL" || child.tagName === "OL",
    )) {
      addList(pdf, layout, nested as HTMLElement, depth + 1);
    }
  }
  if (depth === 0) layout.y += 3.2;
}

function addCodeBlock(pdf: JsPdf, layout: Layout, el: HTMLElement) {
  const text = (el.textContent ?? "").replace(/\n$/, "");
  if (!text.trim()) return;
  pdf.setFont(PDF_FONT_NAME, "normal");
  pdf.setFontSize(TYPE.codeSize);
  const lines = text
    .split("\n")
    .flatMap((line) => splitPreservedTextToLines(pdf, line, layout.contentWidth - 10));
  const lineHeight = TYPE.codeLine;
  const topPadding = 4;
  const bottomPadding = 3.2;
  let index = 0;
  while (index < lines.length) {
    ensureSpace(pdf, layout, lineHeight + topPadding + bottomPadding);
    const availableLines = Math.max(
      1,
      Math.floor(
        (layout.pageHeight - layout.margin - layout.y - topPadding - bottomPadding) / lineHeight,
      ),
    );
    const chunk = lines.slice(index, index + availableLines);
    const boxTop = layout.y - 3;
    const boxHeight = chunk.length * lineHeight + topPadding + bottomPadding;
    pdf.setFillColor(COLORS.soft);
    pdf.setDrawColor(COLORS.border);
    pdf.setLineWidth(0.25);
    pdf.rect(layout.x, boxTop, layout.contentWidth, boxHeight, "FD");
    setTextColor(pdf, COLORS.text);
    let lineY = boxTop + topPadding + 2.45;
    for (const line of chunk) {
      drawText(pdf, line, layout.x + 5, lineY);
      lineY += lineHeight;
    }
    layout.y = boxTop + boxHeight + CODE_BLOCK_AFTER;
    index += chunk.length;
  }
}

function addBlockquote(pdf: JsPdf, layout: Layout, el: HTMLElement) {
  const text = childText(el);
  if (!text) return;
  pdf.setFont(PDF_FONT_NAME, "normal");
  pdf.setFontSize(TYPE.bodySize);
  setTextColor(pdf, COLORS.quoteText);
  const lineHeight = TYPE.bodyLine;
  const lines = splitTextToLines(pdf, text, layout.contentWidth - 14);
  const textBlockHeight = Math.max(lineHeight, lines.length * lineHeight);
  const boxHeight = Math.max(15, textBlockHeight + 7.2);
  ensureSpace(pdf, layout, boxHeight + 5);
  const top = layout.y - 3;
  pdf.setFillColor(COLORS.quoteFill);
  pdf.rect(layout.x, top, layout.contentWidth, boxHeight, "F");
  pdf.setDrawColor(COLORS.quoteBorder);
  pdf.setLineWidth(1.2);
  pdf.line(layout.x, top + 0.8, layout.x, top + boxHeight - 0.8);
  setTextColor(pdf, COLORS.quoteText);
  let lineY = top + (boxHeight - textBlockHeight) / 2 + QUOTE_TEXT_BASELINE_OFFSET;
  for (const line of lines) {
    drawText(pdf, line, layout.x + 8, lineY);
    lineY += lineHeight;
  }
  layout.y = top + boxHeight + 4.2;
}

function addTable(pdf: JsPdf, layout: Layout, el: HTMLElement) {
  const rows = Array.from(el.querySelectorAll("tr"));
  if (rows.length === 0) return;
  layout.y += 2;
  const columnCount = Math.max(...rows.map((row) => row.children.length));
  const columnWidth = layout.contentWidth / Math.max(columnCount, 1);
  pdf.setFont(PDF_FONT_NAME, "normal");
  pdf.setFontSize(TYPE.tableSize);
  const xPadding = 3.4;
  const topPadding = 5.2;
  const baselineOffset = 2.1;
  const preparedRows = rows.map((row) => {
    const cells = Array.from(row.children);
    const cellLines = cells.map((cell) =>
      splitTextToLines(pdf, childText(cell), columnWidth - xPadding * 2),
    );
    const rowHeight = Math.max(
      10.5,
      Math.max(...cellLines.map((lines) => lines.length)) * TYPE.tableLine + 7.4,
    );
    return { cellLines, rowHeight };
  });
  const totalHeight = preparedRows.reduce((sum, row) => sum + row.rowHeight, 0) + 5;
  if (totalHeight <= layout.pageHeight - layout.margin - 22) ensureSpace(pdf, layout, totalHeight);
  for (const [rowIndex, row] of preparedRows.entries()) {
    const maxLineCount = Math.max(...row.cellLines.map((lines) => lines.length), 1);
    let lineOffset = 0;
    while (lineOffset < maxLineCount) {
      let availableLines = Math.floor(
        (layout.pageHeight - layout.margin - layout.y - 7.4) / TYPE.tableLine,
      );
      if (availableLines < 1) {
        ensureSpace(pdf, layout, layout.pageHeight);
        availableLines = Math.floor(
          (layout.pageHeight - layout.margin - layout.y - 7.4) / TYPE.tableLine,
        );
      }
      const lineCount = Math.max(1, Math.min(maxLineCount - lineOffset, availableLines));
      const chunkLines = row.cellLines.map((lines) =>
        lines.slice(lineOffset, lineOffset + lineCount),
      );
      const chunkHeight = Math.max(
        10.5,
        Math.max(...chunkLines.map((lines) => lines.length), 1) * TYPE.tableLine + 7.4,
      );
      ensureSpace(pdf, layout, chunkHeight);
      if (rowIndex === 0 || rowIndex % 2 === 1) {
        pdf.setFillColor(rowIndex === 0 ? "#eef2f6" : COLORS.softer);
        pdf.rect(layout.x, layout.y - topPadding, layout.contentWidth, chunkHeight, "F");
      }
      pdf.setDrawColor(COLORS.border);
      pdf.setLineWidth(0.25);
      for (let col = 0; col < columnCount; col += 1) {
        const x = layout.x + col * columnWidth;
        pdf.rect(x, layout.y - topPadding, columnWidth, chunkHeight);
        pdf.setFont(rowIndex === 0 ? PDF_FONT_BOLD_NAME : PDF_FONT_NAME, "normal");
        setTextColor(pdf, rowIndex === 0 ? COLORS.ink : COLORS.text);
        for (const [lineIndex, line] of (chunkLines[col] ?? []).entries()) {
          const cellY = layout.y + baselineOffset + lineIndex * TYPE.tableLine;
          if (rowIndex === 0) {
            drawBoldText(pdf, line, x + xPadding, cellY);
          } else {
            drawText(pdf, line, x + xPadding, cellY);
          }
        }
      }
      layout.y += chunkHeight;
      lineOffset += lineCount;
    }
  }
  layout.y += 5;
}

function addHorizontalRule(pdf: JsPdf, layout: Layout) {
  ensureSpace(pdf, layout, 5);
  drawRule(pdf, layout, layout.y, COLORS.rule);
  layout.y += 6;
}

function addFrontMatter(pdf: JsPdf, layout: Layout, el: HTMLElement) {
  const rows = Array.from(el.querySelectorAll<HTMLElement>(".front-matter-row"));
  if (rows.length === 0) return;
  const keyWidth = Math.min(42, layout.contentWidth * 0.3);
  const valueWidth = layout.contentWidth - keyWidth - 8;
  pdf.setFont(PDF_FONT_NAME, "normal");
  pdf.setFontSize(TYPE.smallSize);
  layout.y += 2;
  for (const row of rows) {
    const key = childText(row.querySelector(".front-matter-key") ?? row);
    const value = childText(row.querySelector(".front-matter-value") ?? row);
    const keyLines = splitTextToLines(pdf, key, keyWidth);
    const valueLines = splitTextToLines(pdf, value, valueWidth);
    const rowHeight = Math.max(keyLines.length, valueLines.length, 1) * 4.8 + 4;
    ensureSpace(pdf, layout, rowHeight);
    pdf.setFillColor(COLORS.softer);
    pdf.setDrawColor(COLORS.border);
    pdf.setLineWidth(0.25);
    pdf.rect(layout.x, layout.y - 4, layout.contentWidth, rowHeight, "FD");
    setTextColor(pdf, COLORS.muted);
    const baselineOffset = 1.5;
    for (const [index, line] of keyLines.entries()) {
      drawText(pdf, line, layout.x + 3, layout.y + baselineOffset + index * 4.8);
    }
    setTextColor(pdf, COLORS.text);
    for (const [index, line] of valueLines.entries()) {
      drawText(pdf, line, layout.x + keyWidth + 6, layout.y + baselineOffset + index * 4.8);
    }
    layout.y += rowHeight;
  }
  layout.y += 6;
}

function addMediaFallback(pdf: JsPdf, layout: Layout, el: HTMLElement) {
  const label =
    el.tagName === "IMG"
      ? `Image: ${el.getAttribute("alt") || el.getAttribute("src") || ""}`
      : childText(el);
  if (!label) return;
  pdf.setFont(PDF_FONT_NAME, "normal");
  pdf.setFontSize(9);
  const lines = splitTextToLines(pdf, label, layout.contentWidth - 6);
  const height = Math.max(11, lines.length * 4.8 + 5);
  ensureSpace(pdf, layout, height + 2);
  pdf.setFillColor(COLORS.softer);
  pdf.setDrawColor(COLORS.border);
  pdf.setLineWidth(0.25);
  pdf.rect(layout.x, layout.y - 5, layout.contentWidth, height, "FD");
  setTextColor(pdf, COLORS.muted);
  for (const [index, line] of lines.entries()) {
    drawText(pdf, line, layout.x + 3, layout.y + 2.6 + index * 4.8);
  }
  layout.y += height + 2;
}

async function imageDataUrl(img: HTMLImageElement): Promise<string | null> {
  if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

async function addImage(pdf: JsPdf, layout: Layout, img: HTMLImageElement): Promise<boolean> {
  const dataUrl = await imageDataUrl(img).catch(() => null);
  if (!dataUrl) return false;
  const naturalRatio = img.naturalWidth / Math.max(img.naturalHeight, 1);
  const width = Math.min(layout.contentWidth, img.naturalWidth * 0.264583);
  const height = width / Math.max(naturalRatio, 0.1);
  const maxHeight = layout.pageHeight - layout.margin - 22;
  const drawHeight = Math.min(height, maxHeight);
  const drawWidth = drawHeight === height ? width : drawHeight * naturalRatio;
  ensureSpace(pdf, layout, drawHeight + 8);
  const x = layout.x + (layout.contentWidth - drawWidth) / 2;
  const top = layout.y - 3;
  pdf.addImage(dataUrl, "PNG", x, top, drawWidth, drawHeight);
  const alt = cleanText(img.getAttribute("alt") ?? "");
  layout.y = top + drawHeight + 4;
  if (alt) {
    pdf.setFont(PDF_FONT_NAME, "normal");
    pdf.setFontSize(TYPE.smallSize);
    setTextColor(pdf, COLORS.muted);
    const lines = splitTextToLines(pdf, alt, layout.contentWidth - 6);
    for (const line of lines) {
      ensureSpace(pdf, layout, 4.8);
      drawText(pdf, line, layout.x + 3, layout.y);
      layout.y += 4.8;
    }
    layout.y += 2;
  }
  return true;
}

async function addDisplayMath(pdf: JsPdf, layout: Layout, el: HTMLElement) {
  const text = mathSourceText(el);
  if (!text) return;
  ensureSpace(pdf, layout, 15);
  const top = layout.y - 4;
  const height = 13;
  pdf.setFillColor(COLORS.softer);
  pdf.setDrawColor(COLORS.border);
  pdf.setLineWidth(0.25);
  pdf.rect(layout.x, top, layout.contentWidth, height, "FD");
  const rendered = await renderMathSvg(text, true);
  if (rendered) {
    const width = Math.min(layout.contentWidth - 12, DISPLAY_MATH_HEIGHT * rendered.aspectRatio);
    await drawMathSvg(
      pdf,
      rendered,
      layout.x + (layout.contentWidth - width) / 2,
      top + (height - DISPLAY_MATH_HEIGHT) / 2,
      width,
      DISPLAY_MATH_HEIGHT,
    );
  } else {
    pdf.setFont(PDF_FONT_NAME, "normal");
    pdf.setFontSize(12);
    setTextColor(pdf, COLORS.ink);
    const textWidth = pdf.getTextWidth(text);
    drawText(pdf, text, layout.x + (layout.contentWidth - textWidth) / 2, top + 8);
  }
  layout.y = top + height + 5;
}

function addPageFooters(pdf: JsPdf, layout: Layout, sourcePath: string) {
  const pageCount = pdf.getNumberOfPages();
  const label = basename(sourcePath);
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont(PDF_FONT_NAME, "normal");
    pdf.setFontSize(8);
    pdf.setLineWidth(0.15);
    pdf.setDrawColor("#e5e7eb");
    pdf.line(
      layout.x,
      layout.pageHeight - 12,
      layout.x + layout.contentWidth,
      layout.pageHeight - 12,
    );
    setTextColor(pdf, "#6b7280");
    drawText(pdf, label, layout.x, layout.pageHeight - 7);
    const pageLabel = `${page} / ${pageCount}`;
    const pageLabelWidth = pdf.getTextWidth(pageLabel);
    drawText(
      pdf,
      pageLabel,
      layout.x + layout.contentWidth - pageLabelWidth,
      layout.pageHeight - 7,
    );
  }
  pdf.setPage(pageCount);
}

function estimateHeadingWithNextHeight(heading: HTMLElement, next: HTMLElement | undefined) {
  const level = Number(heading.tagName.slice(1));
  const headingHeight = level === 1 ? 20 : level === 2 ? 17 : 14;
  if (!next) return headingHeight;
  if (next.tagName === "TABLE") {
    const rowCount = next.querySelectorAll("tr").length;
    return headingHeight + Math.max(48, rowCount * 12 + 14);
  }
  if (next.tagName === "PRE") return headingHeight + 36;
  if (next.tagName === "UL" || next.tagName === "OL") return headingHeight + 32;
  if (next.tagName === "BLOCKQUOTE") return headingHeight + 28;
  return headingHeight + 24;
}

async function renderElement(pdf: JsPdf, layout: Layout, el: HTMLElement) {
  if (/^H[1-6]$/.test(el.tagName)) {
    addHeading(pdf, layout, el);
    return;
  }
  if (el.tagName === "P") {
    const directImages = Array.from(el.children).filter(
      (child): child is HTMLImageElement => child.tagName === "IMG",
    );
    await addInlineBlock(pdf, layout, el, {
      fontSize: TYPE.bodySize,
      lineHeight: TYPE.bodyLine,
      after: 4.2,
    });
    for (const image of directImages) {
      if (!(await addImage(pdf, layout, image))) {
        addMediaFallback(pdf, layout, image);
      }
    }
    return;
  }
  if (el.tagName === "UL" || el.tagName === "OL") {
    addList(pdf, layout, el);
    return;
  }
  if (el.tagName === "PRE") {
    addCodeBlock(pdf, layout, el);
    return;
  }
  if (el.tagName === "BLOCKQUOTE") {
    addBlockquote(pdf, layout, el);
    return;
  }
  if (el.tagName === "TABLE") {
    addTable(pdf, layout, el);
    return;
  }
  if (el.tagName === "HR") {
    addHorizontalRule(pdf, layout);
    return;
  }
  if (el.classList.contains("front-matter")) {
    addFrontMatter(pdf, layout, el);
    return;
  }
  if (el.classList.contains("katex-display")) {
    await addDisplayMath(pdf, layout, el);
    return;
  }
  if (el.tagName === "IMG") {
    if (!(await addImage(pdf, layout, el as HTMLImageElement))) {
      addMediaFallback(pdf, layout, el);
    }
    return;
  }
  if (el.tagName === "SVG") {
    addMediaFallback(pdf, layout, el);
    return;
  }
  addTextBlock(pdf, layout, childText(el), { fontSize: 10.5, lineHeight: 6, after: 4 });
}

export async function renderMarkdownLayout(
  pdf: JsPdf,
  element: HTMLElement,
  sourcePath: string,
): Promise<void> {
  const layout: Layout = {
    x: 18,
    y: 22,
    pageWidth: pdf.internal.pageSize.getWidth(),
    pageHeight: pdf.internal.pageSize.getHeight(),
    margin: 18,
    contentWidth: pdf.internal.pageSize.getWidth() - 36,
  };

  const children = Array.from(element.children) as HTMLElement[];
  for (const [index, child] of children.entries()) {
    if (/^H[1-6]$/.test(child.tagName)) {
      ensureSpace(pdf, layout, estimateHeadingWithNextHeight(child, children[index + 1]));
    }
    await renderElement(pdf, layout, child);
  }

  addPageFooters(pdf, layout, sourcePath);
}
