/**
 * Employee Agenda - Mobile-friendly view for employee roster
 */
import { useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { STATUS_CODES, getStatusStyle } from '../utils/statusColors';

interface EmployeeAgendaProps {
  rosterData: any;
  month: string;
  employeeId: string;
  onCellEdit: (employeeId: string, date: string, status: string) => void;
  issues: any[];
  selectedIssue: any | null;
  onIssueClick: (issue: any) => void;
}

const STATUS_LABELS: Record<string, string> = {
  WORK: 'Working',
  WO: 'Weekly Off',
  PH: 'Public Holiday',
  LEAVE: 'Leave',
  COMP_OFF: 'Comp Off',
  COVER: 'Covering',
  CLOSED: 'Closed',
};

export function EmployeeAgenda({
  rosterData,
  month,
  employeeId,
  onCellEdit,
  issues,
  selectedIssue,
  onIssueClick,
}: EmployeeAgendaProps) {
  const days = useMemo(() => {
    const start = startOfMonth(parseISO(`${month}-01`));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end });
  }, [month]);

  // Find employee data
  const employee = useMemo(() => {
    const entry = rosterData.entries.find((e: any) => e.employee_id === employeeId);
    return entry?.employee;
  }, [rosterData.entries, employeeId]);

  const employeeEntries = useMemo(() => {
    const entries = new Map<string, any>();
    rosterData.entries
      .filter((e: any) => e.employee_id === employeeId)
      .forEach((e: any) => entries.set(e.date, e));
    return entries;
  }, [rosterData.entries, employeeId]);

  const employeeCovers = useMemo(() => {
    const covers = new Map<string, any[]>();
    rosterData.covers
      .filter((c: any) => c.employee_id === employeeId)
      .forEach((c: any) => {
        const key = `${c.process_id}-${c.date}`;
        if (!covers.has(key)) covers.set(key, []);
        covers.get(key)!.push(c);
      });
    return covers;
  }, [rosterData.covers, employeeId]);

  // Get cell issues
  const getCellIssues = (date: string) => {
    return issues.filter((issue) => issue.date === date && (!issue.employee_id || issue.employee_id === employeeId));
  };

  if (!employee) {
    return (
      <div className="text-center py-12 text-slate-500">
        Employee not found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Employee Header */}
      <div className="bg-white border border-[#dddddd] rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#181d26]">{employee.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
              <span>Pod: {employee.pod?.name || 'N/A'}</span>
              <span>•</span>
              <span>Role: {employee.role}</span>
            </div>
          </div>
        </div>

        {/* Counters */}
        <div className="mt-4 grid grid-cols-4 gap-3 text-center">
          <Counter
            label="Working"
            value={Array.from(employeeEntries.values()).filter((e) => e.status === 'WORK').length}
            color="green"
          />
          <Counter
            label="Offs"
            value={Array.from(employeeEntries.values()).filter((e) => e.status === 'WO').length}
            color="slate"
          />
          <Counter
            label="Leaves"
            value={Array.from(employeeEntries.values()).filter((e) => e.status === 'pink').length}
            color="pink"
          />
          <Counter
            label="Comp-Off"
            value={Array.from(employeeEntries.values()).filter((e) => e.status === 'COMP_OFF').length}
            color="indigo"
          />
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white border border-[#dddddd] rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 border-b border-[#dddddd] bg-[#f8fafc]">
          <h3 className="text-xs font-bold text-[#181d26] uppercase tracking-wider">Monthly Calendar</h3>
        </div>
        <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const entry = employeeEntries.get(dateStr);
            const hasCover = employeeCovers.has(`${dateStr}`);
            const cellIssues = getCellIssues(dateStr);
            const isSelected = selectedIssue && cellIssues.some((i: any) => i.id === selectedIssue.id);
            const severity = cellIssues.some((i) => i.severity === 'ERROR')
              ? 'ERROR'
              : cellIssues.some((i) => i.severity === 'WARNING')
                ? 'WARNING'
                : null;

            let status = entry?.status;
            if (hasCover && status === 'WORK') status = 'COVER';
            if (!status) status = 'CLOSED';

            const styles = getStatusStyle(status);
            const code = STATUS_CODES[status] ?? '?';
            const styleBg = styles.bg;
            const styleText = styles.text;
            const styleBorder = styles.border;

            return (
              <button
                key={dateStr}
                onClick={() => {
                  if (status === 'WORK' || status === 'WO' || status === 'COVER') {
                    onCellEdit(employeeId, dateStr, status === 'WORK' ? 'WO' : 'WORK');
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (cellIssues.length > 0) onIssueClick(cellIssues[0]);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  isSelected ? 'ring-2 ring-[#181d26] bg-[#f1f5f9]' : 'hover:bg-[#f8fafc]'
                } ${severity === 'ERROR' ? 'border-red-300' : severity === 'WARNING' ? 'border-amber-300' : 'border-[#dddddd]'}`}
              >
                <div className="flex flex-col items-start w-24">
                  <span className="font-semibold text-sm text-[#181d26]">{format(day, 'MMM d')}</span>
                  <span className="text-xs text-slate-400">{format(day, 'EEEE')}</span>
                </div>
                <div className={`flex-1 ${styleBg} ${styleBorder} rounded-full px-3 py-1 text-center text-xs font-semibold ${styleText}`}>
                  {STATUS_LABELS[status] || status}
                  <span className="ml-1.5 text-xs opacity-70">({code})</span>
                </div>
                {cellIssues.length > 0 && (
                  <div className="flex gap-1">
                    {cellIssues.map((issue: any) => (
                      <span
                        key={issue.id}
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          issue.severity === 'ERROR'
                            ? 'bg-[#fce4ec] text-[#aa2d00] border border-[#f8bbd0]'
                            : issue.severity === 'WARNING'
                              ? 'bg-[#fff8e1] text-[#b45309] border border-[#ffecb3]'
                              : 'bg-[#f1f5f9] text-[#181d26] border border-[#dddddd]'
                        }`}
                      >
                        {issue.rule}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white border border-[#dddddd] rounded-xl p-3 shadow-xs">
        <h4 className="text-xs font-bold text-[#181d26] uppercase tracking-wider mb-2">Legend</h4>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(STATUS_LABELS).map(([key, label]) => {
            const styles = getStatusStyle(key);
            const code = STATUS_CODES[key] ?? '?';
            const styleBg = styles.bg;
            const styleText = styles.text;
            const styleBorder = styles.border;
            return (
              <span key={key} className={`inline-flex items-center gap-1.5 ${styleBg} ${styleBorder} rounded-full px-2.5 py-1 font-medium ${styleText}`}>
                <span className="font-mono font-bold text-[11px]">{code}</span> {label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    green: { bg: 'bg-green-100', text: 'text-green-700' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-700' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-700' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  };
  const c = (colors[color] ?? colors.slate) as { bg: string; text: string };

  return (
    <div className={`p-3 rounded-lg ${c.bg}`}>
      <div className={`text-2xl font-bold ${c.text}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}