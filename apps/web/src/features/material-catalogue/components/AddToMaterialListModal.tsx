import { type MaterialListSummaryDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Input,
  Modal,
  ModalBody,
  ModalGridBackground,
  ModalIconHeader,
  toast,
} from '@forethread/ui-components';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import { useState } from 'react';

import { useMaterialListMutations, useMaterialLists } from '../hooks/useMaterialLists';

export interface AddToMaterialListModalProps {
  /** The material being added (from its row kebab). */
  material: { id: string; name: string };
  onClose: () => void;
}

/**
 * "Add to material list" picker (US 4.03) — opened from a material row's kebab.
 * Renders the user's material-list cards (searchable); clicking a card adds the
 * material to that list, then toasts and closes. Matches the Figma
 * "Add from Material list" modal.
 */
export function AddToMaterialListModal({ material, onClose }: AddToMaterialListModalProps) {
  const { t } = useTranslation(['materialCatalogue']);
  const [search, setSearch] = useState('');
  const { addItems } = useMaterialListMutations();

  const {
    data: lists = [],
    isLoading,
    isError,
  } = useMaterialLists({ search: search.trim() || undefined });

  const handlePick = (list: MaterialListSummaryDto) => {
    addItems.mutate(
      { id: list.id, materialIds: [material.id] },
      {
        onSuccess: () => {
          toast.success(t('materialLists.toasts.addedToList', { name: list.name }));
          onClose();
        },
      },
    );
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl" scrollBody decoration={<ModalGridBackground />}>
      <ModalBody className="relative">
        <ModalIconHeader
          icon={<PackageIcon className="w-6 h-6 text-foreground" />}
          title={<span className="text-lg font-semibold">{t('addToMaterialListModal.title')}</span>}
          subtitle={
            <span className="text-sm text-muted-foreground">
              {t('addToMaterialListModal.subtitle')}
            </span>
          }
          onClose={onClose}
          className="mb-6"
        />

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('addToMaterialListModal.searchPlaceholder')}
          aria-label={t('addToMaterialListModal.searchPlaceholder')}
          leftIcon={<SearchIcon className="w-4 h-4" />}
          data-testid="add-to-list-search"
          className="mb-4"
        />

        <div className="space-y-2" data-testid="add-to-list-results">
          {isLoading ? (
            <p role="status" className="py-8 text-center text-muted-foreground">
              {t('addToMaterialListModal.loading')}
            </p>
          ) : isError ? (
            <p role="alert" className="py-8 text-center text-destructive">
              {t('addToMaterialListModal.error')}
            </p>
          ) : lists.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {search.trim()
                ? t('addToMaterialListModal.noResults')
                : t('addToMaterialListModal.empty')}
            </p>
          ) : (
            lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => handlePick(list)}
                disabled={addItems.isPending}
                className="w-full flex items-center gap-3 text-left p-3 rounded-xl border border-border hover:bg-muted/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid={`add-to-list-card-${list.id}`}
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                  <PackageIcon className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-foreground truncate">{list.name}</span>
                  {list.description && (
                    <span className="block text-sm text-muted-foreground truncate">
                      {list.description}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}
