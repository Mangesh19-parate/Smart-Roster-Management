/**
 * TopBar - Airtable Inspired Enterprise Application Header
 * Month navigation, Roster Status, Quick Solve Actions, Export, and User Profile.
 */
import { useState, useRef, useEffect } from 'react';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Play,
  RefreshCw,
  Download,
  LogOut,
  CheckCircle2,
  Menu,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface TopBarProps {
  month: string;
  onMonthChange: (month: string) => void;
  rosterStatus: string;
  onGenerate?: () => void;
  onRegenerateMinimal?: () => void;
  onRegenerateFull?: () => void;
  onExport?: (formatType: 'csv' | 'xlsx') => void;
  onOpenApprovals?: () => void;
  generating?: boolean;
  serverWaking?: boolean;
  disabled?: boolean;
  userRole?: string;
  onToggleSidebar?: () => void;
}

const STATUS_CONFIGS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  DRAFT: { bg: 'bg-[#f1f5f9]', text: 'text-[#41454d]', border: 'border-[#dddddd]', label: 'Draft' },
  IN_REVIEW: { bg: 'bg-[#fff8e1]', text: 'text-[#b45309]', border: 'border-[#fde68a]', label: 'In Review' },
  PUBLISHED: { bg: 'bg-[#e8f5e9]', text: 'text-[#1b5e20]', border: 'border-[#c8e6c9]', label: 'Published' },
};

