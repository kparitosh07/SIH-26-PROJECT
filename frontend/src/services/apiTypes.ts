// API Types
export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string;
  role: 'admin' | 'inspector' | 'auditor';
  department: string | null;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
}

export interface Scan {
  id: number;
  user_id: number;
  original_filename: string;
  content_type: string;
  file_size_bytes: number;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  progress: number;
  ocr_confidence: number | null;
  compliance_score: number | null;
  verdict: 'pass' | 'minor' | 'major' | 'critical' | null;
  error_message: string | null;
  completed_at: string | null;
  created_at: string;
  product: Product | null;
}

export interface ScanDetail extends Scan {
  raw_ocr_text: string | null;
  extracted_fields: Record<string, any> | null;
  ocr_engine: string | null;
  ocr_latency_ms: number | null;
  violations: Violation[];
  report: Report | null;
  max_permissible_errors: MaxPermissibleError[] | null;
}

export interface MaxPermissibleError {
  basis: string;
  declared_quantity?: string;
  max_permissible_error: number | string;
  unit?: string;
  note?: string;
}

export interface Violation {
  id: number;
  field_key: string;
  label: string;
  status: 'pass' | 'minor' | 'major' | 'critical';
  message: string;
  evidence: string | null;
  regex_pattern: string | null;
  extracted_value: string | null;
}

export interface Product {
  id: number;
  name: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
}

export interface Report {
  id: number;
  scan_id: number;
  report_file_path: string;
  generated_by: number | null;
  remarks: string | null;
  meta: Record<string, any> | null;
  created_at: string;
}

export interface DashboardOverview {
  total_scans: number;
  completed_scans: number;
  fail_scans: number;
  pass_rate: number;
  avg_ocr_confidence: number | null;
  avg_compliance_score: number | null;
  last_24h_scans: number;
  active_users: number;
}

export interface StatusTrendPoint {
  date: string;
  total: number;
  failed: number;
  passed: number;
}

export interface CategoryPoint {
  label: string;
  value: number;
}

export interface ViolationPoint {
  field_key: string;
  label: string;
  count: number;
}

export interface RecentScan {
  id: number;
  original_filename: string;
  status: string;
  verdict: string | null;
  compliance_score: number | null;
  created_at: string;
  user: User;
}

export interface DashboardResponse {
  overview: DashboardOverview;
  status_trend: StatusTrendPoint[];
  category_distribution: CategoryPoint[];
  top_violations: ViolationPoint[];
  recent_scans: RecentScan[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  resource: string | null;
  resource_id: number | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
}