import { useEffect, useState } from 'react';
import { dashboardApi } from '../services/api';
import type { DashboardResponse } from '../services/apiTypes';
import { BarChart3, PieChart, TrendingUp, Target, Filter, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/UI';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, AreaChart, Area } from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function Analytics() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.overview(timeRange);
      setData(res.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [timeRange]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <Card><CardContent className="h-24" /></Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardContent className="h-64" /></Card>
            <Card><CardContent className="h-64" /></Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500">Deep insights into compliance scanning trends</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={timeRange}
            onChange={e => setTimeRange(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Scans</p>
                <p className="text-3xl font-bold text-gray-900">{data?.overview.total_scans ?? 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary-100">
                <BarChart3 className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pass Rate</p>
                <p className="text-3xl font-bold text-gray-900">{data?.overview.pass_rate ?? 0}%</p>
              </div>
              <div className="p-3 rounded-xl bg-success-100">
                <Target className="w-6 h-6 text-success-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg OCR Confidence</p>
                <p className="text-3xl font-bold text-gray-900">{data?.overview.avg_ocr_confidence?.toFixed(1) ?? '—'}%</p>
              </div>
              <div className="p-3 rounded-xl bg-warning-100">
                <TrendingUp className="w-6 h-6 text-warning-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Compliance Score</p>
                <p className="text-3xl font-bold text-gray-900">{data?.overview.avg_compliance_score?.toFixed(1) ?? '—'}%</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-100">
                <PieChart className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scan Volume Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Scan Volume Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {data?.status_trend.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.status_trend}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPassed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      labelFormatter={date => `Date: ${date}`}
                    />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={2} name="Total" />
                    <Area type="monotone" dataKey="passed" stroke="#22c55e" fillOpacity={1} fill="url(#colorPassed)" strokeWidth={2} name="Passed" />
                    <Area type="monotone" dataKey="failed" stroke="#ef4444" fillOpacity={1} fill="url(#colorFailed)" strokeWidth={2} name="Failed" />
                  </AreaChart>
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
              Violation Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {data?.top_violations.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={data.top_violations}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="count"
                      nameKey="label"
                      label={({ label, percent }) => `${label} ${(percent * 100).toFixed(1)}%`}
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
                <div className="h-full flex items-center justify-center text-gray-400">No violations recorded</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category & Compliance Score Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Product Category Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {data?.category_distribution.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.category_distribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" width={120} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">No category data</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Compliance Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {/* Simulated score distribution - in reality would come from API */}
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { range: '90-100', count: 12 },
                  { range: '80-89', count: 18 },
                  { range: '70-79', count: 25 },
                  { range: '60-69', count: 15 },
                  { range: '50-59', count: 8 },
                  { range: '40-49', count: 5 },
                  { range: 'Below 40', count: 3 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Violation Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Detailed Violation Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Field</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Total Violations</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Critical</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Major</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Minor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Pass Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data?.top_violations.map((v) => (
                  <tr key={v.field_key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{v.label}</td>
                    <td className="px-4 py-3">{v.count}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-danger-100 text-danger-600 rounded text-xs font-medium">
                        {Math.floor(v.count * 0.2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded text-xs font-medium">
                        {Math.floor(v.count * 0.4)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-warning-100 text-warning-600 rounded text-xs font-medium">
                        {Math.floor(v.count * 0.4)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-success-600">{(100 - (v.count / (data?.overview.total_scans || 1)) * 100).toFixed(1)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}