import { useMemo, useState } from 'react';
import { Building2, Download, Search } from 'lucide-react';
import { requestsApi } from '../../api/requests';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getUrgencyColor, getUrgencyLabel } from '../../api/requests';
import { StatusBadge } from '../shared/StatusBadge';

type AdminRequest = {
  id: string;
  category: string;
  borough: string;
  status: string;
  created_at: string;
  assigned_org_id: string | null;
  metadata?: Record<string, any> | null;
  member?: { full_name?: string; email?: string } | { full_name?: string; email?: string }[];
  organization?: { name?: string } | { name?: string }[];
};

const STATUSES = ['new', 'in_review', 'in_progress', 'closed'];
const CATEGORIES = [
  'housing', 'food', 'healthcare', 'job_training',
  'education', 'legal', 'mental_health', 'childcare', 'other',
];
const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

interface Props {
  onViewRequest: (requestId: string) => void;
}

export function RequestsListView({ onViewRequest }: Props) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [boroughFilter, setBoroughFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'urgent' | 'this_week' | 'exploring'>('all');
  const [exporting, setExporting] = useState(false);

  const requestsQuery = useQuery({
    queryKey: ['admin', 'requests', 'list'],
    enabled: !!user,
    queryFn: async () => (await requestsApi.getAllRequests()) as AdminRequest[],
  });

  const requests = requestsQuery.data ?? [];

  const filteredRequests = useMemo(() => {
    const urgencyRank = (u?: string) =>
      u === "urgent" ? 0 : u === "this_week" ? 1 : u === "exploring" ? 2 : 3;
    return requests.filter((r) => {
      const member = Array.isArray(r.member) ? r.member[0] : r.member;
      const meta = (r.metadata ?? {}) as any;
      const applicant =
        meta.first_name || meta.last_name
          ? `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim()
          : (member?.full_name ?? "");
      const haystack = `${applicant} ${member?.email ?? ''} ${r.category} ${r.borough}`.toLowerCase();
      const matchesSearch = haystack.includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || r.status === statusFilter;
      const matchesCategory = !categoryFilter || r.category === categoryFilter;
      const matchesBorough = !boroughFilter || r.borough.toLowerCase() === boroughFilter.toLowerCase();
      const matchesUrgency = urgencyFilter === 'all' || String(meta.urgency ?? '') === urgencyFilter;
      return matchesSearch && matchesStatus && matchesCategory && matchesBorough && matchesUrgency;
    }).sort((a, b) => urgencyRank((a.metadata as any)?.urgency) - urgencyRank((b.metadata as any)?.urgency));
  }, [requests, searchTerm, statusFilter, categoryFilter, boroughFilter, urgencyFilter]);

  const statusCounts = useMemo(() => {
    return requests.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [requests]);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await requestsApi.exportCsv();
      const headers = ['ID', 'Category', 'Borough', 'Status', 'Member', 'Organization', 'Created At'];
      const rows: Array<Array<string | number>> = data.map((r: any) => [
        r.id,
        r.category,
        r.borough,
        r.status,
        r.member?.[0]?.full_name || '',
        r.organization?.[0]?.name || '',
        new Date(r.created_at).toLocaleDateString(),
      ]);
      const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
      const link = document.createElement('a');
      link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
      link.download = `requests-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setExporting(false);
    }
  }

  if (requestsQuery.isLoading) {
    return <div className="py-20 text-center text-gray-500">Loading requests...</div>;
  }

  if (requestsQuery.isError) {
    const msg =
      requestsQuery.error instanceof Error
        ? requestsQuery.error.message
        : 'Unknown error';
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-semibold">Requests failed to load.</p>
          <p className="text-sm mt-1">Unable to load requests. {msg}</p>
          <p className="text-xs mt-2 text-red-600">
            If you see a 403, ensure the admin role has RLS SELECT permissions for `service_requests`.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void requestsQuery.refetch()}
          className="h-10 px-4 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status count cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
            className={`border rounded-xl p-4 text-left transition-all hover:shadow-md ${
              statusFilter === status
                ? 'border-teal-400 bg-teal-50 ring-2 ring-teal-500/10'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{status.replace(/_/g, ' ')}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{statusCounts[status] || 0}</p>
          </button>
        ))}
      </div>

      {/* Filter + search bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search member, category..."
              className="w-full h-11 border border-gray-200 rounded-xl pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 border border-gray-200 rounded-xl px-3 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ').toUpperCase()}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-11 border border-gray-200 rounded-xl px-3 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, ' ').toUpperCase()}</option>
              ))}
            </select>

            <select
              value={boroughFilter}
              onChange={(e) => setBoroughFilter(e.target.value)}
              className="h-11 border border-gray-200 rounded-xl px-3 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
            >
              <option value="">All Boroughs</option>
              {BOROUGHS.map((b) => (
                <option key={b} value={b}>{b.toUpperCase()}</option>
              ))}
            </select>

            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value as any)}
              className="h-11 border border-gray-200 rounded-xl px-3 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
            >
              <option value="all">ALL URGENCY</option>
              <option value="urgent">URGENT</option>
              <option value="this_week">THIS WEEK</option>
              <option value="exploring">EXPLORING</option>
            </select>
          </div>

          <button
            onClick={() => void handleExport()}
            disabled={exporting}
            className="h-11 px-4 rounded-xl bg-teal-600 text-white flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-teal-700 transition-all font-bold text-xs uppercase tracking-wider"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            Showing <span className="text-gray-900">{filteredRequests.length}</span> of {requests.length} requests
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-[11px] font-bold text-teal-600 hover:text-teal-700 uppercase"
            >
              Clear Search
            </button>
          )}
        </div>
      </div>

      {/* Requests List/Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {filteredRequests.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-gray-400">No requests found matching your filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Applicant</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Category</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Urgency</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Routed Organization</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRequests.map((req) => {
                    const member = Array.isArray(req.member) ? req.member[0] : req.member;
                    const org = Array.isArray(req.organization) ? req.organization[0] : req.organization;
                    const meta = (req.metadata ?? {}) as any;
                    const applicant =
                      meta.first_name || meta.last_name
                        ? `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim()
                        : (member?.full_name || 'Anonymous');
                    const urgency = meta.urgency as string | undefined;
                    
                    return (
                      <tr
                        key={req.id}
                        onClick={() => onViewRequest(req.id)}
                        className="hover:bg-gray-50/80 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-900">{applicant}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{member?.email || 'No email'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-gray-800 capitalize">{req.category.replace(/_/g, ' ')}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{req.borough}</p>
                        </td>
                        <td className="px-6 py-4">
                          {urgency ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${getUrgencyColor(urgency)}`}>
                              {getUrgencyLabel(urgency)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 uppercase font-medium">Not specified</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={req.status} className="text-[10px] font-bold uppercase" />
                        </td>
                        <td className="px-6 py-4">
                          {org?.name ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-teal-600" />
                              <span className="text-sm font-medium text-gray-700">{org.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-500">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="xl:hidden divide-y divide-gray-100">
              {filteredRequests.map((req) => {
                const member = Array.isArray(req.member) ? req.member[0] : req.member;
                const org = Array.isArray(req.organization) ? req.organization[0] : req.organization;
                const meta = (req.metadata ?? {}) as any;
                const applicant =
                  meta.first_name || meta.last_name
                    ? `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim()
                    : (member?.full_name || 'Anonymous');
                const urgency = meta.urgency as string | undefined;

                return (
                  <div
                    key={req.id}
                    onClick={() => onViewRequest(req.id)}
                    className="p-5 hover:bg-gray-50/50 active:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-base font-bold text-gray-900">{applicant}</p>
                        <p className="text-xs text-gray-500">{member?.email || 'No email'}</p>
                      </div>
                      <StatusBadge status={req.status} className="text-[10px] font-bold uppercase" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Category</p>
                        <p className="text-sm font-semibold text-gray-800 capitalize">{req.category.replace(/_/g, ' ')}</p>
                        <p className="text-[11px] text-gray-500">{req.borough}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Urgency</p>
                        <div>
                          {urgency ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${getUrgencyColor(urgency)}`}>
                              {getUrgencyLabel(urgency)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">Not specified</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        {org?.name ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-teal-600" />
                            <span className="text-xs font-bold text-gray-700 truncate max-w-[150px]">
                              {org.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Unassigned</span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-gray-400">
                        {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
