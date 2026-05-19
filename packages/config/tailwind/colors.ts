/**
 * Forethread Design System — Color Tokens
 *
 * Extracted from Figma design system.
 * Font: Urbanist
 *
 * Usage:
 *   import { colors } from '@forethread/config/tailwind/colors';
 *   colors.gray[500] // '#6D7588'
 */

// ─────────────────────────────────────────────
// Primary Colors
// ─────────────────────────────────────────────

export const basic = {
  white: '#FFFFFF',
  black: '#090A0B',
} as const;

export const gray = {
  25: '#FDFDFD',
  50: '#F4F4F6',
  100: '#E8EAED',
  200: '#D2D5DB',
  300: '#B0B5BF',
  400: '#999FAD',
  500: '#6D7588',
  600: '#525866',
  700: '#40454F',
  800: '#2D3139',
  900: '#1B1D22',
} as const;

export const destructive = {
  25: '#FFFBFA',
  50: '#FEF3F2',
  100: '#FEE4E2',
  200: '#FECDCA',
  300: '#FDA29B',
  400: '#F97066',
  500: '#F04438',
  600: '#D92D20',
  700: '#B4231B',
  800: '#912018',
  900: '#7A271A',
} as const;

export const warning = {
  25: '#FFFCF5',
  50: '#FFFAEB',
  100: '#FFF2CF',
  200: '#FFE7A4',
  300: '#FFD470',
  400: '#F9AF4D',
  500: '#F79009',
  600: '#C67306',
  700: '#9E5C05',
  800: '#774504',
  900: '#4F2E02',
} as const;

export const success = {
  25: '#F6FEF9',
  50: '#EDFCF2',
  100: '#D3F8DF',
  200: '#AAF0C4',
  300: '#73E2A3',
  400: '#3CCB7F',
  500: '#16B364',
  600: '#099250',
  700: '#087443',
  800: '#095C37',
  900: '#084C2E',
} as const;

// ─────────────────────────────────────────────
// Secondary Colors
// ─────────────────────────────────────────────

export const violet = {
  25: '#FEFAFF',
  50: '#FDF4FF',
  100: '#FBE8FF',
  200: '#F6D0FE',
  300: '#EEAAFD',
  400: '#E478FA',
  500: '#D444F1',
  600: '#BA24D5',
  700: '#9F1AB1',
  800: '#7515B0',
  900: '#3F0F43',
} as const;

export const purple = {
  25: '#FAFAFF',
  50: '#F4F3FF',
  100: '#EBE9FE',
  200: '#D9D6FE',
  300: '#BDB4FE',
  400: '#9B8AFB',
  500: '#7A5AF8',
  600: '#6938EF',
  700: '#5925DC',
  800: '#4A1FB8',
  900: '#240F57',
} as const;

export const indigo = {
  25: '#F5F8FF',
  50: '#EEF4FF',
  100: '#E0EAFF',
  200: '#C7D7FE',
  300: '#A4BCFD',
  400: '#8098F9',
  500: '#6172F3',
  600: '#444CE7',
  700: '#3538CD',
  800: '#2A2D93',
  900: '#1F2358',
} as const;

export const blue = {
  25: '#F5FAFF',
  50: '#EFF8FF',
  100: '#D1E9FF',
  200: '#B2DDFF',
  300: '#84CAFF',
  400: '#53B1FD',
  500: '#2E90FA',
  600: '#1570EF',
  700: '#175CD3',
  800: '#134293',
  900: '#102A56',
} as const;

export const cyan = {
  25: '#F5FEFF',
  50: '#ECFDFF',
  100: '#CFF9FE',
  200: '#A5F0FC',
  300: '#67E3F9',
  400: '#22CCEE',
  500: '#06AED4',
  600: '#088AB2',
  700: '#0E7090',
  800: '#164C63',
  900: '#0D2D3A',
} as const;

export const teal = {
  25: '#F6FEFC',
  50: '#F0FDF9',
  100: '#CCFBEF',
  200: '#99F6E0',
  300: '#5FE9D0',
  400: '#2ED3B7',
  500: '#15B79E',
  600: '#0E9384',
  700: '#107569',
  800: '#134E48',
  900: '#0A2926',
} as const;

export const green = {
  25: '#F6FEF6',
  50: '#DFF7DF',
  100: '#C8F0C9',
  200: '#9CE29C',
  300: '#6ED46E',
  400: '#41C641',
  500: '#14B814',
  600: '#109310',
  700: '#0C6E0C',
  800: '#084A08',
  900: '#042504',
} as const;

export const lime = {
  25: '#FBFEF6',
  50: '#EEF7DF',
  100: '#E1F0C9',
  200: '#C7E29C',
  300: '#A0D46E',
  400: '#93C641',
  500: '#79B814',
  600: '#619310',
  700: '#496E0C',
  800: '#304A08',
  900: '#1B2504',
} as const;

export const gold = {
  25: '#FEFEF6',
  50: '#F9F9DF',
  100: '#F4F4C9',
  200: '#EBEA9B',
  300: '#E1DF6E',
  400: '#D8D540',
  500: '#CEC813',
  600: '#A5A20F',
  700: '#7C7A0B',
  800: '#525108',
  900: '#292904',
} as const;

export const orange = {
  25: '#FEFAF5',
  50: '#FEF6EE',
  100: '#FDEAD7',
  200: '#F9DBAF',
  300: '#F7B27A',
  400: '#F38744',
  500: '#EF6820',
  600: '#E04F16',
  700: '#B93815',
  800: '#772917',
  900: '#511C10',
} as const;

export const rose = {
  25: '#FFF7F8',
  50: '#FFF1F3',
  100: '#FFE4E8',
  200: '#FECDD8',
  300: '#FEA3B4',
  400: '#FD6F8E',
  500: '#F63D6B',
  600: '#E31B53',
  700: '#C01048',
  800: '#B9123E',
  900: '#510824',
} as const;

export const pink = {
  25: '#FEF8FC',
  50: '#FDF2FA',
  100: '#FCE7F6',
  200: '#FCCEEE',
  300: '#FAA7E0',
  400: '#F670C7',
  500: '#EE46BC',
  600: '#DD2590',
  700: '#C01574',
  800: '#B51651',
  900: '#4E0D30',
} as const;

// ─────────────────────────────────────────────
// Aggregated exports
// ─────────────────────────────────────────────

export const colors = {
  basic,
  gray,
  destructive,
  warning,
  success,
  violet,
  purple,
  indigo,
  blue,
  cyan,
  teal,
  green,
  lime,
  gold,
  orange,
  rose,
  pink,
} as const;

export type Colors = typeof colors;
