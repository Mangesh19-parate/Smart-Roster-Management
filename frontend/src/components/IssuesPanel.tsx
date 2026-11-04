/**
 * Issues Panel - Shows roster issues with filtering and navigation
 */
import { useState, useMemo } from 'react';
import type { IssuesPanelProps } from './types';
import { explainApi } from '../api/client';

const SEVERITY_COLORS = {
  ERROR: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
  WARNING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  INFO: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-700' },
};

const SEVERITY_ORDER = { ERROR: 0, WARNING: 1, INFO: 2 };

export function IssuesPanel({
  issues,
  selectedIssue,
  onIssueClick,
  onClose,
  mobile = false,
  month = '2026-12',
}: IssuesPanelProps) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'structural'>('all');
  const [groupByRule, setGroupByRule] = useState(true);

  const filteredIssues = useMemo(() => {
    let result = [...issues];
    if (filter === 'error') result = result.filter((i) => i.severity === 'ERROR');
    if (filter === 'warning') result = result.filter((i) => i.severity === 'WARNING');
    if (filter === 'structural') result = result.filter((i) => i.structural);
    return result.sort((a, b) => SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] - SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER]);
  }, [issues, filter]);

  const groupedIssues = useMemo(() => {
    if (!groupByRule) return { All: filteredIssues };
    const groups: Record<string, any[]> = {};
    filteredIssues.forEach((issue) => {
      const key = issue.rule;
      if (!groups[key]) groups[key] = [];
      groups[key].push(issue);
    });
    return groups;
  }, [filteredIssues, groupByRule]);

  const errorCount = issues.filter((i) => i.severity === 'ERROR').length;
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length;

  const panelStyle = mobile
    ? 'fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg max-h-[60vh]'
    : 'w-80 md:w-96 bg-white border-l border-slate-200 flex flex-col h-full';

  return (
    <aside className={panelStyle}>
      {/* Header */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Issues</h3>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${SEVERITY_COLORS.ERROR.badge}`}>
            {errorCount}
          </span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${SEVERITY_COLORS.WARNING.badge}`}>
            {warningCount}
          </span>
          {!mobile && (
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-slate-200 space-y-2">
        <div className="flex gap-1" role="radiogroup">
          {(['all', 'error', 'warning', 'structural'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                filter === f
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              role="radio"
              aria-checked={filter === f}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={groupByRule}
            onChange={(e) => setGroupByRule(e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
          />
          Group by Rule
        </label>
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {Object.entries(groupedIssues).length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            {filter === 'all' ? 'No issues found. 🎉' : `No ${filter} issues.`}
          </div>
        ) : (
          Object.entries(groupedIssues).map(([rule, ruleIssues]) => (
            <div key={rule} className="space-y-2">
              <div className="px-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {rule} ({ruleIssues.length})
              </div>
              {ruleIssues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  month={month}
                  selected={selectedIssue?.id === issue.id}
                  onClick={() => onIssueClick(issue)}
                  colors={SEVERITY_COLORS[issue.severity as keyof typeof SEVERITY_COLORS]}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function IssueRow({
  issue,
  month,
  selected,
  onClick,
  colors,
}: {
  issue: any;
  month: string;
  selected: boolean;
  onClick: () => void;
  colors: { bg: string; text: string; border: string; badge: string };
}) {
  const [explanation, setExplanation] = useState<{ explanation: string; source: string } | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);

  const handleExplain = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (explanation) {
      setExplanation(null);
      return;
    }
    setLoadingExplain(true);
    try {
      const res = await explainApi.explain(month, issue.id);
      setExplanation(res);
    } catch (err: any) {
      setExplanation({ explanation: `Failed to load explanation: ${err.message}`, source: 'template' });
    } finally {
      setLoadingExplain(false);
    }
  };

  const getLocation = () => {
    const parts = [];
    if (issue.brand_id) parts.push(`Brand: ${issue.brand_id.slice(0, 8)}`);
    if (issue.process_id) parts.push(`Process: ${issue.process_id.slice(0, 8)}`);
    if (issue.employee_id) parts.push(`Emp: ${issue.employee_id.slice(0, 8)}`);
    if (issue.date) parts.push(issue.date);
    return parts.join(' · ');
  };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={`w-full text-left p-2 rounded-md transition-colors cursor-pointer ${
        selected
          ? 'bg-indigo-50 ring-2 ring-indigo-500'
          : 'hover:bg-slate-50'
      } ${colors.bg} ${colors.border} border`}
    >
      <div className="flex items-start gap-2">
        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${colors.badge} flex-shrink-0`}>
          {issue.severity}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="font-medium text-sm text-slate-900 truncate">{issue.message}</div>
            <button
              onClick={handleExplain}
              disabled={loadingExplain}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 flex-shrink-0"
            >
              {loadingExplain ? '...' : explanation ? 'Hide' : 'Explain'}
            </button>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{issue.cause}</div>
          <div className="text-xs text-slate-400 mt-0.5">{getLocation()}</div>
          {issue.suggestion_hint && (
            <div className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {issue.suggestion_hint}
            </div>
          )}

          {explanation && (
            <div className="mt-2 p-2 bg-white rounded border border-indigo-200 text-xs text-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[10px] uppercase tracking-wider text-slate-500">Explanation</span>
                <span className={`px-1.5 py-0.2 text-[9px] font-semibold rounded ${
                  explanation.source === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {explanation.source === 'ai' ? 'AI-written' : 'Template'}
                </span>
              </div>
              <p className="text-slate-800 leading-relaxed">{explanation.explanation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}