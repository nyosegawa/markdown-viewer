import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface SearchBarProps {
  containerRef: React.RefObject<HTMLElement | null>;
  query: string;
  focusToken: number;
  onQueryChange: (query: string) => void;
  onClose: () => void;
}

interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

interface SearchMatch {
  start: number;
  end: number;
}

interface MatchState {
  query: string;
  items: SearchMatch[];
}

function collectTextSegments(root: HTMLElement): { segments: TextSegment[]; text: string } {
  const segments: TextSegment[] = [];
  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(".search-bar")) return NodeFilter.FILTER_REJECT;
      if (parent.closest("mark.search-highlight")) return NodeFilter.FILTER_REJECT;
      return node.nodeValue && node.nodeValue.length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  let node: Node | null = walker.nextNode();
  while (node) {
    const value = node.nodeValue;
    if (value) {
      const start = text.length;
      text += value;
      segments.push({ node: node as Text, start, end: text.length });
    }
    node = walker.nextNode();
  }
  return { segments, text };
}

function collectMatches(root: HTMLElement, query: string): SearchMatch[] {
  if (!query) return [];
  const needle = query.toLowerCase();
  const { text } = collectTextSegments(root);
  const matches: SearchMatch[] = [];
  const lower = text.toLowerCase();
  let idx = lower.indexOf(needle);
  while (idx !== -1) {
    matches.push({ start: idx, end: idx + needle.length });
    idx = lower.indexOf(needle, idx + needle.length);
  }
  return matches;
}

const ALL_KEY = "mdv-search";
const CURRENT_KEY = "mdv-search-current";

function clearCssHighlights() {
  if (typeof CSS !== "undefined" && "highlights" in CSS) {
    CSS.highlights.delete(ALL_KEY);
    CSS.highlights.delete(CURRENT_KEY);
  }
}

function clearDomHighlights(root: HTMLElement) {
  for (const mark of Array.from(root.querySelectorAll("mark.search-highlight"))) {
    mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
  }
  root.normalize();
}

function wrapTextSlice(node: Text, start: number, end: number, current: boolean): HTMLElement {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const mark = document.createElement("mark");
  mark.className = current ? "search-highlight search-highlight-current" : "search-highlight";
  range.surroundContents(mark);
  return mark;
}

function applyHighlights(
  root: HTMLElement,
  matches: SearchMatch[],
  currentIndex: number,
): HTMLElement | null {
  clearCssHighlights();
  clearDomHighlights(root);
  if (matches.length === 0) return null;

  const { segments } = collectTextSegments(root);
  let currentMark: HTMLElement | null = null;
  for (let matchIndex = matches.length - 1; matchIndex >= 0; matchIndex -= 1) {
    const match = matches[matchIndex];
    const affected = segments
      .filter((segment) => segment.start < match.end && segment.end > match.start)
      .reverse();
    for (const segment of affected) {
      const start = Math.max(match.start, segment.start) - segment.start;
      const end = Math.min(match.end, segment.end) - segment.start;
      if (start >= end) continue;
      const mark = wrapTextSlice(segment.node, start, end, matchIndex === currentIndex);
      if (matchIndex === currentIndex) currentMark = mark;
    }
  }
  return currentMark;
}

function scrollMarkIntoView(mark: HTMLElement, scroller: HTMLElement) {
  const rangeRect = mark.getBoundingClientRect();
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
  const [matchState, setMatchState] = useState<MatchState>({ query: "", items: [] });
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    clearDomHighlights(root);
    const result = query.length > 0 ? collectMatches(root, query) : [];
    const current =
      result.length > 0 ? applyHighlights(root, result, 0) : applyHighlights(root, [], 0);
    setMatchState({ query, items: result });
    setCurrentIndex(0);
    if (current) scrollMarkIntoView(current, root);
  }, [query, containerRef]);

  useLayoutEffect(() => {
    const scroller = containerRef.current;
    if (!scroller) return;
    if (matchState.query !== query) return;
    const current = applyHighlights(scroller, matchState.items, currentIndex);
    if (current) scrollMarkIntoView(current, scroller);
  }, [matchState, currentIndex, query, containerRef]);

  useEffect(
    () => () => {
      clearCssHighlights();
      const root = containerRef.current;
      if (root) clearDomHighlights(root);
    },
    [containerRef],
  );

  useEffect(() => {
    if (!Number.isFinite(focusToken)) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusToken]);

  const goNext = useCallback(() => {
    if (matchState.items.length === 0) return;
    setCurrentIndex((i) => (i + 1) % matchState.items.length);
  }, [matchState.items.length]);

  const goPrev = useCallback(() => {
    if (matchState.items.length === 0) return;
    setCurrentIndex((i) => (i - 1 + matchState.items.length) % matchState.items.length);
  }, [matchState.items.length]);

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

  const hasMatches = matchState.items.length > 0;

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
        {query.length === 0
          ? ""
          : hasMatches
            ? `${currentIndex + 1} / ${matchState.items.length}`
            : "0 / 0"}
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
