/**
 * Regenerate Preview Modal (S11, T45)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Regenerate Preview (Minimal Change)</h2>
            <p className="text-sm text-slate-500">Review schedule impact for {month} before accepting.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left Summary */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200 h-fit">
            <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Entries changed:</span>
                <span className="font-semibold text-slate-900">{entries.length}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Issues Before:</span>
                <span className="font-medium text-rose-600">{issuesBefore}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Issues After:</span>
                <span className={`font-medium ${issuesAfter < issuesBefore ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {issuesAfter}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Solver Status:</span>
                <span className="font-medium text-slate-900">{stats?.status || 'FEASIBLE'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Solve Time:</span>
                <span className="font-medium text-slate-900">{stats?.solve_ms ? `${stats.solve_ms}ms` : '< 1s'}</span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-xs text-amber-800">
              Changes are held in memory. Nothing is written to the database until you click <strong>Accept</strong>.
            </div>
          </div>

          {/* Right Diff List */}
          <div className="md:col-span-2 space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">
              Changed Entries ({entries.length})
            </h3>
            {entries.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">
                No entries needed to be modified. The existing plan already satisfies constraints.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[45vh] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600 font-medium border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Employee ID</th>
                      <th className="p-2.5 text-center">Before</th>
                      <th className="p-2.5 text-center">→</th>
                      <th className="p-2.5 text-center">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {entries.map((e, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono text-xs text-slate-800">{e.date}</td>
                        <td className="p-2.5 font-mono text-xs text-slate-600">{e.employee_id.slice(0, 8)}...</td>
                        <td className="p-2.5 text-center font-semibold text-slate-700">{e.before || '—'}</td>
                        <td className="p-2.5 text-center text-slate-400">→</td>
                        <td className="p-2.5 text-center font-bold text-indigo-600">{e.after || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-white"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={isLoading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Accept & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

