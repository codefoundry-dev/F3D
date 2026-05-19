import DownloadIcon from '../assets/icons/download.svg?react';

import { ToolbarIconButton } from './ToolbarIconButton';

export interface ExportFormat {
  key: string;
  label: string;
}

export interface ExportDropdownButtonProps {
  /** Title for the icon button */
  title?: string;
  /** Available export formats */
  formats: ExportFormat[];
  /** Called when an export format is selected */
  onExport: (formatKey: string) => void;
  /** Whether the dropdown is open */
  isOpen: boolean;
  /** Toggle the dropdown open state */
  onOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  /** Ref for the dropdown container */
  dropdownRef: React.RefObject<HTMLDivElement>;
}

export function ExportDropdownButton({
  title = 'Export',
  formats,
  onExport,
  isOpen,
  onOpenChange,
  dropdownRef,
}: ExportDropdownButtonProps) {
  return (
    <div ref={dropdownRef} className="relative">
      <ToolbarIconButton title={title} onClick={() => onOpenChange((p: boolean) => !p)}>
        <DownloadIcon className="w-6 h-6" />
      </ToolbarIconButton>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-44 bg-card border border-border rounded-xl shadow-lg z-50 py-1">
          {formats.map((fmt) => (
            <button
              key={fmt.key}
              type="button"
              className="w-full text-left px-4 py-2.5 text-sm text-card-foreground hover:bg-accent transition-colors"
              onClick={() => {
                onOpenChange(false);
                onExport(fmt.key);
              }}
            >
              {fmt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
