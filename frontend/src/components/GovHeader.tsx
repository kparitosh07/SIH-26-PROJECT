import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Star, Bell } from 'lucide-react';
import { cn } from '../utils/helpers';

export function AshokaEmblem({ className = "w-11 h-14 text-amber-700 dark:text-amber-400" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 125" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Central Lion Head */}
      <path d="M42 12 C42 8 50 4 58 12 C62 10 65 14 62 18 C66 22 64 28 58 30 C58 34 52 38 48 34 C44 38 38 34 38 30 C32 28 30 22 34 18 C31 14 34 10 38 12 C40 8 42 12 42 12 Z" fill="currentColor" />
      <circle cx="50" cy="14" r="3" fill="#f59e0b" />
      <path d="M44 20 C47 18 53 18 56 20 C58 24 56 28 50 28 C44 28 42 24 44 20 Z" fill="currentColor" />

      {/* Left Lion Profile */}
      <path d="M28 20 C24 16 18 20 20 26 C16 30 20 36 26 36 C28 40 34 42 38 38 C34 34 32 28 34 24 C30 24 28 20 28 20 Z" fill="currentColor" opacity="0.9" />

      {/* Right Lion Profile */}
      <path d="M72 20 C76 16 82 20 80 26 C84 30 80 36 74 36 C72 40 66 42 62 38 C66 34 68 28 66 24 C70 24 72 20 72 20 Z" fill="currentColor" opacity="0.9" />

      {/* Lion Bodies */}
      <path d="M30 38 C30 50 40 58 50 58 C60 58 70 50 70 38 C62 44 38 44 30 38 Z" fill="currentColor" />

      {/* Abacus Base Plate */}
      <rect x="18" y="60" width="64" height="10" rx="3" fill="currentColor" />
      <rect x="16" y="62" width="68" height="6" rx="1.5" stroke="#f59e0b" strokeWidth="0.8" fill="none" />

      {/* Ashoka Chakra Wheel */}
      <circle cx="50" cy="65" r="4.5" fill="#0f172a" stroke="#ffffff" strokeWidth="0.8" />
      <circle cx="50" cy="65" r="1.2" fill="#ffffff" />
      <circle cx="32" cy="65" r="2" fill="#0f172a" opacity="0.7" />
      <circle cx="68" cy="65" r="2" fill="#0f172a" opacity="0.7" />

      {/* Bell Lotus Base */}
      <path d="M25 72 C32 82 42 86 50 86 C58 86 68 82 75 72 L78 75 C70 88 58 92 50 92 C42 92 30 88 22 75 Z" fill="currentColor" />
      <rect x="22" y="94" width="56" height="5" rx="1" fill="currentColor" />

      {/* Devanagari Motto */}
      <text x="50" y="114" textAnchor="middle" fontSize="11" fontWeight="bold" fill="currentColor" letterSpacing="0.5" fontFamily="serif">
        सत्यमेव जयते
      </text>
    </svg>
  );
}

export function GovHeader({ onOpenFeedback }: { onOpenFeedback?: () => void }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('Home');

  const navItems = ['Home', 'About', 'Guidelines', 'Resources', 'Contact Us'];

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
    <header className="w-full bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 transition-colors z-30 relative shadow-sm">
      {/* Top Government Emblem & Ministry Banner */}
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Official Indian Emblem + Ministry Title */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="flex flex-col items-center justify-center flex-shrink-0">
            <AshokaEmblem className="w-10 h-14 sm:w-11 sm:h-14 text-amber-800 dark:text-amber-400" />
          </div>

          <div className="h-12 w-px bg-gray-300 dark:bg-slate-700 flex-shrink-0 hidden sm:block" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] sm:text-xs font-extrabold tracking-wider text-amber-800 dark:text-amber-400 uppercase truncate">
                भारत सरकार / GOVERNMENT OF INDIA
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight mt-0.5 truncate">
              Packaging Compliance Checker
            </h1>
            <p className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5 truncate">
              Ensuring Safe, Compliant and Sustainable Packaging &bull; <span className="text-slate-500 dark:text-slate-400">Ministry of Consumer Affairs, Food & Public Distribution</span>
            </p>
          </div>
        </div>

        {/* Right: National Initiative Badges (Digital India & Swachh Bharat) */}
        <div className="hidden xl:flex items-center gap-4 flex-shrink-0">
          {/* Digital India Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 via-sky-500 to-emerald-500 flex items-center justify-center text-white font-black text-[10px] shadow-sm">
              DI
            </div>
            <div className="text-left">
              <span className="block text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                Digital India
              </span>
              <span className="text-[9px] font-semibold text-sky-600 dark:text-sky-400">
                Power To Empower
              </span>
            </div>
          </div>

          {/* Swachh Bharat Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
            <div className="flex items-center text-emerald-700 dark:text-emerald-400">
              <svg width="26" height="15" viewBox="0 0 32 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="9" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
                <circle cx="24" cy="9" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M14 9 H18" stroke="currentColor" strokeWidth="2" />
                <path d="M2 9 H0 M32 9 H30" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <div className="text-left">
              <span className="block text-xs font-bold text-emerald-800 dark:text-emerald-300 leading-none">
                स्वच्छ भारत
              </span>
              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                स्वस्थ भारत
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Government Portal Navigation Bar */}
      <div className="bg-slate-900 dark:bg-slate-950 text-white border-t border-slate-800 shadow-md">
        <div className="px-4 sm:px-6 lg:px-8 flex items-center justify-between h-12 gap-4">
          {/* Left: Nav Tabs */}
          <nav className="flex items-center space-x-1 overflow-x-auto scrollbar-none py-1">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => setActiveTab(item)}
                className={cn(
                  'px-3 py-1 text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap',
                  activeTab === item
                    ? 'bg-sky-700 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                )}
              >
                {item}
              </button>
            ))}
          </nav>

          {/* Right Header Controls & User Badge */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Active Section Title Pill */}
            <span className="hidden lg:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-950 text-sky-300 border border-sky-800/80">
              {getPageTitle()}
            </span>

            {/* Segmented Theme Switcher */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-md transition-all cursor-pointer',
                  theme === 'light'
                    ? 'bg-white text-amber-600 shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                )}
                title="Light Theme"
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-md transition-all cursor-pointer',
                  theme === 'dark'
                    ? 'bg-sky-600 text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                )}
                title="Dark Theme"
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dark</span>
              </button>
            </div>

            {/* Notification Bell */}
            <button
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg relative transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-900" />
            </button>

            {/* Rate App Button */}
            {onOpenFeedback && (
              <button
                onClick={onOpenFeedback}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/60 rounded-lg transition-colors cursor-pointer"
                title="Rate App"
              >
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="hidden sm:inline">Rate App</span>
              </button>
            )}

            {/* User Profile Badge */}
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="w-7 h-7 rounded-full bg-sky-600 flex items-center justify-center text-white font-semibold text-xs shadow-xs">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <span className="block text-xs font-semibold text-slate-200 leading-none">
                    {user.full_name}
                  </span>
                  <span className="text-[10px] text-sky-400 capitalize">
                    {user.role}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
