import { memo, useEffect, useId, useMemo, useRef, useState } from "react";

type MermaidTheme = "light" | "dark";

interface MermaidDiagramProps {
  source: string;
  sourceStart?: string;
  sourceEnd?: string;
}

interface MermaidState {
  status: "loading" | "rendered" | "error";
  svg: string | null;
  bindFunctions: ((element: Element) => void) | null;
  error: string | null;
}

let initializePromise: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  initializePromise ??= import("mermaid").then(({ default: mermaid }) => {
    return mermaid;
  });
  return initializePromise;
}

function mermaidThemeVariables(theme: MermaidTheme) {
  const fontFamily =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  if (theme === "dark") {
    return {
      background: "transparent",
      mainBkg: "#161c24",
      primaryColor: "#1f6feb",
      primaryBorderColor: "#c9d1d9",
      primaryTextColor: "#f0f6fc",
      lineColor: "#f0f6fc",
      defaultLinkColor: "#f0f6fc",
      secondaryColor: "#21262d",
      tertiaryColor: "#0d1117",
      nodeBorder: "#c9d1d9",
      clusterBkg: "#11161d",
      clusterBorder: "#8b949e",
      edgeLabelBackground: "#0b0f14",
      titleColor: "#f0f6fc",
      fontFamily,
    };
  }
  return {
    background: "transparent",
    mainBkg: "#ffffff",
    primaryColor: "#f6f8fa",
    primaryBorderColor: "#8c959f",
    primaryTextColor: "#1f2328",
    lineColor: "#57606a",
    defaultLinkColor: "#57606a",
    secondaryColor: "#eef4ff",
    tertiaryColor: "#f6f8fa",
    nodeBorder: "#8c959f",
    clusterBkg: "#f6f8fa",
    clusterBorder: "#57606a",
    edgeLabelBackground: "#ffffff",
    titleColor: "#1f2328",
    fontFamily,
  };
}

function configureMermaid(mermaid: typeof import("mermaid").default, theme: MermaidTheme) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: mermaidThemeVariables(theme),
    flowchart: {
      htmlLabels: false,
      curve: "basis",
      padding: 12,
    },
  });
}

function readDocumentTheme(): MermaidTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function useDocumentTheme(): MermaidTheme {
  const [theme, setTheme] = useState<MermaidTheme>(readDocumentTheme);

  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      setTheme(readDocumentTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  return theme;
}

function renderId(id: string): string {
  return `mermaid-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function renderMermaidSvg(
  mermaid: typeof import("mermaid").default,
  id: string,
  source: string,
  theme: MermaidTheme,
) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  document.body.appendChild(container);
  try {
    configureMermaid(mermaid, theme);
    const rendered = await mermaid.render(id, source, container);
    return rendered;
  } finally {
    container.remove();
  }
}

function MermaidDiagramInner({ source, sourceStart, sourceEnd }: MermaidDiagramProps) {
  const reactId = useId();
  const id = useMemo(() => renderId(reactId), [reactId]);
  const figureRef = useRef<HTMLElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const documentTheme = useDocumentTheme();
  const [svgReady, setSvgReady] = useState(false);
  const [state, setState] = useState<MermaidState>({
    status: "loading",
    svg: null,
    bindFunctions: null,
    error: null,
  });

  useEffect(() => {
    let canceled = false;
    setSvgReady(false);
    setState({ status: "loading", svg: null, bindFunctions: null, error: null });

    loadMermaid()
      .then(async (mermaid) => {
        const renderTheme = figureRef.current?.closest(".pdf-export-surface")
          ? "light"
          : documentTheme;
        const rendered = await renderMermaidSvg(mermaid, id, source, renderTheme);
        if (!canceled) {
          setState({
            status: rendered.svg ? "rendered" : "error",
            svg: rendered.svg || null,
            bindFunctions: rendered.bindFunctions ?? null,
            error: rendered.svg ? null : "Mermaid did not return SVG output",
          });
        }
      })
      .catch((error: unknown) => {
        if (!canceled) {
          setState({ status: "error", svg: null, bindFunctions: null, error: errorMessage(error) });
        }
      });

    return () => {
      canceled = true;
    };
  }, [documentTheme, id, source]);

  useEffect(() => {
    const host = svgHostRef.current;
    if (!host) return;
    setSvgReady(false);
    host.replaceChildren();
    if (!state.svg) return;

    const svg = new DOMParser().parseFromString(state.svg, "image/svg+xml").documentElement;
    if (svg.tagName.toLowerCase() !== "svg") return;
    host.appendChild(document.importNode(svg, true));
    state.bindFunctions?.(host);
    setSvgReady(true);
  }, [state.bindFunctions, state.svg]);

  const exposedStatus = state.status === "rendered" && !svgReady ? "loading" : state.status;

  return (
    <figure
      ref={figureRef}
      className="mermaid-diagram"
      data-mermaid-source={source}
      data-mermaid-status={exposedStatus}
      data-srcstart={sourceStart}
      data-srcend={sourceEnd}
    >
      {state.svg ? (
        <div ref={svgHostRef} className="mermaid-diagram-svg" />
      ) : (
        <pre className="mermaid-fallback">{source}</pre>
      )}
      {state.error ? <figcaption>{state.error}</figcaption> : null}
    </figure>
  );
}

export const MermaidDiagram = memo(MermaidDiagramInner);
