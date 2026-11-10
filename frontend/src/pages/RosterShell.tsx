/**
 * RosterShell - Production-Quality Enterprise Application Shell
 * Redesigned navigation architecture, high-density roster command center, and integrated workflows.
 */
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { rosterApi, changesApi, configApi, leavesApi } from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

import { Sidebar, type NavItemKey } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { RosterHeader } from '../components/RosterHeader';
import { RosterSummary } from '../components/RosterSummary';
import { FilterToolbar, type ViewMode } from '../components/FilterToolbar';
import { RosterGrid } from '../components/RosterGrid';
import { CoverageStrip } from '../components/CoverageStrip';
import { IssuesPanel } from '../components/IssuesPanel';
import { SuggestionsDrawer } from '../components/SuggestionsDrawer';
import { EmployeeAgenda } from '../components/EmployeeAgenda';
import { Overview } from './Overview';
import { Config } from './Config';
import { LeaveManagementView } from '../components/LeaveManagementView';
import { ReportsView } from '../components/ReportsView';
import { RegeneratePreviewModal } from '../components/RegeneratePreviewModal';
import { LeaveDialog } from '../components/LeaveDialog';
import { ApprovalsDialog } from '../components/ApprovalsDialog';
import { useDebounce } from '../hooks/useDebounce';

