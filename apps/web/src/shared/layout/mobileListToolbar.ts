import type { DotAction, SavedView } from '@forethread/ui-components';

/**
 * Number of advanced filters with a value, for the phone Filters button
 * (ADR-0019 B9). Arrays count when non-empty, strings when non-blank, numbers
 * when set, booleans when true.
 */
export function countActiveFilters(filters: object | null | undefined): number {
  if (!filters) return 0;
  return Object.values(filters as Record<string, unknown>).filter((v) => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim() !== '';
    if (typeof v === 'number') return !Number.isNaN(v);
    if (typeof v === 'boolean') return v;
    return v !== null && v !== undefined && typeof v !== 'object';
  }).length;
}

export interface ListMenuActionsOptions {
  /** View presets; omit when the list has no saved views. */
  views?: {
    savedViews: SavedView[];
    activeViewId: string | null | undefined;
    onApplyView: (viewId: string | null) => void;
    defaultViewLabel: string;
  };
  saveView?: { label: string; onClick: () => void };
  exports?: { key: string; label: string; onClick: () => void }[];
  columnSettings?: { label: string; onClick: () => void };
}

/**
 * The phone list ⋯ menu (B9): view presets (the active one marked with ✓),
 * Save view, Export formats, Column settings — in that order.
 */
export function buildListMenuActions({
  views,
  saveView,
  exports = [],
  columnSettings,
}: ListMenuActionsOptions): DotAction[] {
  const mark = (active: boolean, label: string) => (active ? `✓ ${label}` : label);
  const actions: DotAction[] = [];
  if (views) {
    actions.push({
      key: 'view:default',
      label: mark(!views.activeViewId, views.defaultViewLabel),
      onClick: () => views.onApplyView(null),
    });
    for (const v of views.savedViews) {
      actions.push({
        key: `view:${v.id}`,
        label: mark(views.activeViewId === v.id, v.name),
        onClick: () => views.onApplyView(v.id),
      });
    }
  }
  if (saveView) actions.push({ key: 'saveView', ...saveView });
  for (const e of exports)
    actions.push({ key: `export:${e.key}`, label: e.label, onClick: e.onClick });
  if (columnSettings) actions.push({ key: 'columnSettings', ...columnSettings });
  return actions;
}
