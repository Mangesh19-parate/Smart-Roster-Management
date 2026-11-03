/**
 * Status color utilities
 */

export const STATUS_CODES: Record<string, string> = {
  WORK: 'W',
  WO: 'WO',
  PH: 'PH',
  LEAVE: 'L',
  COMP_OFF: 'CO',
};

export const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  WORK: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  WO: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  PH: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  LEAVE: { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
  COMP_OFF: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
  COVER: { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
  CLOSED: { bg: 'bg-slate-200', text: 'text-slate-500', border: 'border-slate-300' },
};

// Type-safe getter that always returns a valid style
export function getStatusStyle(status: string): { bg: string; text: string; border: string } {
  return STATUS_STYLES[status] ?? STATUS_STYLES.WORK as { bg: string; text: string; border: string };
}

export function getStatusCode(status: string): string {
  return STATUS_CODES[status] ?? '?';
}