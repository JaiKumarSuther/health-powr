import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { requestsApi } from '../../api/requests';
import { getAvatarColor, getInitials } from '../../lib/utils';

type RequestStatus = 'new' | 'in_review' | 'in_progress' | 'closed';

function hoursSince(iso: string | null | undefined) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / 36e5;
}

function StatusPill({ status }: { status: RequestStatus }) {
  const cls: Record<RequestStatus, string> = {
    new: 'bg-sky-50 text-sky-700 border-sky-100',
    in_review: 'bg-amber-50 text-amber-800 border-amber-100',
    in_progress: 'bg-teal-50 text-teal-800 border-teal-100',
    closed: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const label: Record<RequestStatus, string> = {
    new: 'New',
    in_review: 'In review',
    in_progress: 'In progress',
    closed: 'Closed',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${cls[status]}`}>
      {label[status]}
    </span>
  );
}

function MiniBarChart({
  title,
  subtitle,
  bars,
  tone = 'teal',
}: {
  title: string;
  subtitle: string;
  bars: Array<{ label: string; value: number }>;
  tone?: 'teal' | 'slate';
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const barCls =
    tone === 'teal'
      ? 'bg-teal-600/85'
      : 'bg-slate-600/80';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="text-[13px] font-extrabold text-slate-900">{title}</div>
        <div className="text-[12px] text-slate-400 mt-0.5">{subtitle}</div>
      </div>
      <div className="p-5">
        <div className="h-[140px] flex items-end gap-2">
          {bars.map((b) => (
            <div key={b.label} className="flex-1 min-w-0 flex flex-col items-center gap-2">
              <div className="w-full flex items-end justify-center">
                <div
                  className={`w-full rounded-xl ${barCls}`}
                  style={{
                    height: `${Math.max(8, Math.round((b.value / max) * 120))}px`,
                  }}
                  aria-label={`${b.label}: ${b.value}`}
                />
              </div>
              <div className="text-[10px] font-bold text-slate-400 truncate w-full text-center">
                {b.label}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-semibold">Total</span>
          <span className="font-extrabold text-slate-900">
            {bars.reduce((s, b) => s + b.value, 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function StaffOverviewView() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setLoadError(null);
        const data = await requestsApi.getOrgRequests();
        if (!active) return;
        setRequests(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!active) return;
        setLoadError(e?.message || 'Failed to load your workspace.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const byStatus: Record<RequestStatus, number> = {
      new: 0,
      in_review: 0,
      in_progress: 0,
      closed: 0,
    };
    for (const r of requests) {
      const s = r?.status as RequestStatus | undefined;
      if (s && s in byStatus) byStatus[s] += 1;
    }
    const open = byStatus.new + byStatus.in_review + byStatus.in_progress;
    return { byStatus, open };
  }, [requests]);

  const statusBars = useMemo(() => {
    return [
      { label: 'New', value: stats.byStatus.new },
      { label: 'Review', value: stats.byStatus.in_review },
      { label: 'In prog', value: stats.byStatus.in_progress },
      { label: 'Closed', value: stats.byStatus.closed },
    ];
  }, [stats.byStatus.closed, stats.byStatus.in_progress, stats.byStatus.in_review, stats.byStatus.new]);

  const last7DaysBars = useMemo(() => {
    const days: Array<{ key: string; label: string; value: number }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const label = d.toLocaleDateString([], { weekday: 'short' });
      days.push({ key, label, value: 0 });
    }
    const idx = new Map(days.map((d) => [d.key, d]));
    for (const r of requests) {
      const iso = r?.created_at as string | undefined;
      if (!iso) continue;
      const d = new Date(iso);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const slot = idx.get(key);
      if (slot) slot.value += 1;
    }
    return days.map((d) => ({ label: d.label, value: d.value }));
  }, [requests]);

  const attention = useMemo(() => {
    // "Needs attention": open requests updated > 48h ago (best-effort using updated_at/created_at)
    return requests
      .filter((r) => r?.status !== 'closed')
      .map((r) => {
        const h = hoursSince(r?.updated_at || r?.created_at);
        return { r, h: h ?? 0 };
      })
      .filter((x) => x.h > 48)
      .sort((a, b) => b.h - a.h)
      .slice(0, 5)
      .map((x) => x.r);
  }, [requests]);

  const recent = useMemo(() => {
    return [...requests]
      .sort((a, b) => +new Date(b?.created_at ?? 0) - +new Date(a?.created_at ?? 0))
      .slice(0, 8);
  }, [requests]);

  if (loading) {
    return (
      <div className="w-full">
        <div className="rounded-[18px] border border-slate-200 bg-white px-6 py-6">
          <div className="h-4 w-28 rounded bg-slate-100 animate-pulse" />
          <div className="mt-3 h-7 w-72 rounded bg-slate-100 animate-pulse" />
          <div className="mt-2 h-4 w-[520px] max-w-full rounded bg-slate-100 animate-pulse" />
          <div className="mt-5 flex gap-2">
            <div className="h-11 w-36 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-11 w-32 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
              <div className="mt-2 h-8 w-14 rounded bg-slate-100 animate-pulse" />
              <div className="mt-3 h-3 w-28 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="h-4 w-44 rounded bg-slate-100 animate-pulse" />
              <div className="mt-2 h-3 w-60 rounded bg-slate-100 animate-pulse" />
            </div>
            <div className="divide-y divide-slate-100">
              {[0, 1, 2].map((i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
                    <div className="mt-2 h-3 w-56 rounded bg-slate-100 animate-pulse" />
                  </div>
                  <div className="h-6 w-20 rounded-full bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="h-4 w-36 rounded bg-slate-100 animate-pulse" />
              <div className="mt-2 h-3 w-48 rounded bg-slate-100 animate-pulse" />
            </div>
            <div className="p-4 space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="h-3 w-44 rounded bg-slate-100 animate-pulse" />
                  <div className="mt-2 h-3 w-56 rounded bg-slate-100 animate-pulse" />
                </div>
              ))}
              <div className="h-10 w-full rounded-xl bg-slate-100 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
                <div className="mt-2 h-3 w-56 rounded bg-slate-100 animate-pulse" />
              </div>
              <div className="p-5">
                <div className="h-[140px] rounded-xl bg-slate-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
        <div className="text-sm font-bold">Couldn’t load your dashboard</div>
        <div className="text-xs mt-1 text-red-700">{loadError}</div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 h-9 px-3 rounded-lg bg-white border border-red-200 text-red-700 text-[12px] font-semibold hover:bg-red-50"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[18px] border border-slate-200 bg-white px-6 py-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-600 via-sky-500 to-teal-600 opacity-80" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-slate-200 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
              <LayoutDashboard className="w-4 h-4 text-teal-600" />
              Staff dashboard
            </div>
            <h1 className="mt-3 text-[22px] md:text-[26px] font-extrabold tracking-tight text-slate-900">
              Your workspace at a glance
            </h1>
            <p className="mt-1 text-[13px] text-slate-500 max-w-xl">
              Track your assigned requests, keep response times tight, and jump back into conversations in one place.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => navigate('/staff/messages')}
              className="h-11 px-4 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-colors inline-flex items-center justify-center gap-2"
            >
              Open messages <ArrowUpRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/staff/assigned')}
              className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2"
            >
              View assigned <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Open</div>
          <div className="mt-1 text-[28px] font-extrabold tracking-tight text-slate-900">{stats.open}</div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <Inbox className="w-4 h-4 text-slate-400" /> Assigned to you
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">New</div>
          <div className="mt-1 text-[28px] font-extrabold tracking-tight text-slate-900">{stats.byStatus.new}</div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" /> Waiting for first touch
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">In progress</div>
          <div className="mt-1 text-[28px] font-extrabold tracking-tight text-slate-900">{stats.byStatus.in_progress}</div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-slate-400" /> Actively being worked
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Needs attention</div>
          <div className="mt-1 text-[28px] font-extrabold tracking-tight text-slate-900">{attention.length}</div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> No update in 48h+
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-3">
        {/* Recent assigned */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-extrabold text-slate-900">Recent assigned requests</div>
              <div className="text-[12px] text-slate-400 mt-0.5">Jump back into a case in one click</div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/staff/assigned')}
              className="text-[12px] font-bold text-teal-700 hover:text-teal-800 transition-colors"
            >
              View all
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recent.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">No assigned requests yet.</div>
            ) : (
              recent.map((r) => {
                const applicant = r?.member?.full_name || 'Client';
                const initials = getInitials(applicant);
                const color = getAvatarColor(applicant);
                const status = (r?.status as RequestStatus) || 'new';
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => navigate(`/staff/requests/${r.id}`)}
                    className="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors flex items-center gap-3"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center border border-black/5 text-white text-[11px] font-extrabold flex-shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-slate-900 truncate">{applicant}</div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {String(r?.category ?? 'request').replace(/_/g, ' ')} · {r?.borough ?? '—'}
                          </div>
                        </div>
                        <StatusPill status={status} />
                      </div>
                      <div className="mt-2 text-[12px] text-slate-400 line-clamp-1">
                        {r?.description || 'Open request'}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Attention queue */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="text-[13px] font-extrabold text-slate-900">Needs attention</div>
            <div className="text-[12px] text-slate-400 mt-0.5">Cases with no recent activity</div>
          </div>
          <div className="p-4 space-y-3">
            {attention.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Everything looks good — no cases are stale.
              </div>
            ) : (
              attention.map((r) => {
                const applicant = r?.member?.full_name || 'Client';
                const h = hoursSince(r?.updated_at || r?.created_at) ?? 0;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => navigate(`/staff/requests/${r.id}`)}
                    className="w-full rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3 text-left hover:bg-amber-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-slate-900 truncate">{applicant}</div>
                        <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                          {String(r?.category ?? 'request').replace(/_/g, ' ')} · {r?.borough ?? '—'}
                        </div>
                      </div>
                      <div className="text-[11px] font-extrabold text-amber-700 whitespace-nowrap">
                        {Math.floor(h)}h+
                      </div>
                    </div>
                    <div className="mt-2 text-[12px] text-slate-600 line-clamp-1">
                      {r?.description || 'Open request'}
                    </div>
                  </button>
                );
              })
            )}
            <button
              type="button"
              onClick={() => navigate('/staff/assigned')}
              className="w-full h-10 rounded-xl bg-white border border-slate-200 text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Go to Assigned Requests
            </button>
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <MiniBarChart
          title="Requests by status"
          subtitle="Distribution of your assigned cases"
          bars={statusBars}
          tone="teal"
        />
        <MiniBarChart
          title="Requests created (last 7 days)"
          subtitle="New volume trend"
          bars={last7DaysBars}
          tone="slate"
        />
      </div>
    </div>
  );
}

