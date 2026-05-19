import { useRef } from 'react';

import EditIcon from '../assets/icons/edit-without-line.svg?react';
import { cn } from '../utils/cn';

import { Spinner } from './Spinner';

export interface AvatarUploadProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'md' | 'lg';
  editable?: boolean;
  isUploading?: boolean;
  onUpload?: (file: File) => void;
  accept?: string;
}

const SIZE_CLASSES = {
  md: 'w-14 h-14 text-xl',
  lg: 'w-20 h-20 text-3xl',
} as const;

const BADGE_CLASSES = {
  md: 'w-6 h-6',
  lg: 'w-7 h-7',
} as const;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function AvatarUpload({
  name,
  avatarUrl,
  size = 'lg',
  editable = true,
  isUploading = false,
  onUpload,
  accept = 'image/jpeg,image/png,image/webp',
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
    e.target.value = '';
  };

  return (
    <div className="relative inline-block">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className={cn('rounded-full object-cover shrink-0', SIZE_CLASSES[size])}
        />
      ) : (
        <div
          className={cn(
            'rounded-full bg-muted flex items-center justify-center font-bold text-foreground shrink-0',
            SIZE_CLASSES[size],
          )}
        >
          {getInitials(name)}
        </div>
      )}

      {editable && onUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleChange}
          />
          <button
            type="button"
            className={cn(
              'absolute bottom-0 right-0 rounded-full bg-card border border-border flex items-center justify-center shadow-sm hover:bg-accent transition-colors',
              BADGE_CLASSES[size],
            )}
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Spinner size="sm" />
            ) : (
              <EditIcon className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        </>
      )}
    </div>
  );
}
