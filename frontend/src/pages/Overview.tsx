/**
 * Overview - Operational Command Center Dashboard
 * Visualizes operational workforce distribution, coverage metrics, and alerts from real backend queries.
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
      {/* Overview Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Operations Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time workforce health and monthly process coverage for {formattedMonth}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRunValidation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Health Check</span>
          </button>
          <button
            type="button"
            onClick={onOpenLeaveDialog}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <CalendarOff className="w-3.5 h-3.5 text-slate-500" />
            <span>Request Leave</span>
          </button>
          <button
            type="button"
            onClick={onNavigateToRoster}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-2xs transition-colors"
          >
            <span>Open Roster Matrix</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Workforce */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Workforce</span>
            <div className="p-2 rounded-md bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.totalEmployees}</span>
            <span className="text-xs text-slate-500">Scheduled active agents</span>
          </div>
        </div>

        {/* Coverage Health */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Process Coverage Rate</span>
            <div
              className={`p-2 rounded-md ${
                stats.overallCoverageRate >= 95 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${
                stats.overallCoverageRate >= 95 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {stats.overallCoverageRate}%
            </span>
            <span className="text-xs text-slate-500">of demand satisfied</span>
          </div>
        </div>

        {/* Coverage Shortfall Days */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Coverage Gaps</span>
            <div className={`p-2 rounded-md ${stats.gapCount > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${stats.gapCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {stats.gapCount}
            </span>
            <span className="text-xs text-slate-500">process-day shortfalls</span>
          </div>
        </div>

        {/* Rule Engine Health */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Rule Engine Health</span>
            <div className={`p-2 rounded-md ${stats.criticalIssues > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${stats.criticalIssues > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {stats.criticalIssues}
            </span>
            <span className="text-xs text-slate-500">critical / {stats.warningIssues} warnings</span>
          </div>
        </div>
      </div>

      {/* Workforce Today & Process Health Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Status Breakdown */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900">Workforce Status Today</h3>
            <span className="text-xs text-slate-400 font-medium">{targetDateStr}</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Working On-Shift
                </span>
                <span>{stats.workingToday} agents</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: stats.totalEmployees > 0 ? `${(stats.workingToday / stats.totalEmployees) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  Scheduled Weekly Off
                </span>
                <span>{stats.offToday} agents</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-400 rounded-full"
                  style={{
                    width: stats.totalEmployees > 0 ? `${(stats.offToday / stats.totalEmployees) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  On Leave / Comp-Off
                </span>
                <span>{stats.leaveToday} agents</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: stats.totalEmployees > 0 ? `${(stats.leaveToday / stats.totalEmployees) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Utilization rate</span>
            <span className="font-semibold text-slate-800">
              {stats.totalEmployees > 0 ? Math.round((stats.workingToday / stats.totalEmployees) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Process Coverage Status */}
        <div className="lg:col-span-2 bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900">Process Coverage Breakdown</h3>
            <span className="text-xs text-slate-500 font-medium">Monthly Fulfillment</span>
          </div>

          {stats.processes.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No active process demand found for this month.</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {stats.processes.map((proc) => {
                const fulfillment = proc.required > 0 ? Math.min(100, Math.round((proc.actual / proc.required) * 100)) : 100;
                const isShort = proc.gaps > 0;

                return (
                  <div key={proc.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-[140px] truncate">
                      <span className="font-semibold text-slate-900 block truncate">{proc.name}</span>
                      {proc.brand && <span className="text-[10px] text-slate-400 block truncate">{proc.brand}</span>}
                    </div>

                    <div className="flex-1 max-w-xs">
                      <div className="flex justify-between text-[11px] font-medium text-slate-500 mb-1">
                        <span>Fulfillment</span>
                        <span className={fulfillment < 100 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                          {fulfillment}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${fulfillment < 100 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${fulfillment}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isShort ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
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
