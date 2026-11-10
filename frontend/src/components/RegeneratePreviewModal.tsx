/**
 * Regenerate Preview Modal (S11, T45) - Airtable Inspired Diff Inspector
 * Displays diff before applying changes: changed entries, gaps, status, and Accept/Discard.
 */
interface DiffEntry {
  employee_id: string;
  employee_name?: string;
  date: string;
  before: string | null;
  after: string | null;
  locked?: boolean;
}

interface RegeneratePreviewModalProps {
  month: string;
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  isLoading?: boolean;
  diffData?: {
    diff?: {
      entries?: DiffEntry[];
      covers?: any[];
    };
    issues_before?: any[];
    issues_after?: any[];
    stats?: {
      status?: string;
      solve_ms?: number;
      gaps_total?: number;
    };
  } | null;
}

export function RegeneratePreviewModal({
  month,
  isOpen,
  onClose,
  onAccept,
  isLoading,
  diffData,
}: RegeneratePreviewModalProps) {
  if (!isOpen) return null;

  const entries = diffData?.diff?.entries || [];
  const stats = diffData?.stats;
  const issuesBefore = diffData?.issues_before?.length ?? 0;
  const issuesAfter = diffData?.issues_after?.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181d26]/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-[#dddddd] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#dddddd] bg-[#f8fafc] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#181d26]">Regenerate Preview (Minimal Change)</h2>
            <p className="text-xs text-[#41454d] mt-0.5">Review schedule impact for {month} before accepting.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#9297a0] hover:text-[#181d26] rounded-xl hover:bg-white border border-transparent hover:border-[#dddddd] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Left Summary */}
          <div className="space-y-3 bg-[#f8fafc] p-4 rounded-xl border border-[#dddddd] h-fit">
            <h3 className="font-semibold text-[#181d26] text-xs uppercase tracking-wider">Summary</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#dddddd]">
                <span className="text-[#41454d]">Entries changed:</span>
                <span className="font-semibold text-[#181d26]">{entries.length}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#dddddd]">
                <span className="text-[#41454d]">Issues Before:</span>
                <span className="font-semibold text-[#aa2d00]">{issuesBefore}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#dddddd]">
                <span className="text-[#41454d]">Issues After:</span>
                <span className={`font-semibold ${issuesAfter < issuesBefore ? 'text-[#006400]' : 'text-[#181d26]'}`}>
                  {issuesAfter}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#dddddd]">
                <span className="text-[#41454d]">Solver Status:</span>
                <span className="font-semibold text-[#181d26]">{stats?.status || 'FEASIBLE'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#41454d]">Solve Time:</span>
                <span className="font-semibold text-[#181d26]">{stats?.solve_ms ? `${stats.solve_ms}ms` : '< 1s'}</span>
              </div>
            </div>
            <div className="bg-[#f5e9d4] border border-[#dddddd] rounded-xl p-3 text-[11px] text-[#333840] leading-relaxed">
              Changes are held in memory. Nothing is written to the database until you click <strong>Accept & Save</strong>.
            </div>
          </div>

          {/* Right Diff List */}
          <div className="md:col-span-2 space-y-3">
            <h3 className="font-semibold text-[#181d26] text-xs uppercase tracking-wider">
              Changed Entries ({entries.length})
            </h3>
            {entries.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#9297a0] bg-[#f8fafc] border border-[#dddddd] rounded-xl">
                No entries needed to be modified. The existing plan already satisfies constraints.
              </div>
            ) : (
              <div className="border border-[#dddddd] rounded-xl overflow-hidden max-h-[45vh] overflow-y-auto shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8fafc] text-[#41454d] font-medium border-b border-[#dddddd] sticky top-0 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Employee ID</th>
                      <th className="p-3 text-center">Before</th>
                      <th className="p-3 text-center">→</th>
                      <th className="p-3 text-center">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dddddd]">
                    {entries.map((e, idx) => (
                      <tr key={idx} className="hover:bg-[#f8fafc] transition-colors">
                        <td className="p-3 font-mono text-xs text-[#181d26]">{e.date}</td>
                        <td className="p-3 font-mono text-xs text-[#41454d]">{e.employee_id.slice(0, 8)}...</td>
                        <td className="p-3 text-center font-medium text-[#41454d]">{e.before || '—'}</td>
                        <td className="p-3 text-center text-[#9297a0]">→</td>
                        <td className="p-3 text-center font-bold text-[#181d26]">{e.after || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions - Airtable Button Pair */}
        <div className="p-4 border-t border-[#dddddd] bg-[#f8fafc] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-[#dddddd] text-[#181d26] text-xs font-medium rounded-xl hover:bg-white transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={isLoading}
            className="px-4 py-2 bg-[#181d26] text-white text-xs font-medium rounded-xl hover:bg-[#0d1218] active:bg-[#000000] disabled:opacity-50 transition-colors shadow-xs"
          >
            {isLoading ? 'Saving...' : 'Accept & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
