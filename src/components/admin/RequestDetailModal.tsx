import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getUrgencyColor, getUrgencyLabel } from '../../api/requests';
import { StatusBadge } from '../shared/StatusBadge';

type RequestDetail = {
  id: string;
  category: string;
  borough: string;
  description: string;
  status: string;
  priority: string | null;
  created_at: string;
  closed_at: string | null;
  metadata?: Record<string, any> | null;
  member: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    borough: string | null;
  } | null;
  organization: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    borough: string | null;
  } | null;
  assigned_staff: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  notes: {
    id: string;
    content: string;
    is_internal: boolean;
    created_at: string;
    author: { full_name: string | null } | null;
  }[];
  status_history: {
    id: string;
    old_status: string | null;
    new_status: string;
    note: string | null;
    created_at: string;
    actor: { full_name: string | null } | null;
  }[];
};

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-500',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

interface RequestDetailModalProps {
  requestId: string | null;
  onClose: () => void;
}

export function RequestDetailModal({ requestId, onClose }: RequestDetailModalProps) {
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      return;
    }
    void loadRequest(requestId);
  }, [requestId]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function loadRequest(id: string) {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('service_requests')
        .select(`
          *,
          member:profiles!member_id(id, full_name, email, phone, borough),
          organization:organizations!assigned_org_id(id, name, email, phone, borough),
          assigned_staff:profiles!assigned_staff_id(id, full_name, email),
          notes:request_notes(
            id, content, is_internal, created_at,
            author:profiles!author_id(full_name)
          ),
          status_history:request_status_history(
            id, old_status, new_status, note, created_at,
            actor:profiles!changed_by(full_name)
          )
        `)
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      // Sort history newest-first
      const req = data as RequestDetail;
      if (req.status_history) {
        req.status_history = [...req.status_history].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      }
      if (req.notes) {
        req.notes = [...req.notes].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      }
      setRequest(req);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load request details.');
    } finally {
      setLoading(false);
    }
  }

  if (!requestId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div>
              {loading ? (
                <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
              ) : request ? (
                <div>
                  <h2 className="font-bold text-gray-900 text-lg capitalize">
                    {request.category.replace(/_/g, ' ')} — {request.borough}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <StatusBadge status={request.status} className="text-xs px-2 py-0.5 font-semibold" />
                    {request.metadata?.urgency && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getUrgencyColor(request.metadata.urgency)}`}>
                        {getUrgencyLabel(request.metadata.urgency)}
                      </span>
                    )}
                    {request.priority && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[request.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                        {request.priority} priority
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      Submitted {new Date(request.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="py-16 text-center text-sm text-gray-500">Loading...</div>
            )}

            {error && (
              <div className="p-6 text-sm text-red-600">{error}</div>
            )}

            {!loading && !error && request && (
              <div className="divide-y divide-gray-100">
                {/* Section 1: Client Info */}
                <div className="px-6 py-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Applicant details</h3>
                  {(() => {
                    const meta = (request.metadata ?? {}) as any;
                    const name =
                      meta.first_name || meta.last_name
                        ? `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim()
                        : request.member?.full_name || 'Anonymous';
                    const rows: Array<{ label: string; value: React.ReactNode }> = [];
                    rows.push({ label: "Name", value: name });
                    if (meta.phone || request.member?.phone) {
                      const phone = meta.phone || request.member?.phone;
                      rows.push({
                        label: "Phone",
                        value: phone ? (
                          <a className="hover:underline" href={`tel:${String(phone).replace(/\s/g, "")}`}>
                            {phone}
                          </a>
                        ) : "—",
                      });
                    }
                    if (meta.urgency) rows.push({ label: "Urgency", value: getUrgencyLabel(meta.urgency) });
                    if (meta.household_size) rows.push({ label: "Household size", value: meta.household_size });
                    if (meta.note) rows.push({ label: "Note", value: <span className="whitespace-pre-wrap">{meta.note}</span> });
                    return (
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        {rows.map((r) => (
                          <div key={r.label} className="flex gap-2">
                            <dt className="text-gray-400 w-28 flex-shrink-0">{r.label}</dt>
                            <dd className="text-gray-800 font-medium">{r.value}</dd>
                          </div>
                        ))}
                      </dl>
                    );
                  })()}
                </div>

                {/* Section 2: Request Details */}
                <div className="px-6 py-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Request Details</h3>
                  <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">{request.description}</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    <InfoRow label="Category" value={request.category.replace(/_/g, ' ')} />
                    <InfoRow label="Borough" value={request.borough} />
                    <InfoRow
                      label="Assigned org"
                      value={request.organization?.name || 'Unassigned'}
                    />
                    <InfoRow
                      label="Assigned staff"
                      value={request.assigned_staff?.full_name || 'None'}
                    />
                    {request.closed_at && (
                      <InfoRow
                        label="Closed"
                        value={new Date(request.closed_at).toLocaleDateString()}
                      />
                    )}
                  </div>
                </div>

                {/* Section 3: Status History */}
                <div className="px-6 py-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Status History ({request.status_history?.length ?? 0})
                  </h3>
                  {!request.status_history?.length ? (
                    <p className="text-sm text-gray-400">No status changes recorded.</p>
                  ) : (
                    <ol className="relative border-l border-gray-200 space-y-4 ml-2">
                      {request.status_history.map((h) => (
                        <li key={h.id} className="pl-5">
                          <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-teal-500 border-2 border-white" />
                          <p className="text-sm text-gray-800">
                            <span className="font-medium">{h.actor?.full_name || 'System'}</span>
                            {h.old_status && (
                              <> changed status from{' '}
                                <span className="font-medium">{h.old_status.replace(/_/g, ' ')}</span>
                                {' '}→{' '}
                              </>
                            )}
                            {!h.old_status && <> set status to </>}
                            <span className="font-medium">{h.new_status.replace(/_/g, ' ')}</span>
                          </p>
                          {h.note && (
                            <p className="text-xs text-gray-500 mt-0.5 italic">"{h.note}"</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(h.created_at).toLocaleString()}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {/* Section 4: Notes */}
                <div className="px-6 py-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Notes ({request.notes?.length ?? 0})
                  </h3>
                  {!request.notes?.length ? (
                    <p className="text-sm text-gray-400">No notes recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {request.notes.map((note) => (
                        <div
                          key={note.id}
                          className={`rounded-lg p-3 text-sm ${
                            note.is_internal
                              ? 'bg-amber-50 border border-amber-200'
                              : 'bg-gray-50 border border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-800">
                              {note.author?.full_name || 'Staff'}
                            </span>
                            {note.is_internal && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-medium">
                                Internal
                              </span>
                            )}
                            <span className="text-xs text-gray-400 ml-auto">
                              {new Date(note.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 w-28 flex-shrink-0">{label}</span>
      <span className="text-gray-800 font-medium capitalize">{value}</span>
    </div>
  );
}
