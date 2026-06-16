import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { test } from "vitest";
import { SyncMarkdownRenderer } from "../src/lib/markdown";
import { renderMarkdownPdfBytes } from "../src/lib/pdf-export";

const OUT_DIR = "/tmp/markdown-viewer-pdf-visual-qa";
const OUT_PDF = join(OUT_DIR, "visual-qa.pdf");

const inlineTick = "`";
const fence = "```";

const QA_MARKDOWN = [
  "---",
  "title: PDF visual QA",
  "slug: very-long-front-matter-value-that-must-wrap-inside-the-metadata-table-without-crossing-the-border-1234567890",
  "---",
  "",
  "# H1 見出し",
  "",
  "## H2 見出し",
  "",
  "### H3 見出し",
  "",
  "#### H4 見出し",
  "",
  `本文と **これは太字例です** と *これは斜体例です* と ${inlineTick}inlineCode()${inlineTick} と行の中の数式 $E = mc^2 + \\text{日本語}$ を同じ段落で確認する。`,
  "",
  `長いインラインコード ${inlineTick}veryLongInlineCodeIdentifier.with.deep.property.access.andNoNaturalBreakpoints1234567890${inlineTick} と URL https://example.com/docs/this/is/a/very/long/path/without/many/good/wrap/points?query=abcdefghijklmnopqrstuvwxyz を含んでも本文幅に収まること。`,
  "",
  "- 通常の箇条書きと `inline code` が同じ行で読めること",
  "  - ネストした箇条書きが親項目と重ならないこと",
  "    1. 番号付きの深い項目も自然なインデントになること",
  "- [x] 完了タスク",
  "- [ ] 未完了タスクにとても長いテキストが続いてもチェックボックスと本文が重ならないこと",
  "",
  "> 単行引用は背景色の縦軸中央に見えること。",
  "",
  "> 複数行の引用です。背景色の下側だけが余らず、テキストブロックが矩形の中央に落ち着いて見えることを確認します。二行以上でも上寄りにも下寄りにも見えないこと。",
  "",
  "| Element | Expected | Notes |",
  "|---|---|---|",
  "| Table | Header is bold | セル内の縦位置が上すぎない |",
  "| Long cell | Wraps inside border | 長い文章でも罫線を突き抜けず自然に折り返す |",
  `| Inline code | ${inlineTick}tableCellWithVeryLongInlineCodeTokenAndNoBreaks1234567890${inlineTick} | 枠内で自然に折り返す |`,
  "| URL | https://example.com/extremely/long/table/cell/value/abcdefghijklmnopqrstuvwxyz/1234567890 | 横にはみ出さない |",
  "",
  `${fence}ts`,
  "export function sample(value: string) {",
  "  // 日本語コメントが文字化けしないこと",
  "  const label = '日本語のコード文字列';",
  "  const veryLongIdentifierWithoutGoodBreakpoints = value + '.abcdefghijklmnopqrstuvwxyz.1234567890.abcdefghijklmnopqrstuvwxyz.1234567890';",
  "  return value.trim();",
  "}",
  fence,
  "",
  "![長い代替テキストを持つ画像フォールバック](./missing-image-with-long-filename-that-still-must-wrap-inside-the-pdf-output.png)",
  "",
  "$$",
  String.raw`f(x) = \int_0^1 x^2 dx + \text{日本語}`,
  "$$",
  "",
].join("\n");

function renderMarkdownBody(): HTMLElement {
  const result = render(createElement(SyncMarkdownRenderer, { source: QA_MARKDOWN }));
  const body = result.container.querySelector<HTMLElement>(".markdown-body");
  if (!body) throw new Error("visual QA markdown body did not render");
  return body;
}

test(
  "writes PDF visual QA artifact",
  async () => {
    await mkdir(OUT_DIR, { recursive: true });
    const [regular, bold, heading] = await Promise.all([
      readFile("src/assets/fonts/NotoSansJP-Regular.ttf"),
      readFile("src/assets/fonts/NotoSansJP-Bold.ttf"),
      readFile("src/assets/fonts/NotoSansJP-Black.ttf"),
    ]);
    const bytes = await renderMarkdownPdfBytes(renderMarkdownBody(), "/tmp/visual-qa.md", {
      regular: new Uint8Array(regular),
      bold: new Uint8Array(bold),
      heading: new Uint8Array(heading),
    });
    await writeFile(OUT_PDF, bytes);
    console.log(`wrote ${OUT_PDF}`);
  },
  30_000,
);
