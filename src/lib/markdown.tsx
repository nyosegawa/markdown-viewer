import type { Schema } from "hast-util-sanitize";
import { memo, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { PluggableList } from "unified";

const baseTagNames = defaultSchema.tagNames ?? [];
const baseAttributes = defaultSchema.attributes ?? {};
const baseWildcard = baseAttributes["*"] ?? [];
const baseSpan = baseAttributes.span ?? [];
const baseCode = baseAttributes.code ?? [];
const basePre = baseAttributes.pre ?? [];
const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

// MathML tags emitted by rehype-katex for its accessible annotation output.
// Without these, `<math>...</math>` is stripped to plain text.
const MATHML_TAGS = [
  "math",
  "semantics",
  "annotation",
  "annotation-xml",
  "mrow",
  "mi",
  "mn",
  "mo",
  "ms",
  "mspace",
  "mtext",
  "mfrac",
  "msqrt",
  "mroot",
  "mstyle",
  "merror",
  "mpadded",
  "mphantom",
  "mover",
  "munder",
  "munderover",
  "msub",
  "msup",
  "msubsup",
  "mmultiscripts",
  "mtable",
  "mtr",
  "mtd",
  "maligngroup",
  "malignmark",
  "mprescripts",
  "none",
  "menclose",
  "mfenced",
  "mglyph",
  "mlabeledtr",
];

const katexSchema: Schema = {
  ...defaultSchema,
  // Local markdown files are trusted content; disable id clobbering so
  // fragment links like `#heading-slug` match what rehype-slug produced.
  clobber: [],
  clobberPrefix: "",
  tagNames: [...baseTagNames, "span", ...MATHML_TAGS],
  attributes: {
    ...baseAttributes,
    // KaTeX/Shiki emit hundreds of internal class names (mord, strut,
    // vlist-r, delimsizing, …) that a narrow regex cannot enumerate.
    // Input is always a trusted local file, so we allow arbitrary class
    // values rather than whitelisting each family.
    "*": [...baseWildcard, "className", "style"],
    span: [...baseSpan, "aria-hidden", "style"],
    code: [...baseCode, "className", "style"],
    pre: [...basePre, "className", "style", "tabIndex"],
    math: ["xmlns", "display"],
    annotation: ["encoding"],
    "annotation-xml": ["encoding"],
    ...Object.fromEntries(HEADING_TAGS.map((tag) => [tag, [...(baseAttributes[tag] ?? []), "id"]])),
  },
};

const remarkPlugins: PluggableList = [remarkGfm, remarkMath];

/**
 * Shiki fine-grained bundle: we import only the languages + themes we care
 * about so the split chunk stays at ~2MB instead of ~9MB for the full bundle.
 * Keep this list alphabetised; add new languages as needed.
 */
const loadHighlighter = async () => {
  const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
    import("@shikijs/core"),
    import("@shikijs/engine-javascript"),
  ]);
  return createHighlighterCore({
    themes: [import("@shikijs/themes/github-light"), import("@shikijs/themes/github-dark")],
    langs: [
      import("@shikijs/langs/bash"),
      import("@shikijs/langs/c"),
      import("@shikijs/langs/cpp"),
      import("@shikijs/langs/css"),
      import("@shikijs/langs/diff"),
      import("@shikijs/langs/go"),
      import("@shikijs/langs/html"),
      import("@shikijs/langs/java"),
      import("@shikijs/langs/javascript"),
      import("@shikijs/langs/json"),
      import("@shikijs/langs/jsx"),
      import("@shikijs/langs/markdown"),
      import("@shikijs/langs/python"),
      import("@shikijs/langs/ruby"),
      import("@shikijs/langs/rust"),
      import("@shikijs/langs/shell"),
      import("@shikijs/langs/sql"),
      import("@shikijs/langs/swift"),
      import("@shikijs/langs/toml"),
      import("@shikijs/langs/tsx"),
      import("@shikijs/langs/typescript"),
      import("@shikijs/langs/xml"),
      import("@shikijs/langs/yaml"),
    ],
    engine: createJavaScriptRegexEngine(),
  });
};

const loadRehype = async (): Promise<PluggableList> => {
  const [{ default: rehypeShikiFromHighlighter }, highlighter] = await Promise.all([
    import("@shikijs/rehype/core"),
    loadHighlighter(),
  ]);
  return [
    rehypeSlug,
    // KaTeX must run before Shiki: remark-rehype emits math as
    // `<pre><code class="math math-display">…</code></pre>`, and Shiki would
    // otherwise treat "math" as an unknown language and render the LaTeX
    // source as plaintext code. Letting KaTeX replace those nodes first
    // removes the decoy before Shiki scans.
    rehypeKatex,
    [
      rehypeShikiFromHighlighter,
      highlighter,
      {
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false,
        fallbackLanguage: "plaintext",
      },
    ],
    [rehypeSanitize, katexSchema],
  ] satisfies PluggableList;
};

export interface MarkdownRendererProps {
  source: string;
}

function MarkdownRendererInner({ source }: MarkdownRendererProps) {
  const [rehypePlugins, setRehypePlugins] = useState<PluggableList | null>(null);

  useEffect(() => {
    let canceled = false;
    loadRehype()
      .then((plugins) => {
        if (!canceled) setRehypePlugins(plugins);
      })
      .catch((err) => {
        console.error("failed to load rehype plugins", err);
        if (!canceled) {
          setRehypePlugins([
            rehypeSlug,
            rehypeKatex,
            [rehypeSanitize, katexSchema],
          ] satisfies PluggableList);
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  if (!rehypePlugins) {
    return (
      <article className="markdown-body" data-testid="markdown-body">
        <p>Loading…</p>
      </article>
    );
  }

  return (
    <article className="markdown-body" data-testid="markdown-body">
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {source}
      </ReactMarkdown>
    </article>
  );
}

export const MarkdownRenderer = memo(MarkdownRendererInner);

/**
 * Test-friendly export that skips the async Shiki loader so Vitest/JSDOM
 * environments don't need to bundle the grammar engine.
 */
export function SyncMarkdownRenderer({ source }: MarkdownRendererProps) {
  return (
    <article className="markdown-body" data-testid="markdown-body">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={
          [rehypeSlug, rehypeKatex, [rehypeSanitize, katexSchema]] satisfies PluggableList
        }
      >
        {source}
      </ReactMarkdown>
    </article>
  );
}
