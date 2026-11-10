/**
 * Structural Report Page - Airtable Inspired Diagnostics View
 * Shows brands/processes that cannot satisfy their own rules
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
      case 'ERROR': return 'bg-[#fef2f2] text-[#aa2d00] border-[#fecaca]';
      case 'WARNING': return 'bg-[#fff8e1] text-[#b45309] border-[#fde68a]';
      default: return 'bg-[#f8fafc] text-[#41454d] border-[#dddddd]';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between pb-4 border-b border-[#dddddd]">
        <div>
          <h1 className="text-xl font-semibold text-[#181d26] tracking-tight">Structural Diagnostics</h1>
          <p className="text-xs text-[#41454d] mt-0.5">Month: {format(new Date(`${month}-01`), 'MMMM yyyy')}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 text-[#9297a0] hover:text-[#181d26] rounded-xl hover:bg-[#f8fafc] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto pt-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#181d26] border-t-transparent"></div>
          </div>
        ) : structuralIssues.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-[#e8f5e9] text-[#1b5e20] border border-[#c8e6c9] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-[#181d26] mb-1">No Structural Issues Detected</h3>
            <p className="text-xs text-[#41454d]">All brands and processes have sufficient headcount and backup coverage.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Airtable Cream Callout Card */}
            <div className="bg-[#f5e9d4] border border-[#dddddd] rounded-xl p-4 mb-4">
              <h3 className="font-semibold text-sm text-[#181d26] mb-1">What are Structural Issues?</h3>
              <p className="text-xs text-[#333840] leading-relaxed">
                Structural issues indicate fundamental configuration problems that cannot be resolved by scheduling alone.
                These require changes to team composition, assignments, or coverage requirements.
              </p>
            </div>

            {structuralIssues.map((issue: any) => (
              <div key={issue.id} className="bg-white border border-[#dddddd] rounded-xl overflow-hidden shadow-xs">
                <div className={`p-4 border-b border-[#dddddd] flex items-start justify-between ${getSeverityColor(issue.severity)}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${getSeverityColor(issue.severity)}`}>
                        {issue.severity}
                      </span>
                      <span className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-[#f8fafc] border border-[#dddddd] text-[#181d26]">
                        {issue.rule}
                      </span>
                      {issue.brand_id && (
                        <span className="px-2.5 py-0.5 text-[10px] font-medium rounded-full bg-white border border-[#dddddd] text-[#41454d]">
                          Brand: {issue.brand_id.slice(0, 8)}...
                        </span>
                      )}
                      {issue.process_id && (
                        <span className="px-2.5 py-0.5 text-[10px] font-medium rounded-full bg-white border border-[#dddddd] text-[#41454d]">
                          Process: {issue.process_id.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-[#181d26]">{issue.message}</p>
                    <p className="text-xs text-[#41454d] mt-1">{issue.cause}</p>
                  </div>
                </div>
                <div className="p-4 bg-[#f8fafc]">
                  <h4 className="font-semibold text-xs text-[#181d26] mb-1 uppercase tracking-wider">Recommended Action</h4>
                  <p className="text-xs text-[#333840]">{getRecommendation(issue)}</p>
                </div>
              </div>
            ))}

            <div className="mt-6 p-4 bg-[#f8fafc] border border-[#dddddd] rounded-xl">
              <h3 className="font-semibold text-xs text-[#181d26] uppercase tracking-wider mb-2">Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-[#41454d]">Total Structural Issues: </span>
                  <span className="font-semibold text-[#181d26]">{structuralIssues.length}</span>
                </div>
                <div>
                  <span className="text-[#41454d]">No Backup: </span>
                  <span className="font-semibold text-[#181d26]">{structuralIssues.filter(i => i.rule === 'STRUCT_NO_BACKUP').length}</span>
                </div>
                <div>
                  <span className="text-[#41454d]">Insufficient Headcount: </span>
                  <span className="font-semibold text-[#181d26]">{structuralIssues.filter(i => i.rule === 'STRUCT_HEADCOUNT').length}</span>
                </div>
                <div>
                  <span className="text-[#41454d]">Missing Assignments: </span>
                  <span className="font-semibold text-[#181d26]">{structuralIssues.filter(i => i.rule === 'ASSIGN_MISSING').length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
