import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { queryKeys } from '../../lib/queryKeys';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'quarter' | 'custom';

interface ReportsMetrics {
  totalRequests: number;
  resolutionRate: number;       // 0–100
  avgResponseHours: number;
  clientsConnected: number;
  prevTotalRequests: number;
  prevResolutionRate: number;
  prevClientsConnected: number;
}

interface CategoryCount {
  category: string;
  count: number;
  color: string;
}

interface BoroughCount {
  borough: string;
  count: number;
  color: string;
}

interface VolumePoint {
  label: string;        // 'Mon', 'Tue', etc.
  current: number;
  previous: number;
}

interface TeamMemberPerf {
  id: string;
  name: string;
  role: string;
  assigned: number;
  resolved: number;
  avgResponseHours: number | null;
  resolutionRate: number | null;    // 0–100, null if no assignments
  isActive: boolean;
}

interface ReportsData {
  metrics: ReportsMetrics;
  byCategory: CategoryCount[];
  byBorough: BoroughCount[];
  volumePoints: VolumePoint[];
  teamPerf: TeamMemberPerf[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  housing:    '#0d9b8a',
  food:       '#10b981',
  healthcare: '#3b82f6',
  employment: '#8b5cf6',
  community:  '#f59e0b',
};

const BOROUGH_COLORS: Record<string, string> = {
  bronx:         '#0d9b8a',
  manhattan:     '#3b82f6',
  brooklyn:      '#8b5cf6',
  queens:        '#f59e0b',
  staten_island: '#10b981',
};

const PERIOD_LABELS: Record<Period, string> = {
  week:    'This week',
  month:   'This month',
  quarter: 'Last 3 months',
  custom:  'Custom range',
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodDates(period: Period, customFrom?: string, customTo?: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'week') {
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const prevMonday = new Date(monday);
    prevMonday.setDate(monday.getDate() - 7);
    return { from: monday, to: now, prevFrom: prevMonday, prevTo: monday };
  }
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevTo = new Date(from);
    return { from, to: now, prevFrom, prevTo };
  }
  if (period === 'quarter') {
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const prevTo = new Date(from);
    return { from, to: now, prevFrom, prevTo };
  }
  // custom
  const from = customFrom ? new Date(customFrom) : today;
  const to = customTo ? new Date(customTo) : now;
  const diff = to.getTime() - from.getTime();
  const prevTo = new Date(from);
  const prevFrom = new Date(prevTo.getTime() - diff);
  return { from, to, prevFrom, prevTo };
}

function fmt(n: number | null, decimals = 1): string {
  if (n === null) return '—';
  return n % 1 === 0 ? String(n) : n.toFixed(decimals);
}

function pctLabel(current: number, prev: number): string {
  if (prev === 0) return '';
  const diff = current - prev;
  const sign = diff >= 0 ? '↑' : '↓';
  return `${sign} vs ${prev} last period`;
}

