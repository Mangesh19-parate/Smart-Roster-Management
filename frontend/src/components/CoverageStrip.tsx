/**
 * Coverage Strip - Shows coverage status per day per process
 */
import { useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

interface CoverageStripProps {
  coverage: any[];
  demand: any[];
  month: string;
}

const COVERAGE_COLORS = {
  fully_covered: 'bg-green-600',
  at_minimum: 'bg-amber-500',
  gap: 'bg-red-600',
  closed: 'bg-slate-300',
};

export function CoverageStrip({ coverage, demand, month }: CoverageStripProps) {
  const days = useMemo(() => {
    const start = startOfMonth(parseISO(`${month}-01`));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end });
  }, [month]);

  // Group coverage by process
  const processCoverage = useMemo(() => {
    const map = new Map<string, Map<string, any>>();
    coverage.forEach((c) => {
      if (!map.has(c.process_id)) map.set(c.process_id, new Map());
      map.get(c.process_id)!.set(c.date, c);
    });
    return map;
  }, [coverage]);

  // Group demand by process
  const processDemand = useMemo(() => {
    const map = new Map<string, Map<string, any>>();
    demand.forEach((d) => {
      if (!map.has(d.process_id)) map.set(d.process_id, new Map());
      map.get(d.process_id)!.set(d.date, d);
    });
    return map;
  }, [demand]);

  const processes = Array.from(processCoverage.keys());

  if (processes.length === 0) return null;

  return (
    <div className="border-t border-slate-200 bg-white overflow-x-auto">
      <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Coverage
      </div>
      <table className="w-full min-w-max border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-40 md:w-48 px-2 py-1 text-left text-xs font-medium text-slate-500 bg-white border-r border-slate-200">
              Process
            </th>
            {days.map((day) => (
              <th
                key={format(day, 'yyyy-MM-dd')}
                className="w-8 h-6 min-w-8 px-1 py-0.5 text-center text-[9px] font-medium text-slate-500 bg-white border-r border-slate-200"
                style={{ width: '32px' }}
              >
                {format(day, 'd')}<br />
                <span className="text-[8px]">{format(day, 'EEE')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processes.map((processId, idx) => (
            <tr key={processId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              <td className="sticky left-0 z-10 w-40 md:w-48 px-2 py-1 border-r border-slate-200 bg-white text-xs font-medium text-slate-700 truncate max-w-[160px]">
                {processId}
              </td>
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const cov = processCoverage.get(processId)?.get(dateStr);
                const dem = processDemand.get(processId)?.get(dateStr);

                if (!dem || dem.required === 0) {
                  return (
                    <td
                      key={dateStr}
                      className="w-8 h-6 min-w-8 bg-slate-200 border-r border-slate-300 relative"
                      style={{ width: '32px' }}
                    >
                      <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#e2e8f0_0,#e2e8f0_2px,transparent_2px,transparent_4px)]" />
                    </td>
                  );
                }

                const status = cov?.status || 'gap';
                const colorClass = COVERAGE_COLORS[status as keyof typeof COVERAGE_COLORS] || COVERAGE_COLORS.gap;
                const shortfall = cov?.shortfall || dem.required;

                return (
                  <td
                    key={dateStr}
                    className={`w-8 h-6 min-w-8 ${colorClass} border-r border-slate-200 relative flex items-center justify-center text-white font-medium`}
                    style={{ width: '32px' }}
                    title={`Required: ${dem.required}, Supplied: ${cov?.supplied || 0}, Shortfall: ${shortfall}`}
                  >
                    {shortfall > 0 ? shortfall : '✓'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}