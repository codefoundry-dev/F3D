import { type RfqDocument, openFileInNewTab } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import { useCallback } from 'react';

import { formatDate } from './detail-primitives';

interface DocumentRowProps {
  doc: RfqDocument;
  onView?: (doc: RfqDocument) => void;
  onDelete?: (doc: RfqDocument) => void;
  isDeleting?: boolean;
}

export function DocumentRow({ doc, onView, onDelete, isDeleting }: DocumentRowProps) {
  const { t } = useTranslation('rfqs');

  const initials = doc.uploadedBy.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleDownload = useCallback(async () => {
    if (doc.fileId) {
      await openFileInNewTab(doc.fileId);
    }
  }, [doc.fileId]);

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{doc.name}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1.5">
            {doc.uploadedBy.avatarUrl ? (
              <img
                src={doc.uploadedBy.avatarUrl}
                alt={doc.uploadedBy.name}
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                {initials}
              </div>
            )}
            <span className="text-xs text-muted-foreground">{doc.uploadedBy.email}</span>
          </div>
          <div className="flex items-center gap-1">
            <ClockIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{formatDate(doc.uploadedAt)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <button
          type="button"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={t('actions.view')}
          onClick={() => onView?.(doc)}
        >
          <EyeIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={t('actions.download')}
          onClick={handleDownload}
        >
          <DownloadIcon className="w-5 h-5" />
        </button>
        {onDelete && (
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
            title={t('actions.delete')}
            onClick={() => onDelete(doc)}
            disabled={isDeleting}
          >
            <DeleteIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
