import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { useEffect, useRef } from "react";
import type { Theme } from "@/hooks/useTheme";
import { setSrcOffset } from "@/lib/scroll-memory";

export interface EditorProps {
  value: string;
  onChange: (next: string) => void;
  theme: Theme;
  /** Byte offset into `value` to scroll to on first mount. Used to carry the
   *  viewer's scroll position into edit mode. Ignored if 0 or out of range. */
  initialSourceOffset?: number;
  /** When provided, the editor records its topmost visible source offset to
   *  the shared scroll-memory store under this id, so flipping back to view
   *  mode can restore the same place in the rendered document. */
  tabId?: string;
}

export function Editor({ value, onChange, theme, initialSourceOffset, tabId }: EditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  // Capture the initial offset once: re-creating the EditorView on theme flip
  // shouldn't yank the user back to this position.
  const pendingOffsetRef = useRef(initialSourceOffset);
  // Mirror tabId so the scroll listener inside the EditorView lifecycle effect
  // picks up tab switches without recreating the view.
  const tabIdRef = useRef(tabId);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    tabIdRef.current = tabId;
  }, [tabId]);

  useEffect(() => {
    if (!hostRef.current) return;

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown(),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
    ];
    if (theme === "dark") extensions.push(oneDark);

    const view = new EditorView({
      state: EditorState.create({ doc: valueRef.current, extensions }),
      parent: hostRef.current,
    });
    viewRef.current = view;

    const pending = pendingOffsetRef.current;
    if (typeof pending === "number" && pending > 0) {
      pendingOffsetRef.current = undefined;
      const doc = view.state.doc;
      const clamped = Math.min(pending, doc.length);
      const line = doc.lineAt(clamped);
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: "start" }),
      });
    }

    // Mirror the viewer's scroll-memory protocol: report the topmost visible
    // line's source offset so flipping back to view mode can restore it.
    // `lineBlockAtHeight(scrollTop)` resolves the block at the top of the
    // viewport in document-layout coords; this is more reliable than
    // `posAtCoords` (which can return null near padding/gutters during
    // wheel events). rAF-throttled — CodeMirror fires scroll per notch.
    let rafId: number | null = null;
    const sample = () => {
      rafId = null;
      const id = tabIdRef.current;
      if (!id) return;
      const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop);
      setSrcOffset(id, block.from);
    };
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(sample);
    };
    view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      view.scrollDOM.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
      view.destroy();
      viewRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  return <div className="editor-host" data-testid="editor-host" ref={hostRef} />;
}
