/**
 * Approvals Dialog - Airtable Inspired Pod Approvals Workflow and Roster Publish (Tier B / S13)
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalApi, configApi, rosterApi } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { CheckCircle2, AlertTriangle, Clock, X } from 'lucide-react';

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
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-[#e8f5e9] text-[#1b5e20] border border-[#c8e6c9]">
            <CheckCircle2 className="w-3 h-3 text-[#1b5e20]" />
            <span>Approved</span>
          </span>
        );
      case 'CHANGES_REQUESTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-[#fef2f2] text-[#aa2d00] border border-[#fecaca]">
            <AlertTriangle className="w-3 h-3 text-[#aa2d00]" />
            <span>Changes Requested</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-[#fff8e1] text-[#b45309] border border-[#fde68a]">
            <Clock className="w-3 h-3 text-[#b45309]" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181d26]/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-[#dddddd] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#dddddd] bg-[#f8fafc] flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base text-[#181d26]">Roster Approvals — {month}</h3>
            <p className="text-xs text-[#41454d] mt-0.5">Status: <span className="font-semibold text-[#181d26]">{rosterStatus}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#9297a0] hover:text-[#181d26] rounded-xl hover:bg-white border border-transparent hover:border-[#dddddd] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {rosterLoading ? (
            <div className="text-center py-12 text-[#9297a0] text-xs">Loading approvals...</div>
          ) : (
            <>
              {/* Manager Actions Bar */}
              {isManager && rosterStatus === 'DRAFT' && (
                <div className="p-4 bg-[#f8fafc] border border-[#dddddd] rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-sm text-[#181d26]">Submit Roster for Review</h4>
                    <p className="text-xs text-[#41454d] mt-0.5">Submitting creates pending sign-off items for all pod leads.</p>
                  </div>
                  <button
                    onClick={() => submitReviewMutation.mutate()}
                    disabled={submitReviewMutation.isPending || errorIssues.length > 0}
                    className="px-4 py-2 bg-[#181d26] text-white text-xs font-medium rounded-xl hover:bg-[#0d1218] active:bg-[#000000] disabled:opacity-50 transition-colors shadow-xs shrink-0"
                  >
                    {errorIssues.length > 0 ? `Errors Exist (${errorIssues.length})` : 'Submit for Review'}
                  </button>
                </div>
              )}

              {/* Pods list */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[#181d26] uppercase tracking-wider">Pod Sign-offs</h4>
                {pods && pods.length > 0 ? (
                  pods.map((pod: any) => {
                    const approval = approvals.find((a: any) => a.pod_id === pod.id);
                    const canDecide = (isManager || (isPodLead && userPodId === pod.id)) && rosterStatus === 'IN_REVIEW';

                    return (
                      <div key={pod.id} className="p-4 border border-[#dddddd] rounded-xl bg-white shadow-xs flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-sm text-[#181d26]">{pod.name}</span>
                            {approval?.decided_at && (
                              <span className="text-xs text-[#9297a0] ml-2">
                                (Decided {new Date(approval.decided_at).toLocaleDateString()})
                              </span>
                            )}
                          </div>
                          <div>{getStatusBadge(approval?.status || 'PENDING')}</div>
                        </div>

                        {approval?.comment && (
                          <p className="text-xs text-[#41454d] bg-[#f8fafc] p-2.5 rounded-lg border border-[#dddddd]">
                            <strong>Note:</strong> {approval.comment}
                          </p>
                        )}

                        {canDecide && (
                          <div className="pt-2.5 border-t border-[#dddddd] flex items-center gap-2">
                            <button
                              onClick={() => decideMutation.mutate({ podId: pod.id, decision: 'APPROVED' })}
                              disabled={decideMutation.isPending}
                              className="px-3 py-1.5 text-xs font-medium text-[#1b5e20] bg-[#e8f5e9] border border-[#c8e6c9] rounded-xl hover:bg-[#c8e6c9]/40 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setActiveCommentPod(activeCommentPod === pod.id ? null : pod.id)}
                              className="px-3 py-1.5 text-xs font-medium text-[#aa2d00] bg-[#fef2f2] border border-[#fecaca] rounded-xl hover:bg-[#fecaca]/40 transition-colors"
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
                              className="flex-1 px-3 py-1.5 text-xs border border-[#dddddd] rounded-xl focus:border-[#181d26] focus:outline-none text-[#181d26]"
                            />
                            <button
                              onClick={() => {
                                const comment = commentInput[pod.id];
                                if (!comment) return alert('Comment is required for requesting changes.');
                                decideMutation.mutate({ podId: pod.id, decision: 'CHANGES_REQUESTED', comment });
                              }}
                              disabled={decideMutation.isPending}
                              className="px-3.5 py-1.5 bg-[#aa2d00] text-white text-xs font-medium rounded-xl hover:bg-[#882400] disabled:opacity-50 transition-colors shadow-xs"
                            >
                              Submit
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-[#9297a0]">No pods configured.</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer - Airtable Button Pair */}
        <div className="p-4 border-t border-[#dddddd] bg-[#f8fafc] flex items-center justify-between">
          <div>
            {publishDisabledReason && (
              <span className="text-xs text-[#b45309]">
                Publish disabled: {publishDisabledReason}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3.5 py-2 text-xs font-medium text-[#181d26] bg-white border border-[#dddddd] rounded-xl hover:bg-[#f8fafc] transition-colors">
              Close
            </button>
            {isManager && (
              <button
                onClick={() => publishMutation.mutate()}
                disabled={!canPublish || publishMutation.isPending}
                className="px-4 py-2 bg-[#006400] text-white text-xs font-medium rounded-xl hover:bg-[#005000] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
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
