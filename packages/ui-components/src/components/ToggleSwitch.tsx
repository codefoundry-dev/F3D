import ToggleSwitchIcon from '../assets/icons/toggle-switch.svg?react';
import { cn } from '../utils/cn';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-foreground hover:opacity-80 transition-opacity',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      onClick={() => onChange(!checked)}
    >
      <ToggleSwitchIcon className={cn('w-[37.5px] h-[20.25px]', !checked && 'scale-x-[-1]')} />
    </button>
  );
}
