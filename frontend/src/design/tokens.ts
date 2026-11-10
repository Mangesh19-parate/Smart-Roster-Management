/**
 * Design tokens for Smart Roster Management.
 * Based on Airtable design system (frontend/DESIGN.md)
 */

export const colors = {
  // Airtable Brand colors
  primary: {
    DEFAULT: '#181d26', // Near-black ink
    hover: '#0d1218',
    active: '#0d1218',
    light: '#f8fafc',
  },
  ink: {
    DEFAULT: '#181d26',
    body: '#333840',
    muted: '#41454d',
    hairline: '#dddddd',
    borderStrong: '#9297a0',
  },
  surface: {
    canvas: '#ffffff',
    soft: '#f8fafc',
    strong: '#e0e2e6',
    dark: '#181d26',
    darkElevated: '#1d1f25',
  },
  // Airtable Signature Cards
  signature: {
    coral: '#aa2d00',
    forest: '#0a2e0e',
    cream: '#f5e9d4',
    peach: '#fcab79',
    mint: '#a8d8c4',
    yellow: '#f4d35e',
    mustard: '#d9a441',
  },
  link: {
    DEFAULT: '#1b61c9',
    active: '#1a3866',
  },
  // Airtable Grid Pill Status Colors
  status: {
    working: { bg: '#e8f5e9', text: '#1b5e20', border: '#c8e6c9', code: 'W' },
    weeklyOff: { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0', code: 'WO' },
    publicHoliday: { bg: '#fff8e1', text: '#b45309', border: '#fde68a', code: 'PH' },
    leave: { bg: '#fce4ec', text: '#9d174d', border: '#fbcfe8', code: 'L' },
    compOff: { bg: '#ede7f6', text: '#5b21b6', border: '#ddd6fe', code: 'CO' },
    cover: { bg: '#e0f7fa', text: '#0e7490', border: '#a5f3fc', code: 'C' },
  },
  // Coverage colors
  coverage: {
    fullyCovered: '#006400',
    atMinimum: '#d9a441',
    gap: '#aa2d00',
    closed: '#cbd5e1',
  },
  // Severity colors
  severity: {
    error: { bg: '#fef2f2', text: '#aa2d00', border: '#fecaca' },
    warning: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
    info: { bg: '#f0f9ff', text: '#254fad', border: '#bae6fd' },
  },
};

export const spacing = {
  0: '0',
  xxs: '4px',
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
  section: '96px',
};

export const borderRadius = {
  xs: '2px',
  sm: '6px', // inputs, table cells
  md: '10px', // cards
  lg: '12px', // Airtable primary CTAs & signature cards
  pill: '9999px', // Airtable pills
  full: '9999px',
};

export const shadows = {
  xs: '0 1px 2px rgba(24,29,38,0.05)',
  sm: '0 1px 3px rgba(24,29,38,0.08), 0 1px 2px rgba(24,29,38,0.04)',
  md: '0 4px 14px rgba(24,29,38,0.1)',
  lg: '0 10px 25px rgba(24,29,38,0.12)',
};

export const typography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  sizes: {
    displayXl: '48px',
    displayLg: '40px',
    displayMd: '32px',
    titleLg: '24px',
    titleMd: '20px',
    titleSm: '18px',
    labelMd: '16px',
    button: '16px',
    body: '14px',
    caption: '13px',
    legal: '12px',
    gridCell: '12px',
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
  },
};

export const gridCell = {
  width: '32px',
  height: '28px',
  fontSize: '12px',
  fontWeight: 500,
};

export const transitions = {
  fast: '150ms ease',
  normal: '200ms ease',
};

export const zIndex = {
  dropdown: 100,
  sticky: 200,
  drawer: 300,
  modal: 400,
  toast: 500,
};
