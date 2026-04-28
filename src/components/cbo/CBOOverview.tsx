import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Search, ChevronRight } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { subDays, startOfDay } from 'date-fns';
import { requestsApi } from '../../api/requests';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getAvatarColor, getInitials } from '../../lib/utils';
import { StatusBadge } from '../shared/StatusBadge';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function CBOOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [teamActivity, setTeamActivity] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgStatus, setOrgStatus] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [membershipRole, setMembershipRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        setLoading(true);
        setLoadError(null);
        const ctx = await requestsApi.getMyOrgMembership();
        setOrgId(ctx.orgId);
        setMembershipRole(ctx.role);
        if (ctx.orgId) {
          const { data: orgRow } = await supabase
            .from('organizations')
            .select('status, name')
            .eq('id', ctx.orgId)
            .maybeSingle();
          setOrgStatus(orgRow?.status ?? null);
          setOrgName(orgRow?.name ?? null);
        } else {
          setOrgStatus(null);
          setOrgName(null);
        }
        const [statusCounts, requests, activity] = await Promise.all([
          requestsApi.getOrgStatusCounts(),
          requestsApi.getOrgRequests(),
          requestsApi.getOrgTeamActivity(10),
        ]);
        setCounts(statusCounts);
        setAllRequests(requests);
        setRecentRequests(requests.slice(0, 8));
        setTeamActivity(activity);
      } catch (e: any) {
        setLoadError(e?.message || 'Failed to load overview.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [user]);

  const reload = useMemo(() => {
    return async () => {
      const [statusCounts, requests, activity] = await Promise.all([
        requestsApi.getOrgStatusCounts(),
        requestsApi.getOrgRequests(),
        requestsApi.getOrgTeamActivity(10),
      ]);
      setCounts(statusCounts);
      setAllRequests(requests);
      setRecentRequests(requests.slice(0, 8));
      setTeamActivity(activity);
    };
  }, []);

  useEffect(() => {
    if (!user || !orgId) return;

    const channel = supabase
      .channel(`cbo-overview-requests-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_requests",
          filter: `assigned_org_id=eq.${orgId}`,
        },
        () => {
          void reload();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, reload, user]);

  const displayedRequests = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return recentRequests;
    return recentRequests.filter((r) => {
      const hay = [
        r.member?.full_name,
        r.category,
        r.borough,
        r.description,
        r.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [recentRequests, searchTerm]);

  const insights = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const yStart = startOfDay(subDays(now, 1));
    const yEnd = todayStart;

    const statusKey = (s: any) => String(s ?? '').toLowerCase().replace(/\s+/g, '_');
    const isUrgent = (r: any) => {
      const meta = (r as any)?.metadata ?? null;
      if (meta && typeof meta === 'object') {
        const urgency = (meta as any).urgency ?? (meta as any).priority;
        return String(urgency ?? '').toLowerCase() === 'urgent';
      }
      return String(r?.urgency ?? '').toLowerCase() === 'urgent';
    };

    const createdAt = (r: any) => {
      const t = r?.created_at ? new Date(r.created_at) : null;
      return t && !Number.isNaN(+t) ? t : null;
    };

    const bucket7 = Array.from({ length: 7 }).map((_, i) => {
      const d = startOfDay(subDays(now, 6 - i));
      return { day: d, label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }), count: 0 };
    });
    for (const r of allRequests) {
      const t = createdAt(r);
      if (!t) continue;
      const day = startOfDay(t).getTime();
      const b = bucket7.find((x) => x.day.getTime() === day);
      if (b) b.count += 1;
    }

    const todayNew = allRequests.filter((r) => {
      const t = createdAt(r);
      return t ? t >= todayStart : false;
    }).length;
    const yNew = allRequests.filter((r) => {
      const t = createdAt(r);
      return t ? t >= yStart && t < yEnd : false;
    }).length;

    const urgentNow = allRequests.filter(isUrgent).length;
    const inProgressNow = allRequests.filter((r) => statusKey(r.status) === 'in_progress').length;
    const closedNow = allRequests.filter((r) => statusKey(r.status) === 'closed').length;

    const statusBars = [
      { status: 'New', key: 'new' },
      { status: 'In progress', key: 'in_progress' },
      { status: 'Closed', key: 'closed' },
      { status: 'Other', key: 'other' },
    ].map((s) => ({
      name: s.status,
      value:
        s.key === 'other'
          ? Math.max(
              0,
              allRequests.length -
                ((counts['new'] ?? 0) + (counts['in_progress'] ?? 0) + (counts['closed'] ?? 0)),
            )
          : counts[s.key] ?? 0,
    }));

    return {
      todayNew,
      yNew,
      urgentNow,
      inProgressNow,
      closedNow,
      trendNew: todayNew - yNew,
      last7: bucket7.map((b) => ({ name: b.label, value: b.count })),
      statusBars,
    };
  }, [allRequests, counts]);

  const [requestsPage, setRequestsPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const itemsPerPage = 5;

  const paginatedRequests = useMemo(() => {
    const start = (requestsPage - 1) * itemsPerPage;
    return displayedRequests.slice(start, start + itemsPerPage);
  }, [displayedRequests, requestsPage]);

  const paginatedActivity = useMemo(() => {
    const start = (activityPage - 1) * itemsPerPage;
    return teamActivity.slice(start, start + itemsPerPage);
  }, [teamActivity, activityPage]);

  const totalRequestsPages = Math.ceil(displayedRequests.length / itemsPerPage);
  const totalActivityPages = Math.ceil(teamActivity.length / itemsPerPage);

  if (loading) {
    return (
      <div className="space-y-6 pb-8">
        {/* Header skeleton */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 animate-pulse" />
              <div className="min-w-0">
                <div className="h-3 w-44 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-28 bg-slate-100 rounded animate-pulse mt-2" />
              </div>
            </div>
            <div className="w-full sm:w-[320px]">
              <div className="h-10 w-full bg-slate-100 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="h-6 w-24 bg-slate-100 rounded-lg animate-pulse" />
                <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
              </div>
              <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-28 bg-slate-100 rounded animate-pulse mt-3" />
            </div>
          ))}
        </div>

        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden lg:col-span-2">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse" />
              <div className="min-w-0">
                <div className="h-4 w-44 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-64 bg-slate-100 rounded animate-pulse mt-2" />
              </div>
            </div>
            <div className="h-[220px] px-3 py-3">
              <div className="h-full w-full rounded-xl bg-slate-100/60 animate-pulse" />
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/30">
              <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-28 bg-slate-100 rounded animate-pulse mt-2" />
            </div>
            <div className="h-[220px] px-3 py-3">
              <div className="h-full w-full rounded-xl bg-slate-100/60 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Lists skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[440px] sm:h-[480px]"
            >
              <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between gap-3 flex-shrink-0">
                <div>
                  <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-48 bg-slate-100 rounded animate-pulse mt-2" />
                </div>
                <div className="h-7 w-24 bg-slate-100 rounded-lg animate-pulse" />
              </div>
              <div className="divide-y divide-slate-100 flex-1 overflow-hidden">
                {Array.from({ length: 5 }).map((__, i) => (
                  <div key={i} className="px-4 sm:px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                        <div className="h-4 w-16 bg-slate-100 rounded-full animate-pulse" />
                      </div>
                      <div className="h-3 w-44 bg-slate-100 rounded animate-pulse mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const orgDisplayName = orgName || user?.organization || 'Organization';
  const roleLabel = membershipRole
    ? membershipRole === 'owner'
      ? 'Owner'
      : membershipRole === 'admin'
        ? 'Admin'
        : 'Staff'
    : 'Staff';
  const userInitials = getInitials(user?.name ?? 'User');
  const userAvatarColor = getAvatarColor(user?.name ?? 'User');

  return (
    <div className="space-y-6 pb-8">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-[12px] font-extrabold shadow-sm"
              style={{ backgroundColor: userAvatarColor }}
              aria-label={userInitials}
            >
              {userInitials}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] text-slate-500">
                {orgDisplayName} · {roleLabel}
              </div>
              <div className="text-[16px] font-extrabold text-slate-900 truncate">
                Overview
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-[320px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setRequestsPage(1);
                }}
                placeholder="Search recent requests..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50/60 text-[13px] focus:bg-white focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>
      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <p className="text-sm font-semibold">Couldn’t load overview</p>
          <p className="text-xs mt-1">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 h-9 px-3 rounded-lg bg-white border border-red-200 text-red-700 text-[12px] font-semibold hover:bg-red-50"
          >
            Refresh
          </button>
        </div>
      )}
      {orgStatus === 'pending' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Your organization is pending approval.</p>
          <p className="text-xs text-amber-800 mt-1">
            A HealthPowr admin will review your account shortly. You will have full access once approved.
          </p>
        </div>
      )}

      {orgStatus === 'rejected' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-900">Your organization application was not approved.</p>
          <p className="text-xs text-red-800 mt-1">
            Please contact <strong>support@healthpowr.app</strong> for more information or to appeal.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            key: 'new',
            label: 'New Requests',
            delta: `${insights.todayNew >= 0 ? '+' : ''}${insights.todayNew} today`,
            trend: `${insights.trendNew >= 0 ? '↑' : '↓'} ${Math.abs(insights.trendNew)} vs yesterday`,
            trendTone: insights.trendNew >= 0 ? 'text-teal-600' : 'text-rose-600',
            value: counts['new'] || 0,
          },
          {
            key: 'urgent',
            label: 'Urgent',
            delta: 'Live',
            trend: `${insights.urgentNow} marked urgent`,
            trendTone: 'text-rose-600',
            value: insights.urgentNow,
          },
          {
            key: 'in_progress',
            label: 'In Progress',
            delta: 'Live',
            trend: `${insights.inProgressNow} active`,
            trendTone: 'text-teal-600',
            value: counts['in_progress'] || insights.inProgressNow || 0,
          },
          {
            key: 'closed',
            label: 'Closed',
            delta: 'Live',
            trend: `${insights.closedNow} completed`,
            trendTone: 'text-slate-600',
            value: counts['closed'] || insights.closedNow || 0,
          },
        ].map((m) => (
          <div key={m.key} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="p-1.5 sm:p-2 bg-slate-50 rounded-lg group-hover:bg-teal-50 transition-colors">
                <p className="text-[9px] sm:text-[10px] tracking-widest uppercase text-slate-500 font-bold">
                  {m.label}
                </p>
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                {m.delta}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {m.value}
              </p>
            </div>
            <p className={`text-[10px] sm:text-[11px] font-medium mt-2 sm:mt-3 flex items-center gap-1 ${m.trendTone}`}>
              {m.trend}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-teal-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Requests (last 7 days)</p>
                <p className="text-[11px] text-slate-500">Daily new requests assigned to your org</p>
              </div>
            </div>
          </div>
          <div className="h-[220px] px-3 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={insights.last7}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" width={28} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 20px rgba(2,6,23,0.08)',
                  }}
                  labelStyle={{ fontWeight: 700, color: '#0f172a' }}
                />
                <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/30">
            <p className="text-sm font-bold text-slate-900">Requests by status</p>
            <p className="text-[11px] text-slate-500">Current distribution</p>
          </div>
          <div className="h-[220px] px-3 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={insights.statusBars} layout="vertical" margin={{ left: 18, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={80} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 20px rgba(2,6,23,0.08)',
                  }}
                  labelStyle={{ fontWeight: 700, color: '#0f172a' }}
                />
                <Bar dataKey="value" fill="#0d9488" radius={[8, 8, 8, 8]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[440px] sm:h-[480px]">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50/30 gap-3 flex-shrink-0">
            <div>
              <p className="text-sm font-bold text-slate-900">Recent Requests</p>
              <p className="text-[11px] text-slate-500">Latest incoming community needs</p>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3">
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                <button
                  disabled={requestsPage === 1}
                  onClick={(e) => { e.stopPropagation(); setRequestsPage(p => p - 1); }}
                  className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:shadow-none transition-all"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <span className="text-[10px] font-bold px-2 text-slate-600">
                  {requestsPage} / {totalRequestsPages || 1}
                </span>
                <button
                  disabled={requestsPage === totalRequestsPages || totalRequestsPages === 0}
                  onClick={(e) => { e.stopPropagation(); setRequestsPage(p => p + 1); }}
                  className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:shadow-none transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                className="text-[11px] font-bold text-teal-600 hover:text-teal-700 whitespace-nowrap"
                onClick={() => navigate('/cbo/clients')}
              >
                View all
              </button>
            </div>
          </div>
          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto hide-scrollbar">
            {paginatedRequests.map((req) => {
              const name = req.member?.full_name || 'Community Member';
              const initials = getInitials(name);
              const avatarColor = getAvatarColor(name);
              const category = String(req.category ?? '').replace(/_/g, ' ');
              const borough = req.borough ?? '—';
              const when = req.created_at
                ? formatDistanceToNowStrict(new Date(req.created_at), { addSuffix: true })
                : '';
              return (
                <div
                  key={req.id}
                  className="px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/cbo/clients/${req.id}`)}
                >
                  <div
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white text-[10px] sm:text-[12px] font-bold shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-[13px] sm:text-[14px] font-bold text-slate-900 truncate max-w-[120px] sm:max-w-none">
                        {name}
                      </p>
                      <StatusBadge status={req.status} className="scale-90 sm:scale-100 origin-left" />
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-slate-500 flex-wrap">
                      <span className="capitalize">{category}</span>
                      <span>•</span>
                      <span>{borough}</span>
                      {when && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="block sm:inline">{when}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="sm:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-teal-50 flex items-center justify-center">
                      <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" />
                    </div>
                  </div>
                </div>
              );
            })}
            {displayedRequests.length === 0 && (
              <div className="px-6 py-12 text-center h-full flex flex-col justify-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-900">No requests found</p>
                <p className="text-[12px] text-slate-500 mt-1">
                  Try adjusting your search or check back later.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[440px] sm:h-[480px]">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between flex-shrink-0 gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Team Activity</p>
              <p className="text-[11px] text-slate-500">Updates from your organization</p>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3">
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                <button
                  disabled={activityPage === 1}
                  onClick={(e) => { e.stopPropagation(); setActivityPage(p => p - 1); }}
                  className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:shadow-none transition-all"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <span className="text-[10px] font-bold px-2 text-slate-600">
                  {activityPage} / {totalActivityPages || 1}
                </span>
                <button
                  disabled={activityPage === totalActivityPages || totalActivityPages === 0}
                  onClick={(e) => { e.stopPropagation(); setActivityPage(p => p + 1); }}
                  className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:shadow-none transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto hide-scrollbar">
            {paginatedActivity.map((item) => {
              const ago = item.created_at
                ? formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true })
                : '';
              const isStatus = item.kind === 'status';
              const isNote = item.kind === 'note';
              
              return (
                <div key={item.id} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="mt-1 flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full ${
                        isStatus ? 'bg-teal-500' : isNote ? 'bg-blue-500' : 'bg-slate-400'
                      } ring-4 ring-slate-50`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] sm:text-[13px] text-slate-700 leading-relaxed">
                        <span className="font-bold text-slate-900">{item.actor}</span>{" "}
                        <span className="text-slate-600">{item.text}</span>
                      </p>
                      {ago && (
                        <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1 sm:mt-1.5 font-medium flex items-center gap-1">
                           {ago}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {teamActivity.length === 0 && (
              <div className="px-6 py-12 text-center text-slate-500 h-full flex flex-col justify-center">
                <p className="text-sm font-bold text-slate-900">No activity yet</p>
                <p className="text-[12px] text-slate-400 mt-1">
                  Team updates will appear here automatically.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