export function TopBar({
  month,
  onMonthChange,
  rosterStatus = 'DRAFT',
  onGenerate,
  onRegenerateMinimal,
  onRegenerateFull,
  onExport,
  onOpenApprovals,
  generating = false,
  serverWaking = false,
  disabled = false,
  userRole = 'EMPLOYEE',
  onToggleSidebar,
}: TopBarProps) {
  const { user, signOut } = useAuth();
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target as Node)) {
        setMonthPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentDate = parseISO(`${month}-01`);
  const prevMonth = format(subMonths(currentDate, 1), 'yyyy-MM');
  const nextMonth = format(addMonths(currentDate, 1), 'yyyy-MM');

  const statusStyle = STATUS_CONFIGS[rosterStatus] ?? STATUS_CONFIGS.DRAFT!;
  const canManage = userRole === 'MANAGER';
  const isPodLead = userRole === 'POD_LEAD';

  return (
    <header className="h-14 bg-white border-b border-[#dddddd] px-4 flex items-center justify-between shrink-0 z-20">
      {/* Left: Mobile Sidebar Toggle + Month Switcher */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 text-[#41454d] hover:text-[#181d26] hover:bg-[#f8fafc] rounded-xl transition-colors"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Month Navigator - Airtable clean button pill */}
        <div className="flex items-center gap-1 bg-[#f8fafc] border border-[#dddddd] rounded-xl p-0.5" ref={monthPickerRef}>
          <button
            type="button"
            onClick={() => onMonthChange(prevMonth)}
            className="p-1 rounded-lg text-[#41454d] hover:text-[#181d26] hover:bg-white transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setMonthPickerOpen(!monthPickerOpen)}
            className="px-2.5 py-1 text-xs font-medium text-[#181d26] hover:bg-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-[#41454d]" />
            <span>{format(currentDate, 'MMMM yyyy')}</span>
            <ChevronDown className="w-3 h-3 text-[#9297a0]" />
          </button>

          <button
            type="button"
            onClick={() => onMonthChange(nextMonth)}
            className="p-1 rounded-lg text-[#41454d] hover:text-[#181d26] hover:bg-white transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Month Picker Dropdown */}
          {monthPickerOpen && (
            <div className="absolute top-12 left-4 mt-1 bg-white border border-[#dddddd] rounded-xl shadow-lg p-3 z-50 min-w-[210px]">
              <label className="block text-[11px] font-semibold text-[#41454d] uppercase tracking-wider mb-1.5">
                Select Month
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => {
                  if (e.target.value) {
                    onMonthChange(e.target.value);
                    setMonthPickerOpen(false);
                  }
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-[#dddddd] rounded-lg focus:outline-none focus:border-[#181d26]"
              />
            </div>
          )}
        </div>

        {/* Status Pill Badge */}
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
        >
          {statusStyle.label}
        </span>
      </div>

      {/* Center: Server Waking Indicator */}
      {serverWaking && (
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-[#fff8e1] border border-[#fde68a] rounded-full text-xs text-[#b45309] animate-pulse">
          <span className="w-2 h-2 rounded-full bg-[#d9a441]" />
          <span>Waking up engine, this may take up to 45 seconds...</span>
        </div>
      )}

      {/* Right: Actions & User Profile */}
      <div className="flex items-center gap-2">
        {/* Approvals Review Shortcut */}
        {(canManage || isPodLead) && onOpenApprovals && (
          <button
            type="button"
            onClick={onOpenApprovals}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#181d26] bg-white border border-[#dddddd] rounded-xl hover:bg-[#f8fafc] hover:border-[#9297a0] transition-colors shadow-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#1b61c9]" />
            <span>Approvals</span>
          </button>
        )}

        {/* Regenerate Dropdown */}
        {canManage && onRegenerateMinimal && onRegenerateFull && (
          <div className="relative hidden sm:block">
            <button
              type="button"
              disabled={disabled || generating}
              onClick={() => setRegenOpen(!regenOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#181d26] bg-white border border-[#dddddd] rounded-xl hover:bg-[#f8fafc] hover:border-[#9297a0] transition-colors shadow-xs disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#41454d]" />
              <span>Regenerate</span>
              <ChevronDown className="w-3 h-3 text-[#9297a0]" />
            </button>
            {regenOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-[#dddddd] rounded-xl shadow-lg py-1.5 z-50">
                <button
                  type="button"
                  onClick={() => {
                    onRegenerateMinimal();
                    setRegenOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-[#181d26] hover:bg-[#f8fafc] transition-colors"
                >
                  <div className="font-medium text-[#181d26]">Minimal Change Preview</div>
                  <div className="text-[11px] text-[#41454d] mt-0.5">Only shifts needed to fix gaps</div>
                </button>
                <div className="border-t border-[#dddddd] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    onRegenerateFull();
                    setRegenOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-[#aa2d00] hover:bg-[#fef2f2] transition-colors"
                >
                  <div className="font-medium text-[#aa2d00]">Full Solve</div>
                  <div className="text-[11px] text-[#41454d] mt-0.5">Recomputes entire month</div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Generate Primary Button - Airtable Near-Black CTA */}
        {canManage && onGenerate && (
          <button
            type="button"
            disabled={disabled || generating}
            onClick={onGenerate}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#181d26] hover:bg-[#0d1218] active:bg-[#000000] rounded-xl shadow-xs disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Solving...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Generate</span>
              </>
            )}
          </button>
        )}

        {/* Export Button */}
        {onExport && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen(!exportOpen)}
              className="p-1.5 text-[#41454d] hover:text-[#181d26] hover:bg-[#f8fafc] rounded-xl border border-[#dddddd] transition-colors"
              title="Export Roster"
            >
              <Download className="w-4 h-4" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white border border-[#dddddd] rounded-xl shadow-lg py-1.5 z-50">
                <button
                  type="button"
                  onClick={() => {
                    onExport('csv');
                    setExportOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-1.5 text-xs text-[#181d26] hover:bg-[#f8fafc] transition-colors font-medium"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExport('xlsx');
                    setExportOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-1.5 text-xs text-[#181d26] hover:bg-[#f8fafc] transition-colors font-medium"
                >
                  Export Excel (.xlsx)
                </button>
              </div>
            )}
          </div>
        )}

        {/* User Profile Popover */}
        <div className="relative ml-1" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-[#f8fafc] border border-transparent hover:border-[#dddddd] transition-colors"
            aria-label="User Profile"
          >
            <div className="w-7 h-7 rounded-full bg-[#181d26] text-white font-semibold text-xs flex items-center justify-center">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-1.5 w-60 bg-white border border-[#dddddd] rounded-xl shadow-lg py-2 z-50">
              <div className="px-3.5 py-2 border-b border-[#dddddd]">
                <p className="text-xs font-semibold text-[#181d26] truncate">{user?.email || 'Authenticated User'}</p>
                <span className="inline-block mt-1 px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-[#f8fafc] border border-[#dddddd] text-[#181d26] uppercase">
                  {userRole}
                </span>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full px-3.5 py-2 text-xs font-medium text-[#aa2d00] hover:bg-[#fef2f2] flex items-center gap-2 transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
