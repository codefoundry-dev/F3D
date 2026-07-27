export function isValidDateStr(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(str);
}

export function isDateDisabled(dateStr: string, minDate?: string, maxDate?: string): boolean {
  if (!isValidDateStr(dateStr)) return false;
  if (minDate && dateStr < minDate) return true;
  if (maxDate && dateStr > maxDate) return true;
  return false;
}

/**
 * Today as a YYYY-MM-DD string in the user's **local** calendar — the canonical
 * `minDate` for any field that names a future event (need-by, delivery,
 * deadlines). Derived from local date parts rather than `toISOString()`, which
 * yields the UTC day and so drifts by one either side of midnight — blocking a
 * genuine "today" west of UTC, or admitting yesterday east of it. The calendar
 * grid builds its cells from local parts too, so both sides agree.
 */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function parseValue(val: string | undefined): { day: string; month: string; year: string } {
  if (!val) return { day: '', month: '', year: '' };
  const dateOnly = val.includes('T') ? val.split('T')[0] : val;
  const [y, m, d] = dateOnly.split('-');
  return { day: d ?? '', month: m ?? '', year: y ?? '' };
}

export function toDateStr(day: string, month: string, year: string): string {
  if (!day || !month || !year || year.length < 4) return '';
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function clampNum(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export interface CalendarCell {
  day: number;
  current: boolean;
}

export function buildCalendarCells(
  daysInMonth: number,
  firstDay: number,
  daysInPrevMonth: number,
): CalendarCell[] {
  const cells: CalendarCell[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, current: false });
    }
  }
  return cells;
}
