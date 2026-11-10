/**
 * RosterGrid - High-performance Enterprise Roster Matrix
 * Sticky headers, sticky employee rail, lock indicators, cell edit modal, and conflict highlights.
 */
import { useMemo, useCallback, useState } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Lock } from 'lucide-react';
import { STATUS_CODES, getStatusStyle } from '../utils/statusColors';
import { CellEditModal } from './CellEditModal';

interface RosterGridProps {
  rosterData: any;
  month: string;
  view: string;
  viewId: string | null;
  issues: any[];
  selectedIssue: any | null;
  onCellEdit: (employeeId: string, date: string, status: string, locked?: boolean, reason?: string) => void;
  onIssueClick: (issue: any) => void;
  searchQuery?: string;
  statusFilter?: string;
  isSavingEdit?: boolean;
}

const DEFAULT_TODAY_STR = format(new Date(), 'yyyy-MM-dd');

export function RosterGrid({
  rosterData,
  month,
  view,
  viewId,
  issues,
  selectedIssue,
  onCellEdit,
  onIssueClick,
  searchQuery = '',
  statusFilter = 'ALL',
  isSavingEdit = false,
}: RosterGridProps) {
  // Modal state for cell editing
  const [editingCell, setEditingCell] = useState<{
    employee: any;
    date: string;
    status: string;
    isLocked: boolean;
    issues: any[];
  } | null>(null);

  // Month days
  const days = useMemo(() => {
    const start = startOfMonth(parseISO(`${month}-01`));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end });
  }, [month]);

  const todayStr = DEFAULT_TODAY_STR;

  // Map employees
  const employees = useMemo(() => {
    const empMap = new Map<string, any>();

    // Seed from rosterData.employees
    if (Array.isArray(rosterData?.employees)) {
      rosterData.employees.forEach((emp: any) => {
        empMap.set(emp.id, {
          id: emp.id,
          name: emp.name || 'Unknown',
          pod: emp.pod?.name || '',
          pod_id: emp.pod_id || emp.pod?.id || '',
          role: emp.role || 'AGENT',
          entries: new Map<string, any>(),
          covers: new Map<string, any>(),
        });
      });
    }

    // Populate entries
    if (Array.isArray(rosterData?.entries)) {
      rosterData.entries.forEach((entry: any) => {
        if (!empMap.has(entry.employee_id)) {
          empMap.set(entry.employee_id, {
            id: entry.employee_id,
            name: entry.employee?.name || 'Unknown',
            pod: entry.employee?.pod?.name || '',
            pod_id: entry.employee?.pod_id || entry.employee?.pod?.id || '',
            role: entry.employee?.role || 'AGENT',
            entries: new Map<string, any>(),
            covers: new Map<string, any>(),
          });
        }
        const emp = empMap.get(entry.employee_id);
        emp.entries.set(entry.date, entry);
      });
    }

    // Populate covers
    if (Array.isArray(rosterData?.covers)) {
      rosterData.covers.forEach((cover: any) => {
        const emp = empMap.get(cover.employee_id);
        if (emp) {
          const key = `${cover.process_id}-${cover.date}`;
          if (!emp.covers.has(key)) emp.covers.set(key, []);
          emp.covers.get(key).push(cover);
        }
      });
    }

    return Array.from(empMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rosterData]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    let result = employees;

    // View filter
    if (view === 'pod' && viewId) {
      result = result.filter((e) => e.pod_id === viewId || e.pod === viewId);
    } else if (view === 'employee' && viewId) {
      result = result.filter((e) => e.id === viewId);
    }

    // Search query filter (name or role)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) => e.name.toLowerCase().includes(q) || (e.role && e.role.toLowerCase().includes(q)) || (e.pod && e.pod.toLowerCase().includes(q))
      );
    }

    // Status filter (keeps employees who have at least one shift matching statusFilter)
    if (statusFilter !== 'ALL') {
      result = result.filter((e) => {
        for (const entry of e.entries.values()) {
          if (entry.status === statusFilter) return true;
        }
        return false;
      });
    }

    return result;
  }, [employees, view, viewId, searchQuery, statusFilter]);

  // Get cell entry
  const getCellEntry = useCallback((employee: any, date: string) => {
    return employee.entries.get(date);
  }, []);

  // Get status for a cell
  const getCellStatus = useCallback(
    (employee: any, date: string) => {
      const entry = employee.entries.get(date);
      if (entry) {
        // Check if covering
        const hasCover = Array.from(employee.covers.values()).some((covers: any) =>
          Array.isArray(covers) && covers.some((c: any) => c.date === date)
        );
        if (hasCover && entry.status === 'WORK') return 'COVER';
        return entry.status;
      }
      const demand = rosterData?.demand?.find((d: any) => d.date === date);
      if (demand && demand.required === 0) return 'CLOSED';
      return null;
    },
    [rosterData?.demand]
  );

  // Get cell issues
  const getCellIssues = useCallback(
    (employeeId: string, date: string, processId?: string) => {
      return issues.filter((issue) => {
        if (issue.employee_id && issue.employee_id !== employeeId) return false;
        if (issue.date && issue.date !== date) return false;
        if (processId && issue.process_id && issue.process_id !== processId) return false;
        return true;
      });
    },
    [issues]
  );

  // Check if cell has error/warning
  const getCellSeverity = useCallback(
    (employeeId: string, date: string) => {
      const cellIssues = getCellIssues(employeeId, date);
      if (cellIssues.some((i) => i.severity === 'ERROR')) return 'ERROR';
      if (cellIssues.some((i) => i.severity === 'WARNING')) return 'WARNING';
      return null;
    },
    [getCellIssues]
  );

  const handleCellClick = (employee: any, date: string) => {
    const entry = getCellEntry(employee, date);
    const status = getCellStatus(employee, date) || 'WORK';
    const isLocked = entry ? !!entry.locked : false;
    const cellIssues = getCellIssues(employee.id, date);

    setEditingCell({
      employee,
      date,
      status: status === 'COVER' ? 'WORK' : status,
      isLocked,
      issues: cellIssues,
    });
  };

  const handleModalSave = (data: {
    employee_id: string;
    date: string;
    status: string;
    locked: boolean;
    reason?: string;
  }) => {
    onCellEdit(data.employee_id, data.date, data.status, data.locked, data.reason);
    setEditingCell(null);
  };

  if (filteredEmployees.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#dddddd] p-12 text-center shadow-xs">
        <p className="text-sm font-medium text-[#181d26]">No employees match the current filters.</p>
        <p className="text-xs text-[#41454d] mt-1">Try clearing search terms or selecting another view.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#dddddd] shadow-xs overflow-hidden flex flex-col">
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] focus:outline-none">
        <table className="w-full border-collapse text-left" role="grid">
          {/* Header Row */}
          <thead className="sticky top-0 z-20 bg-[#f8fafc] border-b border-[#dddddd] select-none">
            <tr>
              <th className="sticky left-0 z-30 w-48 min-w-48 max-w-48 px-3 py-2 text-xs font-semibold text-[#181d26] uppercase tracking-wider bg-[#f8fafc] border-r border-[#dddddd] shadow-[1px_0_0_0_#dddddd]">
                Employee
              </th>
              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const isToday = dateKey === todayStr;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <th
                    key={dateKey}
                    id={`col-${dateKey}`}
                    className={`sticky top-0 z-20 w-8.5 min-w-8.5 px-0.5 py-1.5 text-center text-xs font-medium border-r border-[#dddddd] transition-colors ${
                      isToday
                        ? 'bg-[#181d26] text-white font-semibold'
                        : isWeekend
                        ? 'bg-[#f1f5f9] text-[#41454d]'
                        : 'bg-[#f8fafc] text-[#41454d]'
                    }`}
                  >
                    <div className="text-[11px] leading-tight font-semibold">{format(day, 'd')}</div>
                    <div className={`text-[9px] uppercase tracking-tighter leading-none ${isToday ? 'text-slate-300' : 'text-[#9297a0]'}`}>
                      {format(day, 'EEE')}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#dddddd]">
            {filteredEmployees.map((employee, rowIndex) => {
              const isEven = rowIndex % 2 === 0;

              return (
                <tr
                  key={employee.id}
                  className={`hover:bg-[#f8fafc] transition-colors ${isEven ? 'bg-white' : 'bg-[#fafafa]'}`}
                >
                  {/* Sticky Employee Column */}
                  <td
                    className={`sticky left-0 z-10 w-48 min-w-48 max-w-48 px-3 py-1.5 border-r border-[#dddddd] shadow-[1px_0_0_0_#dddddd] ${
                      isEven ? 'bg-white' : 'bg-[#fafafa]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-xs text-[#181d26] truncate" title={employee.name}>
                        {employee.name}
                      </span>
                      {employee.pod && (
                        <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.2 bg-[#f8fafc] border border-[#dddddd] text-[#41454d] rounded-md">
                          {employee.pod}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#9297a0] truncate mt-0.5">{employee.role}</div>
                  </td>

                  {/* Grid Cells */}
                  {days.map((day) => {
                    const date = format(day, 'yyyy-MM-dd');
                    const status = getCellStatus(employee, date);
                    const entry = getCellEntry(employee, date);
                    const severity = getCellSeverity(employee.id, date);
                    const isLocked = entry ? !!entry.locked : false;
                    const isSelected =
                      selectedIssue &&
                      getCellIssues(employee.id, date).some((i: any) => i.id === selectedIssue.id);

                    if (!status) {
                      return (
                        <td
                          key={date}
                          className="w-8.5 min-w-8.5 h-8 border-r border-[#dddddd] bg-[#f8fafc]/30"
                        />
                      );
                    }

                    const styles = getStatusStyle(status);
                    const code = STATUS_CODES[status] ?? '?';
                    const isToday = date === todayStr;

                    return (
                      <td
                        key={date}
                        onClick={() => handleCellClick(employee, date)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          const cellIssues = getCellIssues(employee.id, date);
                          if (cellIssues.length > 0) {
                            onIssueClick(cellIssues[0]);
                          }
                        }}
                        className={`relative w-8.5 min-w-8.5 h-8 p-0 border-r border-[#dddddd] cursor-pointer select-none text-center transition-all ${
                          isToday ? 'bg-[#f8fafc]' : ''
                        }`}
                        title={`${employee.name} • ${format(day, 'MMM d')} • ${status}${isLocked ? ' (Locked)' : ''}`}
                      >
                        <div
                          className={`w-full h-full flex items-center justify-center text-[11px] font-medium transition-all relative ${styles.bg} ${styles.text} hover:opacity-90 ${
                            severity === 'ERROR'
                              ? 'ring-2 ring-[#aa2d00] ring-inset z-10'
                              : severity === 'WARNING'
                              ? 'ring-2 ring-[#d9a441] ring-inset z-10'
                              : ''
                          } ${isSelected ? 'ring-2 ring-[#181d26] ring-offset-1 z-10' : ''}`}
                        >
                          <span>{code}</span>

                          {/* Lock Indicator */}
                          {isLocked && (
                            <span className="absolute top-0.5 right-0.5" title="Locked Shift">
                              <Lock className="w-2.5 h-2.5 text-[#181d26] stroke-[2.5]" />
                            </span>
                          )}

                          {/* Issue Dot */}
                          {severity && (
                            <span
                              className={`absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                                severity === 'ERROR' ? 'bg-[#aa2d00]' : 'bg-[#d9a441]'
                              }`}
                            />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cell Edit Modal */}
      {editingCell && (
        <CellEditModal
          key={`${editingCell.employee.id}-${editingCell.date}`}
          isOpen={!!editingCell}
          onClose={() => setEditingCell(null)}
          employee={editingCell.employee}
          date={editingCell.date}
          currentStatus={editingCell.status}
          isLocked={editingCell.isLocked}
          issues={editingCell.issues}
          onSave={handleModalSave}
          isLoading={isSavingEdit}
        />
      )}
    </div>
  );
}
