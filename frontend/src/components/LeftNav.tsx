/**
 * Left Navigation - Desktop sidebar with view filters and pod/brand/process lists
 */
import { useState } from 'react';
import { configApi } from '../api/client';
import { useQuery } from '@tanstack/react-query';

type ViewMode = 'company' | 'pod' | 'brand' | 'process' | 'employee';

interface LeftNavProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  viewId: string | null;
  onViewIdChange: (id: string | null) => void;
  userRole: string;
  rosterData: any;
}

const VIEW_LABELS: Record<ViewMode, string> = {
  company: 'Company',
  pod: 'Pod',
  brand: 'Brand',
  process: 'Process',
  employee: 'Employee',
};

export function LeftNav({ view, onViewChange, viewId, onViewIdChange, userRole, rosterData }: LeftNavProps) {
  const [expanded, setExpanded] = useState<string>('views');

  // Fetch filter data based on view
  const { data: pods } = useQuery({
    queryKey: ['pods'],
    queryFn: () => configApi.listPods(),
    staleTime: 60_000,
  });

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: () => configApi.listBrands(),
    staleTime: 60_000,
  });

  const { data: processes } = useQuery({
    queryKey: ['processes'],
    queryFn: () => configApi.listProcesses(),
    staleTime: 60_000,
  });

  const canViewAll = userRole === 'MANAGER' || userRole === 'POD_LEAD';

  const getFilterItems = () => {
    switch (view) {
      case 'pod':
        return pods?.map((p: any) => ({ id: p.id, name: p.name, count: 0 })) || [];
      case 'brand':
        return brands?.map((b: any) => ({ id: b.id, name: b.name, count: 0 })) || [];
      case 'process':
        return processes?.map((p: any) => ({ id: p.id, name: p.name, count: 0 })) || [];
      case 'employee':
        return rosterData?.entries
          ? Array.from(
              new Map(
                rosterData.entries
                  .filter((e: any) => e.employee)
                  .map((e: any) => [e.employee_id, { id: e.employee_id, name: e.employee?.name || 'Unknown' }])
              ).values()
            )
          : [];
      default:
        return [];
    }
  };

  const filterItems = getFilterItems();

  const toggleExpand = (section: string) => {
    setExpanded((prev) => (prev === section ? '' : section));
  };

  return (
    <aside className="hidden md:block w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-16 overflow-y-auto">
      <nav className="p-4 space-y-4">
        {/* View Switcher */}
        <div className="space-y-1">
          <h3 className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Views</h3>
          {(Object.keys(VIEW_LABELS) as Array<keyof typeof VIEW_LABELS>).map((v) => (
            <button
              key={v}
              onClick={() => { onViewChange(v); onViewIdChange(null); }}
              className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                view === v
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {/* Filters based on view */}
        {(view !== 'company' && view !== 'employee') && canViewAll && filterItems.length > 0 && (
          <div className="space-y-1">
            <button
              onClick={() => toggleExpand('filters')}
              className="w-full text-left px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between"
            >
              <span>{VIEW_LABELS[view]}s</span>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${expanded === 'filters' ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expanded === 'filters' && (
              <div className="space-y-1 pl-2">
                <button
                  onClick={() => onViewIdChange(null)}
                  className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                    !viewId
                      ? 'bg-indigo-50 text-indigo-600 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All {VIEW_LABELS[view]}s
                </button>
                {filterItems.map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => onViewIdChange(item.id)}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                      viewId === item.id
                        ? 'bg-indigo-50 text-indigo-600 font-medium'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Stats */}
        {rosterData && (
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <div className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Stats</div>
            <div className="px-3 py-2 bg-slate-50 rounded-md space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Employees</span>
                <span className="font-medium text-slate-900">
                  {new Set(rosterData.entries.map((e: any) => e.employee_id)).size}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Working Days</span>
                <span className="font-medium text-slate-900">
                  {rosterData.entries.filter((e: any) => e.status === 'WORK').length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Gaps</span>
                <span className="font-medium text-red-600">
                  {rosterData.coverage?.filter((c: any) => c.status === 'gap').length || 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}