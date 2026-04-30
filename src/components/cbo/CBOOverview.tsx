import { useEffect, useMemo, useState } from 'react';
import { requestsApi } from '../../api/requests';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type InboxTab = 'unopened' | 'in_review' | 'in_progress' | 'responded' | 'urgent' | 'all';

interface TeamMember {
  profile_id: string;
  full_name: string;
  role: string;
  isActive: boolean;
  assignedRequests: ServiceRequest[];
}

interface ServiceRequest {
  id: string;
  status: string;
  category: string;
  borough: string;
  created_at: string;
  member_id: string;
  assigned_staff_id: string | null;
  urgency?: string;
  member?: { full_name: string };
  hoursOld?: number;
}

interface ActivityItem {
  id: string;
  actor: string;
  text: string;
  created_at: string;
  dotColor: string;
}

interface OrgMetrics {
  unopened: number;
  urgent: number;
  avgResponseHours: number;
  resolutionRate: number;
  clientsConnected: number;
  resolvedThisWeek: number;
  activeClients: number;
  clientSatisfaction: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function hoursAgo(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

function timeLabel(dateStr: string): string {
  const h = hoursAgo(dateStr);
  if (h < 1) return `${Math.round(h * 60)} min ago`;
  if (h < 24) return `${Math.round(h)} hr ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const TAB_DEFS: Record<InboxTab, string> = {
  unopened:    'Unopened — submitted by the client, not yet viewed by anyone on your team',
  in_review:   'Opened — a caseworker has viewed the request but hasn\'t responded yet',
  in_progress: 'In Progress — a caseworker is actively working the case and has made contact',
  responded:   'Responded — your team has sent a message; waiting on the client to reply',
  urgent:      'Urgent — flagged manually or unopened for 48+ hours',
  all:         'All requests across all statuses',
};

const TAB_LEFT_COLORS: Record<string, string> = {
  unopened:    '#f59e0b',
  in_review:   '#1d4ed8',
  in_progress: '#1d4ed8',
  responded:   '#15803d',
  urgent:      '#dc2626',
};

const ACTIVITY_DOT_COLORS = ['#0d9b8a', '#1d4ed8', '#f59e0b', '#15803d', '#0d9b8a'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  value, label, trend, trendColor = '#10b981',
  trendIcon, reviewNow, onReviewNow, sparkPoints,
}: {
  value: string;
  label: string;
  trend?: string;
  trendColor?: string;
  trendIcon?: boolean;
  reviewNow?: boolean;
  onReviewNow?: () => void;
  sparkPoints?: number[];
}) {
  const max = sparkPoints ? Math.max(...sparkPoints, 1) : 1;
  const h = 28; const W = 120;
  const pts = sparkPoints
    ? sparkPoints.map((v, i) => `${(i / (sparkPoints.length - 1)) * W},${h - (v / max) * (h - 4) + 2}`).join(' ')
    : '';

  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col gap-2 min-h-[140px]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[36px] font-medium text-[#0f1f2e] leading-none tracking-tight">{value}</span>
        {trend && (
          <span className="text-[11px] font-semibold flex-shrink-0 flex items-center gap-1" style={{ color: trendColor }}>
            {trendIcon && (
              <svg viewBox="0 0 16 16" className="w-[10px] h-[10px] flex-shrink-0" stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round">
                <circle cx="8" cy="8" r="6"/><path d="M8 5v3"/><circle cx="8" cy="11" r=".5" fill="currentColor" stroke="none"/>
              </svg>
            )}
            {trend}
          </span>
        )}
      </div>
      <span className="text-[12px] text-[#7a9e99]">{label}</span>
      {sparkPoints && (
        <div className="mt-auto overflow-hidden">
          <svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" className="block overflow-hidden">
            <defs>
              <linearGradient id={`sg-${label.replace(/\s/g,'')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.18}/>
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <path fill={`url(#sg-${label.replace(/\s/g,'')})`}
              d={`M0,${h - (sparkPoints[0] / max) * (h - 4) + 2} ${sparkPoints.map((v,i) => `L${(i/(sparkPoints.length-1))*W},${h-(v/max)*(h-4)+2}`).join(' ')} L${W},${h+4} L0,${h+4} Z`}
            />
            <polyline stroke="#1d4ed8" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" points={pts}/>
          </svg>
        </div>
      )}
      {reviewNow && (
        <button
          onClick={onReviewNow}
          className="mt-auto pt-3 text-left text-[12px] font-semibold text-[#7a9e99] hover:text-[#0d9b8a] transition-colors"
        >
          Review now →
        </button>
      )}
    </div>
  );
}

