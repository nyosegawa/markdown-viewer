import notoSansJpBlackUrl from "@/assets/fonts/NotoSansJP-Black.ttf?url";
import notoSansJpBoldUrl from "@/assets/fonts/NotoSansJP-Bold.ttf?url";
import notoSansJpRegularUrl from "@/assets/fonts/NotoSansJP-Regular.ttf?url";

export type JsPdf = InstanceType<typeof import("jspdf").jsPDF>;

export const PDF_FONT_NAME = "NotoSansJP";
export const PDF_FONT_BOLD_NAME = "NotoSansJPBold";
export const PDF_FONT_HEADING_NAME = "NotoSansJPHeading";

const PDF_FONT_REGULAR_FILE = "NotoSansJP-Regular.ttf";
const PDF_FONT_BOLD_FILE = "NotoSansJP-Bold.ttf";
const PDF_FONT_HEADING_FILE = "NotoSansJP-Black.ttf";

export interface PdfFontBytes {
  regular: Uint8Array;
  bold: Uint8Array;
  heading: Uint8Array;
}

function binaryString(bytes: Uint8Array): string {
  let out = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return out;
}

async function loadFontBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`failed to load PDF font: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function loadBundledPdfFonts(): Promise<PdfFontBytes> {
  const [regular, bold, heading] = await Promise.all([
    loadFontBytes(notoSansJpRegularUrl),
    loadFontBytes(notoSansJpBoldUrl),
    loadFontBytes(notoSansJpBlackUrl),
  ]);
  return { regular, bold, heading };
}

export async function installPdfFonts(pdf: JsPdf, fontBytes?: PdfFontBytes) {
  const bytes = fontBytes ?? (await loadBundledPdfFonts());
  pdf.addFileToVFS(PDF_FONT_REGULAR_FILE, binaryString(bytes.regular));
  pdf.addFileToVFS(PDF_FONT_BOLD_FILE, binaryString(bytes.bold));
  pdf.addFileToVFS(PDF_FONT_HEADING_FILE, binaryString(bytes.heading));
  pdf.addFont(PDF_FONT_REGULAR_FILE, PDF_FONT_NAME, "normal");
  pdf.addFont(PDF_FONT_BOLD_FILE, PDF_FONT_BOLD_NAME, "normal");
  pdf.addFont(PDF_FONT_HEADING_FILE, PDF_FONT_HEADING_NAME, "normal");
  pdf.setFont(PDF_FONT_NAME, "normal");
}
