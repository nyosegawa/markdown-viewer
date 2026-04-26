import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// Several tests wait for `Viewer.tsx`'s `lazy(() => import("@/lib/markdown"))`
// to resolve, which pulls remark/rehype/Shiki into a fresh worker. Under
// `vitest run` parallelism the cold dynamic import can take >1s on CI,
// pushing past testing-library's default async timeout (1s) and producing
// "Loading renderer…" timeouts. Bump it once for the whole suite rather
// than per-call, which we'd have to remember at every new findBy* site.
configure({ asyncUtilTimeout: 5000 });

beforeEach(() => {
  // Reset global state that may leak between tests.
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});
