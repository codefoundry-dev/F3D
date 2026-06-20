import CheckmarkIcon from '../assets/icons/checkmark.svg?react';
import { cn } from '../utils/cn';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  /** Renders the indeterminate (dash) state — useful for table select-all. */
  indeterminate?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Checkbox — Forethread design system (Figma node 3581-46580 "Checkbox base").
 * Checked/indeterminate = dark charcoal gradient + white glyph; unchecked = white
 * with a gray-300 border (hover gray-700). Corner/4XS radius.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  indeterminate,
  size = 'md',
  className,
}: CheckboxProps) {
  const on = checked || indeterminate;
  const box = size === 'sm' ? 'size-4' : 'size-5';
  const glyph = size === 'sm' ? 'size-3' : 'size-3.5';

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2.5 cursor-pointer select-none',
        disabled && 'cursor-not-allowed opacity-60',
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
            'flex items-center justify-center rounded-[4px] border-[1.5px] transition-colors',
            'peer-focus-visible:ring-4 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
            box,
            on
              ? 'border-transparent bg-gradient-to-b from-[#090A0B] to-[#2D3139] text-white'
              : 'border-[#B0B5BF] bg-white hover:border-[#40454F]',
            disabled && (on ? 'bg-none bg-[#B0B5BF]' : 'border-[#E8EAED] bg-[#F4F4F6]'),
          )}
        >
          {indeterminate ? (
            <span
              className={cn('rounded-full bg-white', size === 'sm' ? 'h-0.5 w-2' : 'h-0.5 w-2.5')}
            />
          ) : (
            checked && <CheckmarkIcon className={glyph} />
          )}
        </span>
      </span>
      {label && <span className="text-sm text-card-foreground">{label}</span>}
    </label>
  );
}
