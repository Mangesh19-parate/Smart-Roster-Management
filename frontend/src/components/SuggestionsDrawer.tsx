/**
 * Suggestions Drawer - Airtable Inspired Ranked Suggestions Drawer
 */
import { useEffect } from 'react';
import { changesApi } from '../api/client';
import { useQuery } from '@tanstack/react-query';
import type { SuggestionsDrawerProps } from './types';
import { Sparkles, X } from 'lucide-react';

const SUGGESTION_KIND_LABELS: Record<string, string> = {
  ADD_COVER: 'Add Cover',
  SHIFT_OFF: 'Shift Off',
  SWAP_OFF: 'Swap Off',
  LOCAL_RESOLVE: 'Local Resolve',
  REQUEST_BACKUP: 'Request Backup',
};

const KIND_COLORS: Record<string, string> = {
  ADD_COVER: 'bg-[#e8f5e9] text-[#1b5e20] border-[#c8e6c9]',
  SHIFT_OFF: 'bg-[#f0f9ff] text-[#254fad] border-[#bae6fd]',
  SWAP_OFF: 'bg-[#ede7f6] text-[#5b21b6] border-[#ddd6fe]',
  LOCAL_RESOLVE: 'bg-[#f8fafc] text-[#181d26] border-[#dddddd]',
  REQUEST_BACKUP: 'bg-[#fff8e1] text-[#b45309] border-[#fde68a]',
};

export function SuggestionsDrawer({
  isOpen,
  onClose,
  issue,
  month,
  onApply,
  loading,
}: SuggestionsDrawerProps) {
  const { data: suggestions } = useQuery({
    queryKey: ['suggestions', month, issue?.id],
    queryFn: () => changesApi.getSuggestions(month, issue!.id),
    enabled: !!issue && isOpen,
    staleTime: 0,
  });

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !issue) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#181d26]/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="flex-1 max-w-2xl md:max-w-3xl bg-white shadow-xl flex flex-col h-full border-l border-[#dddddd] z-10">
        {/* Header */}
        <div className="p-4 border-b border-[#dddddd] bg-[#f8fafc] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#d9a441]" />
              <h3 className="font-semibold text-sm text-[#181d26]">Suggestions for {issue.rule}</h3>
            </div>
            <p className="text-xs text-[#41454d] mt-1">{issue.cause}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#9297a0] hover:text-[#181d26] rounded-xl hover:bg-white border border-transparent hover:border-[#dddddd] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {!suggestions || suggestions.length === 0 ? (
            <div className="text-center py-12 text-[#9297a0] text-xs font-medium">
              No suggestions available for this issue.
            </div>
          ) : (
            suggestions.map((suggestion: any, index: number) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                rank={index + 1}
                onApply={() => onApply(suggestion.id)}
                loading={loading}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  rank,
  onApply,
  loading,
}: {
  suggestion: any;
  rank: number;
  onApply: () => void;
  loading: boolean;
}) {
  const kindColor = KIND_COLORS[suggestion.kind] || 'bg-[#f8fafc] text-[#181d26] border-[#dddddd]';

  return (
    <div className="border border-[#dddddd] rounded-xl p-4 bg-white hover:border-[#181d26] transition-colors shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[#181d26] text-white">
              #{rank}
            </span>
            <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${kindColor}`}>
              {SUGGESTION_KIND_LABELS[suggestion.kind] || suggestion.kind}
            </span>
          </div>
          <p className="text-xs text-[#181d26] font-medium mb-2 leading-relaxed">{suggestion.description}</p>

          {/* Fixes */}
          {suggestion.fixes?.length > 0 && (
            <div className="mb-2">
              <span className="text-[11px] font-semibold text-[#41454d] uppercase tracking-wider block mb-1">Fixes:</span>
              <div className="flex flex-wrap gap-1">
                {suggestion.fixes.map((fix: any) => (
                  <span key={fix.id} className="px-2 py-0.5 text-[11px] font-medium bg-[#e8f5e9] text-[#1b5e20] border border-[#c8e6c9] rounded-full">
                    {fix.rule}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* May Break */}
          {suggestion.may_break?.length > 0 && (
            <div className="mb-2">
              <span className="text-[11px] font-semibold text-[#aa2d00] uppercase tracking-wider block mb-1">May Break:</span>
              <div className="flex flex-wrap gap-1">
                {suggestion.may_break.map((brk: any) => (
                  <span key={brk.id} className="px-2 py-0.5 text-[11px] font-medium bg-[#fef2f2] text-[#aa2d00] border border-[#fecaca] rounded-full">
                    {brk.rule}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="flex flex-wrap gap-3 text-[11px] text-[#41454d] mt-2">
            <span>Entries changed: <strong>{suggestion.entries_changed}</strong></span>
            <span>Fairness Δ: <strong>{suggestion.fairness_delta >= 0 ? '+' : ''}{suggestion.fairness_delta.toFixed(1)}</strong></span>
          </div>
        </div>

        <button
          onClick={onApply}
          disabled={loading}
          className="px-4 py-2 bg-[#181d26] text-white rounded-xl text-xs font-medium hover:bg-[#0d1218] active:bg-[#000000] focus:outline-none disabled:opacity-50 flex-shrink-0 transition-colors shadow-xs"
        >
          {loading ? 'Applying...' : 'Apply'}
        </button>
      </div>

      {/* Actions Preview */}
      {suggestion.actions?.length > 0 && (
        <details className="mt-3 pt-3 border-t border-[#dddddd]">
          <summary className="text-[11px] text-[#41454d] cursor-pointer hover:text-[#181d26] font-medium">
            Show actions ({suggestion.actions.length})
          </summary>
          <div className="mt-2 space-y-1 text-[11px] font-mono text-[#333840]">
            {suggestion.actions.map((action: any, idx: number) => (
              <div key={idx} className="px-2.5 py-1 bg-[#f8fafc] border border-[#dddddd] rounded-lg">
                {action.type}: {action.employee_id?.slice(0, 8)} {action.date} → {action.status}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
