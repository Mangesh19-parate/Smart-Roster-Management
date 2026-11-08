/**
 * RosterSummary - High-density operational metrics bar calculated from real data
 */
import { useMemo } from 'react';
import { format } from 'date-fns';
import { Users, UserCheck, Coffee, CalendarOff, AlertTriangle, ShieldCheck } from 'lucide-react';

interface RosterSummaryProps {
  rosterData: any;
  issues: any[];
  month: string;
}

const DEFAULT_TODAY_STR = format(new Date(), 'yyyy-MM-dd');

export function RosterSummary({ rosterData, issues, month }: RosterSummaryProps) {
  // Use today if in the viewed month, otherwise pick the 1st of the month for status inspection
  const targetDateStr = useMemo(() => {
    return DEFAULT_TODAY_STR.startsWith(month) ? DEFAULT_TODAY_STR : `${month}-01`;
  }, [month]);

  const metrics = useMemo(() => {
    // 1. Total employees
    let totalEmployees = 0;
    if (Array.isArray(rosterData?.employees) && rosterData.employees.length > 0) {
      totalEmployees = rosterData.employees.length;
    } else if (Array.isArray(rosterData?.entries)) {
      const uniqueEmpIds = new Set(rosterData.entries.map((e: any) => e.employee_id));
      totalEmployees = uniqueEmpIds.size;
    }

    // 2. Entries on targetDate
    let workingToday = 0;
    let weeklyOffToday = 0;
    let onLeaveToday = 0;

    if (Array.isArray(rosterData?.entries)) {
      rosterData.entries.forEach((e: any) => {
        if (e.date === targetDateStr) {
          if (e.status === 'WORK') workingToday++;
          else if (e.status === 'WO') weeklyOffToday++;
          else if (e.status === 'LEAVE' || e.status === 'COMP_OFF') onLeaveToday++;
        }
      });
    }

    // 3. Total coverage gaps in the entire month
    let coverageGaps = 0;
    if (Array.isArray(rosterData?.coverage)) {
      rosterData.coverage.forEach((c: any) => {
        const shortfall = c.shortfall ?? Math.max(0, (c.required || 0) - (c.actual || 0));
        if (shortfall > 0) coverageGaps++;
      });
    }

    // 4. Scheduling Health Issues count
    const criticalIssues = issues.filter((i) => i.severity === 'ERROR').length;
    const warningIssues = issues.filter((i) => i.severity === 'WARNING').length;

    return {
      totalEmployees,
      workingToday,
      weeklyOffToday,
      onLeaveToday,
      coverageGaps,
      criticalIssues,
      warningIssues,
      targetDateStr,
    };
  }, [rosterData, issues, targetDateStr]);

  const isCurrentMonth = DEFAULT_TODAY_STR.startsWith(month);
  const dayLabel = isCurrentMonth ? 'Today' : format(new Date(`${targetDateStr}T00:00:00`), 'MMM d');

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {/* Total Staff */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="p-2 rounded-md bg-indigo-50 text-indigo-600">
          <Users className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-500 block leading-tight">Total Staff</span>
          <span className="text-lg font-bold text-slate-900 leading-none">{metrics.totalEmployees}</span>
        </div>
      </div>

      {/* Working */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="p-2 rounded-md bg-emerald-50 text-emerald-600">
          <UserCheck className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-500 block leading-tight">Working ({dayLabel})</span>
          <span className="text-lg font-bold text-slate-900 leading-none">{metrics.workingToday}</span>
        </div>
      </div>

      {/* Weekly Off */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="p-2 rounded-md bg-slate-100 text-slate-600">
          <Coffee className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-500 block leading-tight">Weekly Off ({dayLabel})</span>
          <span className="text-lg font-bold text-slate-900 leading-none">{metrics.weeklyOffToday}</span>
        </div>
      </div>

      {/* On Leave */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="p-2 rounded-md bg-amber-50 text-amber-600">
          <CalendarOff className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-500 block leading-tight">On Leave ({dayLabel})</span>
          <span className="text-lg font-bold text-slate-900 leading-none">{metrics.onLeaveToday}</span>
        </div>
      </div>

      {/* Coverage Gaps */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
        <div className={`p-2 rounded-md ${metrics.coverageGaps > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-500 block leading-tight">Coverage Gaps</span>
          <span className={`text-lg font-bold leading-none ${metrics.coverageGaps > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {metrics.coverageGaps}
          </span>
        </div>
      </div>

      {/* Scheduling Issues */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
        <div className={`p-2 rounded-md ${metrics.criticalIssues > 0 ? 'bg-rose-50 text-rose-600' : metrics.warningIssues > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-500 block leading-tight">Scheduling Health</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs font-semibold text-rose-600">{metrics.criticalIssues} Crit</span>
            <span className="text-xs text-slate-400">/</span>
            <span className="text-xs font-semibold text-amber-600">{metrics.warningIssues} Warn</span>
          </div>
        </div>
      </div>
    </div>
  );
}