export function RosterShell() {
  const { session, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const userRole = session?.user?.app_metadata?.role || 'EMPLOYEE';

  // Navigation State
  const [activeNav, setActiveNav] = useState<NavItemKey>(() => {
    const nav = searchParams.get('nav') as NavItemKey;
    return nav || 'roster';
  });

  // Roster Parameters
  const [month, setMonth] = useState(() => {
    const param = searchParams.get('month');
    return param || format(new Date(), 'yyyy-MM');
  });

  const [view, setView] = useState<ViewMode>(() => (searchParams.get('view') as ViewMode) || 'company');
  const [viewId, setViewId] = useState<string | null>(() => searchParams.get('id'));

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // UI Drawer / Panel states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [issuesPanelOpen, setIssuesPanelOpen] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [suggestionsDrawerOpen, setSuggestionsDrawerOpen] = useState(false);

  // Dialog & Modal states
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [showRegeneratePreview, setShowRegeneratePreview] = useState(false);
  const [regenerateDiff, setRegenerateDiff] = useState<any | null>(null);

  // Progress Indicators
  const [generating, setGenerating] = useState(false);
  const [serverWaking, setServerWaking] = useState(false);

  // Sync state with URL query parameters
  useEffect(() => {
    const params: Record<string, string> = { nav: activeNav, month, view };
    if (viewId) params.id = viewId;
    setSearchParams(params, { replace: true });
  }, [activeNav, month, view, viewId, setSearchParams]);

  // Fetch Roster Data
  const {
    data: rosterData,
    isLoading: rosterLoading,
    error: rosterError,
    refetch: refetchRoster,
  } = useQuery({
    queryKey: ['roster', month, view, viewId],
    queryFn: () => rosterApi.fetch(month, view, viewId || undefined),
    enabled: !!month && !authLoading,
    staleTime: 30_000,
  });

  // Fetch Issues
  const {
    data: issuesData,
    isLoading: issuesLoading,
    error: issuesError,
    refetch: refetchIssues,
  } = useQuery({
    queryKey: ['issues', month],
    queryFn: () => rosterApi.listIssues(month),
    enabled: !!month && !authLoading,
    staleTime: 30_000,
  });

  const issues = issuesData || [];

  // Fetch Supporting Entities for Filters
  const { data: pods = [] } = useQuery({
    queryKey: ['pods'],
    queryFn: () => configApi.listPods(),
    staleTime: 60_000,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: () => configApi.listBrands(),
    staleTime: 60_000,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ['processes'],
    queryFn: () => configApi.listProcesses(),
    staleTime: 60_000,
  });

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ['leaves', month],
    queryFn: () => leavesApi.list({ month }),
    staleTime: 60_000,
  });

  // Employees list for contextual selector
  const employeesList = useMemo(() => {
    if (Array.isArray(rosterData?.employees) && rosterData.employees.length > 0) {
      return rosterData.employees;
    }
    if (Array.isArray(rosterData?.entries)) {
      const map = new Map<string, any>();
      rosterData.entries.forEach((e: any) => {
        if (e.employee && !map.has(e.employee_id)) {
          map.set(e.employee_id, {
            id: e.employee_id,
            name: e.employee?.name || 'Unknown',
            pod: e.employee?.pod?.name || '',
          });
        }
      });
      return Array.from(map.values());
    }
    return [];
  }, [rosterData]);

  // Mutations
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

  const regenerateMutation = useMutation({
    mutationFn: (mode: 'MINIMAL_CHANGE' | 'FULL') => rosterApi.regenerate(month, { mode, save: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', month] });
      queryClient.invalidateQueries({ queryKey: ['issues', month] });
    },
    onError: (err: any) => alert(`Regenerate failed: ${err.message}`),
  });

  const regeneratePreviewMutation = useMutation({
    mutationFn: () => rosterApi.regenerate(month, { mode: 'MINIMAL_CHANGE', save: false }),
    onSuccess: (data: any) => {
      setRegenerateDiff(data);
      setShowRegeneratePreview(true);
    },
    onError: (err: any) => alert(`Regenerate preview failed: ${err.message}`),
  });

  const validateMutation = useMutation({
    mutationFn: () => rosterApi.validate(month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', month] });
    },
    onError: (err: any) => alert(`Validate failed: ${err.message}`),
  });

  const { debouncedCallback: debouncedValidate } = useDebounce(() => {
    validateMutation.mutate();
  }, 300);

  const editEntryMutation = useMutation({
    mutationFn: (data: { employee_id: string; date: string; status: string; locked?: boolean }) =>
      rosterApi.editEntry(month, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', month] });
      queryClient.invalidateQueries({ queryKey: ['issues', month] });
    },
    onError: (err: any) => alert(`Edit failed: ${err.message}`),
  });

  const handleCellEdit = (
    employeeId: string,
    date: string,
    status: string,
    locked?: boolean
  ) => {
    editEntryMutation.mutate({ employee_id: employeeId, date, status, locked });
    debouncedValidate();
  };

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

  const handleExport = async (formatType: 'csv' | 'xlsx') => {
    try {
      const blob = await rosterApi.export(month, formatType, view, viewId || undefined);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roster-${month}-${view}.${formatType}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleSuggestionClick = (issue: any) => {
    setSelectedIssue(issue);
    setSuggestionsDrawerOpen(true);
  };

  const handleJumpToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const colEl = document.getElementById(`col-${today}`);
    if (colEl) {
      colEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setView('company');
    setViewId(null);
    setStatusFilter('ALL');
  };

  const rosterStatus = rosterData?.roster?.status || 'DRAFT';
  const isPublished = rosterStatus === 'PUBLISHED';
  const isInReview = rosterStatus === 'IN_REVIEW';
  const canManage = userRole === 'MANAGER';

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Render Page Content based on activeNav
  const renderContent = () => {
    if (activeNav === 'overview') {
      return (
        <Overview
          rosterData={rosterData}
          issues={issues}
          month={month}
          onNavigateToRoster={() => setActiveNav('roster')}
          onOpenLeaveDialog={() => setShowLeaveDialog(true)}
          onRunValidation={() => validateMutation.mutate()}
        />
      );
    }

    if (activeNav === 'employees') {
      return <Config initialTab="employees" />;
    }

    if (activeNav === 'brands') {
      return <Config initialTab="brands" />;
    }

    if (activeNav === 'pods') {
      return <Config initialTab="pods" />;
    }

    if (activeNav === 'rules') {
      return <Config initialTab="holidays" />;
    }

    if (activeNav === 'settings') {
      return <Config initialTab="settings" />;
    }

    if (activeNav === 'leaves') {
      return (
        <LeaveManagementView
          month={month}
          onOpenAddLeave={() => setShowLeaveDialog(true)}
          userRole={userRole}
        />
      );
    }

    if (activeNav === 'reports') {
      return <ReportsView month={month} />;
    }

    // Default: 'roster' (Primary Monthly Operations Grid)
    return (
      <div className="flex flex-col gap-3.5 h-full">
        {/* Roster Header */}
        <RosterHeader
          month={month}
          rosterStatus={rosterStatus}
          lastUpdated={rosterData?.roster?.updated_at ? format(new Date(rosterData.roster.updated_at), 'MMM d, h:mm a') : null}
          onGenerate={() => generateMutation.mutate()}
          onRegenerateMinimal={() => regeneratePreviewMutation.mutate()}
          onRegenerateFull={() => regenerateMutation.mutate('FULL')}
          onExport={handleExport}
          generating={generating}
          disabled={isPublished || isInReview}
          canManage={canManage}
        />

        {/* Operational Summary Metrics */}
        <RosterSummary rosterData={rosterData} issues={issues} month={month} />

        {/* Filter Toolbar */}
        <FilterToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          view={view}
          onViewChange={setView}
          viewId={viewId}
          onViewIdChange={setViewId}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          pods={pods}
          brands={brands}
          processes={processes}
          employees={employeesList}
          onJumpToday={handleJumpToday}
          onResetFilters={handleResetFilters}
        />

        {/* Main Grid or Agenda View */}
        {rosterLoading ? (
          <div className="flex-1 flex items-center justify-center py-20 bg-white rounded-xl border border-[#dddddd]">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-3 border-[#181d26] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-600">Loading schedule matrix...</p>
            </div>
          </div>
        ) : rosterError ? (
          <div className="py-16 text-center bg-white rounded-xl border border-red-200 p-6 space-y-3">
            <p className="text-xs font-bold text-red-700">Failed to load roster: {rosterError.message}</p>
            <button
              onClick={() => refetchRoster()}
              className="px-3.5 py-1.5 text-xs font-semibold bg-[#181d26] text-white rounded-lg hover:bg-black shadow-xs transition-colors"
            >
              Retry Connection
            </button>
          </div>
        ) : !rosterData ? (
          <div className="py-20 text-center bg-white rounded-xl border border-[#dddddd] p-8 space-y-3">
            <p className="text-sm font-semibold text-[#181d26]">No roster generated for {month}</p>
            <p className="text-xs text-slate-500">Generate a new optimized schedule using the CP-SAT engine.</p>
            {canManage && (
              <button
                onClick={() => generateMutation.mutate()}
                disabled={generating}
                className="px-4 py-2 text-xs font-semibold bg-[#181d26] text-white rounded-lg hover:bg-black shadow-xs disabled:opacity-50 transition-colors"
              >
                Generate Monthly Roster
              </button>
            )}
          </div>
        ) : view === 'employee' ? (
          <div className="flex-1 overflow-auto bg-white rounded-xl border border-[#dddddd] p-4">
            <EmployeeAgenda
              rosterData={rosterData}
              month={month}
              employeeId={viewId || ''}
              onCellEdit={handleCellEdit}
              issues={issues}
              selectedIssue={selectedIssue}
              onIssueClick={handleSuggestionClick}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <RosterGrid
                rosterData={rosterData}
                month={month}
                view={view}
                viewId={viewId}
                issues={issues}
                selectedIssue={selectedIssue}
                onCellEdit={handleCellEdit}
                onIssueClick={handleSuggestionClick}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                isSavingEdit={editEntryMutation.isPending}
              />
            </div>

            {/* Coverage Strip */}
            <div className="shrink-0 bg-white rounded-xl border border-[#dddddd] p-2.5 shadow-xs">
              <CoverageStrip
                coverage={rosterData.coverage}
                demand={rosterData.demand}
                month={month}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-[#181d26] antialiased">
      {/* Top Bar Header */}
      <TopBar
        month={month}
        onMonthChange={setMonth}
        rosterStatus={rosterStatus}
        onGenerate={() => generateMutation.mutate()}
        onRegenerateMinimal={() => regeneratePreviewMutation.mutate()}
        onRegenerateFull={() => regenerateMutation.mutate('FULL')}
        onExport={handleExport}
        onOpenApprovals={() => setShowApprovals(true)}
        generating={generating}
        serverWaking={serverWaking}
        disabled={isPublished || isInReview}
        userRole={userRole}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Workspace with Left Sidebar & Right Health Drawer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeNav={activeNav}
          onNavChange={setActiveNav}
          userRole={userRole}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          openIssuesCount={issues.length}
          pendingLeavesCount={pendingLeaves.length}
        />

        {/* Center Application Canvas */}
        <main className="flex-1 overflow-y-auto p-4 md:p-5 flex flex-col">
          {renderContent()}
        </main>

        {/* Right Collapsible "Scheduling Health" Drawer (Only visible on Roster view) */}
        {activeNav === 'roster' && issuesPanelOpen && (
          <div className="hidden xl:flex h-full">
            <IssuesPanel
              issues={issues}
              month={month}
              selectedIssue={selectedIssue}
              onIssueClick={handleSuggestionClick}
              onClose={() => setIssuesPanelOpen(false)}
              isLoading={issuesLoading}
              error={issuesError || rosterError}
              onRetry={() => {
                refetchIssues();
                refetchRoster();
              }}
            />
          </div>
        )}

        {/* Toggle Pill when Scheduling Health Drawer is closed */}
        {activeNav === 'roster' && !issuesPanelOpen && (
          <div className="hidden xl:block fixed right-4 bottom-6 z-30">
            <button
              type="button"
              onClick={() => setIssuesPanelOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#181d26] bg-white border border-[#dddddd] rounded-full shadow-sm hover:bg-[#f1f5f9] transition-all hover:scale-105"
            >
              {issues.length > 0 ? (
                <ShieldAlert className="w-4 h-4 text-red-600" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-[#0a2e0e]" />
              )}
              <span>Health ({issues.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Modals & Dialogs */}
      {/* Suggestions Drawer */}
      <SuggestionsDrawer
        isOpen={suggestionsDrawerOpen}
        onClose={() => {
          setSuggestionsDrawerOpen(false);
          setSelectedIssue(null);
        }}
        issue={selectedIssue}
        month={month}
        onApply={(suggestionId) => applySuggestionMutation.mutate(suggestionId)}
        loading={applySuggestionMutation.isPending}
      />

      {/* Regenerate Preview Modal */}
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

      {/* Leave Request Dialog */}
      {showLeaveDialog && (
        <LeaveDialog
          month={month}
          onClose={() => setShowLeaveDialog(false)}
          employees={employeesList}
        />
      )}

      {/* Pod Approvals & Publish Dialog */}
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
