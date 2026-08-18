import { openFileInNewTab } from '@forethread/api-client';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';

import type { ThreadMessageAttachment } from '../hooks/useMessageThread';

/**
 * Attachment links under a chat message. Downloads go through the signed-URL
 * endpoint (`openFileInNewTab`) — a plain `<a href>` to the API would neither
 * carry the auth token nor hit an existing route.
 */
export function MessageAttachmentLinks({
  attachments,
}: {
  attachments: ThreadMessageAttachment[];
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((att) => (
        <button
          key={att.id}
          type="button"
          onClick={() => void openFileInNewTab(att.fileId)}
          className="inline-flex items-center gap-1 text-xs text-primary underline hover:no-underline"
        >
          <PaperclipIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="max-w-[220px] truncate">{att.filename}</span>
        </button>
      ))}
    </div>
  );
}
