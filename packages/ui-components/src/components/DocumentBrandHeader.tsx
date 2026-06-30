import { useState } from 'react';

import { cn } from '../utils/cn';

export interface DocumentBrandHeaderProps {
  /** Presigned URL of the issuing company's logo; null/undefined when none is set. */
  logoUrl?: string | null;
  /** Issuing company display name — rendered beside the logo and used as its alt text. */
  name: string;
  /** Optional caption shown above the name (e.g. "Issued by"). */
  caption?: string;
  className?: string;
}

/**
 * Issuing-company brand mark shown at the top of RFQ / PO document views, mirroring
 * the logo drawn in the generated PDF (FOR-267). Renders the company logo when a URL
 * is supplied, falling back to the company name alone if the image is missing or
 * fails to load — branding must never break the page. Callers typically render this
 * only when a logo URL is present, so an unbranded document looks unchanged.
 */
export function DocumentBrandHeader({
  logoUrl,
  name,
  caption,
  className,
}: DocumentBrandHeaderProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !imageFailed;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {showLogo && (
        <img
          src={logoUrl as string}
          alt={name}
          className="h-10 max-w-[160px] object-contain"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="flex flex-col min-w-0">
        {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
        <span className="text-base font-bold text-foreground truncate">{name}</span>
      </div>
    </div>
  );
}
