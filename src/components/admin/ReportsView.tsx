import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { requestsApi } from '../../api/requests';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';

type KV = { name: string; value: number };
type DateCount = { date: string; count: number };

const BOROUGH_COLORS = ['#0d9488', '#0284c7', '#7c3aed', '#db2777', '#ea580c', '#16a34a'];
const CHART_TEAL = '#0d9488';
const CATEGORY_COLORS = [
  '#0d9488', // teal
  '#7c3aed', // violet
  '#0284c7', // sky
  '#db2777', // pink
  '#ea580c', // orange
  '#16a34a', // green
  '#e11d48', // rose
  '#9333ea', // purple
  '#0891b2', // cyan
];

function groupAndCount(rows: Record<string, unknown>[] | null, field: string): KV[] {
  if (!rows?.length) return [];
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const val = (r[field] as string) || 'unknown';
    counts[val] = (counts[val] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function groupByDate(rows: { created_at: string }[] | null): DateCount[] {
  if (!rows?.length) return [];
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const date = r.created_at.slice(0, 10);
    counts[date] = (counts[date] || 0) + 1;
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

function StatCard({
  label,
  value,
  topRight,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  topRight?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`text-3xl font-bold ${accent ? 'text-teal-700' : 'text-gray-900'}`}>
          {value}
        </div>
        {topRight ? (
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            {topRight}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-gray-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export function ReportsView() {
  const [exporting, setExporting] = useState(false);

  const reportQuery = useQuery({
    queryKey: queryKeys.adminReportsSummary(),
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        counts,
        { data: catRaw, error: catErr },
        { data: boroughRaw, error: boroughErr },
        { data: timeRaw, error: timeErr },
        { data: orgRaw, error: orgErr },
        { data: closedRaw, error: closedErr },
      ] = await Promise.all([
        requestsApi.getStatusCounts(),
        supabase.from('service_requests').select('category, metadata, created_at'),
        supabase.from('service_requests').select('borough, metadata, created_at'),
        supabase
          .from('service_requests')
          .select('created_at, metadata')
          .gte('created_at', thirtyDaysAgo.toISOString()),
        supabase.from('organizations').select('status'),
        supabase
          .from('service_requests')
          .select('created_at, closed_at')
          .eq('status', 'closed')
          .not('closed_at', 'is', null),
      ]);

      if (catErr) throw catErr;
      if (boroughErr) throw boroughErr;
      if (timeErr) throw timeErr;
      if (orgErr) throw orgErr;
      if (closedErr) throw closedErr;

      return {
        statusCounts: counts,
        byCategory: groupAndCount(catRaw as Record<string, unknown>[], 'category'),
        byBorough: groupAndCount(boroughRaw as Record<string, unknown>[], 'borough'),
        overTime: groupByDate(timeRaw as { created_at: string }[] | null),
        orgByStatus: groupAndCount(orgRaw as Record<string, unknown>[], 'status'),
        closedForResolution: (closedRaw ?? []) as Array<{ created_at: string; closed_at: string | null }>,
      };
    },
  });

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const all: any[] = [];
      for (let p = 1; p < 10_000; p++) {
        const chunk = await requestsApi.exportCsv({ page: p, pageSize: 500 });
        all.push(...(chunk ?? []));
        if (!chunk || chunk.length < 500) break;
      }
      const data = all;
      const headers = ['ID', 'Category', 'Borough', 'Status', 'Member', 'Organization', 'Created At'];
      const rows = (data as any[]).map((r) => [
        r.id, r.category, r.borough, r.status,
        r.member?.[0]?.full_name || '',
        r.organization?.[0]?.name || '',
        new Date(r.created_at).toLocaleDateString(),
      ]);
      const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
      const link = document.createElement('a');
      link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
      link.download = `report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setExporting(false);
    }
  }

  const statusCounts = reportQuery.data?.statusCounts ?? {};
  const byCategory = reportQuery.data?.byCategory ?? [];
  const byBorough = reportQuery.data?.byBorough ?? [];
  const overTime = reportQuery.data?.overTime ?? [];
  const orgByStatus = reportQuery.data?.orgByStatus ?? [];
  const closedForResolution = reportQuery.data?.closedForResolution ?? [];

  const totalRequests = Object.values(statusCounts).reduce((s, n) => s + n, 0);
  const activeCBOs = orgByStatus.find((o) => o.name === 'approved')?.value ?? 0;
  const inProgress = (statusCounts['in_progress'] ?? 0) + (statusCounts['in_review'] ?? 0);

  const avgResolutionDays =
    closedForResolution.length > 0
      ? (
          closedForResolution.reduce((sum, r) => {
            if (!r.closed_at) return sum;
            const ms = new Date(r.closed_at).getTime() - new Date(r.created_at).getTime();
            return sum + ms / (1000 * 60 * 60 * 24);
          }, 0) / closedForResolution.length
        ).toFixed(1)
      : null;

  const topCategory = byCategory[0]?.name ?? null;
  const topCategoryPct =
    totalRequests > 0 && byCategory[0]
      ? Math.round((byCategory[0].value / totalRequests) * 100)
      : null;

  const resolutionRate =
    totalRequests > 0 ? Math.round(((statusCounts['closed'] ?? 0) / totalRequests) * 100) : null;

  if (reportQuery.isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-gray-500 font-medium">Analyzing data...</p>
      </div>
    );
  }

  if (reportQuery.isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-bold text-red-800 uppercase tracking-widest">Reports failed to load</p>
        <p className="text-xs text-red-600 mt-2">
          {reportQuery.error instanceof Error ? reportQuery.error.message : 'Unknown error'}
        </p>
        <button
          type="button"
          onClick={() => void reportQuery.refetch()}
          className="mt-6 h-10 px-6 rounded-xl bg-red-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-red-700 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Row 1: Summary cards */}
      <div>
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Service Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <StatCard label="Total Requests" value={totalRequests} accent />
          <StatCard label="New Requests" value={statusCounts['new'] ?? 0} />
          <StatCard label="In Progress" value={inProgress} />
          <StatCard label="Closed Cases" value={statusCounts['closed'] ?? 0} />
          <StatCard label="Active CBOs" value={activeCBOs} />
          <StatCard
            label="Avg time to resolution"
            value={avgResolutionDays ? `${avgResolutionDays}d` : '—'}
            topRight={closedForResolution.length ? `${closedForResolution.length} closed` : undefined}
          />
          <StatCard
            label="Top category"
            value={topCategory ? topCategory.replace(/_/g, ' ') : '—'}
            topRight={topCategoryPct !== null ? `${topCategoryPct}%` : undefined}
          />
          <StatCard
            label="Resolution rate"
            value={resolutionRate !== null ? `${resolutionRate}%` : '—'}
            topRight={totalRequests ? `${statusCounts['closed'] ?? 0}/${totalRequests}` : undefined}
          />
        </div>
      </div>

      {/* Row 2: Requests over time */}
      <ChartCard title="Requests Trend (Last 30 Days)">
        {overTime.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-gray-400">No data available for this period.</p>
          </div>
        ) : (
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overTime} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fontWeight: 600, fill: '#94a3b8' }}
                  tickFormatter={(v: string) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 9, fontWeight: 600, fill: '#94a3b8' }} 
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val) => [Number(val ?? 0), 'Requests']}
                  labelFormatter={(label) => `Date: ${String(label ?? '')}`}
                />
                <Bar dataKey="count" fill={CHART_TEAL} radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* Row 3: Category + Borough side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Distribution by Category">
          {byCategory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No category data.</p>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={byCategory}
                  margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                    width={100}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => v.replace(/_/g, ' ')}
                  />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Borough Breakdown">
          {byBorough.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No borough data.</p>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byBorough}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    label={(props) => {
                      const name = typeof props.name === "string" ? props.name : "—";
                      const p = typeof props.percent === "number" ? props.percent : 0;
                      return `${name} (${(p * 100).toFixed(0)}%)`;
                    }}
                    labelLine={false}
                  >
                    {byBorough.map((_, i) => (
                      <Cell key={i} fill={BOROUGH_COLORS[i % BOROUGH_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend 
                    verticalAlign="bottom" 
                    iconType="circle"
                    wrapperStyle={{ fontSize: 10, fontWeight: 600, paddingTop: '20px' }} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row 4: Organization status counts */}
      <div className="space-y-4">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Partner Organizations</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['pending', 'approved', 'rejected', 'suspended'].map((s) => {
            const count = orgByStatus.find((o) => o.name === s)?.value ?? 0;
            return (
              <div key={s} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{count}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export Section */}
      <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 font-medium">Download raw data for further analysis</p>
        <button
          onClick={() => void handleExport()}
          disabled={exporting}
          className="w-full sm:w-auto h-11 px-6 rounded-xl bg-teal-600 text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Generating...' : 'Export Complete Report'}
        </button>
      </div>
    </div>
  );
}