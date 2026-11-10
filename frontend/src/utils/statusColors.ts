/**
 * Status color utilities inspired by Airtable's multi-select and status tags
 */

export const STATUS_CODES: Record<string, string> = {
  WORK: 'W',
  WO: 'WO',
  PH: 'PH',
  LEAVE: 'L',
  COMP_OFF: 'CO',
  COVER: 'C',
};

export const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  WORK: { bg: 'bg-[#e8f5e9]', text: 'text-[#1b5e20]', border: 'border-[#c8e6c9]' },
  WO: { bg: 'bg-[#f1f5f9]', text: 'text-[#334155]', border: 'border-[#e2e8f0]' },
  PH: { bg: 'bg-[#fff8e1]', text: 'text-[#b45309]', border: 'border-[#fde68a]' },
  LEAVE: { bg: 'bg-[#fce4ec]', text: 'text-[#9d174d]', border: 'border-[#fbcfe8]' },
  COMP_OFF: { bg: 'bg-[#ede7f6]', text: 'text-[#5b21b6]', border: 'border-[#ddd6fe]' },
  COVER: { bg: 'bg-[#e0f7fa]', text: 'text-[#0e7490]', border: 'border-[#a5f3fc]' },
  CLOSED: { bg: 'bg-[#f1f5f9]', text: 'text-[#94a3b8]', border: 'border-[#cbd5e1]' },
};

// Type-safe getter that always returns a valid style
export function getStatusStyle(status: string): { bg: string; text: string; border: string } {
  return STATUS_STYLES[status] ?? STATUS_STYLES.WORK as { bg: string; text: string; border: string };
}

export function getStatusCode(status: string): string {
  return STATUS_CODES[status] ?? '?';
}
