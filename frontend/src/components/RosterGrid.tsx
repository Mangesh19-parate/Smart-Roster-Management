/**
 * Roster Grid - Main grid component with sticky headers and columns
 */
import { useMemo, useCallback } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { STATUS_CODES, getStatusStyle } from '../utils/statusColors';

interface RosterGridProps {
  rosterData: any;
  month: string;
  view: string;
  viewId: string | null;
  issues: any[];
  selectedIssue: any | null;
  onCellEdit: (employeeId: string, date: string, status: string) => void;
  onIssueClick: (issue: any) => void;
}

export function RosterGrid({
  rosterData,
  month,
  view,
  viewId,
  issues,
  selectedIssue,
  onCellEdit,
  onIssueClick,
}: RosterGridProps) {
  const days = useMemo(() => {
    const start = startOfMonth(parseISO(`${month}-01`));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end });
  }, [month]);

  // Group entries by employee
  const employees = useMemo(() => {
    const empMap = new Map<string, any>();
    rosterData.entries.forEach((entry: any) => {
      if (!empMap.has(entry.employee_id)) {
        empMap.set(entry.employee_id, {
          id: entry.employee_id,
          name: entry.employee?.name || 'Unknown',
          pod: entry.employee?.pod?.name || '',
          role: entry.employee?.role || 'AGENT',
          entries: new Map<string, any>(),
          covers: new Map<string, any>(),
        });
      }
      const emp = empMap.get(entry.employee_id);
      emp.entries.set(entry.date, entry);
    });

    // Add covers
    rosterData.covers.forEach((cover: any) => {
      const emp = empMap.get(cover.employee_id);
      if (emp) {
        const key = `${cover.process_id}-${cover.date}`;
        if (!emp.covers.has(key)) emp.covers.set(key, []);
        emp.covers.get(key).push(cover);
      }
    });

    return Array.from(empMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rosterData.entries, rosterData.covers]);

  // Filter employees based on view
  const filteredEmployees = useMemo(() => {
    if (view === 'company') return employees;
    if (view === 'pod' && viewId) {
      return employees.filter((e) => e.pod === viewId);
    }
    if (view === 'brand' && viewId) {
      // Filter by brand - need to check assignments
      return employees.filter((_e) => {
        // This would need assignment data
        return true;
      });
    }
    if (view === 'process' && viewId) {
      return employees.filter((_e) => {
        // This would need assignment data
        return true;
      });
    }
    if (view === 'employee' && viewId) {
      return employees.filter((e) => e.id === viewId);
    }
    return employees;
  }, [employees, view, viewId]);

  // Get status for a cell
  const getCellStatus = useCallback((employee: any, date: string) => {
    const entry = employee.entries.get(date);
    if (entry) {
      // Check if covering
      const hasCover = Array.from(employee.covers.values()).some((covers: any) =>
        Array.isArray(covers) && covers.some((c: any) => c.date === date)
      );
      if (hasCover && entry.status === 'WORK') return 'COVER';
      return entry.status;
    }
    // Check if closed day
    const demand = rosterData.demand.find((d: any) => d.date === date);
    if (demand && demand.required === 0) return 'CLOSED';
    return null;
  }, [rosterData.demand]);

  // Get cell issues
  const getCellIssues = useCallback((employeeId: string, date: string, processId?: string) => {
    return issues.filter((issue) => {
      if (issue.employee_id && issue.employee_id !== employeeId) return false;
      if (issue.date && issue.date !== date) return false;
      if (processId && issue.process_id && issue.process_id !== processId) return false;
      return true;
    });
  }, [issues]);

  // Check if cell has error/warning
  const getCellSeverity = useCallback((employeeId: string, date: string) => {
    const cellIssues = getCellIssues(employeeId, date);
    if (cellIssues.some((i) => i.severity === 'ERROR')) return 'ERROR';
    if (cellIssues.some((i) => i.severity === 'WARNING')) return 'WARNING';
    return null;
  }, [getCellIssues]);

  // Render cell content
  const renderCell = (employee: any, date: string) => {
    const status = getCellStatus(employee, date);
    const severity = getCellSeverity(employee.id, date);
    const isSelected = selectedIssue && getCellIssues(employee.id, date).some((i: any) => i.id === selectedIssue.id);

    if (!status) return null;

    const styles = getStatusStyle(status);
    const code = STATUS_CODES[status] ?? '?';
    const styleBg = styles.bg;
    const styleText = styles.text;
    const styleBorder = styles.border;

    const baseClasses = `
      w-8 h-7 md:w-8 md:h-7 flex items-center justify-center text-xs font-medium
      border ${styleBorder}
      ${styleBg} ${styleText}
      ${severity === 'ERROR' ? 'ring-2 ring-red-500' : ''}
      ${severity === 'WARNING' ? 'ring-2 ring-amber-500' : ''}
      ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
      cursor-pointer transition-all
      hover:shadow-md hover:z-10
    `;

    return (
      <td
        key={date}
        className={baseClasses}
        title={`${employee.name} - ${format(parseISO(date), 'EEE, MMM d')} - ${status}`}
        onClick={() => {
          if (status === 'WORK' || status === 'WO' || status === 'COVER') {
            onCellEdit(employee.id, date, status === 'WORK' ? 'WO' : 'WORK');
          }
        }}
        onContextMenu={(evt) => {
          evt.preventDefault();
          const cellIssues = getCellIssues(employee.id, date);
          if (cellIssues.length > 0) {
            onIssueClick(cellIssues[0]);
          }
        }}
      >
        {code}
      </td>
    );
  };

  if (filteredEmployees.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No employees to display for this view.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-auto">
      <table className="w-full min-w-max border-collapse" role="grid">
        <thead className="sticky top-0 z-10 bg-white border-b border-slate-200">
          <tr>
            <th className="sticky left-0 z-20 w-40 md:w-48 px-2 py-1.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white border-r border-slate-200">
              Employee
            </th>
            {days.map((day) => (
              <th
                key={format(day, 'yyyy-MM-dd')}
                className="sticky top-0 z-10 w-8 h-7 min-w-8 px-1 py-1 text-center text-xs font-medium text-slate-500 bg-white border-r border-slate-200"
                style={{ width: '32px' }}
              >
                <div className="font-semibold">{format(day, 'd')}</div>
                <div className="text-[10px] text-slate-400">{format(day, 'EEE')}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredEmployees.map((employee, rowIndex) => (
            <tr key={employee.id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              <td className="sticky left-0 z-20 w-40 md:w-48 px-2 py-1 border-r border-slate-200 bg-white">
                <div className="font-medium text-sm text-slate-900 truncate" title={employee.name}>
                  {employee.name}
                </div>
                <div className="text-xs text-slate-500 truncate">{employee.pod}</div>
              </td>
              {days.map((day) => renderCell(employee, format(day, 'yyyy-MM-dd')))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}