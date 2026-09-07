import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FileText, CheckCircle, AlertTriangle, Clock, RefreshCw,
  BarChart3, PieChart, Activity, Target, Leaf, ArrowRight, BookOpen, Upload, Shield
} from 'lucide-react';
import { dashboardApi, scansApi } from '../services/api';
import type { DashboardResponse, Scan } from '../services/apiTypes';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '../components/UI';
import { cn, formatRelativeTime, getSeverityColor, getErrorMessage } from '../utils/helpers';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [recentScans, setRecentScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState('');
  const [timeRange, setTimeRange] = useState(30);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashRes, scansRes] = await Promise.all([
        dashboardApi.overview(timeRange),
        scansApi.list({ page_size: 5 }),
      ]);
      setData(dashRes.data.data);
      setRecentScans(scansRes.data.data?.items || []);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [timeRange]);

  const stats = [
    { label: 'Total Scans', value: data?.overview.total_scans ?? 0, icon: FileText, color: 'text-sky-600', bg: 'bg-sky-100' },
    { label: 'Completed', value: data?.overview.completed_scans ?? 0, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Failed', value: data?.overview.fail_scans ?? 0, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-100' },
    { label: 'Pass Rate', value: `${data?.overview.pass_rate ?? 0}%`, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="h-24 animate-pulse bg-gray-100" /></Card>
          ))}
        </div>
        <Card><CardContent className="h-64 animate-pulse bg-gray-100" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Official Welcome Hero Banner */}
      <Card className="bg-white border-2 border-sky-200 dark:bg-slate-900 dark:border-slate-800 overflow-hidden relative shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-300 text-xs font-bold mb-3 border border-sky-200 dark:border-sky-800">
                <Shield className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
                Ministry of Consumer Affairs &bull; Official Compliance Portal
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-slate-100 tracking-tight">
                Welcome, {user?.full_name || 'Inspector'}
              </h1>
              <p className="text-slate-800 dark:text-slate-200 font-semibold text-sm sm:text-base mt-1">
                Together for a Safer, Healthier and Greener India
              </p>
            </div>

            {/* Right Badge Graphic (India Gate + Swachh Slogan) */}
            <div className="flex items-center gap-4 bg-amber-50 dark:bg-slate-800 p-4 rounded-xl border-2 border-amber-200 dark:border-slate-700 shadow-xs flex-shrink-0">
              <div className="text-center">
                <span className="block text-xs font-black text-amber-950 dark:text-amber-400 border-b-2 border-amber-500 pb-0.5">
                  एक कदम स्वच्छता की ओर
                </span>
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-400 mt-1 block">
                  Swachh Bharat Abhiyan
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Scan & Verify */}
        <div
          onClick={() => navigate('/scan')}
          className="p-5 rounded-xl bg-white dark:bg-sky-950/30 border-2 border-sky-200 dark:border-sky-800/50 hover:border-sky-500 dark:hover:border-sky-500 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-lg bg-sky-600 text-white flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-xs">
            <Upload className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-slate-950 dark:text-slate-100 group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors">
            Scan & Verify
          </h3>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1 mb-3">
            Check packaging compliance using AI-powered verification
          </p>
          <div className="flex items-center text-xs font-extrabold text-sky-700 dark:text-sky-400 gap-1">
            <span>Scan Now</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: View Reports */}
        <div
          onClick={() => navigate('/reports')}
          className="p-5 rounded-xl bg-white dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800/50 hover:border-emerald-500 dark:hover:border-emerald-500 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-slate-950 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
            View Reports
          </h3>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1 mb-3">
            Access and download official compliance reports
          </p>
          <div className="flex items-center text-xs font-extrabold text-emerald-700 dark:text-emerald-400 gap-1">
            <span>View Reports</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 3: Regulatory Standards */}
        <div
          onClick={() => navigate('/analytics')}
          className="p-5 rounded-xl bg-white dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800/50 hover:border-amber-500 dark:hover:border-amber-500 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-slate-950 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
            Regulatory Standards
          </h3>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1 mb-3">
            Explore legal metrology packaging rules & guidelines
          </p>
          <div className="flex items-center text-xs font-extrabold text-amber-700 dark:text-amber-400 gap-1">
            <span>Explore Rules</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 4: Submit for Review */}
        <div
          onClick={() => navigate('/scan')}
          className="p-5 rounded-xl bg-white dark:bg-rose-950/30 border-2 border-rose-200 dark:border-rose-800/50 hover:border-rose-500 dark:hover:border-rose-500 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-lg bg-rose-600 text-white flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-xs">
            <Upload className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-slate-950 dark:text-slate-100 group-hover:text-rose-700 dark:group-hover:text-rose-400 transition-colors">
            Submit for Review
          </h3>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1 mb-3">
            Upload packaging details for official inspection review
          </p>
          <div className="flex items-center text-xs font-extrabold text-rose-700 dark:text-rose-400 gap-1">
            <span>Submit Details</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Compliance Activity Overview</h2>
          <p className="text-xs text-gray-500">Summary of label scans and verification metrics</p>
        </div>
        <select
          value={timeRange}
          onChange={e => setTimeRange(Number(e.target.value))}
          className="px-3 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={cn('p-3 rounded-xl', stat.bg)}>
                  <stat.icon className={cn('w-6 h-6', stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Scan Status Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {data?.status_trend.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.status_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      labelFormatter={date => `Date: ${date}`}
                    />
                    <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} name="Total" />
                    <Line type="monotone" dataKey="passed" stroke="#22c55e" strokeWidth={2} dot={false} name="Passed" />
                    <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} name="Failed" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Violation Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Top Violations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {data?.top_violations.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={data.top_violations}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      dataKey="count"
                      nameKey="label"
                      label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.top_violations.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      formatter={(value: number, name: string) => [value, name]}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">No violations</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Distribution & Compliance Score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Category Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {data?.category_distribution.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.category_distribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" width={100} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">No data</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Avg Compliance Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <div className="text-center">
                <div className="relative w-40 h-40 mx-auto">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="80" cy="80" r="70"
                      fill="none" stroke="#e2e8f0" strokeWidth="12"
                    />
                    <circle
                      cx="80" cy="80" r="70"
                      fill="none"
                      stroke={data?.overview.avg_compliance_score && data.overview.avg_compliance_score >= 70 ? '#22c55e' : data?.overview.avg_compliance_score && data.overview.avg_compliance_score >= 40 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="12"
                      strokeDasharray={`${(data?.overview.avg_compliance_score ?? 0) / 100 * 439.8} 439.8`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold text-gray-900">{data?.overview.avg_compliance_score?.toFixed(1) ?? 0}%</span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">Average compliance score across all scans</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Scans */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Scans
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">File</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Verdict</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Score</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentScans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No scans yet. Upload your first label!</td>
                  </tr>
                ) : (
                  recentScans.map(scan => (
                    <tr key={scan.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 truncate max-w-xs">{scan.original_filename}</div>
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
                      <td className="px-4 py-3 text-gray-500">{formatRelativeTime(scan.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <a href={`/scan/${scan.id}`} className="text-primary-600 hover:text-primary-700 text-sm font-medium">View</a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sustainable Packaging Footer Banner */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 dark:from-emerald-950/40 dark:via-slate-900 dark:to-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
              Sustainable Packaging for a Better Tomorrow
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Comply Today, Contribute to a Healthier and Cleaner India
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/60 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <span>#GoGreen</span>
          <span>#ReducePlastic</span>
        </div>
      </div>
    </div>
  );
}