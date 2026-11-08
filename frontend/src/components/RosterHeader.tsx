/**
 * RosterHeader - Monthly Roster page header with enterprise operational actions
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Play, RefreshCw, Download, ChevronDown, Clock } from 'lucide-react';

interface RosterHeaderProps {
  month: string;
  rosterStatus: string;
  lastUpdated?: string | null;
  onGenerate: () => void;
  onRegenerateMinimal: () => void;
  onRegenerateFull: () => void;
  onExport: (format: 'csv' | 'xlsx') => void;
  generating: boolean;
  disabled: boolean;
  canManage: boolean;
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  DRAFT: {
    label: 'Draft',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    ring: 'ring-slate-500/20',
  },
  IN_REVIEW: {
    label: 'In Review',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-600/20',
  },
  PUBLISHED: {
    label: 'Published',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-600/20',
  },
};

export function RosterHeader({
  month,
  rosterStatus,
  lastUpdated,
  onGenerate,
  onRegenerateMinimal,
  onRegenerateFull,
  onExport,
  generating,
  disabled,
  canManage,
}: RosterHeaderProps) {
  const [regenOpen, setRegenOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const formattedMonth = format(parseISO(`${month}-01`), 'MMMM yyyy');
  const badge = STATUS_BADGES[rosterStatus] ?? STATUS_BADGES.DRAFT!;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
      {/* Title & Metadata */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Monthly Operations Roster
          </h1>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${badge.bg} ${badge.text} ${badge.ring}`}
          >
            {badge.label}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
          <span>Schedule for {formattedMonth}</span>
          {lastUpdated && (
            <>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                Updated {lastUpdated}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Export Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportOpen(!exportOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-30">
              <button
                type="button"
                onClick={() => {
                  onExport('csv');
                  setExportOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <span>Export CSV (.csv)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onExport('xlsx');
                  setExportOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <span>Export Excel (.xlsx)</span>
              </button>
            </div>
          )}
        </div>

        {/* Regenerate Dropdown (Managers only) */}
        {canManage && (
          <div className="relative">
            <button
              type="button"
              disabled={disabled || generating}
              onClick={() => setRegenOpen(!regenOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Regenerate</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {regenOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-30">
                <button
                  type="button"
                  onClick={() => {
                    onRegenerateMinimal();
                    setRegenOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <div className="font-semibold text-slate-800">Minimal Change Preview</div>
                  <div className="text-[11px] text-slate-500">Fixes gaps while preserving unchanged shifts</div>
                </button>
                <div className="border-t border-slate-100 my-0.5" />
                <button
                  type="button"
                  onClick={() => {
                    onRegenerateFull();
                    setRegenOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <div className="font-semibold text-rose-700">Full Optimization Solve</div>
                  <div className="text-[11px] text-slate-500">Recomputes entire schedule while keeping locks</div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Generate Primary Button */}
        {canManage && (
          <button
            type="button"
            disabled={disabled || generating}
            onClick={onGenerate}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Solving...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Generate Roster</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
