import { useState } from 'react';

import DeleteIcon from '../assets/icons/delete.svg?react';
import SettingsIcon from '../assets/icons/settings.svg?react';

import { Badge } from './Badge';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Modal, ModalCloseButton } from './Modal';

export interface TableColumn {
  id: string;
  label: string;
}

export interface SavedView {
  id: string;
  name: string;
  visibleColumns?: string[];
  columnOrder?: string[];
  sortBy?: string;
  sortDir?: string | null;
  quickFilter?: string;
  groupBy?: string;
}

export interface TableManagementModalProps {
  columns: TableColumn[];
  visibleColumns: string[];
  onSave: (visibleColumns: string[]) => void;
  onClose: () => void;
  savedViews?: SavedView[];
  onDeleteView?: (viewId: string) => void;
  onDeleteAllViews?: () => void;
  title?: string;
  subtitle?: string;
  configureLabel?: string;
  deselectAllLabel?: string;
  selectAllLabel?: string;
  savedViewsLabel?: string;
  deleteAllLabel?: string;
  saveLabel?: string;
  cancelLabel?: string;
}

export function TableManagementModal({
  columns,
  visibleColumns,
  onSave,
  onClose,
  savedViews = [],
  onDeleteView,
  onDeleteAllViews,
  title = 'Table management',
  subtitle = 'Customize visible columns and manage your saved views',
  configureLabel = 'Configure Visible Columns',
  deselectAllLabel = 'Deselect All',
  selectAllLabel = 'Select All',
  savedViewsLabel = 'Saved views',
  deleteAllLabel = 'Delete all',
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
}: TableManagementModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(visibleColumns));

  const allSelected = selected.size === columns.length;
  const hasSavedViews = savedViews.length > 0;

  const toggleColumn = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(columns.map((c) => c.id)));
    }
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="px-6 pt-6 pb-6">
        <div className="flex justify-end">
          <ModalCloseButton onClose={onClose} />
        </div>

        {/* Icon badge + title + subtitle */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <Badge className="flex items-center justify-center w-12 h-12 rounded-[12px] bg-foreground/10">
            <SettingsIcon className="w-5 h-5 text-foreground" />
          </Badge>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground text-center">{subtitle}</p>
        </div>

        {/* Saved views section (only when views exist) */}
        {hasSavedViews && (
          <div className="border border-border rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">{savedViewsLabel}</span>
              <button
                type="button"
                onClick={onDeleteAllViews}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {deleteAllLabel}
                <DeleteIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {savedViews.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center justify-between h-10 px-3 rounded-lg border border-foreground/15 bg-muted"
                >
                  <span className="text-sm text-foreground truncate">{view.name}</span>
                  <button
                    type="button"
                    onClick={() => onDeleteView?.(view.id)}
                    className="flex-shrink-0 ml-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <DeleteIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Configure Visible Columns section */}
        <div className="border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-foreground">{configureLabel}</span>
            <div className="flex items-center gap-4">
              {hasSavedViews && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {selectAllLabel}
                  <span className="text-xs">&#10003;</span>
                </button>
              )}
              <button
                type="button"
                onClick={hasSavedViews ? deselectAll : toggleAll}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {hasSavedViews ? deselectAllLabel : allSelected ? deselectAllLabel : selectAllLabel}
                <span className="text-xs">{hasSavedViews || allSelected ? '✕' : '✓'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-x-6 gap-y-3">
            {columns.map((col) => (
              <Checkbox
                key={col.id}
                checked={selected.has(col.id)}
                onChange={() => toggleColumn(col.id)}
                label={col.label}
              />
            ))}
          </div>
        </div>

        {/* Save / Cancel buttons */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <Button variant="outline" size="md" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={selected.size === 0}
            onClick={() => onSave(Array.from(selected))}
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
