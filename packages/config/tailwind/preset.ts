/**
 * Shared Forethread Tailwind CSS preset.
 *
 * All visual tokens (colors, fonts, border-radius, shadows) are defined as
 * CSS custom properties so they can be themed from a single `globals.css`.
 * Each web app imports this preset in its `tailwind.config.ts`.
 *
 * Constitution Reference: Principle IX — Design Token Management
 */

import type { Config } from 'tailwindcss';

import { colors as figmaPalette } from './colors';

/*
 * Exact Figma design-system palette scales (gray, orange, blue, green, …).
 * Spreading these overrides Tailwind's default palette so utilities like
 * `bg-orange-600` / `text-gray-500` resolve to the precise design-system hexes.
 * `destructive` / `warning` / `success` are merged into their semantic tokens
 * below (so `bg-destructive` keeps its themable DEFAULT while `bg-destructive-600`
 * exposes the raw scale). The rest (gray, orange, blue, basic, …) spread directly.
 */
const {
  destructive: destructiveScale,
  warning: warningScale,
  success: successScale,
  ...paletteScales
} = figmaPalette;

const preset: Partial<Config> = {
  darkMode: 'class',
  theme: {
    extend: {
      /* ───── Colors (mapped to CSS custom properties) ───── */
      colors: {
        /* Raw Figma palette scales (exact hexes) */
        ...paletteScales,

        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        /* Brand accent (orange) — emphasis CTAs + brand moments. Distinct from
           the grey `accent` token below (which drives hover/active backgrounds). */
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          foreground: 'hsl(var(--brand-foreground))',
          hover: 'hsl(var(--brand-hover))',
          pressed: 'hsl(var(--brand-pressed))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          ...destructiveScale,
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          ...successScale,
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          ...warningScale,
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        'filter-chip': {
          DEFAULT: 'hsl(var(--filter-chip))',
          foreground: 'hsl(var(--filter-chip-foreground))',
        },

        /* Role badge colors */
        badge: {
          purple: 'hsl(var(--badge-purple))',
          'purple-text': 'hsl(var(--badge-purple-text))',
          blue: 'hsl(var(--badge-blue))',
          'blue-text': 'hsl(var(--badge-blue-text))',
          indigo: 'hsl(var(--badge-indigo))',
          'indigo-text': 'hsl(var(--badge-indigo-text))',
          teal: 'hsl(var(--badge-teal))',
          'teal-text': 'hsl(var(--badge-teal-text))',
          orange: 'hsl(var(--badge-orange))',
          'orange-text': 'hsl(var(--badge-orange-text))',
          amber: 'hsl(var(--badge-amber))',
          'amber-text': 'hsl(var(--badge-amber-text))',
          pink: 'hsl(var(--badge-pink))',
          'pink-text': 'hsl(var(--badge-pink-text))',
        },
      },

      /* ───── Custom breakpoints ───── */
      screens: {
        toolbar: '900px',
      },

      /* ───── Border color default ───── */
      borderColor: {
        DEFAULT: 'hsl(var(--border))',
        hover: 'hsl(var(--border-hover))',
      },

      /* ───── Ring color ───── */
      ringColor: {
        'border-hover': 'hsl(var(--border-hover))',
      },

      /* ───── Border radius ───── */
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      /* ───── Font family ───── */
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
        mono: [
          'var(--font-mono)',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
      },

      /* ───── Box shadows ───── */
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        /* Design-system effects */
        button: '0 1px 2px 0 rgb(10 13 18 / 0.05)',
        /* Focus ring: inner background-coloured ring + outer blue ring (Figma "Focuse-xs") */
        focus: '0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring))',
        'focus-destructive': '0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--destructive))',
        /* Accent (orange) button glow — Figma "Button effect" */
        'accent-glow':
          '0 3px 4px -1px rgb(252 96 16 / 0.4), inset 0 2px 1px 0 rgb(255 255 255 / 0.4)',
      },
    },
  },
};

export default preset;
