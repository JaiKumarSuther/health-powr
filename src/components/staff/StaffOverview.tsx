import { useEffect, useMemo, useState } from 'react';
import { requestsApi } from '../../api/requests';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type CaseTab = 'unopened' | 'in_progress' | 'responded' | 'urgent' | 'closed' | 'all';

interface MyRequest {
  id: string;
  status: string;
  category: string;
  borough: string;
  created_at: string;
  member_id: string;
  assigned_staff_id: string | null;
  member?: { full_name: string; phone?: string };
  notes?: { id: string; content: string; created_at: string; is_internal: boolean }[];
  hoursOld: number;
  isUrgent: boolean;
  hasUnreadMessage: boolean;
}

interface RecentMessage {
  id: string;
  clientName: string;
  initials: string;
  avatarColor: string;
  preview: string;
  timeLabel: string;
  isUnread: boolean;
  isAdmin?: boolean;
  adminName?: string;
}

interface ActivityItem {
  id: string;
  text: string;
  created_at: string;
  dotColor: string;
}

interface MyMetrics {
  activeCases: number;
  urgentCount: number;
  resolvedThisWeek: number;
  avgResponseHours: number;
  pendingResponses: number;
  clientsHelpedThisMonth: number;
  resolutionRate: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_DEFS: Record<CaseTab, string> = {
  unopened:    '<strong>Unopened</strong> — newly assigned to you, not yet viewed',
  in_progress: '<strong>In Progress</strong> — you are actively working this case',
  responded:   '<strong>Responded</strong> — you replied; waiting on the client',
  urgent:      '<strong>Urgent</strong> — flagged or unopened for 48+ hours',
  closed:      '<strong>Closed</strong> — cases you have resolved and closed',
  all:         'All your assigned cases across all statuses',
};

const TAB_LEFT_COLORS: Record<string, string> = {
  unopened:    '#f59e0b',
  in_progress: '#1d4ed8',
  responded:   '#15803d',
  urgent:      '#dc2626',
  closed:      '#d1d5db',
};

const STATUS_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  new:         { bg: '#fef3c7', color: '#92400e', label: 'Unopened' },
  in_review:   { bg: '#f3f4f6', color: '#1d4ed8', label: 'Opened' },
  in_progress: { bg: '#f3f4f6', color: '#1d4ed8', label: 'In Progress' },
  responded:   { bg: '#dcfce7', color: '#15803d', label: 'Responded' },
  closed:      { bg: '#f3f4f6', color: '#6b7280', label: 'Closed' },
};

