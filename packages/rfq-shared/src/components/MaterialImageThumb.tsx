import { useTranslation } from '@forethread/i18n';
import { useState } from 'react';

interface MaterialImageThumbProps {
  /** Catalogue image URL; nothing renders when absent. */
  url?: string | null;
  /** Material name — used for the alt text and the open-image label. */
  name: string;
}

/**
 * Small catalogue-image thumbnail for an RFQ line (FOR-361). Opens the full
 * image in a new tab. Renders nothing for free-text lines, materials without an
 * image, or a URL that fails to load — never a broken-image glyph.
 */
export function MaterialImageThumb({ url, name }: MaterialImageThumbProps) {
  const { t } = useTranslation('rfqs');
  const [failed, setFailed] = useState(false);

  if (!url || failed) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('lineItemsTab.viewImage', { name })}
      title={t('lineItemsTab.viewImage', { name })}
      className="shrink-0"
      data-testid="material-image-thumb"
    >
      <img
        src={url}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-8 h-8 rounded object-cover border border-border hover:opacity-80 transition-opacity"
      />
    </a>
  );
}
