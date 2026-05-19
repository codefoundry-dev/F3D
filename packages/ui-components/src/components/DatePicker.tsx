import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import ChevronRightIcon from '../assets/icons/arrow-right.svg?react';
import ChevronLeftIcon from '../assets/icons/back-arrow.svg?react';
import DateIcon from '../assets/icons/date.svg?react';
import { cn } from '../utils/cn';

import {
  isValidDateStr,
  isDateDisabled,
  WEEK_DAYS,
  getDaysInMonth,
  getFirstDayOfMonth,
  parseValue,
  toDateStr,
  buildCalendarCells,
} from './date-picker/date-utils';
import { SectionedDateInput } from './date-picker/SectionedDateInput';

export type { SectionedDateInputProps } from './date-picker/SectionedDateInput';

export interface DatePickerProps {
  /** Value in YYYY-MM-DD format */
  value?: string;
  /** Called with YYYY-MM-DD string (or empty string to clear) */
  onChange?: (date: string) => void;
  placeholder?: string;
  todayLabel?: string;
  className?: string;
  /** Allow manual text input via sectioned mask (DD / MM / YYYY) */
  editable?: boolean;
  /** Minimum selectable date in YYYY-MM-DD format */
  minDate?: string;
  /** Maximum selectable date in YYYY-MM-DD format */
  maxDate?: string;
  /** Remove border and background for inline/table usage */
  borderless?: boolean;
  /** Disable the picker entirely */
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  todayLabel = 'Today',
  className,
  editable = true,
  minDate,
  maxDate,
  borderless,
  disabled,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});

  // Normalize ISO datetime strings to YYYY-MM-DD
  const normalizedValue = value?.includes('T') ? value.split('T')[0] : value;

  const today = useMemo(() => new Date(), []);
  const selectedDate =
    normalizedValue && isValidDateStr(normalizedValue) ? new Date(normalizedValue) : null;

  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());

  const parsed = parseValue(normalizedValue);
  const [day, setDay] = useState(parsed.day);
  const [month, setMonth] = useState(parsed.month);
  const [year, setYear] = useState(parsed.year);

  useEffect(() => {
    const p = parseValue(normalizedValue);
    setDay(p.day);
    setMonth(p.month);
    setYear(p.year);
  }, [normalizedValue]);

  // Position the portal calendar relative to the trigger
  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 320;
    setPortalStyle({
      position: 'fixed',
      left: rect.left,
      width: 280,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !portalRef.current?.contains(target)
      ) {
        setIsOpen(false);
        commitSections();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        commitSections();
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  });

  const commitSections = useCallback(() => {
    const dateStr = toDateStr(day, month, year);
    if (!dateStr) {
      if (!day && !month && !year) onChange?.('');
      return;
    }
    if (isValidDateStr(dateStr) && !isDateDisabled(dateStr, minDate, maxDate)) {
      const d = new Date(dateStr);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      onChange?.(dateStr);
    } else {
      // Revert to previous valid value
      const p = parseValue(normalizedValue);
      setDay(p.day);
      setMonth(p.month);
      setYear(p.year);
    }
  }, [day, month, year, onChange, minDate, maxDate, normalizedValue]);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const goToToday = useCallback(() => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }, [today]);

  const selectDate = useCallback(
    (dayNum: number) => {
      const dd = String(dayNum).padStart(2, '0');
      const mm = String(viewMonth + 1).padStart(2, '0');
      const yyyy = String(viewYear);
      const dateStr = `${yyyy}-${mm}-${dd}`;
      if (isDateDisabled(dateStr, minDate, maxDate)) return;
      setDay(dd);
      setMonth(mm);
      setYear(yyyy);
      onChange?.(dateStr);
      setIsOpen(false);
    },
    [viewYear, viewMonth, onChange, minDate, maxDate],
  );

  const displayValue = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const daysInPrevMonth = getDaysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const cells = buildCalendarCells(daysInMonth, firstDay, daysInPrevMonth);

  const isDayToday = (d: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate();

  const isSelected = (d: number) =>
    selectedDate?.getFullYear() === viewYear &&
    selectedDate?.getMonth() === viewMonth &&
    selectedDate?.getDate() === d;

  const isDayDisabled = (d: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return isDateDisabled(dateStr, minDate, maxDate);
  };

  const isEmpty = !day && !month && !year;

  return (
    <div
      ref={containerRef}
      className={cn('relative min-w-0', disabled && 'opacity-50 pointer-events-none', className)}
    >
      {editable ? (
        <div
          className={cn(
            'flex items-center w-full h-10 px-3 text-sm transition-colors',
            borderless
              ? 'bg-transparent border-0'
              : cn(
                  'border border-border rounded-lg hover:border-foreground/40',
                  isOpen && 'border-foreground/50 bg-muted',
                ),
          )}
        >
          {isEmpty && !isOpen ? (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <span
              className="flex-1 text-muted-foreground cursor-text truncate"
              onClick={() => setIsOpen(true)}
            >
              {placeholder}
            </span>
          ) : (
            <SectionedDateInput
              day={day}
              month={month}
              year={year}
              onChangeDay={setDay}
              onChangeMonth={setMonth}
              onChangeYear={setYear}
              onComplete={() => {
                commitSections();
                setIsOpen(false);
              }}
              onFocus={() => setIsOpen(true)}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={isOpen}
            />
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setIsOpen((p) => !p)}
            className="flex-shrink-0 ml-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <DateIcon className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen((p) => !p)}
          className={cn(
            'flex items-center justify-between w-full h-10 px-3 text-sm transition-colors',
            borderless
              ? 'bg-transparent border-0'
              : cn(
                  'border border-border rounded-lg hover:border-foreground/40',
                  isOpen && 'border-foreground/50 bg-muted',
                ),
            displayValue ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <span className="truncate">{displayValue || placeholder}</span>
          <DateIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        </button>
      )}

      {isOpen &&
        createPortal(
          <div
            ref={portalRef}
            data-datepicker-portal
            style={portalStyle}
            className="bg-card border border-border rounded-xl shadow-lg z-[9999] p-3"
          >
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={prevMonth}
                className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-accent transition-colors text-foreground"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-foreground">{monthName}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={nextMonth}
                  className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-accent transition-colors text-foreground"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={goToToday}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
                >
                  {todayLabel}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {WEEK_DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {cells.map((cell, i) => {
                const disabled = !cell.current || isDayDisabled(cell.day);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && selectDate(cell.day)}
                    className={cn(
                      'flex items-center justify-center w-8 h-8 mx-auto text-sm rounded-full transition-colors',
                      !cell.current && 'text-muted-foreground/40 cursor-default',
                      cell.current && disabled && 'text-muted-foreground/30 cursor-not-allowed',
                      cell.current && !disabled && 'hover:bg-accent cursor-pointer',
                      cell.current &&
                        !disabled &&
                        isDayToday(cell.day) &&
                        !isSelected(cell.day) &&
                        'bg-foreground text-background',
                      cell.current &&
                        !disabled &&
                        isSelected(cell.day) &&
                        'bg-foreground text-background font-medium',
                    )}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
