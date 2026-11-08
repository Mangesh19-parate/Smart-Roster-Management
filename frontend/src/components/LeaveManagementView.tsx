/**
 * LeaveManagementView - Enterprise leave tracking, requests, and balance inspection
 */
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leavesApi } from '../api/client';
import { Plus, CalendarOff, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

interface LeaveManagementViewProps {
  month: string;
  onOpenAddLeave: () => void;
  userRole?: string;
}

export function LeaveManagementView({ month, onOpenAddLeave, userRole: _userRole }: LeaveManagementViewProps) {
  const queryClient = useQueryClient();

  const { data: leaves = [], isLoading, error, refetch } = useQuery({
    queryKey: ['leaves', month],
    queryFn: () => leavesApi.list({ month }),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leavesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['roster', month] });
      queryClient.invalidateQueries({ queryKey: ['issues', month] });
    },
    onError: (err: any) => alert(`Failed to delete leave: ${err.message}`),
  });

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to cancel this leave request?')) {
      deleteMutation.mutate(id);
    }
  };

  const metrics = useMemo(() => {
    let planned = 0;
    let compOff = 0;
    let sick = 0;

    leaves.forEach((l: any) => {
      const type = (l.type || '').toUpperCase();
      if (type.includes('COMP')) compOff++;
      else if (type.includes('SICK')) sick++;
      else planned++;
    });

    return { total: leaves.length, planned, compOff, sick };
  }, [leaves]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Leave Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review planned absences, medical leaves, and compensatory offs for {month}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddLeave}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-2xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Request Leave</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Requests
          </span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">{metrics.total}</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Planned Leaves
          </span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">{metrics.planned}</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Comp-Offs
          </span>
          <span className="text-xl font-bold text-indigo-600 mt-1 block">{metrics.compOff}</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Sick Leaves
          </span>
          <span className="text-xl font-bold text-amber-600 mt-1 block">{metrics.sick}</span>
        </div>
      </div>

      {/* Leave Records Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Submitted Leave Requests</h3>
          <span className="text-xs text-slate-500">{leaves.length} records</span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Loading leave requests...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center space-y-2 text-red-600">
            <AlertTriangle className="w-6 h-6 mx-auto" />
            <p className="text-xs font-semibold">Failed to load leave records: {(error as any).message}</p>
            <button
              onClick={() => refetch()}
              className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
            >
              Retry
            </button>
          </div>
        ) : leaves.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <CalendarOff className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">No leaves submitted</p>
            <p className="text-xs text-slate-400">Employees have no planned leaves registered for {month}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaves.map((leave: any) => {
                  const empName = leave.employee?.name || leave.employee_name || 'Employee';
                  const startDate = leave.start_date || leave.date;
                  const endDate = leave.end_date || leave.date;
                  let durationDays = 1;
                  try {
                    if (startDate && endDate) {
                      durationDays = Math.max(1, differenceInDays(parseISO(endDate), parseISO(startDate)) + 1);
                    }
                  } catch {
                    durationDays = 1;
                  }

                  return (
                    <tr key={leave.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {empName}
                        {leave.employee?.pod && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            {leave.employee.pod.name || leave.employee.pod}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {leave.type || 'PLANNED'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {startDate ? format(parseISO(startDate), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {endDate ? format(parseISO(endDate), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {durationDays} {durationDays === 1 ? 'day' : 'days'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Approved</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(leave.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Cancel Leave Request"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