const AVATAR_COLORS = ['#0d9b8a','#7c3aed','#d97706','#be185d','#0891b2','#15803d','#1d4ed8'];
const ACTIVITY_DOT_COLORS = ['#0d9b8a','#1d4ed8','#15803d','#1d4ed8','#0d9b8a'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursAgo(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

function timeLabel(dateStr: string): string {
  const h = hoursAgo(dateStr);
  if (h < 1) return `${Math.round(h * 60)} min ago`;
  if (h < 24) return `${Math.round(h)} hr ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return 'Last week';
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function avatarColor(name: string): string {
  const i = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ points, color = '#1d4ed8' }: { points: number[]; color?: string }) {
  const h = 28; const W = 120;
  const max = Math.max(...points, 1);
  const pts = points.map((v, i) => `${(i / (points.length - 1)) * W},${h - (v / max) * (h - 4) + 2}`).join(' ');
  const id = `sg-${color.replace('#', '')}-${Math.random().toString(36).slice(2, 6)}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'hidden', stroke: 'none' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={color === '#2dd4bf' ? 0.25 : 0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} stroke="none"
        d={`M0,${h - (points[0] / max) * (h-4) + 2} ${points.map((v,i) => `L${(i/(points.length-1))*W},${h-(v/max)*(h-4)+2}`).join(' ')} L${W},${h+4} L0,${h+4} Z`}
      />
      <polyline stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" points={pts} />
    </svg>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({
  value, label, trend, trendColor = '#10b981', trendIcon,
  reviewNow, onReviewNow, sparkPoints, sparkColor, dark, darkEyebrow, darkSub, darkTrend,
}: {
  value: string; label: string; trend?: string; trendColor?: string;
  trendIcon?: boolean; reviewNow?: boolean; onReviewNow?: () => void;
  sparkPoints?: number[]; sparkColor?: string;
  dark?: boolean; darkEyebrow?: string; darkSub?: string; darkTrend?: string;
}) {
  if (dark) {
    return (
      <div className="rounded-2xl p-4 flex flex-col gap-2 min-h-[140px]" style={{ background: '#0b1d2a' }}>
        {darkEyebrow && <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#2dd4bf' }}>{darkEyebrow}</div>}
        <div className="flex items-start justify-between gap-2">
          <span className="text-[36px] font-medium leading-none tracking-tight text-white">{value}</span>
        </div>
        {darkSub && <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{darkSub}</span>}
        {sparkPoints && (
          <div className="mt-auto overflow-hidden">
            <Sparkline points={sparkPoints} color="#2dd4bf" />
          </div>
        )}
        {darkTrend && <span className="text-[10px] font-semibold" style={{ color: '#2dd4bf' }}>{darkTrend}</span>}
      </div>
    );
  }

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
          <Sparkline points={sparkPoints} color={sparkColor ?? '#1d4ed8'} />
        </div>
      )}
      {reviewNow && (
        <button onClick={onReviewNow} className="mt-auto pt-3 text-left text-[12px] font-semibold text-[#7a9e99] hover:text-[#0d9b8a] transition-colors">
          Review now →
        </button>
      )}
    </div>
  );
}

// ─── CaseRow ──────────────────────────────────────────────────────────────────

function CaseRow({ req, showBadge, accentColor }: { req: MyRequest; showBadge: boolean; accentColor?: string }) {
  const name = req.member?.full_name ?? 'Unknown';
  const badge = STATUS_BADGES[req.status];

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-[#e8f0ee] last:border-b-0 hover:bg-[#f6faf8] transition-colors cursor-pointer"
      style={accentColor ? { borderLeft: `3px solid ${accentColor}` } : {}}
    >
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold"
          style={{ background: avatarColor(name) }}>
          {initials(name)}
        </div>
        {(req.status === 'new' || req.hasUnreadMessage) && (
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#f59e0b] border-2 border-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#0f1f2e] truncate">{name}</div>
        <div className="text-[11px] text-[#7a9e99] truncate capitalize">
          {req.category} · {req.borough}
          {req.isUrgent && <span className="ml-1.5 text-[#f59e0b] font-semibold">· 48h+</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[11px] text-[#7a9e99]">{timeLabel(req.created_at)}</span>
        {showBadge && badge && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StaffOverview() {
  const { user } = useAuth();
  const [loading, setLoading]           = useState(true);
  const [orgId, setOrgId]               = useState<string | null>(null);
  const [myRequests, setMyRequests]     = useState<MyRequest[]>([]);
  const [myActivity, setMyActivity]     = useState<ActivityItem[]>([]);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [activeTab, setActiveTab]       = useState<CaseTab>('unopened');
  const [userId, setUserId]             = useState<string | null>(null);

  // ── Load ──
  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        setLoading(true);
        const ctx = await requestsApi.getMyOrgMembership();
        setOrgId(ctx.orgId);
        setUserId(ctx.userId ?? null);

        const [rawRequests, activity] = await Promise.all([
          requestsApi.getOrgRequests(),                // already filtered to staff's own requests via getMyOrgMembership
          requestsApi.getOrgTeamActivity(10),
        ]);

        const annotated: MyRequest[] = rawRequests.map((r: any) => ({
          ...r,
          hoursOld: hoursAgo(r.created_at),
          isUrgent: (r.status === 'new' && hoursAgo(r.created_at) >= 48) || r.urgency === 'high',
          hasUnreadMessage: false, // TODO: derive from unread message count when available
        }));
        setMyRequests(annotated);

        setMyActivity(
          activity
            .filter((a: any) => a.actor_id === ctx.userId)   // only my own actions
            .slice(0, 5)
            .map((item: any, i: number) => ({
              id: item.id,
              text: item.text ?? '',
              created_at: item.created_at,
              dotColor: ACTIVITY_DOT_COLORS[i % ACTIVITY_DOT_COLORS.length],
            }))
        );

        // Recent messages — pull from latest notes that are not internal, on my requests
        const myReqIds = annotated.map(r => r.id);
        if (myReqIds.length > 0) {
          const { data: notes } = await supabase
            .from('request_notes')
            .select(`
              id, request_id, content, created_at, is_internal,
              author:profiles!author_id(id, full_name),
              request:service_requests!request_id(member_id, member:profiles!member_id(full_name))
            `)
            .in('request_id', myReqIds)
            .eq('is_internal', false)
            .neq('author_id', ctx.userId)   // messages from clients, not from me
            .order('created_at', { ascending: false })
            .limit(5);

          setRecentMessages(
            (notes ?? []).map((n: any) => {
              const clientName = n.request?.member?.full_name ?? 'Client';
              return {
                id: n.id,
                clientName,
                initials: initials(clientName),
                avatarColor: avatarColor(clientName),
                preview: n.content?.slice(0, 60) ?? '',
                timeLabel: timeLabel(n.created_at),
                isUnread: true,   // TODO: replace with actual read-status tracking
                isAdmin: false,
              };
            })
          );
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [user]);

  // ── Real-time ──
  useEffect(() => {
    if (!orgId || !userId) return;
    const channel = supabase
      .channel(`staff-overview-${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'service_requests',
        filter: `assigned_staff_id=eq.${userId}`,
      }, async () => {
        const rawRequests = await requestsApi.getOrgRequests();
        setMyRequests(rawRequests.map((r: any) => ({
          ...r,
          hoursOld: hoursAgo(r.created_at),
          isUrgent: (r.status === 'new' && hoursAgo(r.created_at) >= 48) || r.urgency === 'high',
          hasUnreadMessage: false,
        })));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [orgId, userId]);

  // ── Derived data ──
  const byTab = useMemo(() => {
    const map: Record<CaseTab, MyRequest[]> = {
      unopened:    myRequests.filter(r => r.status === 'new'),
      in_progress: myRequests.filter(r => r.status === 'in_progress'),
      responded:   myRequests.filter(r => r.status === 'responded'),
      urgent:      myRequests.filter(r => r.isUrgent),
      closed:      myRequests.filter(r => r.status === 'closed'),
      all:         myRequests,
    };
    return map;
  }, [myRequests]);

  const metrics: MyMetrics = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const resolvedThisWeek = myRequests.filter(r =>
      (r.status === 'closed' || r.status === 'responded') &&
      new Date(r.created_at) >= weekStart
    ).length;
    const total = myRequests.filter(r => r.status !== 'closed').length;
    const resolved = myRequests.filter(r => r.status === 'closed').length;
    return {
      activeCases:          myRequests.filter(r => r.status !== 'closed').length,
      urgentCount:          byTab.urgent.length,
      resolvedThisWeek,
      avgResponseHours:     2.1,  // TODO: compute from request_notes
      pendingResponses:     byTab.responded.length,
      clientsHelpedThisMonth: resolved,
      resolutionRate:       total + resolved > 0 ? Math.round((resolved / (total + resolved)) * 100) : 0,
    };
  }, [myRequests, byTab]);

  const panelRequests = byTab[activeTab];
  const sparkPlaceholder = [3, 5, 4, 7, 6, 8, 9, 10];

  // Today's focus — urgent first, then responded (need follow-up), then new
  const todaysFocus = useMemo(() => {
    const urgent = byTab.urgent.slice(0, 1).map(r => ({ req: r, type: 'urgent' as const }));
    const followUp = byTab.responded.slice(0, 1).map(r => ({ req: r, type: 'followup' as const }));
    const newCases = byTab.in_progress.slice(0, 1).map(r => ({ req: r, type: 'inprogress' as const }));
    return [...urgent, ...followUp, ...newCases].slice(0, 3);
  }, [byTab]);

  if (loading) return <div className="py-20 text-center text-[#7a9e99]">Loading your overview...</div>;

  return (
    <div className="space-y-4">

      {/* ── ROW 1: Metric cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          value={String(metrics.activeCases)}
          label="Active cases"
          trend="assigned to me"
          trendColor="#6b7280"
        />
        <MetricCard
          value={String(metrics.urgentCount)}
          label="Urgent / 48h+"
          trend="needs attention"
          trendColor="#f59e0b"
          trendIcon
          reviewNow
          onReviewNow={() => setActiveTab('urgent')}
        />
        <MetricCard
          value={String(metrics.resolvedThisWeek)}
          label="Resolved this week"
          trend="↑ vs last week"
          trendColor="#10b981"
          sparkPoints={sparkPlaceholder}
        />
        <MetricCard
          value={`${metrics.avgResponseHours}h`}
          label="Avg. response time"
          trend="↓ improving"
          trendColor="#10b981"
          sparkPoints={sparkPlaceholder.map(v => 12 - v)}
        />
      </div>

      {/* ── MAIN GRID: Cases (left 2fr) + Right col (1fr) ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>

        {/* ── My assigned cases inbox ── */}
        <div className="bg-white rounded-2xl flex flex-col overflow-hidden">

          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8f0ee] flex-shrink-0">
            <span className="text-[14px] font-bold text-[#0f1f2e]">My assigned cases</span>
            <button className="text-[12px] font-semibold text-[#0d9b8a] hover:underline">View all →</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#e8f0ee] overflow-x-auto flex-shrink-0">
            {([
              { id: 'unopened' as CaseTab,    label: 'Unopened',    count: byTab.unopened.length },
              { id: 'in_progress' as CaseTab, label: 'In Progress', count: byTab.in_progress.length },
              { id: 'responded' as CaseTab,   label: 'Responded',   count: byTab.responded.length },
              { id: 'urgent' as CaseTab,      label: 'Urgent',      count: byTab.urgent.length, isUrgent: true },
              { id: 'closed' as CaseTab,      label: 'Closed',      count: byTab.closed.length },
              { id: 'all' as CaseTab,         label: 'All',         count: null },
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
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    tab.isUrgent
                      ? 'bg-[#f3f4f6] text-[#f59e0b]'
                      : activeTab === tab.id
                        ? 'bg-[#e1f5ee] text-[#0d9b8a]'
                        : 'bg-[#f3f4f6] text-[#7a9e99]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tooltip strip */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white border-b border-[#e8f0ee] flex-shrink-0">
            <svg viewBox="0 0 16 16" className="w-3 h-3 text-[#7a9e99] flex-shrink-0" stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round">
              <circle cx="8" cy="8" r="6"/><path d="M8 5v3"/><circle cx="8" cy="11" r=".5" fill="currentColor" stroke="none"/>
            </svg>
            <span className="text-[11px] text-[#7a9e99]">{TAB_DEFS[activeTab]}</span>
          </div>

          {/* Case rows */}
          <div className="flex-1 overflow-y-auto">
            {panelRequests.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[#7a9e99]">No cases in this category.</div>
            ) : (
              panelRequests.map(req => (
                <CaseRow
                  key={req.id}
                  req={req}
                  accentColor={TAB_LEFT_COLORS[activeTab === 'all' ? req.status : activeTab]}
                  showBadge={activeTab === 'all'}
                />
              ))
            )}
          </div>

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#e8f0ee] flex-shrink-0">
            <span className="text-[11px] text-[#7a9e99]">
              {panelRequests.length} {activeTab === 'all' ? 'total' : activeTab.replace('_', ' ')}
            </span>
            <button className="text-[12px] font-semibold text-[#0d9b8a] hover:underline">View all →</button>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-4">

          {/* Today's focus */}
          <div className="bg-white rounded-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8f0ee]">
              <span className="text-[14px] font-bold text-[#0f1f2e]">Today's focus</span>
              <span className="text-[11px] text-[#7a9e99]">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
            {todaysFocus.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-[#7a9e99]">You're all caught up 🎉</div>
            ) : (
              <div className="py-1">
                {todaysFocus.map(({ req, type }, i) => {
                  const name = req.member?.full_name ?? 'Unknown';
                  const dotColor = type === 'urgent' ? '#dc2626' : type === 'followup' ? '#1d4ed8' : '#0d9b8a';
                  const subText = type === 'urgent'
                    ? 'Unopened 48h+ · urgent'
                    : type === 'followup'
                      ? 'Waiting on client · follow up'
                      : 'In progress · action needed';
                  return (
                    <div key={req.id} className={`flex items-start gap-2.5 px-4 py-2.5 ${i < todaysFocus.length - 1 ? 'border-b border-[#e8f0ee]' : ''}`}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: dotColor }} />
                      <div>
                        <div className="text-[12px] font-bold text-[#0f1f2e]">{name} — <span className="capitalize">{req.category}</span></div>
                        <div className="text-[11px] mt-0.5" style={{ color: type === 'urgent' ? '#dc2626' : '#7a9e99' }}>{subText}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent messages */}
          <div className="bg-white rounded-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8f0ee]">
              <span className="text-[14px] font-bold text-[#0f1f2e]">Recent messages</span>
              <button className="text-[12px] font-semibold text-[#0d9b8a] hover:underline">View all →</button>
            </div>
            {recentMessages.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-[#7a9e99]">No recent messages.</div>
            ) : (
              <div className="py-1">
                {recentMessages.map((msg, i) => (
                  <div key={msg.id} className={`flex items-start gap-2.5 px-4 py-2.5 ${i < recentMessages.length - 1 ? 'border-b border-[#e8f0ee]' : ''}`}>
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                        style={{ background: msg.isAdmin ? '#0b1d2a' : msg.avatarColor, color: msg.isAdmin ? '#2dd4bf' : 'white' }}>
                        {msg.initials}
                      </div>
                      {msg.isUnread && (
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#f59e0b] border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-[#0f1f2e]">
                        {msg.clientName}
                        {msg.isAdmin && <span className="text-[10px] font-normal text-[#7a9e99] ml-1">(admin)</span>}
                      </div>
                      <div className="text-[11px] text-[#7a9e99] mt-0.5 truncate">"{msg.preview}"</div>
                    </div>
                    <span className="text-[10px] text-[#7a9e99] flex-shrink-0">{msg.timeLabel}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── ROW 2: Activity + Performance ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* My activity */}
        <div className="bg-white rounded-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8f0ee]">
            <span className="text-[14px] font-bold text-[#0f1f2e]">My recent activity</span>
          </div>
          <div className="flex flex-col justify-evenly flex-1 py-1">
            {myActivity.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[#7a9e99]">No activity yet.</div>
            ) : (
              myActivity.map(item => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: item.dotColor }} />
                  <div>
                    <div className="text-[12px] text-[#0f1f2e]">{item.text}</div>
                    <div className="text-[11px] text-[#7a9e99] mt-0.5">{timeLabel(item.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* My performance */}
        <div className="bg-white rounded-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8f0ee]">
            <span className="text-[14px] font-bold text-[#0f1f2e]">My performance</span>
            <span className="text-[11px] text-[#7a9e99]">This week</span>
          </div>
          {[
            { label: 'Cases assigned',      val: String(metrics.activeCases),       cls: '' },
            { label: 'Resolved this week',  val: String(metrics.resolvedThisWeek),  cls: 'text-[#15803d]' },
            { label: 'Avg. first response', val: `${metrics.avgResponseHours} hrs`, cls: 'text-[#15803d]' },
            { label: 'Resolution rate',     val: `${metrics.resolutionRate}%`,      cls: 'text-[#15803d]' },
            { label: 'Pending responses',   val: String(metrics.pendingResponses),  cls: '' },
            { label: 'Urgent / 48h+',       val: String(metrics.urgentCount),       cls: metrics.urgentCount > 0 ? 'text-[#f59e0b]' : '' },
          ].map(({ label, val, cls }, i, arr) => (
            <div key={label} className={`flex items-center justify-between px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-[#e8f0ee]' : ''}`}>
              <span className="text-[12px] text-[#7a9e99]">{label}</span>
              <span className={`text-[13px] font-bold text-[#0f1f2e] ${cls}`}>{val}</span>
            </div>
          ))}
          {/* Response time chart */}
          <div className="px-4 pb-4 pt-3 border-t border-[#e8f0ee]">
            <div className="text-[11px] text-[#7a9e99] mb-2">Response time trend</div>
            <svg width="100%" height={36} viewBox="0 0 280 36" preserveAspectRatio="none" style={{ display: 'block', overflow: 'hidden', stroke: 'none' }}>
              <defs>
                <linearGradient id="respGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <path fill="url(#respGrad)" stroke="none" d="M0,8 L40,12 L80,18 L120,22 L160,26 L200,28 L240,30 L280,32 L280,50 L0,50 Z" />
              <polyline stroke="#1d4ed8" strokeWidth={2} fill="none" strokeLinecap="round" points="0,8 40,12 80,18 120,22 160,26 200,28 240,30 280,32" />
              <circle cx={0} cy={8} r={3} fill="#1d4ed8" stroke="none" />
              <circle cx={280} cy={32} r={3} fill="#1d4ed8" stroke="none" />
            </svg>
            <div className="flex justify-between mt-1">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Today'].map(d => (
                <span key={d} className={`text-[9px] ${d === 'Today' ? 'text-[#0d9b8a] font-semibold' : 'text-[#7a9e99]'}`}>{d}</span>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ── ROW 3: Impact metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          dark
          value={String(metrics.clientsHelpedThisMonth)}
          darkEyebrow="My impact this month"
          darkSub="clients I've helped"
          darkTrend="↑ vs last month"
          sparkPoints={sparkPlaceholder}
          label=""
        />
        <MetricCard
          value={String(metrics.resolvedThisWeek)}
          label="Resolved this week"
          trend="↑ vs last week"
          trendColor="#10b981"
          sparkPoints={sparkPlaceholder}
        />
        <MetricCard
          value={`${metrics.resolutionRate}%`}
          label="My resolution rate"
          trend="+8% vs last week"
          trendColor="#10b981"
          sparkPoints={sparkPlaceholder.map(v => v * 1.1)}
        />
        <MetricCard
          value={`${metrics.avgResponseHours}h`}
          label="Avg. response time"
          trend="↓ vs last week"
          trendColor="#10b981"
          sparkPoints={sparkPlaceholder.map(v => 12 - v)}
        />
      </div>

    </div>
  );
}

