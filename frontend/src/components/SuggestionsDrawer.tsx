/**
 * Suggestions Drawer - Shows ranked suggestions for fixing an issue
 */
import { useEffect } from 'react';
import { changesApi } from '../api/client';
import { useQuery } from '@tanstack/react-query';
import type { SuggestionsDrawerProps } from './types';

const SUGGESTION_KIND_LABELS: Record<string, string> = {
  ADD_COVER: 'Add Cover',
  SHIFT_OFF: 'Shift Off',
  SWAP_OFF: 'Swap Off',
  LOCAL_RESOLVE: 'Local Resolve',
  REQUEST_BACKUP: 'Request Backup',
};

const KIND_COLORS: Record<string, string> = {
  ADD_COVER: 'bg-green-100 text-green-700',
  SHIFT_OFF: 'bg-blue-100 text-blue-700',
  SWAP_OFF: 'bg-purple-100 text-purple-700',
  LOCAL_RESOLVE: 'bg-indigo-100 text-indigo-700',
  REQUEST_BACKUP: 'bg-amber-100 text-amber-700',
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
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="flex-1 max-w-2xl md:max-w-3xl bg-white shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Suggestions for {issue.rule}</h3>
            <p className="text-sm text-slate-500 mt-1">{issue.cause}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!suggestions || suggestions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
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
  const kindColor = KIND_COLORS[suggestion.kind] || 'bg-slate-100 text-slate-700';

  return (
    <div className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">
              #{rank}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${kindColor}`}>
              {SUGGESTION_KIND_LABELS[suggestion.kind] || suggestion.kind}
            </span>
          </div>
          <p className="text-sm text-slate-700 mb-2">{suggestion.description}</p>

          {/* Fixes */}
          {suggestion.fixes?.length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-medium text-slate-500">Fixes:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {suggestion.fixes.map((fix: any) => (
                  <span key={fix.id} className="px-1.5 py-0.5 text-xs bg-green-50 text-green-700 rounded">
                    {fix.rule}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* May Break */}
          {suggestion.may_break?.length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-medium text-slate-500">May Break:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {suggestion.may_break.map((brk: any) => (
                  <span key={brk.id} className="px-1.5 py-0.5 text-xs bg-amber-50 text-amber-700 rounded">
                    {brk.rule}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span>Entries changed: {suggestion.entries_changed}</span>
            <span>Fairness Δ: {suggestion.fairness_delta >= 0 ? '+' : ''}{suggestion.fairness_delta.toFixed(1)}</span>
          </div>
        </div>

        <button
          onClick={onApply}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 flex-shrink-0"
        >
          {loading ? 'Applying...' : 'Apply'}
        </button>
      </div>

      {/* Actions Preview */}
      {suggestion.actions?.length > 0 && (
        <details className="mt-3 pt-3 border-t border-slate-200">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
            Show actions ({suggestion.actions.length})
          </summary>
          <div className="mt-2 space-y-1 text-xs font-mono text-slate-600">
            {suggestion.actions.map((action: any, idx: number) => (
              <div key={idx} className="px-2 py-1 bg-slate-50 rounded">
                {action.type}: {action.employee_id?.slice(0, 8)} {action.date} → {action.status}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}