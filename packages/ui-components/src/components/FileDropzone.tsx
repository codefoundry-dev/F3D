import { useCallback, useRef, useState } from 'react';

import PaperclipIcon from '../assets/icons/paperclip.svg?react';
import { cn } from '../utils/cn';

import { Button } from './Button';

export interface FileDropzoneProps {
  onFiles: (files: FileList | File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  buttonLabel?: string;
  hint?: string;
  className?: string;
}

export function FileDropzone({
  onFiles,
  accept,
  multiple,
  disabled,
  buttonLabel = 'Add Attachment',
  hint,
  className,
}: FileDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        onFiles(e.dataTransfer.files);
      }
    },
    [onFiles],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFiles(e.target.files);
      }
      e.target.value = '';
    },
    [onFiles],
  );

  return (
    <div
      className={cn(
        'border border-dashed rounded-xl p-6 text-center transition-colors',
        isDragOver ? 'border-primary bg-primary/5' : 'border-border',
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex flex-col items-center gap-2">
        <Button
          type="button"
          variant="outline"
          leftIcon={<PaperclipIcon className="w-[17px] h-[19.5px]" />}
          disabled={disabled}
          className="h-12 px-6 py-4 gap-2.5 rounded-xl"
          onClick={() => fileInputRef.current?.click()}
        >
          {buttonLabel}
        </Button>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
