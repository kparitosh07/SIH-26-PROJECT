import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { cn } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Upload, History, FileText, Users, Settings, LogOut, X, ChevronRight,
  ShieldCheck, BarChart3, Star, Sun, Moon
} from 'lucide-react';
import { FeedbackModal } from './FeedbackModal';
import { useTheme } from '../context/ThemeContext';

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

export function Sidebar({ onOpenFeedback }: { onOpenFeedback?: () => void }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  return (
    <aside className={cn('fixed left-0 top-0 z-40 h-screen bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transition-all duration-300', collapsed ? 'w-16' : 'w-64')}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className={cn('flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-slate-800', collapsed && 'justify-center')}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-slate-100">LabelCheck</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive: active }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100',
                collapsed && 'justify-center'
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          ))}

          {user.role === 'admin' && (
            <>
              <div className="pt-4 mt-4 border-t border-gray-200 dark:border-slate-800">
                <p className={cn('px-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider', collapsed && 'text-center')}>
                  Administration
                </p>
              </div>
              {adminNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive: active }) => cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100',
                    collapsed && 'justify-center'
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  {!collapsed && <span>{item.name}</span>}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User Section */}
        <div className={cn('p-4 border-t border-gray-200 dark:border-slate-800 space-y-2', collapsed && 'items-center')}>
          {onOpenFeedback && (
            <button
              onClick={onOpenFeedback}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800/60 rounded-lg transition-colors',
                collapsed && 'justify-center px-0'
              )}
              title="Rate App & Send Feedback"
            >
              <Star className="w-4 h-4 fill-amber-400 text-amber-400 flex-shrink-0" />
              {!collapsed && <span>Rate & Feedback</span>}
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                {user.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{user.full_name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 truncate capitalize">{user.role}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export function Header({ onOpenFeedback }: { onOpenFeedback?: () => void }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/scan') return 'Scan Label';
    if (path.startsWith('/scan/')) return 'Scan Details';
    if (path === '/history') return 'Scan History';
    if (path === '/reports') return 'Reports';
    if (path === '/analytics') return 'Analytics';
    if (path.startsWith('/admin/users')) return 'User Management';
    if (path.startsWith('/admin/audit')) return 'Audit Logs';
    if (path.startsWith('/admin/settings')) return 'Settings';
    return 'Label Compliance Checker';
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-slate-800 transition-colors">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{getPageTitle()}</h1>
        <div className="flex items-center gap-3">
          {/* Segmented Theme Switcher */}
          <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-1 rounded-lg border border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer',
                theme === 'light'
                  ? 'bg-white text-amber-600 shadow-sm font-semibold'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              )}
              title="Switch to Light Theme"
              aria-label="Light Mode"
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer',
                theme === 'dark'
                  ? 'bg-slate-900 text-slate-100 shadow-sm font-semibold'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              )}
              title="Switch to Dark Theme"
              aria-label="Dark Mode"
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
          </div>
          {onOpenFeedback && (
            <button
              onClick={onOpenFeedback}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800/60 rounded-lg transition-colors"
              title="Rate this App & Send Feedback"
            >
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="hidden sm:inline">Rate App</span>
            </button>
          )}
          {user && (
            <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600 capitalize">{user.role}</span>
              <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-xs font-medium text-primary-700">
                  {user.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors duration-200">
      <Sidebar onOpenFeedback={() => setIsFeedbackOpen(true)} />
      <div className={cn('transition-all duration-300', 'lg:ml-64')}>
        <Header onOpenFeedback={() => setIsFeedbackOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      {/* Mobile sidebar overlay */}
      <div
        className={cn('fixed inset-0 z-20 bg-gray-900/50 dark:bg-black/70 lg:hidden transition-opacity', sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
    </div>
  );
}