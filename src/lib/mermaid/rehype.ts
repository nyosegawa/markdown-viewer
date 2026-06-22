interface HastText {
  type: "text";
  value: string;
}

interface HastElement {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

interface HastRoot {
  type: "root";
  children?: HastNode[];
}

type HastNode = HastElement | HastRoot | HastText | { type: string; [key: string]: unknown };

function classNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
  return [];
}

function textContent(node: HastNode): string {
  if (node.type === "text") return (node as HastText).value;
  const children = (node as HastElement | HastRoot).children ?? [];
  return children.map(textContent).join("");
}

function isMermaidPre(node: HastNode): node is HastElement {
  if (node.type !== "element") return false;
  const pre = node as HastElement;
  if (pre.tagName !== "pre") return false;
  const code = pre.children?.find(
    (child): child is HastElement => child.type === "element" && child.tagName === "code",
  );
  if (!code) return false;
  return classNames(code.properties?.className).includes("language-mermaid");
}

function toMermaidDiagram(node: HastElement): HastElement {
  const source = textContent(node).replace(/\n$/, "");
  const sourceStart = node.properties?.dataSrcstart ?? node.properties?.["data-srcstart"];
  const sourceEnd = node.properties?.dataSrcend ?? node.properties?.["data-srcend"];
  return {
    type: "element",
    tagName: "div",
    properties: {
      className: ["mermaid-diagram"],
      "data-mermaid-source": source,
      ...(sourceStart === undefined ? {} : { "data-srcstart": sourceStart }),
      ...(sourceEnd === undefined ? {} : { "data-srcend": sourceEnd }),
    },
    children: [
      {
        type: "element",
        tagName: "pre",
        properties: { className: ["mermaid-fallback"] },
        children: [{ type: "text", value: source }],
      },
    ],
  };
}

function visitChildren(node: HastElement | HastRoot) {
  const children = node.children ?? [];
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (isMermaidPre(child)) {
      children[index] = toMermaidDiagram(child);
      continue;
    }
    if (child.type === "element" || child.type === "root") {
      visitChildren(child as HastElement | HastRoot);
    }
  }
}

export default function rehypeMermaid() {
  return (tree: HastRoot) => {
    visitChildren(tree);
  };
}
