import type { Schema } from "hast-util-sanitize";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { PluggableList } from "unified";
import { useFitDisplayMath } from "../hooks/useFitDisplayMath";
import { extractFrontMatter, type FrontMatterMatch } from "./front-matter";
import rehypeSourcePosition from "./rehype-source-position";

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
    // `data-srcstart` / `data-srcend` carry byte offsets back to the
    // original markdown source — used by copy-as-markdown and the
    // view→edit scroll preservation.
    "*": [...baseWildcard, "className", "style", "data-srcstart", "data-srcend"],
    span: [...baseSpan, "aria-hidden", "style"],
    code: [...baseCode, "className", "style"],
    pre: [...basePre, "className", "style", "tabIndex"],
    math: ["xmlns", "display"],
    annotation: ["encoding"],
    "annotation-xml": ["encoding"],
    ...Object.fromEntries(HEADING_TAGS.map((tag) => [tag, [...(baseAttributes[tag] ?? []), "id"]])),
  },
};

// `remark-frontmatter` recognises `---\n…\n---` as a `yaml` mdast node so
// remark stops parsing it as a thematic break followed by paragraphs. The
// node has no default mdast→hast handler, so the YAML disappears from the
// rendered body — we surface it ourselves via <FrontMatterCard /> so users
// can see the metadata.
const remarkPlugins: PluggableList = [remarkFrontmatter, remarkGfm, remarkMath];

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
    // Must run BEFORE katex/shiki so the data-srcstart/end attributes land
    // on the outer containers those plugins preserve (they rewrite children
    // but keep the wrapping <pre>/<span>).
    rehypeSourcePosition,
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

function FrontMatterCard({ match }: { match: FrontMatterMatch }) {
  if (match.entries.length === 0) return null;
  return (
    <dl
      className="front-matter"
      data-srcstart={String(match.start)}
      data-srcend={String(match.end)}
      data-testid="front-matter"
    >
      {match.entries.map((entry, i) => (
        <div
          className="front-matter-row"
          // Front matter keys may repeat (rare, but legal in raw YAML), so we
          // pair the key with its index instead of using the key alone.
          // biome-ignore lint/suspicious/noArrayIndexKey: stable order, no reordering.
          key={`${entry.key}-${i}`}
        >
          <dt className="front-matter-key">{entry.key || "—"}</dt>
          <dd className="front-matter-value">{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MarkdownRendererInner({ source }: MarkdownRendererProps) {
  const [rehypePlugins, setRehypePlugins] = useState<PluggableList | null>(null);
  const frontMatter = useMemo(() => extractFrontMatter(source), [source]);
  const articleRef = useRef<HTMLElement>(null);
  useFitDisplayMath(articleRef);

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
            rehypeSourcePosition,
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
      <article ref={articleRef} className="markdown-body" data-testid="markdown-body">
        {frontMatter ? <FrontMatterCard match={frontMatter} /> : null}
        <p>Loading…</p>
      </article>
    );
  }

  return (
    <article ref={articleRef} className="markdown-body" data-testid="markdown-body">
      {frontMatter ? <FrontMatterCard match={frontMatter} /> : null}
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
  const frontMatter = extractFrontMatter(source);
  const articleRef = useRef<HTMLElement>(null);
  useFitDisplayMath(articleRef);
  return (
    <article ref={articleRef} className="markdown-body" data-testid="markdown-body">
      {frontMatter ? <FrontMatterCard match={frontMatter} /> : null}
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={
          [
            rehypeSlug,
            rehypeSourcePosition,
            rehypeKatex,
            [rehypeSanitize, katexSchema],
          ] satisfies PluggableList
        }
      >
        {source}
      </ReactMarkdown>
    </article>
  );
}
