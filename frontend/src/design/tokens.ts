/**
 * Design tokens for Smart Roster Management.
 * Based on docs/DESIGN.md
 */

export const colors = {
  // Brand colors
  primary: {
    DEFAULT: '#4F46E5', // Indigo
    hover: '#4338CA',
    light: '#EEF2FF',
  },
  neutral: {
    dark: '#0F172A', // Slate
    medium: '#475569',
    light: '#94A3B8',
    border: '#E2E8F0',
    surface: '#F8FAFC', // Off-white
    white: '#FFFFFF',
  },
  // Semantic status colors (fixed)
  status: {
    working: { bg: '#DCFCE7', text: '#166534', code: 'W' },
    weeklyOff: { bg: '#E2E8F0', text: '#334155', code: 'WO' },
    publicHoliday: { bg: '#FEF3C7', text: '#92400E', code: 'PH' },
    leave: { bg: '#FCE7F3', text: '#9D174D', code: 'L' },
    compOff: { bg: '#E0E7FF', text: '#3730A3', code: 'CO' },
    cover: { bg: '#CFFAFE', text: '#155E75', code: 'C' },
  },
  // Coverage colors
  coverage: {
    fullyCovered: '#16A34A',
    atMinimum: '#F59E0B',
    gap: '#DC2626',
    closed: '#CBD5E1',
  },
  // Severity colors
  severity: {
    error: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
    warning: { bg: '#FFFBEB', text: '#F59E0B', border: '#FDE68A' },
    info: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  },
};

export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '16px',
  4: '24px',
  5: '32px',
  6: '48px',
  7: '64px',
};

export const borderRadius = {
  sm: '4px', // grid cells
  md: '6px', // inputs, buttons
  lg: '8px', // cards
  full: '9999px', // badges
};

export const shadows = {
  sm: '0 1px 2px rgba(15,23,42,0.06)', // cards
  md: '0 4px 12px rgba(15,23,42,0.12)', // popovers, drawers
};

export const typography = {
  fontFamily: 'Inter, system-ui, sans-serif',
  sizes: {
    pageTitle: '24px',
    sectionTitle: '18px',
    body: '14px',
    gridCell: '12px',
    caption: '12px',
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