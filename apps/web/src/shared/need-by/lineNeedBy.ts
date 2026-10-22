/**
 * Document-level "needed by" default for wizard line items (FOR-364).
 *
 * A wizard (RFQ, Material Request) holds one header date/time that fills every
 * line. Each line still owns its own `expectedDeliveryDate` / `deliveryTime`,
 * which stay the persisted truth; the header is only a client-side default.
 *
 * Each field is tracked separately: once a user sets a line's date (or time) to
 * something other than the header value, that field is "overridden" and header
 * changes stop touching it. Setting it back to the header value makes it follow
 * the header again.
 */

export interface NeedByDefault {
  /** YYYY-MM-DD, or '' when unset. */
  date: string;
  /** 24-hour "HH:MM", or '' when unset. */
  time: string;
}

export interface NeedByLine {
  key: string;
  /** YYYY-MM-DD */
  expectedDeliveryDate?: string;
  /** 24-hour "HH:MM" */
  deliveryTime?: string;
  /** The user set this line's date by hand, so the header no longer fills it. */
  needByDateOverridden?: boolean;
  /** The user set this line's time by hand, so the header no longer fills it. */
  needByTimeOverridden?: boolean;
}

/** '' and undefined both mean "no value". */
function same(a: string | undefined, b: string | undefined): boolean {
  return (a ?? '') === (b ?? '');
}

/**
 * Fill every non-overridden line with the header date/time. Returns the input
 * array unchanged (same reference) when nothing needs filling, so it is safe
 * to run from an effect that depends on the lines.
 */
export function applyNeedByDefault<T extends NeedByLine>(lines: T[], header: NeedByDefault): T[] {
  let changed = false;
  const next = lines.map((line) => {
    const fillDate = !line.needByDateOverridden && !same(line.expectedDeliveryDate, header.date);
    const fillTime = !line.needByTimeOverridden && !same(line.deliveryTime, header.time);
    if (!fillDate && !fillTime) return line;
    changed = true;
    return {
      ...line,
      ...(fillDate ? { expectedDeliveryDate: header.date || undefined } : {}),
      ...(fillTime ? { deliveryTime: header.time || undefined } : {}),
    };
  });
  return changed ? next : lines;
}

/**
 * Compare a user edit (`next`) against the previous lines and flag each line's
 * date/time as overridden when the user changed it to something other than the
 * header value. Lines that are new or untouched keep their flags.
 */
export function trackNeedByOverrides<T extends NeedByLine>(
  prev: T[],
  next: T[],
  header: NeedByDefault,
): T[] {
  const prevByKey = new Map(prev.map((line) => [line.key, line]));
  return next.map((line) => {
    const before = prevByKey.get(line.key);
    if (!before) return line;
    let updated = line;
    if (!same(before.expectedDeliveryDate, line.expectedDeliveryDate)) {
      updated = {
        ...updated,
        needByDateOverridden: !same(line.expectedDeliveryDate, header.date),
      };
    }
    if (!same(before.deliveryTime, line.deliveryTime)) {
      updated = { ...updated, needByTimeOverridden: !same(line.deliveryTime, header.time) };
    }
    return updated;
  });
}
