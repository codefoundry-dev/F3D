import { cn } from '../utils/cn';

export interface RadioButtonProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
  value?: string;
  name?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * RadioButton — Forethread design system (Figma node 3581-46580 "Radio base").
 * Checked = dark charcoal gradient fill + white centre dot; unchecked = white
 * with a gray-300 border (hover gray-700).
 */
export function RadioButton({
  checked,
  onChange,
  label,
  value,
  name,
  disabled,
  size = 'md',
  className,
}: RadioButtonProps) {
  const box = size === 'sm' ? 'size-4' : 'size-5';
  const dot = size === 'sm' ? 'size-1.5' : 'size-2';

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
            'flex items-center justify-center rounded-full border-[1.5px] transition-colors',
            'peer-focus-visible:ring-4 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
            box,
            checked
              ? 'border-transparent bg-gradient-to-b from-[#090A0B] to-[#2D3139]'
              : 'border-[#B0B5BF] bg-white hover:border-[#40454F]',
            disabled && (checked ? 'bg-none bg-[#B0B5BF]' : 'border-[#E8EAED] bg-[#F4F4F6]'),
          )}
        >
          {checked && <span className={cn('rounded-full bg-white', dot)} />}
        </span>
      </span>
      {label && <span className="text-sm text-card-foreground">{label}</span>}
    </label>
  );
}
