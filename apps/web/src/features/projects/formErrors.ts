import type { FieldErrors, FieldValues } from 'react-hook-form';

/** `t` widened to accept interpolation options (the i18n key union is too narrow). */
export type TFn = (key: string, options?: Record<string, unknown>) => string;

/** Bookkeeping react-hook-form hangs off every error node — never a field itself. */
const META_KEYS = new Set(['ref', 'type', 'types']);

/**
 * Flatten a react-hook-form error tree into the dotted paths that actually carry
 * a message, e.g. `['name', 'locations.1.address']`.
 *
 * Array- and object-level errors land under `root`, which collapses back onto
 * the parent path so `locations.root` reads as `locations`.
 */
export function collectErrorPaths(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object') return [];

  // Leaf — an RHF field error: `{ type, message, ref }`.
  if (typeof (node as { message?: unknown }).message === 'string') return [prefix];

  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => {
    if (META_KEYS.has(key)) return [];
    const path = key === 'root' ? prefix : prefix ? `${prefix}.${key}` : key;
    return collectErrorPaths(value, path);
  });
}

/**
 * The human labels of the fields that failed validation, in error order and
 * de-duplicated (several bad rows in one array collapse to a single label).
 *
 * `labelFor` may return undefined for a path it can't name; the field still
 * counts as invalid, so callers should fall back to a generic message when the
 * result is empty but the form is known to be failing.
 */
export function invalidFieldLabels<T extends FieldValues>(
  errors: FieldErrors<T>,
  labelFor: (path: string) => string | undefined,
): string[] {
  const labels: string[] = [];
  for (const path of collectErrorPaths(errors)) {
    const label = labelFor(path);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

/**
 * Narrow an error tree to a set of top-level fields. `trigger(names)` leaves
 * errors from previously-validated fields in place, so a wizard step must ignore
 * anything it doesn't own before naming the fields that blocked it.
 */
export function pickErrors<T extends FieldValues>(
  errors: FieldErrors<T>,
  fields: readonly string[],
): FieldErrors<T> {
  return Object.fromEntries(
    Object.entries(errors).filter(([key]) => fields.includes(key)),
  ) as FieldErrors<T>;
}
