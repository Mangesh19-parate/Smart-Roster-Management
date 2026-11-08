/**
 * IssuesPanel - Redesigned "Scheduling Health" drawer
 * Displays rule violations, structural warnings, and suggestion triggers with distinct state handling.
 */
import { useState, useMemo } from 'react';
import type { IssuesPanelProps } from './types';
import {
  ShieldAlert,
  AlertCircle,
  X,
  RefreshCw,
  Sparkles,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';

export function IssuesPanel({
  issues = [],
  selectedIssue,
  onIssueClick,
  onClose,
  mobile = false,
  month = '2026-12',
  isLoading = false,
  error = null,
  onRetry,
}: IssuesPanelProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'warning' | 'structural'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Counts
  const criticalCount = useMemo(() => issues.filter((i) => i.severity === 'ERROR').length, [issues]);
  const warningCount = useMemo(() => issues.filter((i) => i.severity === 'WARNING').length, [issues]);
  const structuralCount = useMemo(() => issues.filter((i) => i.structural || i.rule?.startsWith('Struct')).length, [issues]);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    let list = [...issues];
    if (activeTab === 'critical') list = list.filter((i) => i.severity === 'ERROR');
    else if (activeTab === 'warning') list = list.filter((i) => i.severity === 'WARNING');
    else if (activeTab === 'structural') list = list.filter((i) => i.structural || i.rule?.startsWith('Struct'));

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter(
        (i) =>
          (i.rule && i.rule.toLowerCase().includes(q)) ||
          (i.message && i.message.toLowerCase().includes(q)) ||
          (i.employee_name && i.employee_name.toLowerCase().includes(q)) ||
          (i.process_name && i.process_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [issues, activeTab, searchFilter]);

  const panelContainer = mobile
    ? 'fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-xl max-h-[70vh] flex flex-col'
    : 'w-84 lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-xs';

  return (
    <aside className={panelContainer}>
      {/* Drawer Header */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-indigo-600" />
          <h3 className="font-bold text-sm text-slate-900 tracking-tight">Scheduling Health</h3>
          <span className="text-xs px-2 py-0.2 rounded-full font-semibold bg-slate-200 text-slate-700">
            {issues.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isLoading}
              title="Refresh / Re-validate"
              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scheduling health panel"
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metric Breakdown Tabs */}
      <div className="p-2 border-b border-slate-200 bg-white flex items-center gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
            activeTab === 'all' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>All</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full">{issues.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('critical')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
            activeTab === 'critical' ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Critical</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-red-100 text-red-700 rounded-full">{criticalCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('warning')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
            activeTab === 'warning' ? 'bg-amber-50 text-amber-800 font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Warnings</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full">{warningCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('structural')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
            activeTab === 'structural' ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Structural</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-full">{structuralCount}</span>
        </button>
      </div>

      {/* Search within issues */}
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50/50">
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter issues by employee, rule, process..."
          className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {/* Loading State */}
        {isLoading && (
          <div className="py-12 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium text-slate-600">Validating scheduling constraints...</p>
          </div>
        )}

        {/* Error State with Retry Button */}
        {!isLoading && error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-red-600 mx-auto" />
            <p className="text-xs font-bold text-red-900">Health Check Failed</p>
            <p className="text-xs text-red-700">{error.message || 'Unable to connect to validator engine.'}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-xs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Health Check</span>
              </button>
            )}
          </div>
        )}

        {/* Empty State: All rules passed */}
        {!isLoading && !error && issues.length === 0 && (
          <div className="py-12 px-4 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-800">All Rules Satisfied</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              No coverage shortfalls, rest-period conflicts, or structural violations detected for {month}.
            </p>
          </div>
        )}

        {/* Filtered Empty State */}
        {!isLoading && !error && issues.length > 0 && filteredIssues.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-400">
            No issues match the active filter criteria.
          </div>
        )}

        {/* Issues List */}
        {!isLoading &&
          !error &&
          filteredIssues.map((issue, idx) => {
            const isError = issue.severity === 'ERROR';
            const isSelected = selectedIssue && selectedIssue.id === issue.id;

            return (
              <div
                key={issue.id || idx}
                className={`p-3 rounded-lg border transition-all text-xs space-y-2 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/40 shadow-xs'
                    : isError
                    ? 'border-red-200 bg-white hover:border-red-300'
                    : 'border-amber-200 bg-white hover:border-amber-300'
                }`}
              >
                {/* Header: Severity Badge + Rule */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isError ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {issue.severity || 'WARNING'}
                    </span>
                    <span className="font-bold text-slate-800 truncate" title={issue.rule}>
                      {issue.rule}
                    </span>
                  </div>

                  {issue.date && (
                    <span className="text-[10px] text-slate-500 shrink-0 font-medium">
                      {issue.date}
                    </span>
                  )}
                </div>

                {/* Message / Description */}
                <p className="text-slate-600 leading-relaxed font-normal">
                  {issue.message || issue.description}
                </p>

                {/* Entity Tags */}
                <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                  {issue.employee_name && (
                    <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-700 font-medium">
                      Emp: {issue.employee_name}
                    </span>
                  )}
                  {issue.process_name && (
                    <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-700 font-medium">
                      Proc: {issue.process_name}
                    </span>
                  )}
                  {issue.brand_name && (
                    <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-700 font-medium">
                      Brand: {issue.brand_name}
                    </span>
                  )}
                </div>

                {/* Action button to review suggestion */}
                <div className="pt-1 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => onIssueClick(issue)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    <span>Review Suggestion</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </aside>
  );
}
