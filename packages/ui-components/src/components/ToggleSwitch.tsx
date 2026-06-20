import { cn } from '../utils/cn';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

/**
 * ToggleSwitch — Forethread design system (Figma node 3581-46580 "_Toggle base").
 * On = dark charcoal gradient track + white thumb (slid to the end);
 * Off = light grey track with a gray-300 border + white thumb at the start.
 */
const sizes = {
  sm: { track: 'h-5 w-10 rounded-full', thumb: 'size-4 rounded-full' },
  md: { track: 'h-7 w-[60px] rounded-[12px]', thumb: 'h-6 w-[30px] rounded-[10px]' },
} as const;

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  size = 'sm',
  className,
  'aria-label': ariaLabel,
}: ToggleSwitchProps) {
  const s = sizes[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex shrink-0 items-center p-[2px] transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed',
        s.track,
        checked ? 'justify-end' : 'justify-start',
        checked
          ? 'border border-transparent bg-gradient-to-b from-[#090A0B] to-[#2D3139] shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]'
          : 'border border-[#D2D5DB] bg-[#F4F4F6]',
        disabled && (checked ? 'bg-none bg-[#B0B5BF]' : 'bg-[#F4F4F6]'),
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none bg-white shadow-[0_2px_12px_0_rgba(10,13,18,0.12),0_1px_2px_0_rgba(10,13,18,0.06)]',
          s.thumb,
          disabled && 'bg-[#F4F4F6]',
        )}
      />
    </button>
  );
}
