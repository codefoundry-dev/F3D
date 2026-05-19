import { useCallback, useEffect, useRef } from 'react';

import { cn } from '../../utils/cn';

import { clampNum } from './date-utils';

export interface SectionedDateInputProps {
  day: string;
  month: string;
  year: string;
  onChangeDay: (v: string) => void;
  onChangeMonth: (v: string) => void;
  onChangeYear: (v: string) => void;
  onComplete: () => void;
  onFocus: () => void;
  autoFocus?: boolean;
}

export function SectionedDateInput({
  day,
  month,
  year,
  onChangeDay,
  onChangeMonth,
  onChangeYear,
  onComplete,
  onFocus,
  autoFocus,
}: SectionedDateInputProps) {
  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) dayRef.current?.focus();
  }, [autoFocus]);

  const handleKey = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      value: string,
      setter: (v: string) => void,
      max: number,
      maxLen: number,
      prevRef: React.RefObject<HTMLInputElement | null> | null,
      nextRef: React.RefObject<HTMLInputElement | null> | null,
    ) => {
      const key = e.key;

      if (key === 'ArrowUp' || key === 'ArrowDown') {
        e.preventDefault();
        const num = parseInt(value, 10) || 0;
        const delta = key === 'ArrowUp' ? 1 : -1;
        const clamped = clampNum(num + delta, maxLen === 4 ? 1900 : 1, max);
        setter(String(clamped).padStart(maxLen, '0'));
        return;
      }

      if (key === 'ArrowLeft') {
        const el = e.currentTarget;
        if (el.selectionStart === 0 && prevRef?.current) {
          e.preventDefault();
          prevRef.current.focus();
        }
        return;
      }

      if (key === 'ArrowRight' || key === '/' || key === '-' || key === '.') {
        const el = e.currentTarget;
        if (el.selectionStart === el.value.length && nextRef?.current) {
          if (key !== 'ArrowRight') e.preventDefault();
          nextRef.current.focus();
          nextRef.current.select();
        } else if (key !== 'ArrowRight') {
          e.preventDefault();
        }
        return;
      }

      if (key === 'Tab') {
        if (!e.shiftKey && e.currentTarget === yearRef.current) {
          onComplete();
        }
        return;
      }

      if (key === 'Backspace') {
        if (!value && prevRef?.current) {
          e.preventDefault();
          prevRef.current.focus();
          prevRef.current.select();
        }
        return;
      }

      if (key === 'Enter') {
        onComplete();
        return;
      }
    },
    [onComplete],
  );

  const handleInput = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement>,
      setter: (v: string) => void,
      max: number,
      maxLen: number,
      nextRef: React.RefObject<HTMLInputElement | null> | null,
    ) => {
      const raw = e.target.value.replace(/\D/g, '').slice(0, maxLen);
      setter(raw);

      if (raw.length === maxLen && nextRef?.current) {
        const num = parseInt(raw, 10);
        if (maxLen <= 2 && num > max) {
          setter(String(max).padStart(maxLen, '0'));
        }
        nextRef.current.focus();
        nextRef.current.select();
      }
    },
    [],
  );

  const sectionClass =
    'bg-transparent outline-none text-center text-foreground tabular-nums selection:bg-primary/20 p-0';

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="flex items-center flex-1" onClick={onFocus}>
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={day}
        placeholder="DD"
        className={cn(sectionClass, 'w-6')}
        onChange={(e) => handleInput(e, onChangeDay, 31, 2, monthRef)}
        onKeyDown={(e) => handleKey(e, day, onChangeDay, 31, 2, null, monthRef)}
        onFocus={(e) => {
          e.target.select();
          onFocus();
        }}
      />
      <span className="text-muted-foreground select-none text-xs">/</span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={month}
        placeholder="MM"
        className={cn(sectionClass, 'w-6')}
        onChange={(e) => handleInput(e, onChangeMonth, 12, 2, yearRef)}
        onKeyDown={(e) => handleKey(e, month, onChangeMonth, 12, 2, dayRef, yearRef)}
        onFocus={(e) => {
          e.target.select();
          onFocus();
        }}
      />
      <span className="text-muted-foreground select-none text-xs">/</span>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={year}
        placeholder="YYYY"
        className={cn(sectionClass, 'w-11')}
        onChange={(e) => handleInput(e, onChangeYear, 2099, 4, null)}
        onKeyDown={(e) => handleKey(e, year, onChangeYear, 2099, 4, monthRef, null)}
        onFocus={(e) => {
          e.target.select();
          onFocus();
        }}
      />
    </div>
  );
}
