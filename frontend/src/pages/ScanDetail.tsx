import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { scansApi } from '../services/api';
import type { ScanDetail } from '../services/apiTypes';
import {
  FileText, CheckCircle, AlertTriangle, XCircle, Download, RotateCw, RefreshCw, Trash2,
  MoreHorizontal, ChevronDown, ChevronUp, Info, AlertCircle, DollarSign, Scale, Factory,
  Calendar, Phone, MapPin, BadgePercent, Hash, Loader2, Target, Image
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Dropdown, Alert, Modal } from '../components/UI';
import { formatRelativeTime, formatDate, getSeverityColor, formatFileSize, cn, getStatusColor, getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';

const FIELD_ICONS: Record<string, React.ReactNode> = {
  mrp: <DollarSign className="w-4 h-4" />,
  net_quantity: <Scale className="w-4 h-4" />,
  manufacturer: <Factory className="w-4 h-4" />,
  dates: <Calendar className="w-4 h-4" />,
  customer_care: <Phone className="w-4 h-4" />,
  address: <MapPin className="w-4 h-4" />,
  fssai: <BadgePercent className="w-4 h-4" />,
  batch_number: <Hash className="w-4 h-4" />,
};

const FIELD_LABELS: Record<string, string> = {
  mrp: 'MRP (Maximum Retail Price)',
  net_quantity: 'Net Quantity / Net Weight',
  manufacturer: 'Manufacturer Details',
  dates: 'Best Before / Expiry Date',
  customer_care: 'Customer Care Contact',
  address: 'Packaged / Registered Office Address',
  fssai: 'FSSAI License Number',
  batch_number: 'Batch / Lot Number',
};

export function ScanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRawOcr, setShowRawOcr] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const fetchScan = async (showLoading = true) => {
    if (!id) return;
    if (showLoading) setLoading(true);
    try {
      const res = await scansApi.get(Number(id));
      setScan(res.data.data);
    } catch (err: any) {
      if (showLoading) setError(getErrorMessage(err, 'Failed to load scan'));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => { fetchScan(true); }, [id]);

  useEffect(() => {
    if (!scan?.id) return;
    let active = true;
    let url: string | null = null;

    scansApi.download(scan.id)
      .then(res => {
        if (!active) return;
        const blob = new Blob([res.data], { type: scan.content_type || 'image/jpeg' });
        url = URL.createObjectURL(blob);
        setImageUrl(url);
      })
      .catch(() => {});

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [scan?.id]);

  useEffect(() => {
    if (!scan || scan.status === 'completed' || scan.status === 'failed') return;
    const interval = setInterval(() => {
      fetchScan(false);
    }, 2000);
    return () => clearInterval(interval);
  }, [id, scan?.status]);

  const handleDelete = async () => {
    if (!scan || !confirm('Delete this scan permanently?')) return;
    try {
      await scansApi.delete(scan.id);
      toast.success('Scan deleted');
      navigate('/history');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Delete failed'));
    }
  };

  const handleRetry = async () => {
    if (!scan) return;
    try {
      await scansApi.action(scan.id, 'retry');
      toast.success('Retry queued');
      fetchScan();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Retry failed'));
    }
  };

  const handleReprocess = async () => {
    if (!scan) return;
    try {
      await scansApi.action(scan.id, 'reprocess');
      toast.success('Reprocessing queued');
      fetchScan();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Reprocess failed'));
    }
  };

  const downloadFile = async () => {
    if (!scan) return;
    try {
      const blob = await scansApi.download(scan.id);
      const url = window.URL.createObjectURL(blob.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = scan.original_filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <Card><CardContent className="h-32" /></Card>
          <Card><CardContent className="h-64" /></Card>
        </div>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Scan not found</h2>
        <p className="text-gray-500 mt-2">{error || 'The scan could not be loaded.'}</p>
        <Button onClick={() => navigate('/history')} className="mt-4">Back to History</Button>
      </div>
    );
  }

  const violations = scan.violations || [];
  const passingFields = violations.filter(v => v.status === 'pass').length;
  const failingFields = violations.filter(v => v.status !== 'pass').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <a href="/history" className="hover:text-gray-700">History</a>
            <span>/</span>
            <span className="text-gray-900 font-medium">{scan.original_filename}</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">{scan.original_filename}</h1>
          <p className="text-gray-500">{formatFileSize(scan.file_size_bytes)} • {scan.content_type} • {formatRelativeTime(scan.created_at)}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Small Tested Label Photo Box */}
          <div
            onClick={() => setIsPhotoModalOpen(true)}
            className="flex items-center gap-2.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500 rounded-lg shadow-sm cursor-pointer transition-all group"
            title="Click to view full tested label photo"
          >
            <div className="w-8 h-8 rounded overflow-hidden bg-gray-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 border border-gray-200 dark:border-slate-700">
              {imageUrl ? (
                <img src={imageUrl} alt="Tested Label" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              ) : (
                <Image className="w-4 h-4 text-gray-400 dark:text-slate-500" />
              )}
            </div>
            <div className="text-xs">
              <p className="font-semibold text-gray-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">Label Photo</p>
              <p className="text-[10px] text-gray-500 dark:text-slate-400">Click to view</p>
            </div>
          </div>

          <Button variant="outline" onClick={downloadFile}>
            <Download className="w-4 h-4 mr-1" /> Download
          </Button>
          <Dropdown
            trigger={<Button variant="outline"><MoreHorizontal className="w-4 h-4" /></Button>}
            items={[
              { label: 'Retry', onClick: handleRetry, icon: <RotateCw className="w-4 h-4" /> },
              { label: 'Reprocess', onClick: handleReprocess, icon: <RefreshCw className="w-4 h-4" /> },
              { label: 'Delete', onClick: handleDelete, icon: <Trash2 className="w-4 h-4" />, danger: true },
            ]}
            align="right"
          />
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-2xl font-bold text-gray-900 capitalize">{scan.status}</p>
              </div>
              <div className={cn('p-3 rounded-xl', getStatusColor(scan.status).replace('text-', 'bg-').replace('bg-', 'bg-').replace('text-', ''))}>
                {scan.status === 'completed' && <CheckCircle className="w-6 h-6 text-success-600" />}
                {scan.status === 'processing' && <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />}
                {scan.status === 'failed' && <XCircle className="w-6 h-6 text-danger-600" />}
                {scan.status === 'uploaded' && <FileText className="w-6 h-6 text-gray-500" />}
              </div>
            </div>
            {scan.progress !== undefined && scan.status === 'processing' && (
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary-600 rounded-full transition-all" style={{ width: `${scan.progress}%` }} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Verdict</p>
                <p className="text-2xl font-bold text-gray-900 capitalize">{scan.verdict ?? '—'}</p>
              </div>
              <div className={cn('p-3 rounded-xl', getSeverityColor(scan.verdict || 'pass').replace('text-', 'bg-'))}>
                {scan.verdict === 'pass' && <CheckCircle className="w-6 h-6 text-success-600" />}
                {scan.verdict === 'minor' && <AlertTriangle className="w-6 h-6 text-warning-600" />}
                {scan.verdict === 'major' && <AlertTriangle className="w-6 h-6 text-orange-600" />}
                {scan.verdict === 'critical' && <XCircle className="w-6 h-6 text-danger-600" />}
                {!scan.verdict && <Info className="w-6 h-6 text-gray-400" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Compliance Score</p>
                <p className="text-2xl font-bold text-gray-900">{scan.compliance_score?.toFixed(1) ?? '—'}%</p>
              </div>
              <div className="p-3 rounded-xl bg-primary-100">
                <Target className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {scan.error_message && (
        <Alert variant="danger" className="flex items-start gap-3">
          <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Processing Failed</p>
            <p className="text-sm mt-1 font-mono text-xs">{scan.error_message}</p>
          </div>
        </Alert>
      )}

      {/* Violations & Extracted Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Violations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Compliance Violations ({failingFields})
            </CardTitle>
            <span className="text-sm text-gray-500">{passingFields} passing • {failingFields} failing</span>
          </CardHeader>
          <CardContent>
            {violations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No violations data</div>
            ) : (
              <div className="space-y-3">
                {violations.map(v => (
                  <div key={v.id} className={cn('p-4 border rounded-lg transition-colors', v.status === 'pass' ? 'border-success-200 dark:border-success-800/60 bg-success-50 dark:bg-success-950/40' : v.status === 'minor' ? 'border-warning-200 dark:border-warning-800/60 bg-warning-50 dark:bg-warning-950/40' : 'border-danger-200 dark:border-danger-800/60 bg-danger-50 dark:bg-danger-950/40')}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {FIELD_ICONS[v.field_key] && <span className="text-gray-400 dark:text-slate-400">{FIELD_ICONS[v.field_key]}</span>}
                          <span className="font-semibold text-gray-900 dark:text-slate-100">{v.label}</span>
                          <Badge variant={v.status === 'pass' ? 'success' : v.status === 'minor' ? 'warning' : 'danger'}>
                            {v.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-slate-300 mb-2">{v.message}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {v.extracted_value && (
                            <span className="px-2 py-0.5 bg-white/60 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded font-mono text-gray-800 dark:text-slate-200">
                              Extracted: {v.extracted_value}
                            </span>
                          )}
                          {v.evidence && (
                            <span className="px-2 py-0.5 bg-white/60 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded font-mono text-gray-800 dark:text-slate-200 truncate max-w-xs">
                              Evidence: {v.evidence}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extracted Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Extracted Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scan.extracted_fields && Object.keys(scan.extracted_fields).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(scan.extracted_fields).map(([key, value]) => (
                  <div key={key} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-2 mb-1">
                      {FIELD_ICONS[key] && <span className="text-gray-400">{FIELD_ICONS[key]}</span>}
                      <span className="font-medium text-gray-700">{FIELD_LABELS[key] || key.replace('_', ' ').toUpperCase()}</span>
                    </div>
                    <div className="ml-6 text-sm">
                      <code className="bg-white px-2 py-1 rounded border border-gray-200 font-mono text-gray-900">{String(value)}</code>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No structured fields extracted</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* OCR Details */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Extracted OCR Text & Details
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
              Engine: <span className="font-semibold text-gray-800 dark:text-slate-200">{scan.ocr_engine ?? '—'}</span> • Confidence: <span className="font-semibold text-gray-800 dark:text-slate-200">{scan.ocr_confidence?.toFixed(1) ?? '—'}%</span> • Latency: <span className="font-semibold text-gray-800 dark:text-slate-200">{scan.ocr_latency_ms ?? '—'}ms</span>
            </span>
            {scan.raw_ocr_text && (
              <Button variant="ghost" size="sm" onClick={() => setShowRawOcr(!showRawOcr)}>
                {showRawOcr ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {scan.raw_ocr_text ? (
            <div className="space-y-3">
              {showRawOcr && (
                <div className="relative">
                  <pre className="bg-slate-950 text-sky-300 p-4 rounded-xl text-xs overflow-x-auto font-mono max-h-96 leading-relaxed border border-slate-800 shadow-inner whitespace-pre-wrap selection:bg-sky-500 selection:text-white">
                    {scan.raw_ocr_text}
                  </pre>
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                  {scan.raw_ocr_text.split('\n').filter(Boolean).length} text line(s) recognized on packaging label
                </p>
                <Button variant="ghost" size="sm" onClick={() => setShowRawOcr(!showRawOcr)} className="text-primary-600 dark:text-primary-400 font-semibold">
                  {showRawOcr ? 'Hide Raw Text' : 'View Extracted OCR Text'}
                </Button>
              </div>
            </div>
          ) : scan.status === 'processing' || scan.status === 'uploaded' ? (
            <div className="flex items-center justify-center gap-3 py-8 text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-950/20 rounded-xl border border-primary-100 dark:border-primary-900/40">
              <Loader2 className="w-6 h-6 animate-spin flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900 dark:text-slate-100">OCR Text Extraction in Progress...</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Processing label image with AI engine ({scan.progress ?? 0}%)</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 dark:text-slate-400 text-sm">
              No raw OCR text extracted for this scan.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Section */}
      {scan.report && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Compliance Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900">Report generated</p>
                <p className="text-sm text-gray-500">{formatDate(scan.report.created_at)}</p>
              </div>
              <Button onClick={() => window.open(`/api/v1/reports/${scan.report!.id}/download`, '_blank')}>
                <Download className="w-4 h-4 mr-1" /> Download PDF
              </Button>
            </div>
            {scan.report.remarks && (
              <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded">{scan.report.remarks}</p>
            )}
          </CardContent>
        </Card>
      )}
      {/* Photo Viewer Modal */}
      <Modal isOpen={isPhotoModalOpen} onClose={() => setIsPhotoModalOpen(false)} title={`Tested Label Photo: ${scan.original_filename}`} size="xl">
        <div className="space-y-4">
          <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-gray-950 rounded-xl p-2 border border-gray-800">
            {imageUrl ? (
              <img src={imageUrl} alt={scan.original_filename} className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg" />
            ) : (
              <div className="py-12 text-gray-400 flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                <span>Loading label photo...</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500 dark:text-slate-400">
              File: <span className="font-mono text-gray-700 dark:text-slate-300">{scan.original_filename}</span> • {formatFileSize(scan.file_size_bytes)}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsPhotoModalOpen(false)}>Close</Button>
              <Button onClick={downloadFile}><Download className="w-4 h-4 mr-1" /> Download File</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}