import { useTranslation } from '@forethread/i18n';
import { VendorCategory } from '@forethread/shared-types/client';
import { Alert, Button, FilterDropdownButton } from '@forethread/ui-components';
import { useEffect, useMemo, useState } from 'react';

import { useUpdateVendorCategories } from '../services/vendors.service';

interface VendorCategoriesCardProps {
  vendorId: string;
  /** The categories THIS contractor currently applies to the vendor. */
  categories: string[];
}

/**
 * Edit the Vendor Categories a contractor applies to one of its vendors
 * (ADR-0018).
 *
 * This is the surface that was missing: category was captured once at creation
 * and then frozen, and two of the three attach paths never captured it at all.
 * Without it a miscategorised vendor is unfixable, and vendors added by invite
 * stay invisible to every category-driven RFQ send.
 *
 * Deliberately absent for vendor-role users — a Vendor Category is the
 * contractor's classification, not a property the vendor owns or can see. The
 * vendor's own claim lives in `specialisations` on their profile.
 */
export function VendorCategoriesCard({ vendorId, categories }: VendorCategoriesCardProps) {
  const { t } = useTranslation(['vendors', 'common']);
  const updateMutation = useUpdateVendorCategories();
  const [selected, setSelected] = useState<string[]>(categories);

  // Re-sync when the query refetches (e.g. after another edit on this page).
  useEffect(() => {
    setSelected(categories);
  }, [categories]);

  const options = useMemo(
    () =>
      Object.values(VendorCategory).map((cat) => ({
        value: cat,
        label: t(`vendorCategories.${cat}` as 'vendorCategories.ELECTRICAL'),
      })),
    [t],
  );

  const isDirty =
    selected.length !== categories.length || selected.some((c) => !categories.includes(c));

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t('categoriesCard.title')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('categoriesCard.subtitle')}</p>
        </div>
        {isDirty && (
          <Button
            type="button"
            size="sm"
            isLoading={updateMutation.isPending}
            onClick={() => updateMutation.mutate({ id: vendorId, categories: selected })}
            data-testid="save-vendor-categories"
          >
            {t('common:save')}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3">
        <FilterDropdownButton
          label={
            selected.length > 0
              ? t('categoriesCard.selected', { count: selected.length })
              : t('categoriesCard.placeholder')
          }
          popoverTitle={t('categoriesCard.title')}
          options={options}
          selected={selected}
          onChange={setSelected}
        />
        {selected.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">
            {t('categoriesCard.uncategorised')}
          </span>
        ) : (
          selected.map((value) => (
            <span
              key={value}
              className="px-2.5 py-1 text-xs font-medium bg-muted text-foreground rounded-full"
            >
              {options.find((o) => o.value === value)?.label ?? value}
            </span>
          ))
        )}
      </div>

      {updateMutation.isError && (
        <Alert variant="destructive" className="mt-3">
          {t('categoriesCard.error')}
        </Alert>
      )}
    </div>
  );
}
