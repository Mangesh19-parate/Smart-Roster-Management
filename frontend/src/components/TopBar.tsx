/**
 * Top Bar - Month picker, roster status, actions
 */
import { useState } from 'react';
import { format, parseISO, addMonths, subMonths } from 'date-fns';

type ViewMode = 'company' | 'pod' | 'brand' | 'process' | 'employee';

interface TopBarProps {
  month: string;
  onMonthChange: (month: string) => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  viewId: string | null;
  onViewIdChange: (id: string | null) => void;
  rosterStatus: string;
  onGenerate: () => void;
  onRegenerateMinimal: () => void;
  onRegenerateFull: () => void;
  onValidate: () => void;
  generating: boolean;
  validating: boolean;
  serverWaking: boolean;
  disabled: boolean;
  userRole: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Draft' },
  IN_REVIEW: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'In Review' },
  PUBLISHED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Published' },
};

function getStatusConfig(status: string): { bg: string; text: string; label: string } {
  return STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT as { bg: string; text: string; label: string };
}

const VIEW_LABELS: Record<string, string> = {
  company: 'Company',
  pod: 'Pod',
  brand: 'Brand',
  process: 'Process',
  employee: 'Employee',
};

export function TopBar({
  month,
  onMonthChange,
  view,
  onViewChange,
  viewId,
  onViewIdChange,
  rosterStatus,
  onGenerate,
  onRegenerateMinimal,
  onRegenerateFull,
  onValidate,
  generating,
  validating,
  serverWaking,
  disabled,
  userRole,
}: TopBarProps) {
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);

  const currentDate = parseISO(`${month}-01`);
  const prevMonth = format(subMonths(currentDate, 1), 'yyyy-MM');
  const nextMonth = format(addMonths(currentDate, 1), 'yyyy-MM');

  const statusConfig = getStatusConfig(rosterStatus);
  const statusBg = statusConfig.bg;
  const statusText = statusConfig.text;
  const statusLabel = statusConfig.label;

  const canManage = userRole === 'MANAGER';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
      {/* Server Waking Banner */}
      {serverWaking && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center justify-between">
          <span>Waking up the server, this can take up to 50 seconds...</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 bg-amber-200 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      )}

      <div className="px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        {/* Left: Logo & Month Picker */}
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold text-slate-900">Smart Roster</span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusBg} ${statusText}`}>
              {statusLabel}
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setMonthPickerOpen(!monthPickerOpen)}
              className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-1"
            >
              {format(parseISO(`${month}-01`), 'MMMM yyyy')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {monthPickerOpen && (
              <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-md shadow-md py-1 z-20 min-w-[160px]">
                <button
                  onClick={() => { onMonthChange(prevMonth); setMonthPickerOpen(false); }}
                  className="w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  {format(parseISO(`${prevMonth}-01`), 'MMM yyyy')}
                </button>
                <button
                  onClick={() => { onMonthChange(nextMonth); setMonthPickerOpen(false); }}
                  className="w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  {format(parseISO(`${nextMonth}-01`), 'MMM yyyy')}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <hr className="my-1 border-slate-200" />
                <div className="px-2 py-1">
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => { onMonthChange(e.target.value); setMonthPickerOpen(false); }}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: View Switcher (Desktop) */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100 rounded-md p-1">
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => { onViewChange(v); onViewIdChange(null); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === v
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* View Filter Dropdown (for pod/brand/process/employee) */}
          {(view !== 'company' && view !== 'employee') && (
            <select
              value={viewId || ''}
              onChange={(e) => onViewIdChange(e.target.value || null)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]"
            >
              <option value="">All {VIEW_LABELS[view]}s</option>
            </select>
          )}

          {/* Regenerate Dropdown */}
          {!disabled && canManage && (
            <div className="relative">
              <button
                onClick={() => setRegenerateOpen(!regenerateOpen)}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-1"
                disabled={generating}
              >
                Regenerate
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {regenerateOpen && (
                <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-md py-1 z-20 min-w-[180px]">
                  <button
                    onClick={() => { onRegenerateMinimal(); setRegenerateOpen(false); }}
                    className="w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    disabled={generating}
                  >
                    <span className="font-medium">Minimal Change</span>
                    <span className="text-xs text-slate-500 ml-auto">Preserves existing</span>
                  </button>
                  <button
                    onClick={() => { onRegenerateFull(); setRegenerateOpen(false); }}
                    className="w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    disabled={generating}
                  >
                    <span className="font-medium">Full Regenerate</span>
                    <span className="text-xs text-slate-500 ml-auto">From scratch</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {!disabled && canManage && (
            <>
              <button
                onClick={onGenerate}
                disabled={generating}
                className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 flex items-center gap-1"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  'Generate'
                )}
              </button>

              <button
                onClick={onValidate}
                disabled={validating}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {validating ? 'Validating...' : 'Validate'}
              </button>
            </>
          )}

          {/* Export Dropdown */}
          <div className="relative">
            <button className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Mobile View Switcher */}
      <div className="md:hidden px-4 pb-3">
        <select
          value={view}
          onChange={(e) => { onViewChange(e.target.value as ViewMode); onViewIdChange(null); }}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
            <option key={v} value={v}>{VIEW_LABELS[v]}</option>
          ))}
        </select>
      </div>
    </header>
  );
}