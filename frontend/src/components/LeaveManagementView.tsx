/**
 * LeaveManagementView - Airtable Inspired Leave Tracking, Requests, and Balance Inspection
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#dddddd] shadow-xs">
        <div>
          <h1 className="text-xl font-semibold text-[#181d26] tracking-tight">Leave Management</h1>
          <p className="text-xs text-[#41454d] mt-1">
            Review planned absences, medical leaves, and compensatory offs for {month}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddLeave}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#181d26] hover:bg-[#0d1218] active:bg-[#000000] rounded-xl shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Request Leave</span>
        </button>
      </div>

      {/* Summary KPI Cards - Airtable Style */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-[#dddddd] shadow-xs">
          <span className="text-[11px] font-semibold text-[#41454d] uppercase tracking-wider block">
            Total Requests
          </span>
          <span className="text-2xl font-bold text-[#181d26] mt-1 block">{metrics.total}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#dddddd] shadow-xs">
          <span className="text-[11px] font-semibold text-[#41454d] uppercase tracking-wider block">
            Planned Leaves
          </span>
          <span className="text-2xl font-bold text-[#181d26] mt-1 block">{metrics.planned}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#dddddd] shadow-xs">
          <span className="text-[11px] font-semibold text-[#41454d] uppercase tracking-wider block">
            Comp-Offs
          </span>
          <span className="text-2xl font-bold text-[#5b21b6] mt-1 block">{metrics.compOff}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#dddddd] shadow-xs">
          <span className="text-[11px] font-semibold text-[#41454d] uppercase tracking-wider block">
            Sick Leaves
          </span>
          <span className="text-2xl font-bold text-[#b45309] mt-1 block">{metrics.sick}</span>
        </div>
      </div>

      {/* Leave Records Table - Airtable Grid Style */}
      <div className="bg-white rounded-xl border border-[#dddddd] shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#dddddd] flex items-center justify-between bg-[#f8fafc]">
          <h3 className="font-semibold text-sm text-[#181d26]">Submitted Leave Requests</h3>
          <span className="text-xs text-[#41454d] font-medium">{leaves.length} records</span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-[#181d26] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#41454d]">Loading leave requests...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center space-y-2 text-[#aa2d00]">
            <AlertTriangle className="w-6 h-6 mx-auto" />
            <p className="text-xs font-semibold">Failed to load leave records: {(error as any).message}</p>
            <button
              onClick={() => refetch()}
              className="px-3 py-1 text-xs bg-[#f8fafc] border border-[#dddddd] hover:bg-[#e0e2e6] text-[#181d26] rounded-xl font-medium"
            >
              Retry
            </button>
          </div>
        ) : leaves.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <CalendarOff className="w-8 h-8 text-[#9297a0] mx-auto" />
            <p className="text-sm font-semibold text-[#181d26]">No leaves submitted</p>
            <p className="text-xs text-[#41454d]">Employees have no planned leaves registered for {month}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8fafc] border-b border-[#dddddd] text-[#41454d] font-medium uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Start Date</th>
                  <th className="px-5 py-3">End Date</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dddddd]">
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
                    <tr key={leave.id} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="px-5 py-3.5 font-medium text-[#181d26]">
                        {empName}
                        {leave.employee?.pod && (
                          <span className="block text-[10px] font-normal text-[#9297a0]">
                            {leave.employee.pod.name || leave.employee.pod}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#f8fafc] border border-[#dddddd] text-[#181d26]">
                          {leave.type || 'PLANNED'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#41454d] font-medium">
                        {startDate ? format(parseISO(startDate), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-[#41454d] font-medium">
                        {endDate ? format(parseISO(endDate), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-[#41454d] font-medium">
                        {durationDays} {durationDays === 1 ? 'day' : 'days'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#e8f5e9] text-[#1b5e20] border border-[#c8e6c9]">
                          <CheckCircle2 className="w-3 h-3 text-[#1b5e20]" />
                          <span>Approved</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(leave.id)}
                          className="p-1.5 rounded-lg text-[#9297a0] hover:text-[#aa2d00] hover:bg-[#fef2f2] transition-colors"
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
