import { cn } from '../utils/cn';

import { RadioButton } from './RadioButton';

export interface RadioGroupOption {
  value: string;
  label: string;
}

export interface RadioGroupProps {
  options: RadioGroupOption[];
  value: string | null;
  onChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function RadioGroup({
  options,
  value,
  onChange,
  name,
  disabled,
  orientation = 'horizontal',
  className,
}: RadioGroupProps) {
  return (
    <div className={cn('flex', orientation === 'vertical' ? 'flex-col gap-2' : 'gap-4', className)}>
      {options.map((option) => (
        <RadioButton
          key={option.value}
          checked={value === option.value}
          onChange={() => onChange(option.value)}
          label={option.label}
          value={option.value}
          name={name}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
