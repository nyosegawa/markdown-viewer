import { useEffect, useState } from "react";
import { isTauri, listenDragDrop } from "@/lib/tauri";

export interface DropZoneProps {
  onDropPath: (path: string) => void;
}

export function DropZone({ onDropPath }: DropZoneProps) {
  const [, setIsOver] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let unlisten: (() => void) | null = null;
    listenDragDrop((paths) => {
      if (!active) return;
      const first = paths[0];
      if (first) onDropPath(first);
    })
      .then((u) => {
        if (!active) {
          u();
          return;
        }
        unlisten = u;
      })
      .catch((err) => console.warn("drag/drop listener failed", err));

    return () => {
      active = false;
      setIsOver(false);
      if (unlisten) unlisten();
    };
  }, [onDropPath]);

  return null;
}
