/**
 * Approvals Dialog - Pod approvals workflow and roster publish (Tier B / S13)
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalApi, configApi, rosterApi } from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface ApprovalsDialogProps {
  month: string;
  onClose: () => void;
  issues: any[];
}

export function ApprovalsDialog({ month, onClose, issues }: ApprovalsDialogProps) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userRole = session?.user?.app_metadata?.role || 'EMPLOYEE';
  const userPodId = session?.user?.app_metadata?.pod_id;
  const isManager = userRole === 'MANAGER';
  const isPodLead = userRole === 'POD_LEAD';

  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [activeCommentPod, setActiveCommentPod] = useState<string | null>(null);

  // Queries
  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ['roster', month],
    queryFn: () => rosterApi.fetch(month),
  });

  const { data: pods } = useQuery({
    queryKey: ['pods'],
    queryFn: () => configApi.listPods(),
  });

  // Mutations
  const submitReviewMutation = useMutation({
    mutationFn: () => approvalApi.submitReview(month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', month] });
    },
    onError: (err: any) => alert(`Submit failed: ${err.message}`),
  });

  const decideMutation = useMutation({
    mutationFn: ({ podId, decision, comment }: { podId: string; decision: 'APPROVED' | 'CHANGES_REQUESTED'; comment?: string }) =>
      approvalApi.decide(month, podId, decision, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', month] });
      setActiveCommentPod(null);
    },
    onError: (err: any) => alert(`Action failed: ${err.message}`),
  });

  const publishMutation = useMutation({
    mutationFn: () => approvalApi.publish(month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', month] });
      onClose();
    },
    onError: (err: any) => alert(`Publish failed: ${err.message}`),
  });

  const rosterStatus = rosterData?.roster?.status || 'DRAFT';
  const approvals: any[] = rosterData?.approvals || [];
  const errorIssues = issues.filter((i: any) => i.severity === 'ERROR');

  // Check publish criteria
  const pendingApprovals = approvals.filter((a: any) => a.status === 'PENDING');
  const changesRequested = approvals.filter((a: any) => a.status === 'CHANGES_REQUESTED');
  const allPodsApproved = approvals.length > 0 && approvals.every((a: any) => a.status === 'APPROVED');
  const canPublish = isManager && rosterStatus === 'IN_REVIEW' && allPodsApproved && errorIssues.length === 0;

  const getPublishDisabledReason = () => {
    if (rosterStatus !== 'IN_REVIEW') return `Roster is in ${rosterStatus} status.`;
    if (errorIssues.length > 0) return `${errorIssues.length} ERROR issues remain.`;
    if (approvals.length === 0) return 'No pod approvals initialized.';
    if (changesRequested.length > 0) return `${changesRequested.length} pod(s) requested changes.`;
    if (pendingApprovals.length > 0) return `${pendingApprovals.length} pod(s) still pending approval.`;
    return null;
  };

  const publishDisabledReason = getPublishDisabledReason();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">Approved</span>;
      case 'CHANGES_REQUESTED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">Changes Requested</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Pending</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg text-slate-900">Roster Approvals — {month}</h3>
            <p className="text-sm text-slate-500">Status: <span className="font-medium text-slate-700">{rosterStatus}</span></p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {rosterLoading ? (
            <div className="text-center py-8 text-slate-500">Loading approvals...</div>
          ) : (
            <>
              {/* Manager Actions Bar */}
              {isManager && rosterStatus === 'DRAFT' && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-indigo-900">Submit Roster for Review</h4>
                    <p className="text-xs text-indigo-700">Submitting creates pending sign-off items for all pod leads.</p>
                  </div>
                  <button
                    onClick={() => submitReviewMutation.mutate()}
                    disabled={submitReviewMutation.isPending || errorIssues.length > 0}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {errorIssues.length > 0 ? `Errors Exist (${errorIssues.length})` : 'Submit for Review'}
                  </button>
                </div>
              )}

              {/* Pods list */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Pod Sign-offs</h4>
                {pods && pods.length > 0 ? (
                  pods.map((pod: any) => {
                    const approval = approvals.find((a: any) => a.pod_id === pod.id);
                    const canDecide = (isManager || (isPodLead && userPodId === pod.id)) && rosterStatus === 'IN_REVIEW';

                    return (
                      <div key={pod.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-slate-900">{pod.name}</span>
                            {approval?.decided_at && (
                              <span className="text-xs text-slate-500 ml-2">
                                (Decided {new Date(approval.decided_at).toLocaleDateString()})
                              </span>
                            )}
                          </div>
                          <div>{getStatusBadge(approval?.status || 'PENDING')}</div>
                        </div>

                        {approval?.comment && (
                          <p className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200">
                            <strong>Note:</strong> {approval.comment}
                          </p>
                        )}

                        {canDecide && (
                          <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                            <button
                              onClick={() => decideMutation.mutate({ podId: pod.id, decision: 'APPROVED' })}
                              disabled={decideMutation.isPending}
                              className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-300 rounded hover:bg-emerald-100"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setActiveCommentPod(activeCommentPod === pod.id ? null : pod.id)}
                              className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-300 rounded hover:bg-red-100"
                            >
                              Request Changes
                            </button>
                          </div>
                        )}

                        {activeCommentPod === pod.id && (
                          <div className="pt-2 flex gap-2">
                            <input
                              type="text"
                              placeholder="Reason for requesting changes..."
                              value={commentInput[pod.id] || ''}
                              onChange={(e) => setCommentInput({ ...commentInput, [pod.id]: e.target.value })}
                              className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                              onClick={() => {
                                const comment = commentInput[pod.id];
                                if (!comment) return alert('Comment is required for requesting changes.');
                                decideMutation.mutate({ podId: pod.id, decision: 'CHANGES_REQUESTED', comment });
                              }}
                              disabled={decideMutation.isPending}
                              className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              Submit
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-slate-500">No pods configured.</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            {publishDisabledReason && (
              <span className="text-xs text-amber-700">
                Publish disabled: {publishDisabledReason}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-md">
              Close
            </button>
            {isManager && (
              <button
                onClick={() => publishMutation.mutate()}
                disabled={!canPublish || publishMutation.isPending}
                className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Publish Roster
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
