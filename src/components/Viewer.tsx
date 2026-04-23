import { lazy, Suspense } from "react";

const MarkdownRenderer = lazy(async () => {
  const mod = await import("@/lib/markdown");
  return { default: mod.MarkdownRenderer };
});

export interface ViewerProps {
  source: string;
}

export function Viewer({ source }: ViewerProps) {
  return (
    <div className="viewer-scroll" data-testid="viewer-scroll">
      <Suspense
        fallback={
          <article className="markdown-body" data-testid="markdown-body">
            <p>Loading renderer…</p>
          </article>
        }
      >
        <MarkdownRenderer source={source} />
      </Suspense>
    </div>
  );
}
