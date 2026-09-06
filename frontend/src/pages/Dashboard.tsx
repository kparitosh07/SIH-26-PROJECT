import { useEffect, useState } from 'react';
import {
  FileText, CheckCircle, AlertTriangle, Clock, RefreshCw,
  BarChart3, PieChart, Activity, Target
} from 'lucide-react';
import { dashboardApi, scansApi } from '../services/api';
import type { DashboardResponse, Scan } from '../services/apiTypes';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '../components/UI';
import { cn, formatRelativeTime, getSeverityColor, getErrorMessage } from '../utils/helpers';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function Dashboard() {
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
    { label: 'Total Scans', value: data?.overview.total_scans ?? 0, icon: FileText, color: 'text-primary-600', bg: 'bg-primary-100' },
    { label: 'Completed', value: data?.overview.completed_scans ?? 0, icon: CheckCircle, color: 'text-success-600', bg: 'bg-success-100' },
    { label: 'Failed', value: data?.overview.fail_scans ?? 0, icon: AlertTriangle, color: 'text-danger-600', bg: 'bg-danger-100' },
    { label: 'Pass Rate', value: `${data?.overview.pass_rate ?? 0}%`, icon: Target, color: 'text-primary-600', bg: 'bg-primary-100' },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of compliance scanning activity</p>
        </div>
        <select
          value={timeRange}
          onChange={e => setTimeRange(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
    </div>
  );
}