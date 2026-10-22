import { type MaterialCategoryDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge, Button, GridModal, Input } from '@forethread/ui-components';
import MaterialCatalogueIcon from '@forethread/ui-components/assets/icons/material-catalogue.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

import { useMaterialCategoryMutations } from '../hooks/useMaterialCategoryMutations';

/** Resolved by name server-side, so it can't be renamed or deactivated. */
const UNCATEGORISED = 'Uncategorised';

export interface ManageCategoriesModalProps {
  categories: MaterialCategoryDto[];
  onClose: () => void;
}

/**
 * Super-Admin category management (FOR-362). Categories are global: add a new
 * one, rename in place (Enter saves, Esc cancels) or deactivate. Deactivated
 * categories stay on their materials and in the filters, but the create / edit
 * / BOM pickers stop offering them.
 */
export function ManageCategoriesModal({ categories, onClose }: ManageCategoriesModalProps) {
  const { t } = useTranslation(['materialCatalogue']);
  const { create, update, errorText } = useMaterialCategoryMutations();

  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Focus the rename field as soon as a row enters edit mode.
  useEffect(() => {
    if (editingId) renameInputRef.current?.focus();
  }, [editingId]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories;
  }, [categories, filter]);

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setCreateError(t('categories.errors.nameRequired'));
      return;
    }
    create.mutate(name, {
      onSuccess: () => {
        setNewName('');
        setCreateError(null);
      },
      onError: (err) => setCreateError(errorText(err)),
    });
  };

  const startRename = (c: MaterialCategoryDto) => {
    setEditingId(c.id);
    setDraftName(c.name);
    setRowError(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setRowError(null);
  };

  const saveRename = (c: MaterialCategoryDto) => {
    const name = draftName.trim();
    if (!name) {
      setRowError({ id: c.id, message: t('categories.errors.nameRequired') });
      return;
    }
    if (name === c.name) {
      cancelRename();
      return;
    }
    update.mutate(
      { id: c.id, name },
      {
        onSuccess: cancelRename,
        onError: (err) => setRowError({ id: c.id, message: errorText(err) }),
      },
    );
  };

  const onRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>, c: MaterialCategoryDto) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRename(c);
    } else if (e.key === 'Escape') {
      // Keep Esc from also closing the modal.
      e.preventDefault();
      e.stopPropagation();
      cancelRename();
    }
  };

  const toggleActive = (c: MaterialCategoryDto) => {
    setRowError(null);
    update.mutate(
      { id: c.id, isActive: !c.isActive },
      { onError: (err) => setRowError({ id: c.id, message: errorText(err) }) },
    );
  };

  const pendingId = update.isPending ? update.variables?.id : undefined;

  return (
    <GridModal
      onClose={onClose}
      icon={<MaterialCatalogueIcon className="size-6 text-gray-700" />}
      title={t('categories.title')}
      description={t('categories.subtitle')}
      size="lg"
      scrollBody
      showClose
    >
      <div className="space-y-4" data-testid="manage-categories">
        <form onSubmit={handleCreate} className="space-y-1.5" noValidate>
          <label htmlFor="new-category-name" className="text-sm font-medium text-foreground">
            {t('categories.addLabel')}
          </label>
          <div className="flex gap-2">
            <Input
              id="new-category-name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (createError) setCreateError(null);
              }}
              placeholder={t('categories.addPlaceholder')}
              maxLength={255}
              data-testid="new-category-name"
            />
            <Button type="submit" isLoading={create.isPending} data-testid="add-category">
              {t('categories.add')}
            </Button>
          </div>
          {createError && (
            <p role="alert" className="text-sm text-destructive">
              {createError}
            </p>
          )}
        </form>

        <Input
          aria-label={t('categories.filterPlaceholder')}
          placeholder={t('categories.filterPlaceholder')}
          leftIcon={<SearchIcon className="size-4" />}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          data-testid="category-filter"
        />

        <ul className="divide-y divide-border rounded-xl border border-border">
          {visible.length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">
              {t('categories.empty')}
            </li>
          )}
          {visible.map((c) => {
            const isSystem = c.name === UNCATEGORISED;
            const isEditing = editingId === c.id;
            const busy = pendingId === c.id;
            const error = rowError?.id === c.id ? rowError.message : null;
            return (
              <li key={c.id} className="p-3" data-testid={`category-row-${c.id}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <Input
                        aria-label={t('categories.renameLabel', { name: c.name })}
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => onRenameKeyDown(e, c)}
                        maxLength={255}
                        ref={renameInputRef}
                        data-testid={`category-rename-input-${c.id}`}
                      />
                    ) : (
                      <p
                        className={
                          'truncate text-sm font-medium ' +
                          (c.isActive ? 'text-foreground' : 'text-muted-foreground')
                        }
                      >
                        {c.name}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('categories.materialCount', { count: c.materialCount })}
                    </p>
                  </div>

                  {isSystem ? (
                    <Badge color="gray">{t('categories.system')}</Badge>
                  ) : (
                    <Badge color={c.isActive ? 'success' : 'gray'} dot>
                      {c.isActive ? t('categories.active') : t('categories.inactive')}
                    </Badge>
                  )}

                  {!isSystem && (
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => saveRename(c)}
                            isLoading={busy}
                            data-testid={`category-save-${c.id}`}
                          >
                            {t('categories.save')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelRename}>
                            {t('categories.cancel')}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startRename(c)}
                            disabled={busy}
                            data-testid={`category-rename-${c.id}`}
                          >
                            {t('categories.rename')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleActive(c)}
                            isLoading={busy}
                            data-testid={`category-toggle-${c.id}`}
                          >
                            {c.isActive ? t('categories.deactivate') : t('categories.activate')}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {error && (
                  <p role="alert" className="mt-1.5 text-sm text-destructive">
                    {error}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </GridModal>
  );
}
