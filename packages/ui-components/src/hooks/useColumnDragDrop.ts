import { useCallback, useState } from 'react';

interface UseColumnDragDropOptions {
  tableRef: React.RefObject<HTMLTableElement | null>;
  setColumnOrder: (order: string[] | ((prev: string[]) => string[])) => void;
}

export function useColumnDragDrop({ tableRef, setColumnOrder }: UseColumnDragDropOptions) {
  const [dragColKey, setDragColKey] = useState<string | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, key: string) => {
      setDragColKey(key);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', key);

      const table = tableRef.current;
      if (!table) return;

      const thEl = e.currentTarget as HTMLElement;
      const colIndex = Array.from(thEl.parentElement?.children ?? []).indexOf(thEl);
      if (colIndex === -1) return;

      const rows = table.querySelectorAll('tr');
      const ghost = document.createElement('div');
      ghost.style.cssText =
        'position:fixed;left:-9999px;top:0;display:flex;flex-direction:column;background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:4px;overflow:hidden;';

      rows.forEach((row) => {
        const cell = row.children[colIndex] as HTMLElement | undefined;
        if (!cell) return;
        const clone = cell.cloneNode(true) as HTMLElement;
        clone.style.cssText = `display:block;padding:${getComputedStyle(cell).padding};font-size:${getComputedStyle(cell).fontSize};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:${cell.offsetWidth}px;background:hsl(var(--accent));border-bottom:1px solid hsl(var(--border));`;
        ghost.appendChild(clone);
      });

      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, thEl.offsetWidth / 2, 20);

      requestAnimationFrame(() => {
        document.body.removeChild(ghost);
      });
    },
    [tableRef],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, key: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverColKey !== key) setDragOverColKey(key);
    },
    [dragOverColKey],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetKey: string) => {
      e.preventDefault();
      const sourceKey = dragColKey;
      if (!sourceKey || sourceKey === targetKey) {
        setDragColKey(null);
        setDragOverColKey(null);
        return;
      }
      setColumnOrder((prev) => {
        const next = [...prev];
        const srcIdx = next.indexOf(sourceKey);
        const tgtIdx = next.indexOf(targetKey);
        if (srcIdx === -1 || tgtIdx === -1) return prev;
        next.splice(srcIdx, 1);
        next.splice(tgtIdx, 0, sourceKey);
        return next;
      });
      setDragColKey(null);
      setDragOverColKey(null);
    },
    [dragColKey, setColumnOrder],
  );

  const handleDragEnd = useCallback(() => {
    setDragColKey(null);
    setDragOverColKey(null);
  }, []);

  return {
    dragColKey,
    dragOverColKey,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  };
}