function ReqRow({
  request, showBadge = false, accentColor,
}: {
  request: ServiceRequest;
  showBadge?: boolean;
  accentColor?: string;
}) {
  const is48h = (request.hoursOld ?? 0) >= 48 && request.status === 'new';
  const name = request.member?.full_name ?? 'Unknown';
  const ini = initials(name);
  const avatarBg = CATEGORY_COLORS[request.category?.toLowerCase()] ?? '#6b7280';

  const STATUS_BADGES: Record<string, { bg: string; color: string; label: string }> = {
    new:         { bg: '#fef3c7', color: '#92400e', label: 'Unopened' },
    in_review:   { bg: '#f3f4f6', color: '#1d4ed8', label: 'Opened' },
    in_progress: { bg: '#f3f4f6', color: '#1d4ed8', label: 'In Progress' },
    responded:   { bg: '#dcfce7', color: '#15803d', label: 'Responded' },
    closed:      { bg: '#f3f4f6', color: '#6b7280', label: 'Closed' },
  };
  const badge = STATUS_BADGES[request.status];

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-[#e8f0ee] last:border-b-0 hover:bg-[#f6faf8] transition-colors cursor-pointer"
      style={accentColor ? { borderLeft: `3px solid ${accentColor}` } : {}}
    >
      <div className="relative flex-shrink-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold"
          style={{ background: avatarBg }}
        >
          {ini}
        </div>
        {request.status === 'new' && (
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#f59e0b] border-2 border-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#0f1f2e] truncate">{name}</div>
        <div className="text-[11px] text-[#7a9e99] truncate">
          {request.category} · {request.borough}
          {is48h && <span className="ml-1.5 text-[#f59e0b] font-semibold">· 48h+</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[11px] text-[#7a9e99]">{timeLabel(request.created_at)}</span>
        {showBadge && badge && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}

function HBarChart({ items, maxCount }: { items: { label: string; count: number; color: string }[]; maxCount: number }) {
  return (
    <div className="flex flex-col gap-[9px] px-4 pb-4 pt-3">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="text-[11px] text-[#4b6b65] w-[72px] flex-shrink-0 capitalize">{item.label.replace(/_/g, ' ')}</span>
          <div className="flex-1 h-[7px] bg-[#e5e7eb] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0}%`, background: item.color }}/>
          </div>
          <span className="text-[11px] font-semibold text-[#0f1f2e] w-4 text-right flex-shrink-0">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CBOOverview() {
  const { user } = useAuth();
  const [loading, setLoading]           = useState(true);
  const [orgId, setOrgId]               = useState<string | null>(null);
  const [orgStatus, setOrgStatus]       = useState<string | null>(null);
  const [requests, setRequests]         = useState<ServiceRequest[]>([]);
  const [teamActivity, setTeamActivity] = useState<ActivityItem[]>([]);
  const [teamMembers, setTeamMembers]   = useState<TeamMember[]>([]);
  const [activeTab, setActiveTab]       = useState<InboxTab>('unopened');
  const [attnDismissed, setAttnDismissed] = useState(false);

  // ── Load ──
  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        setLoading(true);
        const myOrgId = await requestsApi.getMyOrgId();
        setOrgId(myOrgId);

        if (myOrgId) {
          const { data: orgRow } = await supabase
            .from('organizations').select('status').eq('id', myOrgId).maybeSingle();
          setOrgStatus(orgRow?.status ?? null);
        }

        const [rawRequests, activity, members] = await Promise.all([
          requestsApi.getOrgRequests(),
          requestsApi.getOrgTeamActivity(10),
          requestsApi.getOrgTeamMembers(),
        ]);

        // Annotate requests with hoursOld
        const annotated = rawRequests.map((r: any) => ({
          ...r,
          hoursOld: hoursAgo(r.created_at),
        }));
        setRequests(annotated);

        // Map activity to display items
        setTeamActivity(
          activity.map((item: any, i: number) => ({
            id: item.id,
            actor: item.actor ?? 'Someone',
            text: item.text ?? '',
            created_at: item.created_at,
            dotColor: ACTIVITY_DOT_COLORS[i % ACTIVITY_DOT_COLORS.length],
          }))
        );

        // Map team members with their assigned requests
        setTeamMembers(
          members.map((m: any) => ({
            profile_id: m.profile_id,
            full_name: m.full_name ?? 'Unknown',
            role: m.role === 'owner' ? 'Admin' : 'Caseworker',
            isActive: true, // TODO: replace with real presence once available
            assignedRequests: annotated.filter((r: ServiceRequest) => r.assigned_staff_id === m.profile_id),
          }))
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [user]);

  // ── Reload callback (used by realtime) ──
  const reload = useMemo(() => async () => {
    const [rawRequests, activity] = await Promise.all([
      requestsApi.getOrgRequests(),
      requestsApi.getOrgTeamActivity(10),
    ]);
    const annotated = rawRequests.map((r: any) => ({ ...r, hoursOld: hoursAgo(r.created_at) }));
    setRequests(annotated);
    setTeamActivity(
      activity.map((item: any, i: number) => ({
        id: item.id, actor: item.actor ?? 'Someone',
        text: item.text ?? '', created_at: item.created_at,
        dotColor: ACTIVITY_DOT_COLORS[i % ACTIVITY_DOT_COLORS.length],
      }))
    );
  }, []);

  // ── Real-time ──
  useEffect(() => {
    if (!user || !orgId) return;
    const channel = supabase
      .channel(`cbo-overview-${orgId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'service_requests',
        filter: `assigned_org_id=eq.${orgId}`,
      }, () => void reload())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [orgId, reload, user]);

  // ── Derived data ──
  const byStatus = useMemo(() => {
    const map: Record<string, ServiceRequest[]> = {
      new: [], in_review: [], in_progress: [], responded: [], urgent: [], all: [],
    };
    for (const r of requests) {
      map.all.push(r);
      if (r.status === 'new') map.new.push(r);
      else if (r.status === 'in_review') map.in_review.push(r);
      else if (r.status === 'in_progress') map.in_progress.push(r);
      else if (r.status === 'responded') map.responded.push(r);
      // Urgent: new + unopened 48h+
      if ((r.status === 'new' && (r.hoursOld ?? 0) >= 48) || r.urgency === 'high') {
        map.urgent.push(r);
      }
    }
    return map;
  }, [requests]);

  const metrics: OrgMetrics = useMemo(() => {
    const total = requests.length;
    const resolved = requests.filter(r => r.status === 'closed' || r.status === 'responded').length;
    const uniqueClients = new Set(
      requests.filter(r => r.status === 'closed').map(r => r.member_id)
    ).size;
    return {
      unopened:         byStatus.new.length,
      urgent:           byStatus.urgent.length,
      avgResponseHours: 2.4,  // TODO: compute from request_notes
      resolutionRate:   total > 0 ? Math.round((resolved / total) * 100) : 0,
      clientsConnected: uniqueClients,
      resolvedThisWeek: resolved,
      activeClients:    new Set(requests.filter(r => r.status !== 'closed').map(r => r.member_id)).size,
      clientSatisfaction: 94,  // TODO: pull from ratings table when available
    };
  }, [requests, byStatus]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of requests) {
      const cat = r.category?.toLowerCase() ?? 'other';
      map[cat] = (map[cat] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count, color: CATEGORY_COLORS[label] ?? '#6b7280' }));
  }, [requests]);

  const byBorough = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of requests) {
      const bor = (r.borough ?? 'unknown').toLowerCase().replace(/\s+/g, '_');
      map[bor] = (map[bor] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count, color: BOROUGH_COLORS[label] ?? '#6b7280' }));
  }, [requests]);

  const maxCat = Math.max(...byCategory.map(c => c.count), 1);
  const maxBor = Math.max(...byBorough.map(b => b.count), 1);

  const sparkPlaceholder = [4, 6, 5, 8, 7, 10, 9, 12]; // TODO: replace with real daily buckets

  const panelRequests = useMemo(() => {
    const tab = activeTab;
    if (tab === 'unopened')    return byStatus.new;
    if (tab === 'in_review')   return byStatus.in_review;
    if (tab === 'in_progress') return byStatus.in_progress;
    if (tab === 'responded')   return byStatus.responded;
    if (tab === 'urgent')      return byStatus.urgent;
    return byStatus.all;
  }, [activeTab, byStatus]);

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) return <div className="py-20 text-center text-[#7a9e99]">Loading overview...</div>;

  return (
    <div className="space-y-4">

      {/* ── Org status banners (preserved from original) ── */}
      {orgStatus === 'pending' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Your organization is pending approval.</p>
          <p className="text-xs text-amber-800 mt-1">A HealthPowr admin will review your account shortly.</p>
        </div>
      )}
      {orgStatus === 'rejected' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-900">Your organization application was not approved.</p>
          <p className="text-xs text-red-800 mt-1">Contact <strong>support@healthpowr.app</strong> for more info.</p>
        </div>
      )}

      {/* ── ROW 1: Metric cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          value={String(metrics.unopened)}
          label="Unopened"
          trend="+3 today"
          trendColor="#6b7280"
        />
        <MetricCard
          value={String(metrics.urgent)}
          label="Urgent requests"
          trend="needs action"
          trendColor="#f59e0b"
          trendIcon
          reviewNow
          onReviewNow={() => setActiveTab('urgent')}
        />
        <MetricCard
          value={`${metrics.avgResponseHours}h`}
          label="Avg. response"
          trend="↓ improving"
          trendColor="#10b981"
          sparkPoints={sparkPlaceholder}
        />
        <MetricCard
          value={`${metrics.resolutionRate}%`}
          label="Resolution rate"
          trend="+2% this week"
          trendColor="#10b981"
          sparkPoints={sparkPlaceholder.map(v => v * 1.1)}
        />
      </div>

      {/* ── Attention strip ── */}
      {!attnDismissed && byStatus.urgent.length > 0 && (
        <div className="flex items-center gap-2 bg-[#fffbeb] border border-[#fde68a] rounded-xl px-3.5 py-2">
          <svg viewBox="0 0 16 16" className="w-[13px] h-[13px] flex-shrink-0" stroke="#92400e" fill="none" strokeWidth={1.5} strokeLinecap="round">
            <circle cx="8" cy="8" r="6"/><path d="M8 5v3"/><circle cx="8" cy="11" r=".5" fill="#92400e" stroke="none"/>
          </svg>
          <span className="flex-1 text-[12px] font-normal text-[#92400e]">
            {byStatus.urgent.length} {byStatus.urgent.length === 1 ? 'request hasn\'t' : 'requests haven\'t'} been opened in over 48 hours
          </span>
          <button
            onClick={() => setAttnDismissed(true)}
            className="text-[11px] font-semibold text-[#b45309] hover:text-[#92400e] transition-colors bg-none border-none cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── MASONRY: Inbox (left 2/3) + Team activity (right 1/3) ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>

        {/* Request inbox */}
        <div className="bg-white rounded-2xl flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8f0ee] flex-shrink-0">
            <span className="text-[14px] font-bold text-[#0f1f2e]">Request inbox</span>
            <button className="text-[12px] font-semibold text-[#0d9b8a] hover:underline">View all →</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#e8f0ee] overflow-x-auto flex-shrink-0">
            {([
              { id: 'unopened' as InboxTab,    label: 'Unopened',    count: byStatus.new.length },
              { id: 'in_review' as InboxTab,   label: 'Opened',      count: byStatus.in_review.length },
              { id: 'in_progress' as InboxTab, label: 'In Progress', count: byStatus.in_progress.length },
              { id: 'responded' as InboxTab,   label: 'Responded',   count: byStatus.responded.length },
              { id: 'urgent' as InboxTab,      label: 'Urgent',      count: byStatus.urgent.length, isUrgent: true },
              { id: 'all' as InboxTab,         label: 'All',         count: null },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? 'text-[#0d9b8a] border-[#0d9b8a]'
                    : 'text-[#7a9e99] border-transparent hover:text-[#0f1f2e]'
                }`}
              >
                {tab.label}
                {tab.count !== null && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={
                      tab.isUrgent
                        ? { background: '#f3f4f6', color: '#f59e0b' }
                        : activeTab === tab.id
                          ? { background: '#e1f5ee', color: '#0d9b8a' }
                          : { background: '#f3f4f6', color: '#7a9e99' }
                    }
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Status definition strip */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white border-b border-[#e8f0ee] flex-shrink-0">
            <svg viewBox="0 0 16 16" className="w-3 h-3 text-[#7a9e99] flex-shrink-0" stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round">
              <circle cx="8" cy="8" r="6"/><path d="M8 5v3"/><circle cx="8" cy="11" r=".5" fill="currentColor" stroke="none"/>
            </svg>
            <span className="text-[11px] text-[#7a9e99]">{TAB_DEFS[activeTab]}</span>
          </div>

          {/* Request rows */}
          <div className="flex-1 overflow-y-auto">
            {panelRequests.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[#7a9e99]">No requests in this category.</div>
            ) : (
              panelRequests.map(req => (
                <ReqRow
                  key={req.id}
                  request={req}
                  accentColor={TAB_LEFT_COLORS[activeTab === 'all' ? req.status : activeTab]}
                  showBadge={activeTab === 'all'}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#e8f0ee] flex-shrink-0">
            <span className="text-[11px] text-[#7a9e99]">
              {panelRequests.length} {activeTab === 'all' ? 'total' : activeTab.replace('_', ' ')}
            </span>
            <button className="text-[12px] font-semibold text-[#0d9b8a] hover:underline">View all →</button>
          </div>

        </div>

        {/* Team activity */}
        <div className="bg-white rounded-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8f0ee]">
            <span className="text-[14px] font-bold text-[#0f1f2e]">Team activity</span>
          </div>
          <div className="flex-1 flex flex-col justify-evenly py-2">
            {teamActivity.slice(0, 5).map((item, i) => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: item.dotColor }}/>
                <div>
                  <div className="text-[12px] text-[#0f1f2e]">
                    <strong>{item.actor}</strong> {item.text}
                  </div>
                  <div className="text-[11px] text-[#7a9e99] mt-0.5">{timeLabel(item.created_at)}</div>
                </div>
              </div>
            ))}
            {teamActivity.length === 0 && (
              <div className="py-8 text-center text-[13px] text-[#7a9e99]">No activity yet.</div>
            )}
          </div>
        </div>

      </div>

      {/* ── ROW 3: Volume + Category/Borough charts + Team members ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Left col: volume + two bar charts */}
        <div className="flex flex-col gap-4">

          {/* Volume chart */}
          <div className="bg-white rounded-2xl">
            <div className="flex items-center justify-between px-4 pt-4 pb-0">
              <span className="text-[14px] font-bold text-[#0f1f2e]">Request volume</span>
              <span className="text-[11px] font-bold text-[#0d9b8a]">+18% vs last week</span>
            </div>
            <div className="px-4 pb-4">
              <svg width="100%" height={80} viewBox="0 0 280 80" preserveAspectRatio="none" className="block overflow-hidden mt-2">
                <defs>
                  <linearGradient id="volG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.2}/>
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="volP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6b7280" stopOpacity={0.08}/>
                    <stop offset="100%" stopColor="#6b7280" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <path fill="url(#volP)" d="M0,62 L40,56 L80,54 L120,48 L160,52 L200,46 L240,44 L280,40 L280,100 L0,100 Z"/>
                <polyline stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="4 3" fill="none" points="0,62 40,56 80,54 120,48 160,52 200,46 240,44 280,40"/>
                <path fill="url(#volG)" d="M0,66 L40,58 L80,48 L120,36 L160,42 L200,24 L240,16 L280,10 L280,100 L0,100 Z"/>
                <polyline stroke="#1d4ed8" strokeWidth={2.5} fill="none" points="0,66 40,58 80,48 120,36 160,42 200,24 240,16 280,10"/>
                <circle cx={280} cy={10} r={4} fill="#1d4ed8"/>
                <circle cx={280} cy={10} r={8} fill="#1d4ed8" opacity={0.15}/>
              </svg>
              <div className="flex justify-between mt-1.5">
                {['Mon','Tue','Wed','Thu','Fri','Sat','Today'].map(d => (
                  <span key={d} className={`text-[10px] ${d === 'Today' ? 'text-[#0d9b8a] font-semibold' : 'text-[#7a9e99]'}`}>{d}</span>
                ))}
              </div>
              <div className="flex gap-3 mt-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-[#7a9e99]">
                  <div className="w-3.5 h-0.5 bg-[#1d4ed8] rounded"/> This week
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[#7a9e99]">
                  <div className="w-3.5 h-0.5 bg-[#d1d5db] rounded"/> Last week
                </div>
              </div>
            </div>
          </div>

          {/* Two bar charts */}
          <div className="grid grid-cols-2 gap-4">

            <div className="bg-white rounded-2xl">
              <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-[#e8f0ee]">
                <span className="text-[13px] font-bold text-[#0f1f2e]">By category</span>
                <span className="text-[11px] text-[#7a9e99]">{requests.length}</span>
              </div>
              <HBarChart items={byCategory} maxCount={maxCat}/>
            </div>

            <div className="bg-white rounded-2xl">
              <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-[#e8f0ee]">
                <span className="text-[13px] font-bold text-[#0f1f2e]">By borough</span>
                <span className="text-[11px] text-[#7a9e99]">{requests.length}</span>
              </div>
              <HBarChart items={byBorough} maxCount={maxBor}/>
            </div>

          </div>

        </div>

        {/* Team members */}
        <div className="bg-white rounded-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8f0ee]">
            <span className="text-[14px] font-bold text-[#0f1f2e]">Team members</span>
            <span className="text-[11px] text-[#7a9e99]">
              {teamMembers.filter(m => m.isActive).length} active · {teamMembers.filter(m => !m.isActive).length} away
            </span>
          </div>
          {teamMembers.map((member, i) => (
            <div
              key={member.profile_id}
              className={`flex items-start gap-4 px-4 py-3 ${i < teamMembers.length - 1 ? 'border-b border-[#e8f0ee]' : ''}`}
            >
              {/* Avatar + info */}
              <div className="flex items-center gap-2.5 min-w-[140px]">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-[#0d9b8a] flex items-center justify-center text-white text-[12px] font-bold">
                    {initials(member.full_name)}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${member.isActive ? 'bg-[#10b981]' : 'bg-[#f59e0b]'}`}/>
                </div>
                <div>
                  <div className="text-[13px] font-bold text-[#0f1f2e]">{member.full_name}</div>
                  <div className="text-[10px] font-semibold" style={{ color: member.isActive ? '#10b981' : '#f59e0b' }}>
                    {member.isActive ? 'Active' : 'Away'} · {member.assignedRequests.length} assigned
                  </div>
                </div>
              </div>
              {/* Assigned clients 2-col */}
              {member.assignedRequests.length > 0 ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 flex-1">
                  {member.assignedRequests.slice(0, 4).map(req => (
                    <div key={req.id} className="flex items-center gap-1.5 text-[11px] text-[#4b6b65]">
                      <div className="w-1 h-1 rounded-full bg-[#0d9b8a] flex-shrink-0"/>
                      {req.member?.full_name ?? 'Client'} · <span className="capitalize">{req.category}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 text-[11px] text-[#7a9e99] italic">No active assignments</div>
              )}
            </div>
          ))}
          {teamMembers.length === 0 && (
            <div className="py-8 text-center text-[13px] text-[#7a9e99]">No team members yet.</div>
          )}
        </div>

      </div>

      {/* ── ROW 4: Team performance ── */}
      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8f0ee]">
          <span className="text-[14px] font-bold text-[#0f1f2e]">Team performance</span>
          <span className="text-[11px] text-[#7a9e99]">This week</span>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#e8f0ee]">
              {['Staff member','Assigned','Resolved','Avg. response','Resolution rate','Status'].map(col => (
                <th key={col} className={`px-4 py-2.5 text-[11px] font-semibold text-[#7a9e99] ${col === 'Staff member' ? 'text-left' : 'text-center'}`}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((member, i) => {
              const resolved = member.assignedRequests.filter(r => r.status === 'closed' || r.status === 'responded').length;
              const rate = member.assignedRequests.length > 0
                ? Math.round((resolved / member.assignedRequests.length) * 100)
                : null;
              return (
                <tr key={member.profile_id} className={i < teamMembers.length - 1 ? 'border-b border-[#e8f0ee]' : ''}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-[#0d9b8a] flex items-center justify-center text-white text-[11px] font-bold">
                          {initials(member.full_name)}
                        </div>
                        <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-white ${member.isActive ? 'bg-[#10b981]' : 'bg-[#f59e0b]'}`}/>
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#0f1f2e]">{member.full_name}</div>
                        <div className="text-[11px] text-[#7a9e99]">{member.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-[13px] font-semibold text-[#0f1f2e]">{member.assignedRequests.length}</td>
                  <td className="px-4 py-3 text-center text-[13px] font-semibold text-[#0f1f2e]">{resolved || '—'}</td>
                  <td className="px-4 py-3 text-center text-[13px] text-[#0f1f2e]">—</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[12px] font-bold ${rate !== null ? 'text-[#10b981]' : 'text-[#7a9e99]'}`}>
                      {rate !== null ? `${rate}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      member.isActive ? 'text-[#10b981] bg-[#dcfce7]' : 'text-[#f59e0b] bg-[#fef3c7]'
                    }`}>
                      {member.isActive ? 'Active' : 'Away'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {teamMembers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-[#7a9e99]">No team data.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── ROW 5: Impact metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        {/* Dark hero card */}
        <div className="rounded-2xl p-4 flex flex-col gap-2 min-h-[140px]" style={{ background: '#0b1d2a' }}>
          <div className="text-[10px] font-bold tracking-widest" style={{ color: '#2dd4bf' }}>
            IMPACT THIS MONTH
          </div>
          <span className="text-[36px] font-medium leading-none tracking-tight text-white">{metrics.clientsConnected}</span>
          <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>clients connected to services</span>
          <div className="mt-auto overflow-hidden">
            <svg width="100%" height={28} viewBox="0 0 120 28" preserveAspectRatio="none" className="block overflow-hidden">
              <defs>
                <linearGradient id="impG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.25}/>
                  <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <path fill="url(#impG)" d="M0,22 L17,18 L34,20 L51,14 L68,12 L85,8 L102,5 L120,2 L120,40 L0,40 Z"/>
              <polyline stroke="#2dd4bf" strokeWidth={2} fill="none" points="0,22 17,18 34,20 51,14 68,12 85,8 102,5 120,2"/>
            </svg>
          </div>
          <span className="text-[10px] font-semibold" style={{ color: '#2dd4bf' }}>↑ vs last month</span>
        </div>

        <MetricCard
          value={String(metrics.resolvedThisWeek)}
          label="Resolved this week"
          trend="↑ vs last week"
          trendColor="#10b981"
          sparkPoints={sparkPlaceholder}
        />
        <MetricCard
          value={String(metrics.activeClients)}
          label="Active clients"
          trend="+12 this month"
          trendColor="#10b981"
          sparkPoints={sparkPlaceholder.map(v => v * 1.2)}
        />
        <MetricCard
          value={`${metrics.clientSatisfaction}%`}
          label="Client satisfaction"
          trend="↑ vs last month"
          trendColor="#10b981"
          sparkPoints={sparkPlaceholder.map(v => v * 0.95)}
        />

      </div>

    </div>
  );
}
