import type { Element, Root, RootContent } from "hast";
import type { Plugin } from "unified";

/**
 * Stamp every hast element with `data-srcstart` / `data-srcend` — the byte
 * offset range of the markdown source it was produced from. Downstream code
 * uses these to:
 *   - Copy the original markdown for a DOM selection (Viewer copy handler).
 *   - Jump the editor to the source line matching the viewer's top element.
 *
 * Run this BEFORE rehype-katex / rehype-shiki so positions land on the
 * outer containers before those plugins rewrite children.
 */
const rehypeSourcePosition: Plugin<[], Root> = () => {
  return (tree) => {
    walk(tree);
  };
};

function walk(node: Root | RootContent): void {
  if (node.type === "element") {
    annotate(node);
  }
  if ("children" in node && node.children) {
    for (const child of node.children) walk(child as RootContent);
  }
}

function annotate(node: Element): void {
  const pos = node.position;
  if (!pos) return;
  const start = pos.start?.offset;
  const end = pos.end?.offset;
  if (typeof start !== "number" || typeof end !== "number") return;
  if (!node.properties) node.properties = {};
  node.properties["data-srcstart"] = String(start);
  node.properties["data-srcend"] = String(end);
}

export default rehypeSourcePosition;
