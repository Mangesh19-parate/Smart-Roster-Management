/**
 * IssuesPanel - Airtable Inspired "Scheduling Health" Drawer
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
    ? 'fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#dddddd] shadow-xl max-h-[70vh] flex flex-col'
    : 'w-84 lg:w-96 bg-white border-l border-[#dddddd] flex flex-col h-full shrink-0 shadow-xs';

  return (
    <aside className={panelContainer}>
      {/* Drawer Header */}
      <div className="p-3.5 border-b border-[#dddddd] bg-[#f8fafc] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#181d26]" />
          <h3 className="font-semibold text-sm text-[#181d26] tracking-tight">Scheduling Health</h3>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-white border border-[#dddddd] text-[#181d26]">
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
              className="p-1.5 rounded-lg text-[#9297a0] hover:text-[#181d26] hover:bg-white border border-transparent hover:border-[#dddddd] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scheduling health panel"
            className="p-1.5 rounded-lg text-[#9297a0] hover:text-[#181d26] hover:bg-white border border-transparent hover:border-[#dddddd] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metric Breakdown Tabs - Airtable Pill Filter Style */}
      <div className="p-2 border-b border-[#dddddd] bg-white flex items-center gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 shrink-0 border ${
            activeTab === 'all'
              ? 'bg-[#181d26] text-white border-[#181d26]'
              : 'text-[#41454d] border-[#dddddd] hover:bg-[#f8fafc]'
          }`}
        >
          <span>All</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-[#f1f5f9] text-[#41454d]'}`}>
            {issues.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('critical')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 shrink-0 border ${
            activeTab === 'critical'
              ? 'bg-[#aa2d00] text-white border-[#aa2d00]'
              : 'text-[#41454d] border-[#dddddd] hover:bg-[#f8fafc]'
          }`}
        >
          <span>Critical</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'critical' ? 'bg-white/20 text-white' : 'bg-[#fef2f2] text-[#aa2d00]'}`}>
            {criticalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('warning')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 shrink-0 border ${
            activeTab === 'warning'
              ? 'bg-[#d9a441] text-white border-[#d9a441]'
              : 'text-[#41454d] border-[#dddddd] hover:bg-[#f8fafc]'
          }`}
        >
          <span>Warnings</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'warning' ? 'bg-white/20 text-white' : 'bg-[#fff8e1] text-[#b45309]'}`}>
            {warningCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('structural')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 shrink-0 border ${
            activeTab === 'structural'
              ? 'bg-[#5b21b6] text-white border-[#5b21b6]'
              : 'text-[#41454d] border-[#dddddd] hover:bg-[#f8fafc]'
          }`}
        >
          <span>Structural</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'structural' ? 'bg-white/20 text-white' : 'bg-[#ede7f6] text-[#5b21b6]'}`}>
            {structuralCount}
          </span>
        </button>
      </div>

      {/* Search within issues */}
      <div className="px-3 py-2 border-b border-[#dddddd] bg-[#f8fafc]">
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter issues by employee, rule, process..."
          className="w-full px-3 py-1.5 text-xs bg-white border border-[#dddddd] rounded-xl placeholder-[#9297a0] focus:outline-none focus:border-[#181d26] text-[#181d26]"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {/* Loading State */}
        {isLoading && (
          <div className="py-12 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-[#181d26] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium text-[#41454d]">Validating scheduling constraints...</p>
          </div>
        )}

        {/* Error State with Retry Button */}
        {!isLoading && error && (
          <div className="p-4 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-[#aa2d00] mx-auto" />
            <p className="text-xs font-semibold text-[#aa2d00]">Health Check Failed</p>
            <p className="text-xs text-[#aa2d00]">{error.message || 'Unable to connect to validator engine.'}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#aa2d00] hover:bg-[#882400] rounded-xl transition-colors shadow-xs"
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
            <div className="w-10 h-10 rounded-full bg-[#e8f5e9] text-[#1b5e20] border border-[#c8e6c9] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-[#181d26]">All Rules Satisfied</p>
            <p className="text-xs text-[#41454d] max-w-xs mx-auto">
              No coverage shortfalls, rest-period conflicts, or structural violations detected for {month}.
            </p>
          </div>
        )}

        {/* Filtered Empty State */}
        {!isLoading && !error && issues.length > 0 && filteredIssues.length === 0 && (
          <div className="py-8 text-center text-xs text-[#9297a0]">
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
                className={`p-3.5 rounded-xl border transition-all text-xs space-y-2 ${
                  isSelected
                    ? 'border-[#181d26] bg-[#f8fafc] shadow-xs'
                    : isError
                    ? 'border-[#fecaca] bg-white hover:border-[#aa2d00]'
                    : 'border-[#fde68a] bg-white hover:border-[#d9a441]'
                }`}
              >
                {/* Header: Severity Badge + Rule */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        isError ? 'bg-[#fef2f2] text-[#aa2d00] border border-[#fecaca]' : 'bg-[#fff8e1] text-[#b45309] border border-[#fde68a]'
                      }`}
                    >
                      {issue.severity || 'WARNING'}
                    </span>
                    <span className="font-semibold text-[#181d26] truncate" title={issue.rule}>
                      {issue.rule}
                    </span>
                  </div>

                  {issue.date && (
                    <span className="text-[10px] text-[#9297a0] shrink-0 font-medium">
                      {issue.date}
                    </span>
                  )}
                </div>

                {/* Message / Description */}
                <p className="text-[#333840] leading-relaxed font-normal">
                  {issue.message || issue.description}
                </p>

                {/* Entity Tags */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#41454d]">
                  {issue.employee_name && (
                    <span className="px-2 py-0.5 bg-[#f8fafc] border border-[#dddddd] rounded-md font-medium text-[#181d26]">
                      Emp: {issue.employee_name}
                    </span>
                  )}
                  {issue.process_name && (
                    <span className="px-2 py-0.5 bg-[#f8fafc] border border-[#dddddd] rounded-md font-medium text-[#181d26]">
                      Proc: {issue.process_name}
                    </span>
                  )}
                  {issue.brand_name && (
                    <span className="px-2 py-0.5 bg-[#f8fafc] border border-[#dddddd] rounded-md font-medium text-[#181d26]">
                      Brand: {issue.brand_name}
                    </span>
                  )}
                </div>

                {/* Action button to review suggestion */}
                <div className="pt-1 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => onIssueClick(issue)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#181d26] bg-white hover:bg-[#f8fafc] border border-[#dddddd] hover:border-[#181d26] rounded-xl transition-colors shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#d9a441]" />
                    <span>Review Suggestion</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#9297a0]" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </aside>
  );
}
