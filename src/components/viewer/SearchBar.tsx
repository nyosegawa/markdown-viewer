import { useCallback, useEffect, useRef, useState } from "react";

export interface SearchBarProps {
  containerRef: React.RefObject<HTMLElement | null>;
  query: string;
  focusToken: number;
  onQueryChange: (query: string) => void;
  onClose: () => void;
}

function collectMatches(root: HTMLElement, query: string): Range[] {
  if (!query) return [];
  const needle = query.toLowerCase();
  const matches: Range[] = [];
  const segments: Array<{ node: Text; start: number; end: number }> = [];
  let haystack = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(".search-bar")) return NodeFilter.FILTER_REJECT;
      return node.nodeValue && node.nodeValue.length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  let node: Node | null = walker.nextNode();
  while (node) {
    const text = node.nodeValue;
    if (text) {
      const start = haystack.length;
      haystack += text;
      segments.push({ node: node as Text, start, end: haystack.length });
    }
    node = walker.nextNode();
  }

  const lower = haystack.toLowerCase();
  let idx = lower.indexOf(needle);
  while (idx !== -1) {
    const start = positionForOffset(segments, idx);
    const end = positionForOffset(segments, idx + needle.length);
    if (start && end) {
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      matches.push(range);
    }
    idx = lower.indexOf(needle, idx + needle.length);
  }
  return matches;
}

function positionForOffset(
  segments: Array<{ node: Text; start: number; end: number }>,
  offset: number,
): { node: Text; offset: number } | null {
  for (const segment of segments) {
    if (offset >= segment.start && offset <= segment.end) {
      return { node: segment.node, offset: offset - segment.start };
    }
  }
  return null;
}

const ALL_KEY = "mdv-search";
const CURRENT_KEY = "mdv-search-current";

function clearHighlights() {
  if (typeof CSS !== "undefined" && "highlights" in CSS) {
    CSS.highlights.delete(ALL_KEY);
    CSS.highlights.delete(CURRENT_KEY);
  }
}

function applyHighlights(matches: Range[], currentIndex: number) {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
  if (typeof Highlight === "undefined") return;
  clearHighlights();
  if (matches.length === 0) {
    return;
  }
  const all = new Highlight(...matches);
  CSS.highlights.set(ALL_KEY, all);
  const current = matches[currentIndex];
  if (current) {
    const currentHl = new Highlight(current);
    CSS.highlights.set(CURRENT_KEY, currentHl);
  } else {
    CSS.highlights.delete(CURRENT_KEY);
  }
}

function scrollRangeIntoView(range: Range, scroller: HTMLElement) {
  const rangeRect = range.getBoundingClientRect();
  const hostRect = scroller.getBoundingClientRect();
  const offsetTop = rangeRect.top - hostRect.top + scroller.scrollTop;
  const centered = offsetTop - scroller.clientHeight / 3;
  scroller.scrollTo({ top: Math.max(0, centered), behavior: "smooth" });
}

export function SearchBar({
  containerRef,
  query,
  focusToken,
  onQueryChange,
  onClose,
}: SearchBarProps) {
  const [matches, setMatches] = useState<Range[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    const result = root && query.length > 0 ? collectMatches(root, query) : [];
    setMatches(result);
    setCurrentIndex(0);
  }, [query, containerRef]);

  useEffect(() => {
    applyHighlights(matches, currentIndex);
    const scroller = containerRef.current;
    const target = matches[currentIndex];
    if (scroller && target) scrollRangeIntoView(target, scroller);
  }, [matches, currentIndex, containerRef]);

  useEffect(() => () => clearHighlights(), []);

  useEffect(() => {
    if (!Number.isFinite(focusToken)) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusToken]);

  const goNext = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIndex((i) => (i + 1) % matches.length);
  }, [matches.length]);

  const goPrev = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIndex((i) => (i - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) goPrev();
      else goNext();
    }
  };

  const hasMatches = matches.length > 0;

  return (
    <search className="search-bar" aria-label="Find in document" data-testid="search-bar">
      <svg
        className="search-bar-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        className="search-bar-input"
        type="text"
        placeholder="Find in document"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        data-testid="search-input"
      />
      <span className="search-bar-count" aria-live="polite">
        {query.length === 0 ? "" : hasMatches ? `${currentIndex + 1} / ${matches.length}` : "0 / 0"}
      </span>
      <button
        type="button"
        className="search-bar-btn"
        onClick={goPrev}
        disabled={!hasMatches}
        aria-label="Previous match"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <button
        type="button"
        className="search-bar-btn"
        onClick={goNext}
        disabled={!hasMatches}
        aria-label="Next match"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <button type="button" className="search-bar-btn" onClick={onClose} aria-label="Close search">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </search>
  );
}
