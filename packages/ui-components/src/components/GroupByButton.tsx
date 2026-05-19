import ChevronDownIcon from '../assets/icons/chevron-down.svg?react';
import CrossIcon from '../assets/icons/cross.svg?react';

export interface GroupByButtonProps {
  /** Current active group-by value (empty string = no grouping) */
  groupBy: string;
  /** Called when the grouping changes */
  onGroupByChange: (group: string) => void;
  /** Available group-by options (e.g. ['groupByProject', 'groupByStatus']) */
  options: readonly string[];
  /** Maps an option key to a display label */
  getOptionLabel: (option: string) => string;
  /** Label for the default (inactive) button state */
  label: string;
  /** Whether the dropdown is open */
  isOpen: boolean;
  /** Toggle the dropdown open state */
  onOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  /** Ref for the dropdown container (for click-outside detection) */
  dropdownRef: React.RefObject<HTMLDivElement>;
}

export function GroupByButton({
  groupBy,
  onGroupByChange,
  options,
  getOptionLabel,
  label,
  isOpen,
  onOpenChange,
  dropdownRef,
}: GroupByButtonProps) {
  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (groupBy) {
            onGroupByChange('');
          } else {
            onOpenChange((p: boolean) => !p);
          }
        }}
        className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium border border-foreground/20 text-foreground hover:bg-accent rounded-xl transition-colors"
      >
        {groupBy ? (
          <>
            {getOptionLabel(groupBy)}
            <CrossIcon className="w-3 h-3 ml-1" />
          </>
        ) : (
          <>
            {label}
            <ChevronDownIcon className="w-4 h-4" />
          </>
        )}
      </button>
      {isOpen && !groupBy && (
        <div className="absolute right-0 mt-1 w-44 bg-card border border-border rounded-xl shadow-lg z-50 py-1">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className="w-full text-left px-4 py-2.5 text-sm text-card-foreground hover:bg-accent transition-colors"
              onClick={() => {
                onGroupByChange(opt);
                onOpenChange(false);
              }}
            >
              {getOptionLabel(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
