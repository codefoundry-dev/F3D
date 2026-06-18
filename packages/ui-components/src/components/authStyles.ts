/**
 * Input styling for the US 1.0x auth screens (login / 2FA / reset / activate).
 *
 * Their Figma frames (file CFA6k0XCvImOmWXbBgdWYZ, sections 3344:5988x) use a
 * white, bordered 48px field with 16px text — distinct from the gray `bg-muted`
 * Input used by the in-app forms (which match the newer user-management frames).
 * Scoped here so the shared Input stays untouched and other boards don't regress.
 *
 * Merged over the base Input classes via tailwind-merge, so each utility below
 * overrides its base counterpart (bg-muted → bg-card, rounded-xl → rounded-lg,
 * text-sm → text-base, border-input → border-black/15).
 */
export const AUTH_INPUT_CLASS = 'h-12 rounded-lg border-black/15 bg-card text-base';

/**
 * Secondary (outline) button on auth screens — the Figma "Outlined/Small"
 * variant: 44px tall with 16px text, sitting beneath the 52px/18px solid
 * primary. Merged over `Button size="lg"` via tailwind-merge (h-11 → h-[52px],
 * text-base → text-lg).
 */
export const AUTH_OUTLINE_BTN_CLASS = 'h-11 w-full text-base';
