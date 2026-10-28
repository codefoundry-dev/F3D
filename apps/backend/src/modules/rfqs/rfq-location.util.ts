/**
 * Display string for a project location on RFQ surfaces (FOR-387).
 *
 * `label ?? address` hid the address whenever a location was labelled (e.g.
 * "Main gate"), so buyers and vendors never saw where to deliver. Show both,
 * collapsing to whichever is present when the other is blank or identical.
 */
export function formatRfqLocation(
  location: { label: string | null; address: string | null } | null | undefined,
): string | null {
  if (!location) return null;
  const label = blankToNull(location.label);
  const address = blankToNull(location.address);
  if (label && address && label !== address) return `${label} — ${address}`;
  return label ?? address;
}

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
}
