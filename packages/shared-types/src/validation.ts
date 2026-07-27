export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const URL_REGEX = /^https?:\/\/.+/;

/**
 * Wanted delivery time-of-day on an MR / RFQ / PO line — 24-hour `HH:MM`, the
 * value an `<input type="time">` produces. Stored as a string rather than folded
 * into the line's delivery date so it survives the MR → RFQ → PO hops without
 * dragging timezone semantics along with it.
 */
export const DELIVERY_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

export function isValidUrl(value: string): boolean {
  return URL_REGEX.test(value);
}
