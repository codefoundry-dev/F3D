import { useTranslation } from '@forethread/i18n';
import { StatusSuccessModal } from '@forethread/ui-components';

export type CatalogueSuccessVariant = 'contribute' | 'changeSubmitted';

export interface MaterialCatalogueSuccessModalProps {
  variant: CatalogueSuccessVariant;
  /** Fired when the countdown elapses or the user clicks the button — navigate to the catalogue. */
  onClose: () => void;
}

/**
 * Success modal shown after a non-approver (CA / PO) contributes a material or
 * submits an edit-change-request (US 4.02 / US 4.03). Centred check icon, title,
 * body, a dark full-width "Back to Material Catalogue page" button, and a
 * "Redirecting in N seconds…" line that auto-navigates after 3s. Thin wrapper
 * over the shared StatusSuccessModal so both variants stay consistent.
 */
export function MaterialCatalogueSuccessModal({
  variant,
  onClose,
}: MaterialCatalogueSuccessModalProps) {
  const { t } = useTranslation(['materialCatalogue']);
  const ns = variant === 'contribute' ? 'contributeSuccess' : 'changeSubmittedSuccess';

  return (
    <div data-testid={`catalogue-success-${variant}`}>
      <StatusSuccessModal
        onClose={onClose}
        title={t(`${ns}.title` as 'contributeSuccess.title')}
        description={t(`${ns}.description` as 'contributeSuccess.description')}
        buttonLabel={t(`${ns}.button` as 'contributeSuccess.button')}
        redirectLabel={(seconds) =>
          t(`${ns}.redirect` as 'contributeSuccess.redirect', { seconds })
        }
      />
    </div>
  );
}
