import { getApiClient } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, Input, Spinner } from '@forethread/ui-components';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import LetterIcon from '@forethread/ui-components/assets/icons/letter.svg?react';
import PaperPlaneIcon from '@forethread/ui-components/assets/icons/paper-plane.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import { useCallback, useRef, useState } from 'react';

// Mirrors the server allow-list in storage.controller.ts (ALLOWED_MIME_TYPES).
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.pdf', '.doc', '.docx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface PendingAttachment {
  fileId: string;
  filename: string;
}

export interface MessageComposerProps {
  /** Post a message — from {@link useMessageThread}. Must reject on failure so drafts survive. */
  send: (content: string, attachmentIds?: string[]) => Promise<void>;
  isSending: boolean;
  placeholder: string;
  sendLabel: string;
  /**
   * 'panel' = chat-panel styling (tall field, paper-plane send, top border);
   * 'page' = comms-page styling (compact field, letter-icon send).
   */
  variant?: 'panel' | 'page';
}

/**
 * Shared chat compose row: text input + working paperclip + send. The paperclip
 * opens a file picker, uploads to `/storage/upload`, and holds the resulting
 * file ids as removable chips until Send posts them as message attachments —
 * replacing the four copies of this row that rendered the paperclip as a
 * decorative icon with no upload wiring behind it.
 */
export function MessageComposer({
  send,
  isSending,
  placeholder,
  sendLabel,
  variant = 'panel',
}: MessageComposerProps) {
  const { t } = useTranslation('messages');
  const [messageText, setMessageText] = useState('');
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPanel = variant === 'panel';
  const iconSize = isPanel ? 'w-5 h-5' : 'w-4 h-4';
  const canSend = (messageText.trim() !== '' || pending.length > 0) && !isSending && !isUploading;

  const handleFilesSelected = useCallback(
    async (fileList: FileList | null) => {
      const files = Array.from(fileList ?? []);
      // Reset so re-picking the same file fires onChange again.
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (files.length === 0) return;

      setError(null);
      setIsUploading(true);
      try {
        for (const file of files) {
          const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
          if (!ALLOWED_EXTENSIONS.includes(ext)) {
            setError(t('compose.fileTypeNotAllowed'));
            continue;
          }
          if (file.size > MAX_FILE_SIZE) {
            setError(t('compose.fileTooLarge'));
            continue;
          }
          try {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await getApiClient().post<{ data: { id: string } }>(
              '/storage/upload',
              formData,
              { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            setPending((prev) => [...prev, { fileId: data.data.id, filename: file.name }]);
          } catch {
            setError(t('compose.uploadFailed'));
          }
        }
      } finally {
        setIsUploading(false);
      }
    },
    [t],
  );

  const removePending = useCallback((fileId: string) => {
    setPending((prev) => prev.filter((p) => p.fileId !== fileId));
  }, []);

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    try {
      await send(
        messageText,
        pending.map((p) => p.fileId),
      );
      setMessageText('');
      setPending([]);
      setError(null);
    } catch {
      // Keep the draft + attachments so the user can retry.
      setError(t('compose.sendFailed'));
    }
  }, [canSend, send, messageText, pending, t]);

  return (
    <div className={isPanel ? 'border-t border-border p-3' : 'mt-6'}>
      {(pending.length > 0 || error) && (
        <div className="mb-2">
          {pending.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {pending.map((att) => (
                <span
                  key={att.fileId}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-foreground"
                >
                  <PaperclipIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="max-w-[180px] truncate">{att.filename}</span>
                  <button
                    type="button"
                    onClick={() => removePending(att.fileId)}
                    aria-label={t('compose.removeAttachment')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <CrossIcon className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => void handleFilesSelected(e.target.files)}
        />
        <Input
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && canSend) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={placeholder}
          leftIcon={
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || isUploading}
              title={t('compose.attachFile')}
              aria-label={t('compose.attachFile')}
              className="flex items-center text-gray-500 hover:text-foreground transition-colors disabled:cursor-not-allowed"
            >
              {isUploading ? <Spinner size="sm" /> : <PaperclipIcon className={iconSize} />}
            </button>
          }
          className={isPanel ? 'flex-1 h-12' : undefined}
          disabled={isSending}
        />
        {isPanel ? (
          <Button
            variant="primary"
            size="lg"
            className="h-12 px-8 rounded-xl"
            onClick={() => void handleSend()}
            disabled={!canSend}
            leftIcon={<PaperPlaneIcon className="w-5 h-5" />}
          >
            {sendLabel}
          </Button>
        ) : (
          <Button
            onClick={() => void handleSend()}
            disabled={!canSend}
            leftIcon={<LetterIcon className="w-4 h-4" />}
          >
            {sendLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
