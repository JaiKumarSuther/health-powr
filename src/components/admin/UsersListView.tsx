import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUrgencyColor, getUrgencyLabel } from '../../api/requests';
import { StatusBadge } from '../shared/StatusBadge';

type CommunityMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  borough: string | null;
  created_at: string;
  is_active: boolean | null;
};

type UserRequest = {
  id: string;
  category: string;
  borough: string;
  status: string;
  created_at: string;
  metadata?: Record<string, any> | null;
};

export function UsersListView() {
  const { session } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [viewRequestsFor, setViewRequestsFor] = useState<CommunityMember | null>(null);
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', 'community_members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, borough, created_at, is_active')
        .eq('role', 'community_member')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as CommunityMember[];
    },
    staleTime: Infinity,
    refetchOnMount: false,
  });

  const userRequestsQuery = useQuery({
    queryKey: ['admin', 'users', 'requests', viewRequestsFor?.id],
    enabled: !!viewRequestsFor?.id,
    queryFn: async () => {
      const memberId = viewRequestsFor?.id;
      if (!memberId) return [] as UserRequest[];
      const { data, error } = await supabase
        .from('service_requests')
        .select('id, category, borough, status, created_at, metadata')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as UserRequest[];
    },
    staleTime: Infinity,
    refetchOnMount: false,
  });

  async function handleToggleSuspend(user: CommunityMember) {
    if (!session?.access_token) return;
    const suspend = user.is_active !== false; // suspend if currently active
    setActingId(user.id);
    try {
      const { error: fnErr } = await supabase.functions.invoke('suspend-user', {
        body: { userId: user.id, suspend },
      });
      if (fnErr) throw fnErr;
      // Refresh list only when a change occurred.
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setActingId(null);
    }
  }

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (usersQuery.data ?? []).filter((u) =>
      `${u.full_name ?? ''} ${u.email ?? ''} ${u.borough ?? ''}`.toLowerCase().includes(term),
    );
  }, [usersQuery.data, searchTerm]);

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, borough..."
            className="w-full h-11 border border-gray-200 rounded-xl pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm"
          />
        </div>
      </div>

      {usersQuery.isLoading && (
        <div className="py-20 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />
          <p className="mt-4 text-sm text-gray-500">Loading members...</p>
        </div>
      )}

      {usersQuery.isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-semibold text-red-800">Failed to load members</p>
          <p className="text-xs text-red-600 mt-1">
            {usersQuery.error instanceof Error ? usersQuery.error.message : 'Unknown error occurred'}
          </p>
        </div>
      )}

      {!usersQuery.isLoading && !usersQuery.isError && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              Showing <span className="text-gray-900">{filtered.length}</span> of {(usersQuery.data ?? []).length} members
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-sm text-gray-400">No members found matching your search.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Member</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Location</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Joined</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((u) => {
                        const isSuspended = u.is_active === false;
                        return (
                          <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-gray-900">{u.full_name || 'Anonymous'}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5">{u.email || 'No email'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm font-medium text-gray-700">{u.borough || '—'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-gray-600">{u.phone || '—'}</p>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-500 whitespace-nowrap">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${isSuspended ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${isSuspended ? 'bg-red-600' : 'bg-emerald-600'}`} />
                                {isSuspended ? 'Suspended' : 'Active'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setViewRequestsFor(u)}
                                  className="h-8 px-3 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold uppercase hover:bg-gray-50 transition-all"
                                >
                                  Requests
                                </button>
                                <button
                                  disabled={actingId === u.id}
                                  onClick={() => void handleToggleSuspend(u)}
                                  className={`h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-tight transition-all disabled:opacity-50 ${
                                    isSuspended
                                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                                      : 'border border-red-200 text-red-600 hover:bg-red-50'
                                  }`}
                                >
                                  {actingId === u.id
                                    ? '...'
                                    : isSuspended
                                      ? 'Reactivate'
                                      : 'Suspend'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List */}
                <div className="lg:hidden divide-y divide-gray-100">
                  {filtered.map((u) => {
                    const isSuspended = u.is_active === false;
                    return (
                      <div key={u.id} className="p-5 hover:bg-gray-50/50 active:bg-gray-100 transition-colors">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <p className="text-base font-bold text-gray-900">{u.full_name || 'Anonymous'}</p>
                            <p className="text-xs text-gray-500">{u.email || 'No email'}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${isSuspended ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isSuspended ? 'bg-red-600' : 'bg-emerald-600'}`} />
                            {isSuspended ? 'Suspended' : 'Active'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-5">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Location</p>
                            <p className="text-sm font-semibold text-gray-800">{u.borough || '—'}</p>
                          </div>
                          <div className="space-y-1 text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Joined</p>
                            <p className="text-sm font-medium text-gray-500">
                              {new Date(u.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-4 border-t border-gray-50">
                          <button
                            onClick={() => setViewRequestsFor(u)}
                            className="flex-1 h-10 rounded-xl border border-gray-200 text-gray-600 text-[11px] font-bold uppercase hover:bg-gray-50"
                          >
                            View Requests
                          </button>
                          <button
                            disabled={actingId === u.id}
                            onClick={() => void handleToggleSuspend(u)}
                            className={`flex-1 h-10 rounded-xl text-[11px] font-bold uppercase tracking-tight transition-all disabled:opacity-50 ${
                              isSuspended
                                ? 'bg-emerald-600 text-white'
                                : 'border border-red-200 text-red-600'
                            }`}
                          >
                            {actingId === u.id
                              ? '...'
                              : isSuspended
                                ? 'Reactivate'
                                : 'Suspend User'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* User Requests Modal */}
      {viewRequestsFor && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setViewRequestsFor(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh] pointer-events-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                <div>
                  <h2 className="font-bold text-gray-900">
                    {viewRequestsFor.full_name || viewRequestsFor.email || 'User'}'s Requests
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">{viewRequestsFor.email}</p>
                </div>
                <button
                  onClick={() => setViewRequestsFor(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {userRequestsQuery.isLoading ? (
                  <p className="text-sm text-gray-500 text-center py-8">Loading...</p>
                ) : (userRequestsQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No requests found.</p>
                ) : (
                  <div className="space-y-2">
                    {(userRequestsQuery.data ?? []).map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-4 p-3 rounded-lg border border-gray-200"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800 capitalize">
                            {r.category.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-500">{r.borough} · {new Date(r.created_at).toLocaleDateString()}</p>
                          {r.metadata?.urgency && (
                            <span className={`inline-flex items-center mt-1 text-[11px] px-2 py-0.5 rounded-full font-semibold ${getUrgencyColor(r.metadata.urgency)}`}>
                              {getUrgencyLabel(r.metadata.urgency)}
                            </span>
                          )}
                        </div>
                        <StatusBadge status={r.status} className="text-xs px-2 py-0.5 font-semibold flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
