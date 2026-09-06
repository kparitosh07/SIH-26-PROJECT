import { useEffect, useState } from 'react';
import { scansApi } from '../services/api';
import type { Scan, Violation } from '../services/apiTypes';
import { Search, ChevronLeft, ChevronRight, Download, Eye, RefreshCw, RotateCw, Trash2, MoreHorizontal, Loader2, FileText, AlertCircle } from 'lucide-react';
import { Button, Card, CardContent, Badge, Dropdown, Modal } from '../components/UI';
import { formatRelativeTime, getSeverityColor, formatFileSize, getErrorMessage } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

type ScanStatus = 'uploaded' | 'processing' | 'completed' | 'failed';
type Verdict = 'pass' | 'minor' | 'major' | 'critical';

export function History() {
  const navigate = useNavigate();
  const [scans, setScans] = useState<Scan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ScanStatus | ''>('');
  const [verdictFilter, setVerdictFilter] = useState<Verdict | ''>('');
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [showViolations, setShowViolations] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchScans = async () => {
    setLoading(true);
    try {
      const res = await scansApi.list({ page, page_size: pageSize, status: statusFilter || undefined, verdict: verdictFilter || undefined, search: search || undefined });
      setScans(res.data.data?.items || []);
      setTotal(res.data.data?.total || 0);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load scans'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchScans(); }, [page, statusFilter, verdictFilter, search]);

  useEffect(() => {
    const hasPending = scans.some(s => s.status === 'uploaded' || s.status === 'processing');
    if (!hasPending) return;
    const interval = setInterval(() => {
      scansApi.list({ page, page_size: pageSize, status: statusFilter || undefined, verdict: verdictFilter || undefined, search: search || undefined })
        .then(res => {
          setScans(res.data.data?.items || []);
          setTotal(res.data.data?.total || 0);
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [scans, page, pageSize, statusFilter, verdictFilter, search]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this scan? This action cannot be undone.')) return;
    setDeletingId(id);
    try {
      await scansApi.delete(id);
      toast.success('Scan deleted');
      fetchScans();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Delete failed'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleRetry = async (scan: Scan) => {
    try {
      await scansApi.action(scan.id, 'retry');
      toast.success('Retry queued');
      fetchScans();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Retry failed'));
    }
  };

  const handleReprocess = async (scan: Scan) => {
    try {
      await scansApi.action(scan.id, 'reprocess');
      toast.success('Reprocessing queued');
      fetchScans();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Reprocess failed'));
    }
  };

  const viewViolations = async (scan: Scan) => {
    setSelectedScan(scan);
    try {
      const res = await scansApi.get(scan.id);
      setViolations(res.data.data?.violations || []);
      setShowViolations(true);
    } catch {
      toast.error('Failed to load violations');
    }
  };

  const downloadFile = async (scan: Scan) => {
    try {
      const res = await scansApi.download(scan.id);
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = scan.original_filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  const statusOptions: ScanStatus[] = ['uploaded', 'processing', 'completed', 'failed'];
  const verdictOptions: Verdict[] = ['pass', 'minor', 'major', 'critical'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scan History</h1>
          <p className="text-gray-500">View and manage all your label scans</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchScans}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by filename..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                onKeyDown={e => e.key === 'Enter' && fetchScans()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[160px]"
            >
              <option value="">All Statuses</option>
              {statusOptions.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <select
              value={verdictFilter}
              onChange={e => { setVerdictFilter(e.target.value as any); setPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[160px]"
            >
              <option value="">All Verdicts</option>
              {verdictOptions.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">File</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Verdict</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Score</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">OCR Conf.</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-gray-500">Loading...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && scans.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <FileText className="w-12 h-12" />
                        <p>No scans found</p>
                        <Button variant="outline" size="sm" onClick={() => navigate('/scan')}>
                          Upload your first label
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
                {scans.map(scan => (
                  <tr key={scan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-xs">{scan.original_filename}</div>
                      <div className="text-xs text-gray-500">{formatFileSize(scan.file_size_bytes)} • {scan.content_type}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={scan.status === 'completed' ? 'success' : scan.status === 'processing' ? 'info' : scan.status === 'failed' ? 'danger' : 'gray'}>
                        {scan.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {scan.verdict ? (
                        <Badge variant={getSeverityColor(scan.verdict).includes('success') ? 'success' : getSeverityColor(scan.verdict).includes('warning') ? 'warning' : 'danger'}>
                          {scan.verdict}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {scan.compliance_score !== null ? (
                        <span className="font-medium">{scan.compliance_score.toFixed(1)}%</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {scan.ocr_confidence !== null ? (
                        <span className="font-medium">{scan.ocr_confidence.toFixed(1)}%</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatRelativeTime(scan.created_at)}</td>
                    <td className="px-4 py-3">
                      {deletingId === scan.id ? (
                        <div className="flex justify-end">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        <Dropdown
                          trigger={<Button variant="ghost" size="sm"><MoreHorizontal className="w-4 h-4" /></Button>}
                          items={[
                            { label: 'View Details', onClick: () => navigate(`/scan/${scan.id}`), icon: <Eye className="w-4 h-4" /> },
                            { label: 'View Violations', onClick: () => viewViolations(scan), icon: <AlertCircle className="w-4 h-4" /> },
                            { label: 'Download File', onClick: () => downloadFile(scan), icon: <Download className="w-4 h-4" /> },
                            scan.status === 'failed' && { label: 'Retry', onClick: () => handleRetry(scan), icon: <RotateCw className="w-4 h-4" /> },
                            scan.status === 'completed' && { label: 'Reprocess', onClick: () => handleReprocess(scan), icon: <RefreshCw className="w-4 h-4" /> },
                            { label: 'Delete', onClick: () => handleDelete(scan.id), icon: <Trash2 className="w-4 h-4" />, danger: true },
                          ].filter(Boolean) as any}
                          align="right"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Violations Modal */}
      <Modal
        isOpen={showViolations}
        onClose={() => setShowViolations(false)}
        title={`Violations: ${selectedScan?.original_filename}`}
        size="lg"
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {violations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No violations found</div>
          ) : (
            violations.map(v => (
              <div key={v.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-900">{v.label}</span>
                      <Badge variant={v.status === 'pass' ? 'success' : v.status === 'minor' ? 'warning' : 'danger'}>
                        {v.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{v.message}</p>
                    {v.extracted_value && (
                      <p className="text-sm"><span className="font-medium">Extracted:</span> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{v.extracted_value}</code></p>
                    )}
                    {v.evidence && (
                      <p className="text-sm"><span className="font-medium">Evidence:</span> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{v.evidence}</code></p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}