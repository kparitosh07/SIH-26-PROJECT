import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { cn } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Upload, History, FileText, Users, Settings, LogOut, X, ChevronRight,
  ShieldCheck, BarChart3, Star
} from 'lucide-react';
import { FeedbackModal } from './FeedbackModal';
import { GovHeader } from './GovHeader';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Scan Label', href: '/scan', icon: Upload },
  { name: 'History', href: '/history', icon: History },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
];

const adminNavigation = [
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Audit Logs', href: '/admin/audit', icon: ShieldCheck },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export function Sidebar({
  onOpenFeedback,
  isOpen,
  onClose,
  collapsed,
  setCollapsed
}: {
  onOpenFeedback?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 h-screen bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transition-transform lg:transition-all duration-300 shadow-xl lg:shadow-none',
        collapsed ? 'lg:w-16' : 'lg:w-64',
        'w-64',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo Header */}
        <div className={cn('flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-slate-800', collapsed && 'lg:justify-center')}>
          <div className={cn('flex items-center gap-2', collapsed && 'lg:hidden')}>
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl text-slate-900 dark:text-slate-100 tracking-wide font-serif">मानक</span>
          </div>

          {/* Desktop Collapse & Mobile Close Button */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={({ isActive: active }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100',
                collapsed && 'lg:justify-center'
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span className={cn(collapsed && 'lg:hidden')}>{item.name}</span>
            </NavLink>
          ))}

          {user.role === 'admin' && (
            <>
              <div className="pt-4 mt-4 border-t border-gray-200 dark:border-slate-800">
                <p className={cn('px-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider', collapsed && 'lg:text-center')}>
                  Administration
                </p>
              </div>
              {adminNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={onClose}
                  className={({ isActive: active }) => cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100',
                    collapsed && 'lg:justify-center'
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className={cn(collapsed && 'lg:hidden')}>{item.name}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User Section */}
        <div className={cn('p-4 border-t border-gray-200 dark:border-slate-800 space-y-2', collapsed && 'lg:items-center')}>
          {onOpenFeedback && (
            <button
              onClick={() => {
                if (onClose) onClose();
                onOpenFeedback();
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800/60 rounded-lg transition-colors',
                collapsed && 'lg:justify-center lg:px-0'
              )}
              title="Rate App & Send Feedback"
            >
              <Star className="w-4 h-4 fill-amber-400 text-amber-400 flex-shrink-0" />
              <span className={cn(collapsed && 'lg:hidden')}>Rate & Feedback</span>
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                {user.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className={cn('flex-1 min-w-0', collapsed && 'lg:hidden')}>
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{user.full_name}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors', collapsed && 'lg:justify-center')}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className={cn(collapsed && 'lg:hidden')}>Sign out</span>
          </button>

          {/* Government Slogan Badge */}
          <div className={cn('pt-3 border-t border-gray-200 dark:border-slate-800 text-center', collapsed && 'lg:hidden')}>
            <div className="flex items-center justify-center mb-1 text-amber-700 dark:text-amber-400">
              <svg width="22" height="22" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="6" fill="none" />
                <circle cx="50" cy="50" r="8" fill="currentColor" />
                <line x1="50" y1="8" x2="50" y2="92" stroke="currentColor" strokeWidth="3" />
                <line x1="8" y1="50" x2="92" y2="50" stroke="currentColor" strokeWidth="3" />
                <line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" strokeWidth="3" />
                <line x1="20" y1="80" x2="80" y2="20" stroke="currentColor" strokeWidth="3" />
              </svg>
            </div>
            <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
              सबका साथ, सबका विकास,<br />सबका विश्वास, सबका प्रयास
            </p>
            <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Government of India Initiative
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors duration-200">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <div className={cn('transition-all duration-300', collapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        <GovHeader
          onOpenFeedback={() => setIsFeedbackOpen(true)}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      {/* Mobile sidebar overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity duration-300',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
    </div>
  );
}