import { useTranslation } from '@forethread/i18n';
import { cn, DotActionsMenu, type DotAction } from '@forethread/ui-components';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';

interface CompanyGroupRowProps {
  companyName: string;
  companyId: string;
  /** Category enum keys — the first drives the specialisation chip beside the name. */
  categories?: string[];
  isExpanded: boolean;
  onToggle: () => void;
  actions: DotAction[];
  onView?: () => void;
}

export function CompanyGroupRow({
  companyName,
  categories,
  isExpanded,
  onToggle,
  actions,
  onView,
}: CompanyGroupRowProps) {
  const { t } = useTranslation(['vendors']);

  const primaryCategory = categories?.[0];
  const categoryLabel = primaryCategory
    ? t(`vendorCategories.${primaryCategory}` as 'vendorCategories.ELECTRICAL', {
        defaultValue: primaryCategory,
      })
    : null;

  return (
    <tr
      className="bg-muted/50 hover:bg-muted/70 cursor-pointer transition-colors"
      onClick={onToggle}
    >
      <td colSpan={4} className="px-6 py-3">
        <div className="flex items-center gap-3">
          <ChevronRightIcon
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform duration-200',
              isExpanded && 'rotate-90',
            )}
          />
          <span className="font-medium text-foreground">{companyName}</span>
          {categoryLabel && (
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {categoryLabel}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3" />
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="View"
            onClick={(e) => {
              e.stopPropagation();
              onView?.();
            }}
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          {actions.length > 0 && (
            /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
            <span onClick={(e) => e.stopPropagation()}>
              <DotActionsMenu actions={actions} bordered={false} />
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
