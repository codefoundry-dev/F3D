import { useCallback, useRef, useState } from 'react';

export interface UseColumnResizeOptions {
  /** Minimum column width in px */
  minWidth?: number;
}

export function useColumnResize({ minWidth = 60 }: UseColumnResizeOptions = {}) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, key: string) => {
      e.preventDefault();
      e.stopPropagation();

      const th = (e.target as HTMLElement).closest('th');
      if (!th) return;

      const startWidth = th.offsetWidth;
      resizingRef.current = { key, startX: e.clientX, startWidth };

      const onMouseMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return;
        const diff = ev.clientX - resizingRef.current.startX;
        const newWidth = Math.max(minWidth, resizingRef.current.startWidth + diff);
        const key = resizingRef.current?.key;
        if (key) setColumnWidths((prev) => ({ ...prev, [key]: newWidth }));
      };

      const onMouseUp = () => {
        resizingRef.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [minWidth],
  );

  return { columnWidths, setColumnWidths, handleResizeStart };
}
