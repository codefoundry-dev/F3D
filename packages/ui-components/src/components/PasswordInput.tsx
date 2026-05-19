import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';

import EyeClosedIcon from '../assets/icons/eye-closed.svg?react';
import EyeOpenedIcon from '../assets/icons/eye-opened.svg?react';

import { Input } from './Input';

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  leftIcon?: ReactNode;
  showIcon?: ReactNode;
  hideIcon?: ReactNode;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ leftIcon, showIcon, hideIcon, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    const defaultEyeIcon = <EyeOpenedIcon className="w-[18px] h-[18px]" />;
    const defaultEyeOffIcon = <EyeClosedIcon className="w-[18px] h-[18px]" />;

    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        leftIcon={leftIcon}
        rightIcon={
          <button
            type="button"
            tabIndex={-1}
            className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? (showIcon ?? defaultEyeIcon) : (hideIcon ?? defaultEyeOffIcon)}
          </button>
        }
        {...props}
      />
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
