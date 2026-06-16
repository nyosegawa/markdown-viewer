type MathDocument = ReturnType<typeof import("mathjax-full/js/mathjax.js").mathjax.document>;
type JsPdf = InstanceType<typeof import("jspdf").jsPDF>;

export interface MathSvg {
  svg: string;
  aspectRatio: number;
}

let mathDocumentPromise: Promise<{
  adaptor: import("mathjax-full/js/adaptors/liteAdaptor.js").LiteAdaptor;
  html: MathDocument;
}> | null = null;

const mathSvgCache = new Map<string, MathSvg>();

function hasNonAsciiText(text: string): boolean {
  return Array.from(text).some((char) => char.charCodeAt(0) > 0x7f);
}

async function getMathDocument() {
  mathDocumentPromise ??= Promise.all([
    import("mathjax-full/js/mathjax.js"),
    import("mathjax-full/js/input/tex.js"),
    import("mathjax-full/js/output/svg.js"),
    import("mathjax-full/js/adaptors/liteAdaptor.js"),
    import("mathjax-full/js/handlers/html.js"),
  ]).then(([mathjaxModule, texModule, svgModule, adaptorModule, htmlModule]) => {
    const adaptor = adaptorModule.liteAdaptor();
    htmlModule.RegisterHTMLHandler(adaptor);
    const tex = new texModule.TeX({ packages: ["base", "ams"] });
    const svg = new svgModule.SVG({ fontCache: "none" });
    const html = mathjaxModule.mathjax.document("", { InputJax: tex, OutputJax: svg });
    return { adaptor, html };
  });
  return mathDocumentPromise;
}

function svgAspectRatio(svg: string): number {
  const viewBox = svg
    .match(/viewBox="([^"]+)"/)?.[1]
    ?.split(/\s+/)
    .map(Number);
  if (viewBox && viewBox.length === 4 && viewBox[3] > 0) return viewBox[2] / viewBox[3];
  return 4;
}

export async function renderMathSvg(tex: string, display: boolean): Promise<MathSvg | null> {
  const source = tex.trim();
  if (!source) return null;
  const key = `${display ? "display" : "inline"}:${source}`;
  const cached = mathSvgCache.get(key);
  if (cached) return cached;
  const { adaptor, html } = await getMathDocument();
  const node = html.convert(source, { display });
  const outer = adaptor.outerHTML(node);
  const svg = outer.match(/<svg[\s\S]*<\/svg>/)?.[0];
  if (!svg) return null;
  const rendered = { svg, aspectRatio: svgAspectRatio(svg) };
  mathSvgCache.set(key, rendered);
  return rendered;
}

export async function drawMathSvg(
  pdf: JsPdf,
  rendered: MathSvg,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const raster = hasNonAsciiText(rendered.svg) ? await rasterizeSvg(rendered.svg) : null;
  if (raster) {
    pdf.addImage(raster, "PNG", x, y, width, height);
    return;
  }
  const { svg2pdf } = await import("svg2pdf.js");
  const svg = new DOMParser().parseFromString(rendered.svg, "image/svg+xml").documentElement;
  await svg2pdf(svg, pdf, { x, y, width, height });
}

async function rasterizeSvg(svg: string): Promise<string | null> {
  if (typeof Image === "undefined" || typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  const viewBox = svg
    .match(/viewBox="([^"]+)"/)?.[1]
    ?.split(/\s+/)
    .map(Number);
  const sourceWidth = viewBox && viewBox.length === 4 ? Math.max(1, viewBox[2]) : 800;
  const sourceHeight = viewBox && viewBox.length === 4 ? Math.max(1, viewBox[3]) : 200;
  const scale = 3;
  canvas.width = Math.ceil(sourceWidth * scale);
  canvas.height = Math.ceil(sourceHeight * scale);

  const image = new Image();
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("failed to rasterize math svg"));
    image.src = url;
  }).catch(() => null);
  if (!image.complete) return null;

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
