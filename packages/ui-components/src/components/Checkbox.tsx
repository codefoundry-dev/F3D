import CheckmarkIcon from '../assets/icons/checkmark.svg?react';
import { cn } from '../utils/cn';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ checked, onChange, label, disabled, className }: CheckboxProps) {
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2.5 cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <span className="relative flex items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          className={cn(
            'w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center transition-all',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
            checked
              ? 'bg-foreground border-foreground'
              : 'bg-background border-border hover:border-foreground/40',
            disabled && 'bg-muted border-border',
          )}
        >
          {checked && <CheckmarkIcon className="w-3 h-3 text-background" />}
        </span>
      </span>
      {label && <span className="text-sm text-card-foreground">{label}</span>}
    </label>
  );
}
