/**
 * Roster Shell - Main layout with navigation, toolbar, and roster view
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { rosterApi, changesApi } from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TopBar } from '../components/TopBar';
import { LeftNav } from '../components/LeftNav';
import { RosterGrid } from '../components/RosterGrid';
import { CoverageStrip } from '../components/CoverageStrip';
import { IssuesPanel } from '../components/IssuesPanel';
import { SuggestionsDrawer } from '../components/SuggestionsDrawer';
import { EmployeeAgenda } from '../components/EmployeeAgenda';
import { useDebounce } from '../hooks/useDebounce';
import { format } from 'date-fns';
import { Config } from './Config';
import { StructuralReport } from './StructuralReport';
import { FairnessReport } from './FairnessReport';
import { RegeneratePreviewModal } from '../components/RegeneratePreviewModal';
import { LeaveDialog } from '../components/LeaveDialog';
import { ApprovalsDialog } from '../components/ApprovalsDialog';

type ViewMode = 'company' | 'pod' | 'brand' | 'process' | 'employee';

export function RosterShell() {
  const { session, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // State - initialized from URL
  const [month, setMonth] = useState(() => {
    const param = searchParams.get('month');
    return param || format(new Date(), 'yyyy-MM');
  });
  const [view, setView] = useState<ViewMode>(() => (searchParams.get('view') as ViewMode) || 'company');
  const [viewId, setViewId] = useState<string | null>(() => searchParams.get('id'));
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [suggestionsDrawerOpen, setSuggestionsDrawerOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [serverWaking, setServerWaking] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showStructuralReport, setShowStructuralReport] = useState(false);
  const [showFairnessReport, setShowFairnessReport] = useState(false);
  const [showRegeneratePreview, setShowRegeneratePreview] = useState(false);
  const [regenerateDiff, setRegenerateDiff] = useState<any | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);

  // Sync URL with state
  useEffect(() => {
    setSearchParams({ month, view, ...(viewId ? { id: viewId } : {}) }, { replace: true });
  }, [month, view, viewId, setSearchParams]);

  // Fetch roster data
  const { data: rosterData, isLoading: rosterLoading, error: rosterError, refetch: refetchRoster } = useQuery({
    queryKey: ['roster', month, view, viewId],
    queryFn: () => rosterApi.fetch(month, view, viewId || undefined),
    enabled: !!month && !authLoading,
    staleTime: 30_000,
  });

  // Fetch issues - derived from query, no local state needed
  const { data: issuesData } = useQuery({
    queryKey: ['issues', month],
    queryFn: () => rosterApi.listIssues(month),
    enabled: !!month && !authLoading,
    staleTime: 30_000,
  });

  // Use issues from query data directly
  const issues = issuesData || [];

  // Generate roster mutation
  const generateMutation = useMutation({
    mutationFn: () => rosterApi.generate(month, { keep_locked: true }),
    onMutate: () => setGenerating(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', month] });
      queryClient.invalidateQueries({ queryKey: ['issues', month] });
    },
    onError: (err: any) => {
      if (err.message?.includes('waking') || err.message?.includes('cold start')) {
        setServerWaking(true);
        setTimeout(() => setServerWaking(false), 60000);
      }
      alert(`Generate failed: ${err.message}`);
    },
    onSettled: () => setGenerating(false),
  });

  // Regenerate mutation
  const regenerateMutation = useMutation({
    mutationFn: (mode: 'MINIMAL_CHANGE' | 'FULL') => rosterApi.regenerate(month, { mode, save: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', month] });
      queryClient.invalidateQueries({ queryKey: ['issues', month] });
    },
    onError: (err: any) => alert(`Regenerate failed: ${err.message}`),
  });

  // Validate mutation
  const validateMutation = useMutation({
    mutationFn: () => rosterApi.validate(month),
    onMutate: () => setValidating(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', month] });
    },
    onError: (err: any) => alert(`Validate failed: ${err.message}`),
    onSettled: () => setValidating(false),
  });

  // Entry edit mutation
  const editEntryMutation = useMutation({
    mutationFn: (data: { employee_id: string; date: string; status: string; locked?: boolean }) =>
      rosterApi.editEntry(month, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', month] });
      queryClient.invalidateQueries({ queryKey: ['issues', month] });
    },
    onError: (err: any) => alert(`Edit failed: ${err.message}`),
  });

  // Debounced validation
  const { debouncedCallback: debouncedValidate } = useDebounce(() => {
    validateMutation.mutate();
  }, 250);

  // Handle cell edit
  const handleCellEdit = (employeeId: string, date: string, status: string) => {
    editEntryMutation.mutate({ employee_id: employeeId, date, status });
    debouncedValidate();
  };

  // Handle suggestion click
  const handleSuggestionClick = (issue: any) => {
    setSelectedIssue(issue);
    setSuggestionsDrawerOpen(true);
  };

  // Handle apply suggestion
  const applySuggestionMutation = useMutation({
    mutationFn: (suggestionId: string) => changesApi.applySuggestion(month, suggestionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', month] });
      queryClient.invalidateQueries({ queryKey: ['issues', month] });
      setSuggestionsDrawerOpen(false);
      setSelectedIssue(null);
    },
    onError: (err: any) => alert(`Apply failed: ${err.message}`),
  });

  // Regenerate preview mutation (S11)
  const regeneratePreviewMutation = useMutation({
    mutationFn: () => rosterApi.regenerate(month, { mode: 'MINIMAL_CHANGE', save: false }),
    onSuccess: (data: any) => {
      setRegenerateDiff(data);
      setShowRegeneratePreview(true);
    },
    onError: (err: any) => alert(`Regenerate preview failed: ${err.message}`),
  });

  // Toolbar actions
  const handleGenerate = () => generateMutation.mutate();
  const handleRegenerateMinimal = () => regeneratePreviewMutation.mutate();
  const handleRegenerateFull = () => regenerateMutation.mutate('FULL');
  const handleValidate = () => validateMutation.mutate();

  // Dialog handlers
  const handleOpenConfig = () => setShowConfig(true);
  const handleOpenStructuralReport = () => setShowStructuralReport(true);
  const handleOpenFairnessReport = () => setShowFairnessReport(true);
  const handleOpenLeaveDialog = () => setShowLeaveDialog(true);
  const handleOpenApprovals = () => setShowApprovals(true);

  // Determine roster status
  const rosterStatus = rosterData?.roster?.status || 'DRAFT';
  const isPublished = rosterStatus === 'PUBLISHED';
  const isInReview = rosterStatus === 'IN_REVIEW';

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <TopBar
        month={month}
        onMonthChange={setMonth}
        view={view}
        onViewChange={setView}
        viewId={viewId}
        onViewIdChange={setViewId}
        rosterStatus={rosterStatus}
        onGenerate={handleGenerate}
        onRegenerateMinimal={handleRegenerateMinimal}
        onRegenerateFull={handleRegenerateFull}
        onValidate={handleValidate}
        generating={generating}
        validating={validating}
        serverWaking={serverWaking}
        disabled={isPublished || isInReview}
        userRole={session?.user?.app_metadata?.role || 'EMPLOYEE'}
        onOpenConfig={handleOpenConfig}
        onOpenStructuralReport={handleOpenStructuralReport}
        onOpenFairnessReport={handleOpenFairnessReport}
        onOpenLeaveDialog={handleOpenLeaveDialog}
        onOpenApprovals={handleOpenApprovals}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation (Desktop) */}
        <LeftNav
          view={view}
          onViewChange={setView}
          viewId={viewId}
          onViewIdChange={setViewId}
          userRole={session?.user?.app_metadata?.role || 'EMPLOYEE'}
          rosterData={rosterData}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {rosterLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
            </div>
          ) : rosterError ? (
            <div className="text-center py-12">
              <p className="text-red-600">Failed to load roster: {rosterError.message}</p>
              <button
                onClick={() => refetchRoster()}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Retry
              </button>
            </div>
          ) : !rosterData ? (
            <div className="text-center py-12">
              <p className="text-slate-600 mb-4">No roster for {month}.</p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                Generate Roster
              </button>
            </div>
          ) : view === 'employee' ? (
            <EmployeeAgenda
              rosterData={rosterData}
              month={month}
              employeeId={viewId || ''}
              onCellEdit={handleCellEdit}
              issues={issues}
              selectedIssue={selectedIssue}
              onIssueClick={handleSuggestionClick}
            />
          ) : (
            <div className="flex flex-col gap-4 h-full">
              {/* Roster Grid */}
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <RosterGrid
                  rosterData={rosterData}
                  month={month}
                  view={view}
                  viewId={viewId}
                  issues={issues}
                  selectedIssue={selectedIssue}
                  onCellEdit={handleCellEdit}
                  onIssueClick={handleSuggestionClick}
                />
              </div>

              {/* Coverage Strip */}
              <CoverageStrip
                coverage={rosterData.coverage}
                demand={rosterData.demand}
                month={month}
              />
            </div>
          )}

          {/* Issues Panel (Desktop) */}
          <IssuesPanel
            issues={issues}
            month={month}
            selectedIssue={selectedIssue}
            onIssueClick={handleSuggestionClick}
            onClose={() => setSelectedIssue(null)}
          />
        </main>
      </div>

      {/* Suggestions Drawer */}
      <SuggestionsDrawer
        isOpen={suggestionsDrawerOpen}
        onClose={() => setSuggestionsDrawerOpen(false)}
        issue={selectedIssue}
        month={month}
        onApply={applySuggestionMutation.mutate}
        loading={applySuggestionMutation.isPending}
      />

      {/* Mobile Issues Bottom Sheet */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg max-h-[60vh] overflow-auto">
        <IssuesPanel
          issues={issues}
          month={month}
          selectedIssue={selectedIssue}
          onIssueClick={handleSuggestionClick}
          onClose={() => setSelectedIssue(null)}
          mobile={true}
        />
      </div>

      {/* Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <Config onClose={() => setShowConfig(false)} />
          </div>
        </div>
      )}

      {/* Structural Report Modal */}
      {showStructuralReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <StructuralReport month={month} onClose={() => setShowStructuralReport(false)} />
          </div>
        </div>
      )}

      {/* Fairness Report Modal (S12, T44) */}
      {showFairnessReport && (
        <FairnessReport month={month} onClose={() => setShowFairnessReport(false)} />
      )}

      {/* Regenerate Preview Modal (S11, T45) */}
      <RegeneratePreviewModal
        month={month}
        isOpen={showRegeneratePreview}
        onClose={() => {
          setShowRegeneratePreview(false);
          setRegenerateDiff(null);
        }}
        onAccept={() => {
          regenerateMutation.mutate('MINIMAL_CHANGE');
          setShowRegeneratePreview(false);
        }}
        isLoading={regenerateMutation.isPending}
        diffData={regenerateDiff}
      />

      {/* Leave Dialog */}
      {showLeaveDialog && (
        <LeaveDialog
          month={month}
          onClose={() => setShowLeaveDialog(false)}
          employees={rosterData?.entries?.map((e: any) => e.employee).filter((e: any, i: number, arr: any[]) => arr.findIndex(x => x.id === e.id) === i) || []}
        />
      )}

      {/* Approvals Dialog */}
      {showApprovals && (
        <ApprovalsDialog
          month={month}
          onClose={() => setShowApprovals(false)}
          issues={issues}
        />
      )}
    </div>
  );
}