import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { useState } from 'react';

export interface MaterialThumbProps {
  /** Catalogue image URL; the box glyph (or nothing) shows when absent. */
  url?: string | null;
  /** Material name, used as the image alt text. */
  alt: string;
  /** Tile size + radius classes. */
  className?: string;
  /** Size classes of the fallback box glyph. */
  iconClassName?: string;
  /**
   * Show the box glyph when there is no image (or it fails to load). Pass
   * `false` where a row has no placeholder tile, so nothing renders instead.
   */
  fallback?: boolean;
}

/**
 * Square material thumbnail for the request wizard (FOR-402): the catalogue
 * image when the material has one, otherwise a box glyph. A URL that fails to
 * load falls back the same way, never a broken-image glyph. Not a link, so it
 * is safe inside buttons and labels.
 */
export function MaterialThumb({
  url,
  alt,
  className = 'size-9 rounded-lg',
  iconClassName = 'size-4',
  fallback = true,
}: MaterialThumbProps) {
  // Remember which URL failed, so a row that later gets a new image retries.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (url && failedUrl !== url) {
    return (
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onError={() => setFailedUrl(url)}
        className={`shrink-0 border border-border object-cover ${className}`}
        data-testid="mr-material-thumb"
      />
    );
  }
  if (!fallback) return null;
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-muted text-muted-foreground ${className}`}
      aria-hidden="true"
    >
      <PackageIcon className={iconClassName} />
    </span>
  );
}
