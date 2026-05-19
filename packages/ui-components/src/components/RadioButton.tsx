import { cn } from '../utils/cn';

export interface RadioButtonProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
  value?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
}

export function RadioButton({
  checked,
  onChange,
  label,
  value,
  name,
  disabled,
  className,
}: RadioButtonProps) {
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
          type="radio"
          checked={checked}
          onChange={onChange}
          value={value}
          name={name}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          className={cn(
            'w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-all',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
            checked
              ? 'bg-background border-foreground'
              : 'bg-background border-border hover:border-foreground/40',
            disabled && 'bg-muted border-border',
          )}
        >
          {checked && <span className="w-2.5 h-2.5 rounded-full bg-foreground" />}
        </span>
      </span>
      {label && <span className="text-sm text-card-foreground">{label}</span>}
    </label>
  );
}
