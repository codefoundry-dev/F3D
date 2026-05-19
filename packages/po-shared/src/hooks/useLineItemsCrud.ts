import { useState, useCallback, useEffect, useRef } from 'react';
import type { UseFieldArrayReturn, UseFormSetValue } from 'react-hook-form';

import { EMPTY_LINE_ITEM } from '../schemas/create-po.schema';
import type { FormValues } from '../schemas/create-po.schema';
import type { SelectedMaterial } from '@forethread/ui-components';

interface UseLineItemsCrudParams {
  watchedLineItems: FormValues['lineItems'] | undefined;
  append: UseFieldArrayReturn<FormValues, 'lineItems'>['append'];
  remove: UseFieldArrayReturn<FormValues, 'lineItems'>['remove'];
  setValue: UseFormSetValue<FormValues>;
}

/**
 * Manages line item CRUD operations:
 * - Auto-append empty rows
 * - Add items from modals
 * - Add materials from search
 * - Remove rows with cleanup
 * - Notes toggle per row
 * - Inline cell search state
 */
export function useLineItemsCrud({
  watchedLineItems,
  append,
  remove,
  setValue,
}: UseLineItemsCrudParams) {
  // Auto-append a single empty row when every row is filled
  const appendingRef = useRef(false);
  useEffect(() => {
    const items = watchedLineItems ?? [];
    if (items.length === 0) return;
    if (appendingRef.current) return;
    const hasEmptyRow = items.some((li) => !li.materialName);
    if (hasEmptyRow) return;
    const lastItem = items[items.length - 1];
    if (lastItem?.materialName && lastItem?.unitOfMeasure && lastItem?.quantityOrdered >= 1) {
      appendingRef.current = true;
      append({ ...EMPTY_LINE_ITEM });
      requestAnimationFrame(() => {
        appendingRef.current = false;
      });
    }
  }, [watchedLineItems, append]);

  // Notes toggle per row
  const [notesOpenRow, setNotesOpenRow] = useState<Set<number>>(new Set());
  const toggleNotes = useCallback((index: number) => {
    setNotesOpenRow((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // Inline cell search state
  const [cellSearchOpen, setCellSearchOpen] = useState<number | null>(null);
  const [cellSearchQuery, setCellSearchQuery] = useState('');

  const handleCellSearchChange = useCallback((index: number, query: string) => {
    setCellSearchQuery(query);
    setCellSearchOpen(index);
  }, []);

  const handleCellSearchClose = useCallback(() => {
    setCellSearchOpen(null);
    setCellSearchQuery('');
  }, []);

  // Add items from modals (approved quotes / bulk orders)
  const handleAddModalItems = useCallback(
    (items: FormValues['lineItems']) => {
      if (items.length === 0) return;
      const currentItems = watchedLineItems ?? [];

      // Remove ALL empty rows first (collect indices in reverse to avoid shift issues)
      const emptyIndices = currentItems
        .map((li, i) => (!li.materialName ? i : -1))
        .filter((i) => i >= 0)
        .reverse();
      for (const idx of emptyIndices) {
        remove(idx);
      }

      // Append new items + one trailing empty row
      for (const item of items) {
        append(item);
      }
      append({ ...EMPTY_LINE_ITEM });
    },
    [watchedLineItems, append, remove],
  );

  // Add materials from top search
  const handleAddFromSearch = useCallback(
    (selected: SelectedMaterial[]) => {
      const mats = [...selected];
      if (mats.length === 0) return;
      const currentItems = watchedLineItems ?? [];
      const lastIdx = currentItems.length - 1;
      const lastIsEmpty = lastIdx >= 0 && !currentItems[lastIdx]?.materialName;

      let startIndex = 0;
      if (lastIsEmpty && mats.length > 0) {
        const mat = mats[0];
        setValue(`lineItems.${lastIdx}.materialName`, mat.name);
        setValue(`lineItems.${lastIdx}.materialCode`, mat.id);
        setValue(`lineItems.${lastIdx}.unitOfMeasure`, mat.unit ?? '');
        setValue(`lineItems.${lastIdx}.quantityOrdered`, mat.quantity);
        startIndex = 1;
      }
      for (let i = startIndex; i < mats.length; i++) {
        const mat = mats[i];
        append({
          ...EMPTY_LINE_ITEM,
          materialName: mat.name,
          materialCode: mat.id,
          unitOfMeasure: mat.unit ?? '',
          quantityOrdered: mat.quantity,
        });
      }
    },
    [append, watchedLineItems, setValue],
  );

  const handleRemoveRow = useCallback(
    (index: number) => {
      remove(index);
      setNotesOpenRow((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      // Ensure at least one empty row remains
      const remaining = (watchedLineItems ?? []).length - 1;
      if (remaining === 0) {
        append({ ...EMPTY_LINE_ITEM });
      }
    },
    [remove, append, watchedLineItems],
  );

  return {
    notesOpenRow,
    toggleNotes,
    cellSearchOpen,
    cellSearchQuery,
    handleCellSearchChange,
    handleCellSearchClose,
    handleAddModalItems,
    handleAddFromSearch,
    handleRemoveRow,
  };
}
