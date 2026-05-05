import { useEffect, useState } from "react";
import { Check, PauseCircle, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { orgsApi } from "../../api/organizations";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys";

type OrgDetail = {
  id: string;
  name: string;
  description: string | null;
  borough: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  category: string[] | null;
  languages_supported: string[] | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  is_active: boolean;
  owner: { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
  services: {
    id: string;
    name: string;
    category: string | null;
    description: string | null;
    is_available: boolean | null;
  }[] | null;
  organization_members: {
    id: string;
    role: string;
    joined_at: string;
    profile: { id: string; full_name: string | null; email: string | null } | null;
  }[] | null;
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-gray-100 text-gray-500",
};

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-teal-100 text-teal-700",
  admin: "bg-blue-100 text-blue-700",
  member: "bg-gray-100 text-gray-600",
};

interface OrgDetailPanelProps {
  orgId: string | null;
  onClose: () => void;
}

export function OrgDetailPanel({ orgId, onClose }: OrgDetailPanelProps) {
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!orgId) {
      setOrg(null);
      return;
    }
    void loadOrg(orgId);
  }, [orgId]);

  async function loadOrg(id: string) {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from("organizations")
        .select(`
          *,
          owner:profiles!owner_id(id, full_name, email, phone),
          services(id, name, category, description, is_available),
          organization_members(
            id, role, joined_at,
            profile:profiles!profile_id(id, full_name, email)
          )
        `)
        .eq("id", id)
        .single();
      if (fetchErr) throw fetchErr;
      setOrg(data as OrgDetail);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load organization details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetStatus(status: "approved" | "rejected" | "suspended") {
    if (!org) return;
    setActionLoading(true);
    try {
      await orgsApi.updateStatus(org.id, status, status === "rejected" ? rejectReason || "Not provided" : undefined);
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminOrgs() });
      await loadOrg(org.id);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!org) return;
    const first = window.confirm(`Delete "${org.name}"? This cannot be undone.`);
    if (!first) return;
    const second = window.confirm(`This will delete "${org.name}" and all related services and members. Continue?`);
    if (!second) return;
    setActionLoading(true);
    try {
      await orgsApi.delete(org.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminOrgs() });
      onClose();
    } finally {
      setActionLoading(false);
    }
  }

  if (!orgId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-white shadow-xl flex flex-col overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="font-bold text-gray-900 text-base">Organization Details</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            Loading...
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {!loading && !error && org && (
          <div className="flex-1 overflow-y-auto">
            {/* Section 1: Org Header */}
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center font-bold text-teal-700 text-lg flex-shrink-0">
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 text-lg leading-tight">{org.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[org.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {org.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {org.borough}
                    </span>
                    {org.category?.map((cat) => (
                      <span key={cat} className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Contact Info */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contact</h4>
              <dl className="space-y-2 text-sm">
                <Row label="Email" value={org.email || "—"} />
                <Row label="Phone" value={org.phone || "—"} />
                <Row
                  label="Website"
                  value={
                    org.website ? (
                      <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline truncate">
                        {org.website}
                      </a>
                    ) : "—"
                  }
                />
                <Row label="Address" value={org.address || "—"} />
                <Row
                  label="Languages"
                  value={org.languages_supported?.join(", ") || "—"}
                />
              </dl>
            </div>

            {/* Section 3: Organization Details */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Details</h4>
              {org.description && (
                <p className="text-sm text-gray-700 mb-3">{org.description}</p>
              )}
              <dl className="space-y-2 text-sm">
                <Row
                  label="Owner"
                  value={`${org.owner?.full_name || "Unknown"}${org.owner?.email ? ` (${org.owner.email})` : ""}`}
                />
                <Row
                  label="Submitted"
                  value={new Date(org.created_at).toLocaleDateString()}
                />
                <Row
                  label="Approved"
                  value={org.approved_at ? new Date(org.approved_at).toLocaleDateString() : "Not yet approved"}
                />
                {org.rejection_reason && (
                  <Row label="Rejection reason" value={org.rejection_reason} className="text-red-600" />
                )}
              </dl>
            </div>

            {/* Section 4: Services */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Services ({org.services?.length ?? 0})
              </h4>
              {!org.services?.length ? (
                <p className="text-sm text-gray-400">No services listed.</p>
              ) : (
                <div className="space-y-2">
                  {org.services.map((svc) => (
                    <div key={svc.id} className="flex items-center justify-between gap-3 py-1.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{svc.name}</p>
                        {svc.description && (
                          <p className="text-xs text-gray-500 truncate">{svc.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {svc.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {svc.category}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${svc.is_available !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {svc.is_available !== false ? "Available" : "Unavailable"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 5: Team Members */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Team ({org.organization_members?.length ?? 0})
              </h4>
              {!org.organization_members?.length ? (
                <p className="text-sm text-gray-400">No members found.</p>
              ) : (
                <div className="space-y-2">
                  {org.organization_members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 py-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {m.profile?.full_name || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500">{m.profile?.email || ""}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[m.role] ?? "bg-gray-100 text-gray-600"}`}>
                          {m.role}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(m.joined_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 6: Quick Actions */}
            <div className="px-6 py-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h4>
              {(org.status === "pending" || org.status === "suspended") && (
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rejection reason (required to reject)"
                  className="w-full h-9 border border-gray-200 rounded-lg px-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              )}
              <div className="flex flex-wrap gap-2">
                {org.status !== "approved" && (
                  <button
                    disabled={actionLoading}
                    onClick={() => void handleSetStatus("approved")}
                    className="h-9 px-4 rounded-lg bg-green-600 text-white text-sm flex items-center gap-1.5 hover:bg-green-700 transition-colors disabled:opacity-60"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                )}
                {(org.status === "pending" || org.status === "approved") && (
                  <button
                    disabled={actionLoading}
                    onClick={() => void handleSetStatus("suspended")}
                    className="h-9 px-4 rounded-lg bg-amber-600 text-white text-sm flex items-center gap-1.5 hover:bg-amber-700 transition-colors disabled:opacity-60"
                  >
                    <PauseCircle className="w-4 h-4" />
                    Suspend
                  </button>
                )}
                {(org.status === "pending" || org.status === "suspended") && (
                  <button
                    disabled={actionLoading}
                    onClick={() => void handleSetStatus("rejected")}
                    className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm flex items-center gap-1.5 hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                )}
                <button
                  disabled={actionLoading}
                  onClick={() => void handleDelete()}
                  className="h-9 px-4 rounded-lg border border-red-200 text-red-700 text-sm flex items-center gap-1.5 hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function Row({
  label,
  value,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-gray-400 w-28 flex-shrink-0">{label}</dt>
      <dd className={`text-gray-800 min-w-0 break-words ${className}`}>{value}</dd>
    </div>
  );
}
