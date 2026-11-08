/**
 * Sidebar - Enterprise Primary Application Navigation Shell
 * Supports collapsible rail, role-based visibility, and clear active states.
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
      className={`bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-200 z-30 select-none ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 border-b border-slate-200 flex items-center px-4 gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
          <CalendarCheck2 className="w-4 h-4" />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col truncate">
            <span className="font-bold text-sm text-slate-900 tracking-tight leading-none">Smart Roster</span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-1 leading-none">
              Operations
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
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-md transition-colors relative ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-bold border-l-3 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}

              {/* Badges */}
              {!isCollapsed && item.key === 'roster' && openIssuesCount > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.2 bg-red-100 text-red-700 rounded-full">
                  {openIssuesCount}
                </span>
              )}

              {!isCollapsed && item.key === 'leaves' && pendingLeavesCount > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-700 rounded-full">
                  {pendingLeavesCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Collapse Toggle */}
      {onToggleCollapse && (
        <div className="p-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-full flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      )}
    </aside>
  );
}
