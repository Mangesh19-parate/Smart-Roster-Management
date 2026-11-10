/**
 * Overview - Airtable Inspired Operational Command Center Dashboard
 * Visualizes operational workforce distribution, coverage metrics, and alerts using Airtable signature surface cards.
 */
import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Users,
  AlertTriangle,
  CalendarOff,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

interface OverviewProps {
  rosterData: any;
  issues: any[];
  month: string;
  onNavigateToRoster: () => void;
  onOpenLeaveDialog: () => void;
  onRunValidation: () => void;
}

const DEFAULT_TODAY_STR = format(new Date(), 'yyyy-MM-dd');

export function Overview({
  rosterData,
  issues = [],
  month,
  onNavigateToRoster,
  onOpenLeaveDialog,
  onRunValidation,
}: OverviewProps) {
  const targetDateStr = useMemo(
    () => (DEFAULT_TODAY_STR.startsWith(month) ? DEFAULT_TODAY_STR : `${month}-01`),
    [month]
  );

  // Operational metrics
  const stats = useMemo(() => {
    // 1. Employees count
    let totalEmployees = 0;
    if (Array.isArray(rosterData?.employees) && rosterData.employees.length > 0) {
      totalEmployees = rosterData.employees.length;
    } else if (Array.isArray(rosterData?.entries)) {
      totalEmployees = new Set(rosterData.entries.map((e: any) => e.employee_id)).size;
    }

    // 2. Today's distribution
    let workingToday = 0;
    let offToday = 0;
    let leaveToday = 0;

    if (Array.isArray(rosterData?.entries)) {
      rosterData.entries.forEach((e: any) => {
        if (e.date === targetDateStr) {
          if (e.status === 'WORK') workingToday++;
          else if (e.status === 'WO') offToday++;
          else if (e.status === 'LEAVE' || e.status === 'COMP_OFF') leaveToday++;
        }
      });
    }

    // 3. Process Coverage Analysis
    let totalSlotsRequired = 0;
    let totalSlotsCovered = 0;
    let gapCount = 0;

    const processMap = new Map<string, { id: string; name: string; brand: string; required: number; actual: number; gaps: number }>();

    if (Array.isArray(rosterData?.coverage)) {
      rosterData.coverage.forEach((c: any) => {
        const req = c.required || 0;
        const act = c.actual || 0;
        const shortfall = c.shortfall ?? Math.max(0, req - act);

        totalSlotsRequired += req;
        totalSlotsCovered += Math.min(req, act);
        if (shortfall > 0) gapCount++;

        const procId = c.process_id || 'unknown';
        if (!processMap.has(procId)) {
          processMap.set(procId, {
            id: procId,
            name: c.process_name || 'Process',
            brand: c.brand_name || '',
            required: 0,
            actual: 0,
            gaps: 0,
          });
        }
        const p = processMap.get(procId)!;
        p.required += req;
        p.actual += act;
        if (shortfall > 0) p.gaps++;
      });
    }

    const overallCoverageRate =
      totalSlotsRequired > 0 ? Math.round((totalSlotsCovered / totalSlotsRequired) * 100) : 100;

    const criticalIssues = issues.filter((i) => i.severity === 'ERROR').length;
    const warningIssues = issues.filter((i) => i.severity === 'WARNING').length;

    return {
      totalEmployees,
      workingToday,
      offToday,
      leaveToday,
      gapCount,
      overallCoverageRate,
      criticalIssues,
      warningIssues,
      processes: Array.from(processMap.values()),
    };
  }, [rosterData, issues, targetDateStr]);

  const formattedMonth = format(parseISO(`${month}-01`), 'MMMM yyyy');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Overview Page Header - Airtable Style Band */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#dddddd] shadow-xs">
        <div>
          <h1 className="text-xl font-semibold text-[#181d26] tracking-tight">Operations Command Center</h1>
          <p className="text-xs text-[#41454d] mt-1">
            Real-time workforce health and monthly process coverage for {formattedMonth}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onRunValidation}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#181d26] bg-white border border-[#dddddd] rounded-xl hover:bg-[#f8fafc] hover:border-[#9297a0] shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#41454d]" />
            <span>Health Check</span>
          </button>
          <button
            type="button"
            onClick={onOpenLeaveDialog}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#181d26] bg-white border border-[#dddddd] rounded-xl hover:bg-[#f8fafc] hover:border-[#9297a0] shadow-xs transition-colors"
          >
            <CalendarOff className="w-3.5 h-3.5 text-[#41454d]" />
            <span>Request Leave</span>
          </button>
          <button
            type="button"
            onClick={onNavigateToRoster}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#181d26] hover:bg-[#0d1218] active:bg-[#000000] rounded-xl shadow-xs transition-colors"
          >
            <span>Open Roster Matrix</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Primary KPI Grid - Airtable Signature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Workforce - Dark Ink Card */}
        <div className="bg-[#181d26] text-white p-5 rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Total Workforce</span>
            <div className="p-2 rounded-lg bg-white/10 text-white">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold tracking-tight text-white">{stats.totalEmployees}</span>
            <p className="text-xs text-slate-300 mt-1">Scheduled active agents</p>
          </div>
        </div>

        {/* Coverage Health - Signature Forest Card */}
        <div className="bg-[#0a2e0e] text-white p-5 rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-200">Process Coverage Rate</span>
            <div className="p-2 rounded-lg bg-white/10 text-[#a8d8c4]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold tracking-tight text-white">{stats.overallCoverageRate}%</span>
            <p className="text-xs text-[#a8d8c4] mt-1">Monthly demand satisfied</p>
          </div>
        </div>

        {/* Coverage Shortfall Days - Signature Coral Card (or Soft Mint if clean) */}
        <div
          className={`p-5 rounded-xl shadow-xs flex flex-col justify-between transition-colors ${
            stats.gapCount > 0 ? 'bg-[#aa2d00] text-white' : 'bg-white border border-[#dddddd] text-[#181d26]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${stats.gapCount > 0 ? 'text-rose-100' : 'text-[#41454d]'}`}>
              Coverage Gaps
            </span>
            <div
              className={`p-2 rounded-lg ${
                stats.gapCount > 0 ? 'bg-white/15 text-white' : 'bg-[#e8f5e9] text-[#1b5e20]'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span
              className={`text-3xl font-bold tracking-tight ${
                stats.gapCount > 0 ? 'text-white' : 'text-[#181d26]'
              }`}
            >
              {stats.gapCount}
            </span>
            <p className={`text-xs mt-1 ${stats.gapCount > 0 ? 'text-rose-100' : 'text-[#41454d]'}`}>
              process-day shortfalls
            </p>
          </div>
        </div>

        {/* Rule Engine Health - Signature Cream Card */}
        <div className="bg-[#f5e9d4] border border-[#dddddd] text-[#181d26] p-5 rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#41454d]">Rule Health</span>
            <div className="p-2 rounded-lg bg-white/60 text-[#181d26] border border-[#dddddd]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold tracking-tight text-[#181d26]">
              {stats.criticalIssues === 0 ? 'Optimal' : `${stats.criticalIssues} Crit`}
            </span>
            <p className="text-xs text-[#41454d] mt-1">
              {stats.warningIssues} warnings to review
            </p>
          </div>
        </div>
      </div>

      {/* Workforce Today & Process Health Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Status Breakdown */}
        <div className="bg-white p-6 rounded-xl border border-[#dddddd] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#dddddd] pb-3">
            <h3 className="font-semibold text-sm text-[#181d26]">Workforce Status Today</h3>
            <span className="text-xs text-[#41454d] font-medium">{targetDateStr}</span>
          </div>

          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-xs font-medium text-[#181d26] mb-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#006400]" />
                  Working On-Shift
                </span>
                <span className="font-semibold">{stats.workingToday} agents</span>
              </div>
              <div className="w-full h-2 bg-[#f8fafc] border border-[#dddddd] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#006400] rounded-full"
                  style={{
                    width: stats.totalEmployees > 0 ? `${(stats.workingToday / stats.totalEmployees) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-[#181d26] mb-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#9297a0]" />
                  Scheduled Weekly Off
                </span>
                <span className="font-semibold">{stats.offToday} agents</span>
              </div>
              <div className="w-full h-2 bg-[#f8fafc] border border-[#dddddd] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#9297a0] rounded-full"
                  style={{
                    width: stats.totalEmployees > 0 ? `${(stats.offToday / stats.totalEmployees) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-[#181d26] mb-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#fcab79]" />
                  On Leave / Comp-Off
                </span>
                <span className="font-semibold">{stats.leaveToday} agents</span>
              </div>
              <div className="w-full h-2 bg-[#f8fafc] border border-[#dddddd] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#fcab79] rounded-full"
                  style={{
                    width: stats.totalEmployees > 0 ? `${(stats.leaveToday / stats.totalEmployees) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#dddddd] text-xs text-[#41454d] flex items-center justify-between">
            <span>Utilization rate</span>
            <span className="font-semibold text-[#181d26]">
              {stats.totalEmployees > 0 ? Math.round((stats.workingToday / stats.totalEmployees) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Process Coverage Status - Airtable Grid Table */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-[#dddddd] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#dddddd] pb-3">
            <h3 className="font-semibold text-sm text-[#181d26]">Process Coverage Breakdown</h3>
            <span className="text-xs text-[#41454d] font-medium">Monthly Fulfillment</span>
          </div>

          {stats.processes.length === 0 ? (
            <p className="text-xs text-[#9297a0] py-8 text-center">No active process demand found for this month.</p>
          ) : (
            <div className="divide-y divide-[#dddddd] max-h-68 overflow-y-auto">
              {stats.processes.map((proc) => {
                const fulfillment = proc.required > 0 ? Math.min(100, Math.round((proc.actual / proc.required) * 100)) : 100;
                const isShort = proc.gaps > 0;

                return (
                  <div key={proc.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-[140px] truncate">
                      <span className="font-medium text-[#181d26] block truncate">{proc.name}</span>
                      {proc.brand && <span className="text-[11px] text-[#41454d] block truncate">{proc.brand}</span>}
                    </div>

                    <div className="flex-1 max-w-xs">
                      <div className="flex justify-between text-[11px] font-medium text-[#41454d] mb-1">
                        <span>Fulfillment</span>
                        <span className={fulfillment < 100 ? 'text-[#aa2d00] font-semibold' : 'text-[#006400] font-semibold'}>
                          {fulfillment}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#f8fafc] border border-[#dddddd] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${fulfillment < 100 ? 'bg-[#aa2d00]' : 'bg-[#006400]'}`}
                          style={{ width: `${fulfillment}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                          isShort
                            ? 'bg-[#fef2f2] text-[#aa2d00] border-[#fecaca]'
                            : 'bg-[#e8f5e9] text-[#1b5e20] border-[#c8e6c9]'
                        }`}
                      >
                        {isShort ? `${proc.gaps} gaps` : 'Fully Covered'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
