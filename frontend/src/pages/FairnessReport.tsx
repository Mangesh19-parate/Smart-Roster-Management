/**
 * Fairness Report Page (S12, T44)
 * Shows workload balance: Sundays, holidays, preferred offs, and spread indicator.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { rosterApi } from '../api/client';
import { format } from 'date-fns';

interface FairnessReportProps {
  month: string;
  onClose?: () => void;
}

type SortField = 'employee_name' | 'pod_name' | 'total_work_days' | 'sunday_work_days' | 'holiday_work_days' | 'preferred_off_missed' | 'fairness_score';

export function FairnessReport({ month, onClose }: FairnessReportProps) {
  const [sortField, setSortField] = useState<SortField>('sunday_work_days');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['fairness', month],
    queryFn: () => rosterApi.fairness(month),
    enabled: !!month,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const diff = (Number(aVal) || 0) - (Number(bVal) || 0);
    return sortAsc ? diff : -diff;
  });

  const sundayCounts = rows.map((r) => r.sunday_work_days || 0);
  const minSundays = sundayCounts.length ? Math.min(...sundayCounts) : 0;
  const maxSundays = sundayCounts.length ? Math.max(...sundayCounts) : 0;
  const sundaySpread = maxSundays - minSundays;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Fairness & Workload Report</h2>
            <p className="text-sm text-slate-500">Month: {format(new Date(`${month}-01`), 'MMMM yyyy')}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Spread Summary Banner */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-3 rounded-md border border-slate-200">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Sunday Work Spread</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-bold ${sundaySpread <= 1 ? 'text-emerald-600' : sundaySpread <= 2 ? 'text-amber-600' : 'text-rose-600'}`}>
                {sundaySpread} days
              </span>
              <span className="text-xs text-slate-500">(Max: {maxSundays}, Min: {minSundays})</span>
            </div>
          </div>
          <div className="bg-white p-3 rounded-md border border-slate-200">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Employees Scheduled</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{rows.length}</div>
          </div>
          <div className="bg-white p-3 rounded-md border border-slate-200">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Status</span>
            <div className="text-sm font-medium mt-2">
              {sundaySpread <= 1 ? (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Optimal Distribution</span>
              ) : (
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Uneven Sunday Spread</span>
              )}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-rose-600">Failed to load fairness metrics.</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No fairness metrics found for this month.</div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3 cursor-pointer select-none hover:bg-slate-200" onClick={() => handleSort('employee_name')}>
                      Employee {sortField === 'employee_name' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th className="p-3 cursor-pointer select-none hover:bg-slate-200" onClick={() => handleSort('pod_name')}>
                      Pod {sortField === 'pod_name' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th className="p-3 text-right cursor-pointer select-none hover:bg-slate-200" onClick={() => handleSort('total_work_days')}>
                      Work Days {sortField === 'total_work_days' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th className="p-3 text-right cursor-pointer select-none hover:bg-slate-200" onClick={() => handleSort('sunday_work_days')}>
                      Sundays {sortField === 'sunday_work_days' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th className="p-3 text-right cursor-pointer select-none hover:bg-slate-200" onClick={() => handleSort('holiday_work_days')}>
                      Holidays {sortField === 'holiday_work_days' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th className="p-3 text-right cursor-pointer select-none hover:bg-slate-200" onClick={() => handleSort('preferred_off_missed')}>
                      Pref Off Missed {sortField === 'preferred_off_missed' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th className="p-3 text-right cursor-pointer select-none hover:bg-slate-200" onClick={() => handleSort('fairness_score')}>
                      Fairness Score {sortField === 'fairness_score' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedRows.map((row) => (
                    <tr key={row.employee_id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-medium text-slate-900">{row.employee_name}</td>
                      <td className="p-3 text-slate-600">{row.pod_name}</td>
                      <td className="p-3 text-right text-slate-800">{row.total_work_days}</td>
                      <td className="p-3 text-right font-medium text-indigo-700">{row.sunday_work_days}</td>
                      <td className="p-3 text-right text-slate-800">{row.holiday_work_days}</td>
                      <td className="p-3 text-right text-slate-800">{row.preferred_off_missed}</td>
                      <td className="p-3 text-right font-semibold text-slate-900">{Number(row.fairness_score || 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

