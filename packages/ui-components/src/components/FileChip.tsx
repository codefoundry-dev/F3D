import type { ReactNode } from 'react';

import DeleteIcon from '../assets/icons/delete.svg?react';
import FileDocIcon from '../assets/icons/file-doc.svg?react';
import FileTextIcon from '../assets/icons/file-text.svg?react';
import ImageIcon from '../assets/icons/image.svg?react';
import { cn } from '../utils/cn';

/**
 * FileChip — Forethread design system (Figma "File upload" 4464-17516).
 *
 * A bordered row for an attached file: a colour-coded file-type icon (PDF red,
 * DOC blue, sheet green, image violet) + the file name (primary) and an optional
 * size/caption (tertiary), with an optional remove affordance.
 */
export interface FileChipProps {
  name: string;
  size?: string;
  onRemove?: () => void;
  /** Override the auto-detected file-type icon. */
  icon?: ReactNode;
  className?: string;
}

/** Map a file name's extension to a DS-coloured file-type icon. */
function fileTypeIcon(name: string): { Icon: typeof FileTextIcon; color: string } {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return { Icon: FileTextIcon, color: 'text-destructive-600' };
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext))
    return { Icon: FileDocIcon, color: 'text-blue-600' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { Icon: FileTextIcon, color: 'text-green-600' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext))
    return { Icon: ImageIcon, color: 'text-violet-600' };
  return { Icon: FileTextIcon, color: 'text-gray-500' };
}

export function FileChip({ name, size, onRemove, icon, className }: FileChipProps) {
  const { Icon, color } = fileTypeIcon(name);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-[10px] border border-gray-100 px-3 py-2.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ?? <Icon className={cn('size-5 shrink-0', color)} />}
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-gray-900">{name}</p>
          {size && <p className="text-[12px] text-gray-500">{size}</p>}
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-gray-500 transition-colors hover:text-destructive-600"
          aria-label={`Remove ${name}`}
        >
          <DeleteIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
