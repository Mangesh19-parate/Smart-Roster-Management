/**
 * Fairness Report Page (S12, T44) - Airtable Inspired Workload Distribution
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#dddddd]">
        <div>
          <h2 className="text-xl font-semibold text-[#181d26] tracking-tight">Fairness & Workload Report</h2>
          <p className="text-xs text-[#41454d] mt-0.5">Month: {format(new Date(`${month}-01`), 'MMMM yyyy')}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-[#9297a0] hover:text-[#181d26] rounded-xl hover:bg-[#f8fafc] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Spread Summary Banner - Airtable Style KPI Cards */}
      <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-[#dddddd] shadow-xs">
          <span className="text-[11px] font-semibold text-[#41454d] uppercase tracking-wider block">
            Sunday Work Spread
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-bold ${sundaySpread <= 1 ? 'text-[#006400]' : sundaySpread <= 2 ? 'text-[#b45309]' : 'text-[#aa2d00]'}`}>
              {sundaySpread} days
            </span>
            <span className="text-xs text-[#9297a0]">(Max: {maxSundays}, Min: {minSundays})</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#dddddd] shadow-xs">
          <span className="text-[11px] font-semibold text-[#41454d] uppercase tracking-wider block">
            Employees Scheduled
          </span>
          <div className="text-2xl font-bold text-[#181d26] mt-1">{rows.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#dddddd] shadow-xs">
          <span className="text-[11px] font-semibold text-[#41454d] uppercase tracking-wider block">
            Distribution Status
          </span>
          <div className="mt-2">
            {sundaySpread <= 1 ? (
              <span className="text-[#1b5e20] bg-[#e8f5e9] px-2.5 py-0.5 rounded-full border border-[#c8e6c9] text-xs font-medium">
                Optimal Distribution
              </span>
            ) : (
              <span className="text-[#b45309] bg-[#fff8e1] px-2.5 py-0.5 rounded-full border border-[#fde68a] text-xs font-medium">
                Uneven Sunday Spread
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#181d26] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-[#aa2d00] text-xs font-medium">Failed to load fairness metrics.</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-[#9297a0] text-xs">No fairness metrics found for this month.</div>
        ) : (
          <div className="border border-[#dddddd] rounded-xl overflow-hidden shadow-xs">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-[#f8fafc] text-[#41454d] font-semibold uppercase tracking-wider text-[11px] border-b border-[#dddddd]">
                <tr>
                  <th className="p-3.5 cursor-pointer select-none hover:bg-[#e0e2e6]" onClick={() => handleSort('employee_name')}>
                    Employee {sortField === 'employee_name' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-3.5 cursor-pointer select-none hover:bg-[#e0e2e6]" onClick={() => handleSort('pod_name')}>
                    Pod {sortField === 'pod_name' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-3.5 text-right cursor-pointer select-none hover:bg-[#e0e2e6]" onClick={() => handleSort('total_work_days')}>
                    Work Days {sortField === 'total_work_days' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-3.5 text-right cursor-pointer select-none hover:bg-[#e0e2e6]" onClick={() => handleSort('sunday_work_days')}>
                    Sundays {sortField === 'sunday_work_days' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-3.5 text-right cursor-pointer select-none hover:bg-[#e0e2e6]" onClick={() => handleSort('holiday_work_days')}>
                    Holidays {sortField === 'holiday_work_days' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-3.5 text-right cursor-pointer select-none hover:bg-[#e0e2e6]" onClick={() => handleSort('preferred_off_missed')}>
                    Pref Off Missed {sortField === 'preferred_off_missed' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-3.5 text-right cursor-pointer select-none hover:bg-[#e0e2e6]" onClick={() => handleSort('fairness_score')}>
                    Fairness Score {sortField === 'fairness_score' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dddddd]">
                {sortedRows.map((row) => (
                  <tr key={row.employee_id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="p-3.5 font-medium text-[#181d26]">{row.employee_name}</td>
                    <td className="p-3.5 text-[#41454d]">{row.pod_name}</td>
                    <td className="p-3.5 text-right text-[#181d26] font-medium">{row.total_work_days}</td>
                    <td className="p-3.5 text-right font-semibold text-[#181d26]">{row.sunday_work_days}</td>
                    <td className="p-3.5 text-right text-[#41454d]">{row.holiday_work_days}</td>
                    <td className="p-3.5 text-right text-[#41454d]">{row.preferred_off_missed}</td>
                    <td className="p-3.5 text-right font-bold text-[#181d26]">{Number(row.fairness_score || 0).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
