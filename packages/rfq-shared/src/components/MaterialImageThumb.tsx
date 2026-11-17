import { useTranslation } from '@forethread/i18n';
import { useState } from 'react';

interface MaterialImageThumbProps {
  /** Catalogue image URL; nothing renders when absent. */
  url?: string | null;
  /** Material name — used for the alt text and the open-image label. */
  name: string;
  /**
   * Render the image alone, without the open-in-new-tab link. Use wherever the
   * thumb sits inside another control (a phone card title is a button, and a
   * link nested in a button is invalid and fires both actions on tap).
   */
  plain?: boolean;
}

const IMAGE_CLASS = 'w-8 h-8 rounded object-cover border border-border';

/**
 * Small catalogue-image thumbnail for a line item (FOR-361, used app-wide since
 * FOR-402). Opens the full image in a new tab unless `plain`. Renders nothing
 * for free-text lines, materials without an image, or a URL that fails to load
 * — never a broken-image glyph.
 */
export function MaterialImageThumb({ url, name, plain = false }: MaterialImageThumbProps) {
  const { t } = useTranslation('rfqs');
  const [failed, setFailed] = useState(false);

  if (!url || failed) return null;

  if (plain) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${IMAGE_CLASS} shrink-0`}
        data-testid="material-image-thumb"
      />
    );
  }

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
        className={`${IMAGE_CLASS} hover:opacity-80 transition-opacity`}
      />
    </a>
  );
}
