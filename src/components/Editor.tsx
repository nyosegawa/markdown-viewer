import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { useEffect, useRef } from "react";
import type { Theme } from "@/hooks/useTheme";

export interface EditorProps {
  value: string;
  onChange: (next: string) => void;
  theme: Theme;
  /** Byte offset into `value` to scroll to on first mount. Used to carry the
   *  viewer's scroll position into edit mode. Ignored if 0 or out of range. */
  initialSourceOffset?: number;
}

export function Editor({ value, onChange, theme, initialSourceOffset }: EditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  // Capture the initial offset once: re-creating the EditorView on theme flip
  // shouldn't yank the user back to this position.
  const pendingOffsetRef = useRef(initialSourceOffset);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

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

    return () => {
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