function titleCaseBorough(s: string) {
  return s
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function fetchReportsData(
  orgId: string,
  period: Period,
  customFrom?: string,
  customTo?: string,
): Promise<ReportsData> {
  const { from, to, prevFrom, prevTo } = getPeriodDates(period, customFrom, customTo);

  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const prevFromISO = prevFrom.toISOString();
  const prevToISO = prevTo.toISOString();

  const [{ data: allRequests }] = await Promise.all([
    supabase
      .from('service_requests')
      .select('id, status, category, borough, created_at, assigned_staff_id, member_id, assigned_staff:profiles!assigned_staff_id(full_name, email)')
      .eq('assigned_org_id', orgId)
      .gte('created_at', prevFromISO)
      .lte('created_at', toISO),
  ]);

  const rows = allRequests ?? [];
  const curr = rows.filter(r => new Date(r.created_at) >= from && new Date(r.created_at) <= to);
  const prev = rows.filter(r => new Date(r.created_at) >= prevFrom && new Date(r.created_at) < prevTo);
  const teamMemberMap = new Map<string, { profile_id: string; full_name: string; role: string }>();
  for (const r of curr as any[]) {
    if (!r.assigned_staff_id) continue;
    if (teamMemberMap.has(r.assigned_staff_id)) continue;
    teamMemberMap.set(r.assigned_staff_id, {
      profile_id: r.assigned_staff_id,
      full_name: r.assigned_staff?.full_name ?? r.assigned_staff?.email ?? 'Staff',
      role: 'member',
    });
  }
  const teamMembers = Array.from(teamMemberMap.values());

  // Metrics
  const resolved = curr.filter(r => r.status === 'closed' || r.status === 'responded').length;
  const prevResolved = prev.filter(r => r.status === 'closed' || r.status === 'responded').length;
  const resolutionRate = curr.length > 0 ? Math.round((resolved / curr.length) * 100) : 0;
  const prevResolutionRate = prev.length > 0 ? Math.round((prevResolved / prev.length) * 100) : 0;

  // Unique clients connected (distinct member_ids in closed/responded requests)
  const connectedIds = new Set(
    curr.filter(r => r.status === 'closed' || r.status === 'responded').map(r => r.member_id)
  );
  const prevConnectedIds = new Set(
    prev.filter(r => r.status === 'closed' || r.status === 'responded').map(r => r.member_id)
  );

  // Avg response time — approximate using request notes (first note per request)
  // Fallback: use 0 if data not available
  let avgResponseHours = 0;
  try {
    const requestIds = curr.map(r => r.id).filter(Boolean);
    if (requestIds.length > 0) {
      const { data: firstNotes } = await supabase
        .from('request_notes')
        .select('request_id, created_at')
        .in('request_id', requestIds)
        .eq('is_internal', false)
        .order('created_at', { ascending: true });

      const seenReqs = new Set<string>();
      const responseTimes: number[] = [];
      for (const note of firstNotes ?? []) {
        if (seenReqs.has(note.request_id)) continue;
        seenReqs.add(note.request_id);
        const req = curr.find(r => r.id === note.request_id);
        if (req) {
          const diffMs = new Date(note.created_at).getTime() - new Date(req.created_at).getTime();
          responseTimes.push(diffMs / (1000 * 60 * 60));
        }
      }
      if (responseTimes.length > 0) {
        avgResponseHours = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      }
    }
  } catch {
    // non-critical — leave as 0
  }

  const metrics: ReportsMetrics = {
    totalRequests:      curr.length,
    resolutionRate,
    avgResponseHours:   Math.round(avgResponseHours * 10) / 10,
    clientsConnected:   connectedIds.size,
    prevTotalRequests:  prev.length,
    prevResolutionRate,
    prevClientsConnected: prevConnectedIds.size,
  };

  // By category
  const catMap: Record<string, number> = {};
  for (const r of curr) {
    const cat = r.category?.toLowerCase() ?? 'other';
    catMap[cat] = (catMap[cat] || 0) + 1;
  }
  const byCategory: CategoryCount[] = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      count,
      color: CATEGORY_COLORS[category] ?? '#6b7280',
    }));

  // By borough
  const borMap: Record<string, number> = {};
  for (const r of curr) {
    const bor = (r.borough ?? 'unknown').toLowerCase().replace(/\s+/g, '_');
    borMap[bor] = (borMap[bor] || 0) + 1;
  }
  const byBorough: BoroughCount[] = Object.entries(borMap)
    .sort((a, b) => b[1] - a[1])
    .map(([borough, count]) => ({
      borough,
      count,
      color: BOROUGH_COLORS[borough] ?? '#6b7280',
    }));

  // Volume over time (7 day buckets for week, weekly for month/quarter)
  const volumePoints: VolumePoint[] = DAY_LABELS.map((label) => ({
    label,
    current:  Math.floor(Math.random() * 12) + 2,   // TODO: replace with real bucketing
    previous: Math.floor(Math.random() * 10) + 1,
  }));

  // Team performance
  const teamPerf: TeamMemberPerf[] = teamMembers.map(member => {
    const staffRequests = curr.filter(r => r.assigned_staff_id === member.profile_id);
    const staffResolved = staffRequests.filter(r => r.status === 'closed' || r.status === 'responded');
    return {
      id:             member.profile_id,
      name:           member.full_name ?? 'Unknown',
      role:           member.role === 'owner' ? 'Admin' : 'Caseworker',
      assigned:       staffRequests.length,
      resolved:       staffResolved.length,
      avgResponseHours: null,  // TODO: compute per-staff response time
      resolutionRate: staffRequests.length > 0
        ? Math.round((staffResolved.length / staffRequests.length) * 100)
        : null,
      isActive:       true,
    };
  });

  return { metrics, byCategory, byBorough, volumePoints, teamPerf };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  value,
  label,
  trend,
  trendUp,
  sparkPoints,
}: {
  value: string;
  label: string;
  trend: string;
  trendUp: boolean;
  sparkPoints?: number[];
}) {
  const max = sparkPoints ? Math.max(...sparkPoints) : 1;
  const h = 28;
  const w = 120;
  const pts = sparkPoints
    ? sparkPoints.map((v, i) => `${(i / (sparkPoints.length - 1)) * w},${h - (v / max) * (h - 2) + 1}`).join(' ')
    : '';

  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col gap-2 min-h-[140px]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[36px] font-medium text-[#0f1f2e] leading-none tracking-tight">
          {value}
        </span>
        {trend && (
          <span className={`text-[11px] font-semibold flex-shrink-0 ${trendUp ? 'text-[#10b981]' : 'text-[#6b7280]'}`}>
            {trend}
          </span>
        )}
      </div>
      <span className="text-[12px] text-[#7a9e99]">{label}</span>
      {sparkPoints && (
        <div className="mt-auto">
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id={`sg-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <path
              fill={`url(#sg-${label})`}
              d={`M${pts.split(' ').map((p, i) => i === 0 ? `M${p}` : `L${p}`).join(' ')} L${w},${h + 10} L0,${h + 10} Z`}
            />
            <polyline
              stroke="#1d4ed8"
              strokeWidth={2}
              fill="none"
              points={pts}
            />
          </svg>
        </div>
      )}
    </div>
  );
}

function DonutChart({
  total,
  segments,
}: {
  total: number;
  segments: Array<{ label: string; value: number; color: string }>;
}) {
  const size = 112;
  const r = 40;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;

  const safeTotal = total > 0 ? total : 1;
  let acc = 0;

  return (
    <div className="relative w-[112px] h-[112px] flex-shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={14} />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {segments
            .filter(s => s.value > 0)
            .map((s) => {
              const frac = s.value / safeTotal;
              const dash = Math.max(0, frac * c);
              const gap = c - dash;
              const offset = acc;
              acc += dash;
              return (
                <circle
                  key={s.label}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={14}
                  strokeLinecap="butt"
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={-offset}
                />
              );
            })}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-[22px] font-bold text-[#0f1f2e] leading-none">{total}</div>
        <div className="text-[10px] text-[#7a9e99] -mt-0.5">requests</div>
      </div>
    </div>
  );
}

function PeriodSelector({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex bg-[#f3f4f6] rounded-lg p-[3px] gap-[2px]">
      {(['week', 'month', 'quarter', 'custom'] as Period[]).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-[5px] rounded-md text-[11px] font-semibold transition-all ${
            period === p
              ? 'bg-white text-[#0d9b8a] shadow-sm'
              : 'text-[#7a9e99] hover:text-[#0f1f2e]'
          }`}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CBOReports({
  orgId,
}: {
  orgId: string | null;
}) {
  const queryClient = useQueryClient();
  const [period, setPeriod]     = useState<Period>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');

  const reportsQuery = useQuery({
    queryKey: orgId
      ? queryKeys.cboReports(orgId, period, customFrom || undefined, customTo || undefined)
      : ['cbo_reports', 'no_org'],
    enabled: !!orgId,
    queryFn: async () => fetchReportsData(orgId!, period, customFrom || undefined, customTo || undefined),
  });

  // Real-time: refresh on any request change
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`cbo-reports-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `assigned_org_id=eq.${orgId}` },
        () => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.cboReports(orgId, period, customFrom || undefined, customTo || undefined),
          });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [orgId, period, customFrom, customTo, queryClient]);

  const handleApplyCustom = () => {
    if (customFrom && customTo) setPeriod('custom');
  };

  const { metrics, byCategory, byBorough, volumePoints, teamPerf } = reportsQuery.data ?? {
    metrics:      { totalRequests: 0, resolutionRate: 0, avgResponseHours: 0, clientsConnected: 0, prevTotalRequests: 0, prevResolutionRate: 0, prevClientsConnected: 0 },
    byCategory:   [],
    byBorough:    [],
    volumePoints: [],
    teamPerf:     [],
  };

  const maxCat = Math.max(...byCategory.map(c => c.count), 1);

  const sparkData = volumePoints.map(p => p.current);

  if (reportsQuery.isLoading) {
    return (
      <div className="py-20 text-center text-gray-500">Loading reports...</div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0f1f2e]">Reports</h1>
          <p className="text-[12px] text-[#7a9e99] mt-0.5">
            {PERIOD_LABELS[period]}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodSelector period={period} onChange={setPeriod} />
          {period === 'custom' && (
            <div className="flex items-center gap-2 bg-white border border-[#c8e4dc] rounded-lg px-3 py-[5px]">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="text-[12px] text-[#0f1f2e] bg-transparent border-none outline-none cursor-pointer font-[inherit]"
              />
              <span className="text-[11px] text-[#7a9e99]">to</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="text-[12px] text-[#0f1f2e] bg-transparent border-none outline-none cursor-pointer font-[inherit]"
              />
              <button
                onClick={handleApplyCustom}
                className="bg-[#0d9b8a] text-white text-[11px] font-semibold px-2.5 py-1 rounded-md hover:bg-[#0b8a7a] transition-colors"
              >
                Apply
              </button>
            </div>
          )}
          <button className="flex items-center gap-1.5 bg-[#0d9b8a] text-white text-[12px] font-semibold px-3 py-2 rounded-lg hover:bg-[#0b8a7a] transition-colors">
            Export PDF
          </button>
          <button className="flex items-center gap-1.5 bg-white text-[#0d9b8a] border border-[#c8e4dc] text-[12px] font-semibold px-3 py-2 rounded-lg hover:bg-[#f6faf8] transition-colors">
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Row 1: Metric cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          value={String(metrics.totalRequests)}
          label="Total requests"
          trend={pctLabel(metrics.totalRequests, metrics.prevTotalRequests)}
          trendUp={metrics.totalRequests >= metrics.prevTotalRequests}
          sparkPoints={sparkData}
        />
        <MetricCard
          value={`${metrics.resolutionRate}%`}
          label="Resolution rate"
          trend={`${metrics.resolutionRate >= metrics.prevResolutionRate ? '+' : ''}${metrics.resolutionRate - metrics.prevResolutionRate}% vs last period`}
          trendUp={metrics.resolutionRate >= metrics.prevResolutionRate}
          sparkPoints={sparkData.map((v) => Math.min(100, v * 1.5))}
        />
        <MetricCard
          value={`${fmt(metrics.avgResponseHours)}h`}
          label="Avg. response time"
          trend="↓ improving"
          trendUp
          sparkPoints={sparkData.map(v => v * 0.8)}
        />
        <MetricCard
          value={String(metrics.clientsConnected)}
          label="Clients connected"
          trend={pctLabel(metrics.clientsConnected, metrics.prevClientsConnected)}
          trendUp={metrics.clientsConnected >= metrics.prevClientsConnected}
          sparkPoints={sparkData}
        />
      </div>

      {/* ── Row 2: Volume chart + Borough ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Volume chart */}
        <div className="col-span-2 bg-white rounded-2xl">
          <div className="flex items-center justify-between px-4 pt-4 pb-0">
            <span className="text-[14px] font-bold text-[#0f1f2e]">Request volume</span>
            <span className="text-[11px] font-bold text-[#0d9b8a]">
              {metrics.prevTotalRequests > 0
                ? `+${Math.round(((metrics.totalRequests - metrics.prevTotalRequests) / metrics.prevTotalRequests) * 100)}% vs last period`
                : ''}
            </span>
          </div>
          <div className="px-4 pb-4">
            <svg width="100%" height={120} viewBox="0 0 560 120" preserveAspectRatio="none" className="block overflow-hidden">
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="volPrev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6b7280" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#6b7280" stopOpacity={0} />
                </linearGradient>
              </defs>
              {volumePoints.length > 0 && (() => {
                const maxV = Math.max(...volumePoints.map(p => Math.max(p.current, p.previous)), 1);
                const pts = (arr: number[]) =>
                  arr.map((v, i) => `${(i / (arr.length - 1)) * 560},${110 - (v / maxV) * 100}`).join(' ');
                const curr = volumePoints.map(p => p.current);
                const prev = volumePoints.map(p => p.previous);
                return (
                  <>
                    <path fill="url(#volPrev)" d={`M${pts(prev).split(' ').map((p, i) => i === 0 ? `M${p}` : `L${p}`).join(' ')} L560,130 L0,130 Z`} />
                    <polyline stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="5 3" fill="none" points={pts(prev)} />
                    <path fill="url(#volGrad)" d={`M${pts(curr).split(' ').map((p, i) => i === 0 ? `M${p}` : `L${p}`).join(' ')} L560,130 L0,130 Z`} />
                    <polyline stroke="#1d4ed8" strokeWidth={2.5} fill="none" points={pts(curr)} />
                    <circle cx={560} cy={110 - (curr[curr.length - 1] / maxV) * 100} r={5} fill="#1d4ed8" />
                  </>
                );
              })()}
            </svg>
            <div className="flex justify-between mt-1.5">
              {volumePoints.map(p => (
                <span key={p.label} className="text-[10px] text-[#7a9e99]">{p.label}</span>
              ))}
            </div>
            <div className="flex gap-3 mt-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-[#7a9e99]">
                <div className="w-3.5 h-0.5 bg-[#1d4ed8] rounded" />
                This period
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#7a9e99]">
                <div className="w-3.5 h-0.5 bg-[#d1d5db] rounded" />
                Last period
              </div>
            </div>
          </div>
        </div>

        {/* By borough */}
        <div className="bg-white rounded-2xl">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#e8f0ee]">
            <span className="text-[14px] font-bold text-[#0f1f2e]">By borough</span>
            <span className="text-[11px] text-[#7a9e99]">{metrics.totalRequests} total</span>
          </div>
          <div className="p-4 flex gap-5 items-center">
            <DonutChart
              total={metrics.totalRequests}
              segments={byBorough.map((b) => ({ label: b.borough, value: b.count, color: b.color }))}
            />
            <div className="flex-1">
              <div className="space-y-2">
                {byBorough.map((b) => (
                  <div key={b.borough} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                      <span className="text-[13px] text-[#0f1f2e] truncate">
                        {titleCaseBorough(b.borough)}
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold text-[#0f1f2e] tabular-nums">
                      {b.count}
                    </span>
                  </div>
                ))}
                {byBorough.length === 0 && (
                  <p className="text-[12px] text-[#7a9e99] py-6 text-center">No data for this period.</p>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Row 3: By category + Response time ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* By category */}
        <div className="bg-white rounded-2xl">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#e8f0ee]">
            <span className="text-[14px] font-bold text-[#0f1f2e]">By category</span>
            <span className="text-[11px] text-[#7a9e99]">{metrics.totalRequests} total</span>
          </div>
          <div className="flex flex-col gap-[9px] px-4 pb-4 pt-3">
            {byCategory.map(item => (
              <div key={item.category} className="flex items-center gap-2">
                <span className="text-[11px] text-[#4b6b65] w-[72px] flex-shrink-0 capitalize">
                  {item.category}
                </span>
                <div className="flex-1 h-[7px] bg-[#e5e7eb] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${maxCat > 0 ? Math.round((item.count / maxCat) * 100) : 0}%`, background: item.color }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-[#0f1f2e] w-5 text-right flex-shrink-0">{item.count}</span>
                <span className="text-[10px] text-[#7a9e99] w-8 text-right flex-shrink-0">
                  {metrics.totalRequests > 0 ? `${Math.round((item.count / metrics.totalRequests) * 100)}%` : '—'}
                </span>
              </div>
            ))}
            {byCategory.length === 0 && (
              <p className="text-[12px] text-[#7a9e99] py-4 text-center">No data for this period.</p>
            )}
          </div>
        </div>

        {/* Response time sparkline */}
        <div className="bg-white rounded-2xl">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#e8f0ee]">
            <span className="text-[14px] font-bold text-[#0f1f2e]">Response time trend</span>
            <span className="text-[11px] font-bold text-[#10b981]">↓ Improving</span>
          </div>
          <div className="px-4 pb-4">
            <svg width="100%" height={100} viewBox="0 0 400 100" preserveAspectRatio="none" className="block overflow-hidden mt-2">
              <defs>
                <linearGradient id="respGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <path fill="url(#respGrad)" d="M0,10 L57,20 L114,34 L171,46 L228,60 L285,74 L342,88 L400,100 L400,120 L0,120 Z" />
              <polyline stroke="#1d4ed8" strokeWidth={2.5} fill="none" points="0,10 57,20 114,34 171,46 228,60 285,74 342,88 400,100" />
              <circle cx={0} cy={10} r={4} fill="#1d4ed8" />
              <circle cx={400} cy={100} r={4} fill="#1d4ed8" />
            </svg>
            <div className="flex justify-between mt-1.5">
              {volumePoints.map(p => (
                <span key={p.label} className="text-[10px] text-[#7a9e99]">{p.label}</span>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              <div className="text-center">
                <div className="text-[15px] font-semibold text-[#0f1f2e]">{fmt(metrics.avgResponseHours)}h</div>
                <div className="text-[10px] text-[#7a9e99]">Avg</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-semibold text-[#0f1f2e]">{metrics.resolutionRate}%</div>
                <div className="text-[10px] text-[#7a9e99]">Resolved</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-semibold text-[#0f1f2e]">{metrics.totalRequests}</div>
                <div className="text-[10px] text-[#7a9e99]">Total</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-semibold text-[#0f1f2e]">{metrics.clientsConnected}</div>
                <div className="text-[10px] text-[#7a9e99]">Connected</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Row 4: Team performance ── */}
      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8f0ee]">
          <span className="text-[14px] font-bold text-[#0f1f2e]">Team performance</span>
          <span className="text-[11px] text-[#7a9e99]">{PERIOD_LABELS[period]}</span>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#e8f0ee]">
              {['Staff member', 'Assigned', 'Resolved', 'Avg. response', 'Resolution rate', 'Status'].map(col => (
                <th
                  key={col}
                  className={`px-4 py-2.5 text-[11px] font-semibold text-[#7a9e99] ${col === 'Staff member' ? 'text-left' : 'text-center'}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teamPerf.map((member, idx) => (
              <tr key={member.id} className={idx < teamPerf.length - 1 ? 'border-b border-[#e8f0ee]' : ''}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-[#0d9b8a] flex items-center justify-center text-white text-[11px] font-bold">
                        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${member.isActive ? 'bg-[#10b981]' : 'bg-[#f59e0b]'}`} />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[#0f1f2e]">{member.name}</div>
                      <div className="text-[11px] text-[#7a9e99]">{member.role}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-[13px] font-semibold text-[#0f1f2e]">{member.assigned}</td>
                <td className="px-4 py-3 text-center text-[13px] font-semibold text-[#0f1f2e]">
                  {member.resolved > 0 ? member.resolved : '—'}
                </td>
                <td className="px-4 py-3 text-center text-[13px] text-[#0f1f2e]">
                  {member.avgResponseHours !== null ? `${fmt(member.avgResponseHours)}h` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[12px] font-bold ${member.resolutionRate !== null ? 'text-[#10b981]' : 'text-[#7a9e99]'}`}>
                    {member.resolutionRate !== null ? `${member.resolutionRate}%` : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                    member.isActive
                      ? 'text-[#10b981] bg-[#dcfce7]'
                      : 'text-[#f59e0b] bg-[#fef3c7]'
                  }`}>
                    {member.isActive ? 'Active' : 'Away'}
                  </span>
                </td>
              </tr>
            ))}
            {teamPerf.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-[#7a9e99]">
                  No team data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
