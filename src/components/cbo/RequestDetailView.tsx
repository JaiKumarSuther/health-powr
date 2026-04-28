import { ArrowLeft, Clock, User, Building2, AlertCircle, Lock } from 'lucide-react';
import { getUrgencyColor, getUrgencyLabel } from '../../api/requests';
import { StatusBadge } from '../shared/StatusBadge';

interface Props {
  request: any;
  membershipRole: string;
  teamMembers: any[];
  onBack: () => void;
  onAssignStaff: (requestId: string, staffId: string) => Promise<void>;
  onStatusChange: (requestId: string, status: string) => Promise<void>;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

export function RequestDetailView({
  request,
  membershipRole,
  teamMembers,
  onBack,
  onAssignStaff,
  onStatusChange,
}: Props) {
  const canAssign =
    (membershipRole === 'owner' || membershipRole === 'admin') && !request.assigned_staff_id;
  const meta = (request?.metadata ?? {}) as Record<string, any>;
  const applicantName =
    meta.first_name || meta.last_name
      ? `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim()
      : request.member?.full_name || 'Unknown';
  const phone = meta.phone || request.member?.phone || null;
  const urgency = meta.urgency as string | undefined;

  return (
    <div className="w-full">
      {/* Header with back button */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Requests
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-bold text-gray-900 uppercase tracking-tight capitalize">
              {request.category?.replace(/_/g, ' ')} Request
            </h1>
            <p className="text-[13px] text-gray-500 mt-0.5 uppercase tracking-tight">
              #{request.id.slice(0, 8).toUpperCase()} · {request.borough}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={request.status} className="text-[11px] px-2.5 py-1 font-bold uppercase tracking-tight" />
            {urgency && (
              <span
                className={[
                  "text-[11px] px-2.5 py-1 rounded-full font-bold tracking-tight",
                  getUrgencyColor(urgency),
                ].join(" ")}
              >
                {getUrgencyLabel(urgency)}
              </span>
            )}
            {request.priority && (
              <span
                className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-tight ${
                  PRIORITY_COLORS[request.priority] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {request.priority}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Applicant details */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <User className="w-3.5 h-3.5" />
            Applicant details
          </h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-[11px] text-gray-400 uppercase tracking-wide">Name</dt>
              <dd className="text-[14px] font-semibold text-gray-900 mt-0.5">
                {applicantName}
              </dd>
            </div>
            {phone && (
              <div>
                <dt className="text-[11px] text-gray-400 uppercase tracking-wide">Phone</dt>
                <dd className="text-[14px] text-gray-700 mt-0.5">
                  <a className="hover:underline" href={`tel:${String(phone).replace(/\s/g, '')}`}>
                    {phone}
                  </a>
                </dd>
              </div>
            )}
            {urgency && (
              <div>
                <dt className="text-[11px] text-gray-400 uppercase tracking-wide">Urgency</dt>
                <dd className="text-[14px] text-gray-700 mt-0.5">{getUrgencyLabel(urgency)}</dd>
              </div>
            )}
            {meta.household_size && (
              <div>
                <dt className="text-[11px] text-gray-400 uppercase tracking-wide">Household size</dt>
                <dd className="text-[14px] text-gray-700 mt-0.5">{meta.household_size}</dd>
              </div>
            )}
            {meta.note && (
              <div className="md:col-span-2">
                <dt className="text-[11px] text-gray-400 uppercase tracking-wide">Note</dt>
                <dd className="text-[14px] text-gray-700 mt-0.5 whitespace-pre-wrap">{meta.note}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Request Details */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            Request Details
          </h2>
          <p className="text-[14px] text-gray-700 leading-relaxed">
            {request.description || 'No description provided.'}
          </p>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-[12px] text-gray-400">
            <span>Submitted: {new Date(request.created_at).toLocaleDateString()}</span>
            {request.closed_at && (
              <span>Closed: {new Date(request.closed_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {/* Assignment */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" />
            Assignment
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                {request.assigned_staff_id ? 'Assigned to' : 'Assigned Staff'}
              </p>
              <p className="text-[15px] font-bold text-gray-900 mt-0.5">
                {request.assigned_staff?.full_name || 'Unassigned'}
              </p>
            </div>
            {canAssign ? (
              <select
                defaultValue=""
                onChange={(e) => {
                  const staffId = e.target.value;
                  if (!staffId) return;
                  void onAssignStaff(request.id, staffId);
                }}
                className="h-9 text-[13px] border border-gray-200 rounded-lg px-3 text-gray-700 focus:outline-none focus:border-teal-500 bg-white font-medium"
              >
                <option value="" disabled>
                  Select staff…
                </option>
                {teamMembers.filter((m) => m.role !== 'owner').map((m) => (
                  <option key={m.profile_id} value={m.profile_id}>
                    {m.full_name} ({m.role})
                  </option>
                ))}
              </select>
            ) : request.assigned_staff_id ? (
              <span className="inline-flex items-center gap-2 text-[12px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 font-medium">
                <Lock className="w-3.5 h-3.5" />
                Assignment locked
              </span>
            ) : null}
          </div>
        </div>

        {/* Status Update */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Update Status
          </h2>
          <div className="flex flex-wrap gap-2">
            {(['new', 'in_review', 'in_progress', 'closed'] as const).map((status) => (
              <button
                key={status}
                type="button"
                disabled={request.status === status}
                onClick={() => void onStatusChange(request.id, status)}
                className={`px-4 py-2 text-[12px] font-bold uppercase tracking-tight rounded-lg border transition-colors ${
                  request.status === status
                    ? 'bg-teal-600 text-white border-teal-600 cursor-default'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-700'
                }`}
              >
                {status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Case History */}
        {((request.status_history ?? []).length > 0 || (request.notes ?? []).length > 0) && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Full Case History
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                ...(request.status_history ?? []).map((h: any) => ({
                  id: `status-${h.id}`,
                  created_at: h.created_at,
                  actor: h.changed_by_profile?.full_name || 'Staff',
                  title: `Status: ${String(h.new_status || '').replace(/_/g, ' ')}`,
                  detail: h.note || 'Status updated.',
                })),
                ...(request.notes ?? []).map((n: any) => ({
                  id: `note-${n.id}`,
                  created_at: n.created_at,
                  actor: n.author?.full_name || 'Staff',
                  title: 'Internal note',
                  detail: n.content,
                })),
              ]
                .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
                .map((item) => (
                  <div key={item.id} className="px-5 py-3">
                    <p className="text-[13px] font-semibold text-gray-900">{item.title}</p>
                    <p className="text-[13px] text-gray-600 mt-0.5">{item.detail}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      By {item.actor} on {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
