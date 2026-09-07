import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { scansApi } from '../services/api';
import type { Product } from '../services/apiTypes';
import { Upload, FileText, Loader2, CheckCircle, XCircle, Image, AlertCircle, ChevronDown, Camera } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Alert, Modal } from '../components/UI';
import { formatFileSize, cn, getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'application/pdf'];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

interface UploadFile {
  file: File;
  id: string;
  preview: string | null;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  scanId?: number;
  error?: string;
}

export function ScanUpload() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [products] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setIsCameraOpen(true);
    setCameraLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      toast.error('Unable to access camera. Please check camera permissions.');
      setIsCameraOpen(false);
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) return;
        const file = new File([blob], `label_photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const preview = URL.createObjectURL(file);
        setFiles(prev => [...prev, { file, id, preview, status: 'pending', progress: 0 }]);
        toast.success('Photo captured and added to upload queue');
        stopCamera();
      }, 'image/jpeg', 0.92);
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Unsupported file type`);
        return;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: File too large (max 20MB)`);
        return;
      }
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let preview: string | null = null;
      if (file.type.startsWith('image/')) {
        preview = URL.createObjectURL(file);
      }
      setFiles(prev => [...prev, { file, id, preview, status: 'pending', progress: 0 }]);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/bmp': ['.bmp'],
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_SIZE,
    multiple: true,
    disabled: isUploading,
  });

  const removeFile = (id: string) => {
    setFiles(prev => {
      const f = prev.find(x => x.id === id);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter(x => x.id !== id);
    });
  };

  const uploadFile = async (uploadFile: UploadFile) => {
    setFiles(prev => prev.map(f => f.id === uploadFile.id ? { ...f, status: 'uploading' as const, progress: 0 } : f));

    try {
      const formData = new FormData();
      formData.append('file', uploadFile.file);
      if (selectedProduct) formData.append('product_id', String(selectedProduct));

      const res = await scansApi.upload(uploadFile.file, selectedProduct || undefined);

      // Poll for completion
      let scan = res.data.data;
      setFiles(prev => prev.map(f => f.id === uploadFile.id ? { ...f, status: 'completed' as const, progress: 100, scanId: scan.id } : f));

      toast.success(`${uploadFile.file.name} uploaded successfully`);
      return scan;
    } catch (err: any) {
      const message = getErrorMessage(err, 'Upload failed');
      setFiles(prev => prev.map(f => f.id === uploadFile.id ? { ...f, status: 'error' as const, error: message } : f));
      toast.error(`${uploadFile.file.name}: ${message}`);
    }
  };

  const handleUploadAll = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    setError('');

    let lastScanId: number | undefined;
    for (const f of files) {
      if (f.status === 'pending') {
        const scan = await uploadFile(f);
        if (scan?.id) lastScanId = scan.id;
      }
    }

    setIsUploading(false);
    if (lastScanId && files.filter(f => f.status === 'completed' || f.status === 'pending').length === 1) {
      toast.success('Navigating to OCR scan results...');
      setTimeout(() => navigate(`/scan/${lastScanId}`), 600);
    } else {
      setTimeout(() => navigate('/history'), 1200);
    }
  };

  const clearCompleted = () => {
    setFiles(prev => {
      prev.filter(f => f.status === 'completed').forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      return prev.filter(f => f.status !== 'completed');
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scan Label</h1>
        <p className="text-gray-500">Upload product label images or PDFs for compliance checking</p>
      </div>

      {/* Product Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Product (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <select
              value={selectedProduct || ''}
              onChange={e => setSelectedProduct(e.target.value ? Number(e.target.value) : null)}
              className="w-full appearance-none px-4 py-2.5 pr-10 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Select a known product (or leave blank)</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name || 'Unnamed'} {p.brand ? `(${p.brand})` : ''} {p.category ? `- ${p.category}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </CardContent>
      </Card>

      {/* Dropzone */}
      <Card className={isDragActive ? 'border-primary-500 bg-primary-50' : ''}>
        <CardContent className="p-8">
          <div
            {...getRootProps()}
            className={cn(
              'relative border-2 border-dashed rounded-xl text-center transition-colors',
              isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
            )}
          >
            <input {...getInputProps()} />
            <div className="py-8">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900">
                {isDragActive ? 'Drop files here...' : 'Drag & drop label images or PDFs'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Supports: PNG, JPG, WebP, BMP, PDF &bull; Max 20MB each
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button variant="outline" onClick={(e) => { e.stopPropagation(); open(); }}>
                  Browse Files
                </Button>
                <Button onClick={(e) => { e.stopPropagation(); startCamera(); }} className="flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Use Camera
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Camera Modal */}
      <Modal isOpen={isCameraOpen} onClose={stopCamera} title="Scan Label with Camera" size="lg">
        <div className="space-y-4">
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
            {cameraLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 text-white z-10">
                <Loader2 className="w-8 h-8 animate-spin mr-2" /> Starting camera...
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => videoRef.current?.play()}
              className="w-full h-full object-cover"
            />
            {/* Guide overlay */}
            <div className="absolute inset-8 border-2 border-dashed border-white/60 rounded-lg pointer-events-none flex items-center justify-center">
              <span className="text-xs text-white/90 bg-black/60 px-3 py-1 rounded-full">
                Align product label within frame
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={stopCamera}>
              Cancel
            </Button>
            <Button onClick={capturePhoto} className="flex items-center gap-2">
              <Camera className="w-4 h-4" /> Capture Photo
            </Button>
          </div>
        </div>
      </Modal>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Files Ready ({files.filter(f => f.status === 'pending').length} pending)
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={clearCompleted} disabled={!files.some(f => f.status === 'completed')}>
                Clear Completed
              </Button>
              <Button size="sm" onClick={handleUploadAll} disabled={isUploading || files.every(f => f.status !== 'pending')}>
                {isUploading ? 'Uploading...' : 'Upload All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-200">
              {files.map(f => (
                <div key={f.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                  {/* Preview */}
                  <div className="relative w-16 h-16 rounded-lg border border-gray-200 flex-shrink-0 overflow-hidden bg-gray-50">
                    {f.preview ? (
                      <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                    ) : f.file.type === 'application/pdf' ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-danger-500" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{f.file.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(f.file.size)} • {f.file.type}</p>

                    {/* Progress */}
                    {f.status === 'uploading' && (
                      <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-600 rounded-full transition-all" style={{ width: `${f.progress}%` }} />
                      </div>
                    )}
                    {f.status === 'error' && (
                      <p className="mt-2 text-sm text-danger-600 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> {f.error}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-3">
                    {f.status === 'pending' && (
                      <Badge variant="gray">Pending</Badge>
                    )}
                    {f.status === 'uploading' && (
                      <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
                    )}
                    {f.status === 'completed' && (
                      <div className="flex items-center gap-2">
                        <Badge variant="success" className="flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Done
                        </Badge>
                        {f.scanId && (
                          <Button size="sm" variant="outline" onClick={() => navigate(`/scan/${f.scanId}`)} className="text-xs">
                            View Results →
                          </Button>
                        )}
                      </div>
                    )}
                    {f.status === 'error' && (
                      <Badge variant="danger" className="flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Error
                      </Badge>
                    )}

                    <Button variant="ghost" size="sm" onClick={() => removeFile(f.id)} className="text-gray-400 hover:text-danger-600">
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {/* Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Scanning Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" /> Ensure good lighting - avoid shadows and glare</li>
            <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" /> Capture the entire label - all text should be visible</li>
            <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" /> Hold camera steady - blur reduces OCR accuracy</li>
            <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" /> For PDFs - ensure text is selectable (not scanned images only)</li>
            <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" /> Mandatory fields checked: MRP, Net Quantity, Manufacturer, Dates, Customer Care</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}