/**
 * RosterSummary - Airtable Inspired High-Density Operational Metrics Bar
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
      <div className="bg-white p-3 rounded-xl border border-[#dddddd] shadow-xs flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#f8fafc] text-[#181d26] border border-[#dddddd]">
          <Users className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-[#41454d] block leading-tight">Total Staff</span>
          <span className="text-lg font-semibold text-[#181d26] leading-none">{metrics.totalEmployees}</span>
        </div>
      </div>

      {/* Working */}
      <div className="bg-white p-3 rounded-xl border border-[#dddddd] shadow-xs flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#e8f5e9] text-[#1b5e20] border border-[#c8e6c9]">
          <UserCheck className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-[#41454d] block leading-tight">Working ({dayLabel})</span>
          <span className="text-lg font-semibold text-[#181d26] leading-none">{metrics.workingToday}</span>
        </div>
      </div>

      {/* Weekly Off */}
      <div className="bg-white p-3 rounded-xl border border-[#dddddd] shadow-xs flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#f1f5f9] text-[#334155] border border-[#e2e8f0]">
          <Coffee className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-[#41454d] block leading-tight">Weekly Off ({dayLabel})</span>
          <span className="text-lg font-semibold text-[#181d26] leading-none">{metrics.weeklyOffToday}</span>
        </div>
      </div>

      {/* On Leave */}
      <div className="bg-white p-3 rounded-xl border border-[#dddddd] shadow-xs flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#fce4ec] text-[#9d174d] border border-[#fbcfe8]">
          <CalendarOff className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-[#41454d] block leading-tight">On Leave ({dayLabel})</span>
          <span className="text-lg font-semibold text-[#181d26] leading-none">{metrics.onLeaveToday}</span>
        </div>
      </div>

      {/* Coverage Gaps */}
      <div className="bg-white p-3 rounded-xl border border-[#dddddd] shadow-xs flex items-center gap-3">
        <div
          className={`p-2 rounded-lg ${
            metrics.coverageGaps > 0
              ? 'bg-[#fef2f2] text-[#aa2d00] border border-[#fecaca]'
              : 'bg-[#e8f5e9] text-[#1b5e20] border border-[#c8e6c9]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-[#41454d] block leading-tight">Coverage Gaps</span>
          <span
            className={`text-lg font-semibold leading-none ${
              metrics.coverageGaps > 0 ? 'text-[#aa2d00]' : 'text-[#181d26]'
            }`}
          >
            {metrics.coverageGaps}
          </span>
        </div>
      </div>

      {/* Scheduling Issues */}
      <div className="bg-white p-3 rounded-xl border border-[#dddddd] shadow-xs flex items-center gap-3">
        <div
          className={`p-2 rounded-lg ${
            metrics.criticalIssues > 0
              ? 'bg-[#fef2f2] text-[#aa2d00] border border-[#fecaca]'
              : metrics.warningIssues > 0
              ? 'bg-[#fff8e1] text-[#b45309] border border-[#fde68a]'
              : 'bg-[#e8f5e9] text-[#1b5e20] border border-[#c8e6c9]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-[#41454d] block leading-tight">Scheduling Health</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs font-semibold text-[#aa2d00]">{metrics.criticalIssues} Crit</span>
            <span className="text-xs text-[#9297a0]">/</span>
            <span className="text-xs font-semibold text-[#b45309]">{metrics.warningIssues} Warn</span>
          </div>
        </div>
      </div>
    </div>
  );
}
