/**
 * Coverage Strip - Airtable Inspired Day-by-Day Process Coverage View
 */
import { useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

interface CoverageStripProps {
  coverage: any[];
  demand: any[];
  month: string;
}

const COVERAGE_COLORS = {
  fully_covered: 'bg-[#006400]',
  at_minimum: 'bg-[#d9a441]',
  gap: 'bg-[#aa2d00]',
  closed: 'bg-[#e0e2e6]',
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
    <div className="border-t border-[#dddddd] bg-white overflow-x-auto">
      <div className="px-3 py-1.5 text-xs font-semibold text-[#181d26] uppercase tracking-wider bg-[#f8fafc] border-b border-[#dddddd]">
        Process Fulfillment & Coverage Status
      </div>
      <table className="w-full min-w-max border-collapse text-[10px]">
        <thead>
          <tr className="bg-[#f8fafc] border-b border-[#dddddd]">
            <th className="sticky left-0 z-10 w-40 md:w-48 px-3 py-1.5 text-left text-xs font-medium text-[#41454d] bg-[#f8fafc] border-r border-[#dddddd]">
              Process
            </th>
            {days.map((day) => (
              <th
                key={format(day, 'yyyy-MM-dd')}
                className="w-8 h-6 min-w-8 px-1 py-0.5 text-center text-[9px] font-medium text-[#41454d] bg-[#f8fafc] border-r border-[#dddddd]"
                style={{ width: '32px' }}
              >
                {format(day, 'd')}<br />
                <span className="text-[8px] text-[#9297a0]">{format(day, 'EEE')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processes.map((processId, idx) => (
            <tr key={processId} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
              <td className="sticky left-0 z-10 w-40 md:w-48 px-3 py-1.5 border-r border-[#dddddd] bg-inherit text-xs font-medium text-[#181d26] truncate max-w-[160px]">
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
                      className="w-8 h-6 min-w-8 bg-[#f1f5f9] border-r border-[#dddddd] relative"
                      style={{ width: '32px' }}
                    >
                      <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#e2e8f0_0,#e2e8f0_2px,transparent_2px,transparent_4px)] opacity-50" />
                    </td>
                  );
                }

                const status = cov?.status || 'gap';
                const colorClass = COVERAGE_COLORS[status as keyof typeof COVERAGE_COLORS] || COVERAGE_COLORS.gap;
                const shortfall = cov?.shortfall || dem.required;

                return (
                  <td
                    key={dateStr}
                    className={`w-8 h-6 min-w-8 ${colorClass} border-r border-[#dddddd] relative flex items-center justify-center text-white font-medium`}
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
