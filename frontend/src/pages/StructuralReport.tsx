/**
 * Structural Report Page - Shows brands/processes that cannot satisfy their own rules
 */
import { useQuery } from '@tanstack/react-query';
import { rosterApi } from '../api/client';
import { format } from 'date-fns';

interface StructuralReportProps {
  month: string;
  onClose?: () => void;
}

export function StructuralReport({ month, onClose }: StructuralReportProps) {
  const { data: issues, isLoading } = useQuery({
    queryKey: ['structural', month],
    queryFn: () => rosterApi.structural(month),
    enabled: !!month,
  });

  const structuralIssues = issues?.filter((i: any) => i.structural) || [];

  const getRecommendation = (issue: any) => {
    switch (issue.rule) {
      case 'STRUCT_NO_BACKUP':
        return 'Assign a backup (FLOATER) to this process to cover rest days and leave.';
      case 'STRUCT_HEADCOUNT':
        return 'Increase headcount or reduce min_coverage for this process.';
      case 'ASSIGN_MISSING':
        return 'Assign at least one primary employee to this process.';
      default:
        return 'Review configuration for this process.';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'ERROR': return 'bg-red-100 text-red-700 border-red-200';
      case 'WARNING': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Structural Report</h1>
          <p className="text-sm text-slate-500">Month: {format(new Date(`${month}-01`), 'MMMM yyyy')}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : structuralIssues.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Structural Issues</h3>
            <p className="text-slate-500">All brands and processes have sufficient headcount and backup coverage.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <h3 className="font-medium text-amber-800 mb-2">What are Structural Issues?</h3>
              <p className="text-sm text-amber-700">
                Structural issues indicate fundamental configuration problems that cannot be resolved by scheduling alone.
                These require changes to team composition, assignments, or coverage requirements.
              </p>
            </div>

            {structuralIssues.map((issue: any) => (
              <div key={issue.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className={`p-4 border-b border-slate-200 flex items-start justify-between ${getSeverityColor(issue.severity)}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSeverityColor(issue.severity)}`}>
                        {issue.severity}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">
                        {issue.rule}
                      </span>
                      {issue.brand_id && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                          Brand: {issue.brand_id.slice(0, 8)}...
                        </span>
                      )}
                      {issue.process_id && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                          Process: {issue.process_id.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700">{issue.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{issue.cause}</p>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200">
                  <h4 className="font-medium text-slate-900 mb-2">Recommended Action</h4>
                  <p className="text-sm text-slate-700">{getRecommendation(issue)}</p>
                </div>
              </div>
            ))}

            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <h3 className="font-medium text-slate-900 mb-2">Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Total Structural Issues: </span>
                  <span className="font-semibold text-slate-900">{structuralIssues.length}</span>
                </div>
                <div>
                  <span className="text-slate-500">No Backup: </span>
                  <span className="font-semibold text-slate-900">{structuralIssues.filter(i => i.rule === 'STRUCT_NO_BACKUP').length}</span>
                </div>
                <div>
                  <span className="text-slate-500">Insufficient Headcount: </span>
                  <span className="font-semibold text-slate-900">{structuralIssues.filter(i => i.rule === 'STRUCT_HEADCOUNT').length}</span>
                </div>
                <div>
                  <span className="text-slate-500">Missing Assignments: </span>
                  <span className="font-semibold text-slate-900">{structuralIssues.filter(i => i.rule === 'ASSIGN_MISSING').length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}