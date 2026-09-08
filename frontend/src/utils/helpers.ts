import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The backend stores all timestamps in UTC but rows persisted via SQLite come
 * back without a timezone marker, so browsers would otherwise interpret them
 * as *local* time and show a shifted value. Treat any zone-less value as UTC.
 */
export function parseServerDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  let str = String(date).trim();
  if (str && !/(Z|[+-]\d{2}:?\d{2})$/i.test(str)) {
    str = (str.includes('T') ? str : str.replace(' ', 'T')) + 'Z';
  }
  return new Date(str);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  const d = parseServerDate(date);
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function formatRelativeTime(date: string | Date) {
  const d = parseServerDate(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

export function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getSeverityColor(status: string) {
  switch (status) {
    case 'pass': return 'text-success-600 bg-success-100';
    case 'minor': return 'text-warning-600 bg-warning-100';
    case 'major': return 'text-orange-600 bg-orange-100';
    case 'critical': return 'text-danger-600 bg-danger-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'text-success-600 bg-success-100';
    case 'processing': return 'text-primary-600 bg-primary-100';
    case 'failed': return 'text-danger-600 bg-danger-100';
    case 'uploaded': return 'text-gray-600 bg-gray-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

export function getRoleBadge(role: string) {
  switch (role) {
    case 'admin': return 'text-purple-600 bg-purple-100';
    case 'inspector': return 'text-blue-600 bg-blue-100';
    case 'auditor': return 'text-green-600 bg-green-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

export function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function getErrorMessage(err: any, fallback = 'An error occurred'): string {
  if (!err) return fallback;

  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = detail.map(item => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const locStr = Array.isArray(item.loc) ? item.loc.filter((l: any) => l !== 'body' && l !== 'query').join('.') : '';
        return item.msg ? (locStr ? `${locStr}: ${item.msg}` : item.msg) : JSON.stringify(item);
      }
      return String(item);
    });
    return messages.join(', ');
  }
  if (detail && typeof detail === 'object') {
    if (typeof detail.msg === 'string') return detail.msg;
    if (typeof detail.message === 'string') return detail.message;
    return JSON.stringify(detail);
  }
  if (typeof err.message === 'string') {
    return err.message;
  }
  return fallback;
}