/**
 * Sidebar - Airtable Inspired Primary Application Navigation Shell
 * Supports collapsible rail, role-based visibility, and clean active states.
 */
import {
  LayoutDashboard,
  Calendar,
  Users,
  Briefcase,
  Layers,
  CalendarOff,
  Sliders,
  FileBarChart,
  Settings,
  PanelLeftClose,
  PanelLeft,
  CalendarCheck2,
} from 'lucide-react';

export type NavItemKey =
  | 'overview'
  | 'roster'
  | 'employees'
  | 'brands'
  | 'pods'
  | 'leaves'
  | 'rules'
  | 'reports'
  | 'settings';

interface SidebarProps {
  activeNav: NavItemKey;
  onNavChange: (nav: NavItemKey) => void;
  userRole: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  openIssuesCount?: number;
  pendingLeavesCount?: number;
}

interface NavItemDef {
  key: NavItemKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[]; // Allowed roles: MANAGER, POD_LEAD, EMPLOYEE
}

const NAV_ITEMS: NavItemDef[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['MANAGER', 'POD_LEAD', 'EMPLOYEE'] },
  { key: 'roster', label: 'Roster', icon: Calendar, roles: ['MANAGER', 'POD_LEAD', 'EMPLOYEE'] },
  { key: 'employees', label: 'Employees', icon: Users, roles: ['MANAGER'] },
  { key: 'brands', label: 'Brands & Processes', icon: Briefcase, roles: ['MANAGER'] },
  { key: 'pods', label: 'Pods', icon: Layers, roles: ['MANAGER', 'POD_LEAD'] },
  { key: 'leaves', label: 'Leave Management', icon: CalendarOff, roles: ['MANAGER', 'POD_LEAD', 'EMPLOYEE'] },
  { key: 'rules', label: 'Working Rules', icon: Sliders, roles: ['MANAGER'] },
  { key: 'reports', label: 'Reports', icon: FileBarChart, roles: ['MANAGER', 'POD_LEAD'] },
  { key: 'settings', label: 'Settings', icon: Settings, roles: ['MANAGER'] },
];

export function Sidebar({
  activeNav,
  onNavChange,
  userRole = 'EMPLOYEE',
  isCollapsed = false,
  onToggleCollapse,
  openIssuesCount = 0,
  pendingLeavesCount = 0,
}: SidebarProps) {
  // Filter by user role
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  return (
    <aside
      className={`bg-white border-r border-[#dddddd] flex flex-col shrink-0 transition-all duration-200 z-30 select-none ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 border-b border-[#dddddd] flex items-center px-4 gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#181d26] flex items-center justify-center text-white shrink-0 shadow-xs">
          <CalendarCheck2 className="w-4 h-4 text-white" />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col truncate">
            <span className="font-semibold text-sm text-[#181d26] tracking-tight leading-none">Smart Roster</span>
            <span className="text-[10px] text-[#41454d] font-medium tracking-wide uppercase mt-1 leading-none">
              Airtable Ops
            </span>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavChange(item.key)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl transition-all relative ${
                isActive
                  ? 'bg-[#181d26] text-white font-medium shadow-xs'
                  : 'text-[#41454d] hover:text-[#181d26] hover:bg-[#f8fafc]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#41454d]'}`} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}

              {/* Badges */}
              {!isCollapsed && item.key === 'roster' && openIssuesCount > 0 && (
                <span
                  className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-[#aa2d00] text-white' : 'bg-[#fef2f2] text-[#aa2d00] border border-[#fecaca]'
                  }`}
                >
                  {openIssuesCount}
                </span>
              )}

              {!isCollapsed && item.key === 'leaves' && pendingLeavesCount > 0 && (
                <span
                  className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-[#d9a441] text-white' : 'bg-[#fff8e1] text-[#b45309] border border-[#fde68a]'
                  }`}
                >
                  {pendingLeavesCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Collapse Toggle */}
      {onToggleCollapse && (
        <div className="p-2 border-t border-[#dddddd]">
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-full flex items-center justify-center p-2 rounded-xl text-[#41454d] hover:text-[#181d26] hover:bg-[#f8fafc] transition-colors"
          >
            {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      )}
    </aside>
  );
}
