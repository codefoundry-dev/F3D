import { ComponentStatus } from '../../types/super-admin/platform-state.types';

/**
 * Platform-state status pills.
 *
 * The Figma frame (node 3345-110088) renders ALL statuses as a single neutral
 * gray pill — Healthy / Warning / Error are visually identical, with severity
 * conveyed by the Error info / Last Error columns rather than pill colour. We
 * keep one shared style here so the table matches the design exactly. Disabled
 * rows dim slightly so a toggled-off integration still reads as "off".
 */
const NEUTRAL_STATUS_PILL = 'bg-accent text-foreground border-transparent';

export const STATUS_COLORS: Record<string, string> = {
  [ComponentStatus.HEALTHY]: NEUTRAL_STATUS_PILL,
  [ComponentStatus.ERROR]: NEUTRAL_STATUS_PILL,
  [ComponentStatus.WARNING]: NEUTRAL_STATUS_PILL,
  [ComponentStatus.DISABLED]: 'bg-accent/60 text-muted-foreground border-transparent',
};
