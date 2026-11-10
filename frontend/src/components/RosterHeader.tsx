/**
 * RosterHeader - Airtable Inspired Monthly Roster Header with Operational Actions
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

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  DRAFT: {
    label: 'Draft',
    bg: 'bg-[#f1f5f9]',
    text: 'text-[#41454d]',
    border: 'border-[#dddddd]',
  },
  IN_REVIEW: {
    label: 'In Review',
    bg: 'bg-[#fff8e1]',
    text: 'text-[#b45309]',
    border: 'border-[#fde68a]',
  },
  PUBLISHED: {
    label: 'Published',
    bg: 'bg-[#e8f5e9]',
    text: 'text-[#1b5e20]',
    border: 'border-[#c8e6c9]',
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#dddddd]">
      {/* Title & Metadata */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold text-[#181d26] tracking-tight">
            Monthly Operations Roster
          </h1>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}
          >
            {badge.label}
          </span>
        </div>
        <p className="text-xs text-[#41454d] mt-0.5 flex items-center gap-2">
          <span>Schedule for {formattedMonth}</span>
          {lastUpdated && (
            <>
              <span className="text-[#9297a0]">•</span>
              <span className="inline-flex items-center gap-1 text-[#41454d]">
                <Clock className="w-3 h-3 text-[#9297a0]" />
                Updated {lastUpdated}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Action Buttons - Airtable Signature Button Pair */}
      <div className="flex items-center gap-2">
        {/* Export Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportOpen(!exportOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#181d26] bg-white border border-[#dddddd] rounded-xl hover:bg-[#f8fafc] hover:border-[#9297a0] shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#41454d]" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3 text-[#9297a0]" />
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white border border-[#dddddd] rounded-xl shadow-lg py-1.5 z-30">
              <button
                type="button"
                onClick={() => {
                  onExport('csv');
                  setExportOpen(false);
                }}
                className="w-full text-left px-3.5 py-1.5 text-xs text-[#181d26] hover:bg-[#f8fafc] transition-colors font-medium"
              >
                Export CSV (.csv)
              </button>
              <button
                type="button"
                onClick={() => {
                  onExport('xlsx');
                  setExportOpen(false);
                }}
                className="w-full text-left px-3.5 py-1.5 text-xs text-[#181d26] hover:bg-[#f8fafc] transition-colors font-medium"
              >
                Export Excel (.xlsx)
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#181d26] bg-white border border-[#dddddd] rounded-xl hover:bg-[#f8fafc] hover:border-[#9297a0] shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#41454d]" />
              <span>Regenerate</span>
              <ChevronDown className="w-3 h-3 text-[#9297a0]" />
            </button>
            {regenOpen && (
              <div className="absolute right-0 mt-1 w-60 bg-white border border-[#dddddd] rounded-xl shadow-lg py-1.5 z-30">
                <button
                  type="button"
                  onClick={() => {
                    onRegenerateMinimal();
                    setRegenOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-[#181d26] hover:bg-[#f8fafc] transition-colors"
                >
                  <div className="font-medium text-[#181d26]">Minimal Change Preview</div>
                  <div className="text-[11px] text-[#41454d] mt-0.5">Fixes gaps while preserving unchanged shifts</div>
                </button>
                <div className="border-t border-[#dddddd] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    onRegenerateFull();
                    setRegenOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-[#aa2d00] hover:bg-[#fef2f2] transition-colors"
                >
                  <div className="font-medium text-[#aa2d00]">Full Optimization Solve</div>
                  <div className="text-[11px] text-[#41454d] mt-0.5">Recomputes entire schedule while keeping locks</div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Generate Primary Button - Airtable Near-Black CTA */}
        {canManage && (
          <button
            type="button"
            disabled={disabled || generating}
            onClick={onGenerate}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#181d26] hover:bg-[#0d1218] active:bg-[#000000] rounded-xl shadow-xs disabled:opacity-50 transition-colors"
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
