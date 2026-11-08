/**
 * FilterToolbar - Precise search, scope switcher, and status filter for Roster
 */
import { Search, RotateCcw, Calendar, Filter } from 'lucide-react';

export type ViewMode = 'company' | 'pod' | 'brand' | 'process' | 'employee';

interface FilterToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  viewId: string | null;
  onViewIdChange: (id: string | null) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  pods: any[];
  brands: any[];
  processes: any[];
  employees: any[];
  onJumpToday: () => void;
  onResetFilters: () => void;
}

const VIEW_OPTIONS: { id: ViewMode; label: string }[] = [
  { id: 'company', label: 'Company-Wide' },
  { id: 'pod', label: 'By Pod' },
  { id: 'brand', label: 'By Brand' },
  { id: 'process', label: 'By Process' },
  { id: 'employee', label: 'Single Employee' },
];

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All Statuses' },
  { id: 'WORK', label: 'Working' },
  { id: 'WO', label: 'Weekly Off' },
  { id: 'LEAVE', label: 'Leave' },
  { id: 'COMP_OFF', label: 'Comp-Off' },
];

export function FilterToolbar({
  searchQuery,
  onSearchChange,
  view,
  onViewChange,
  viewId,
  onViewIdChange,
  statusFilter,
  onStatusFilterChange,
  pods,
  brands,
  processes,
  employees,
  onJumpToday,
  onResetFilters,
}: FilterToolbarProps) {
  // Determine if specific selector is needed
  const renderContextualSelector = () => {
    if (view === 'pod') {
      return (
        <select
          value={viewId || ''}
          onChange={(e) => onViewIdChange(e.target.value || null)}
          className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800"
          aria-label="Select Pod"
        >
          <option value="">-- Select Pod --</option>
          {pods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      );
    }
    if (view === 'brand') {
      return (
        <select
          value={viewId || ''}
          onChange={(e) => onViewIdChange(e.target.value || null)}
          className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800"
          aria-label="Select Brand"
        >
          <option value="">-- Select Brand --</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      );
    }
    if (view === 'process') {
      return (
        <select
          value={viewId || ''}
          onChange={(e) => onViewIdChange(e.target.value || null)}
          className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800"
          aria-label="Select Process"
        >
          <option value="">-- Select Process --</option>
          {processes.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.name}
            </option>
          ))}
        </select>
      );
    }
    if (view === 'employee') {
      return (
        <select
          value={viewId || ''}
          onChange={(e) => onViewIdChange(e.target.value || null)}
          className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800"
          aria-label="Select Employee"
        >
          <option value="">-- Select Employee --</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name} {emp.pod ? `(${emp.pod})` : ''}
            </option>
          ))}
        </select>
      );
    }
    return null;
  };

  const isFiltered = searchQuery !== '' || view !== 'company' || viewId !== null || statusFilter !== 'ALL';

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
      {/* Left side: Search & Scope */}
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
        {/* Search Input */}
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search employee or role..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
          />
        </div>

        {/* View Mode Segmented Switcher */}
        <div className="inline-flex rounded-md p-0.5 bg-slate-100 border border-slate-200" role="tablist">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onViewChange(opt.id);
                onViewIdChange(null);
              }}
              role="tab"
              aria-selected={view === opt.id}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                view === opt.id
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Contextual dropdown selector */}
        {renderContextualSelector()}
      </div>

      {/* Right side: Status Filter, Jump to Today, Reset */}
      <div className="flex items-center gap-2">
        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-2 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700"
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((sf) => (
              <option key={sf.id} value={sf.id}>
                {sf.label}
              </option>
            ))}
          </select>
        </div>

        {/* Jump to Today Button */}
        <button
          type="button"
          onClick={onJumpToday}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
          title="Scroll or jump to today's date"
        >
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>Today</span>
        </button>

        {/* Reset Filter Button */}
        {isFiltered && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors"
            title="Reset all active filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
