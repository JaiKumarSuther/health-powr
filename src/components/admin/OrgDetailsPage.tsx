import { useEffect, useMemo, useState } from "react";
import { 
  ArrowLeft, 
  ExternalLink, 
  PauseCircle, 
  MapPin,
  Mail,
  Phone,
  Globe,
  Calendar,
  Clock,
  Users,
  Briefcase,
  Languages,
  AlertCircle,
  CheckCircle,
  XCircle,
  UserCheck,
  Info,
  Shield,
  Award
} from "lucide-react";
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

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  pending: { bg: "bg-amber-50", text: "text-amber-700", icon: Clock, label: "Pending Review" },
  approved: { bg: "bg-emerald-50", text: "text-emerald-700", icon: CheckCircle, label: "Approved" },
  rejected: { bg: "bg-rose-50", text: "text-rose-700", icon: XCircle, label: "Rejected" },
  suspended: { bg: "bg-gray-100", text: "text-gray-600", icon: PauseCircle, label: "Suspended" },
};

const ROLE_BADGE: Record<string, { bg: string; text: string; icon: any }> = {
  owner: { bg: "bg-teal-100", text: "text-teal-700", icon: Crown },
  admin: { bg: "bg-blue-100", text: "text-blue-700", icon: Shield },
  member: { bg: "bg-gray-100", text: "text-gray-600", icon: Users },
};

// Add Crown icon component
function Crown({ className }: { className?: string }) {
  return <div className={className}>👑</div>;
}

export function OrgDetailsPage({ orgId, onBack }: { orgId: string; onBack: () => void }) {
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
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
      setRejectReason("");
      setShowRejectConfirm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load organization details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetStatus(status: "approved" | "rejected" | "suspended") {
    if (!org) return;
    if (status === "rejected" && !rejectReason.trim()) {
      return;
    }
    setActionLoading(true);
    try {
      await orgsApi.updateStatus(
        org.id,
        status,
        status === "rejected" ? rejectReason || "Not provided" : undefined,
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminOrgs() });
      await loadOrg(org.id);
    } finally {
      setActionLoading(false);
    }
  }

  const submittedAt = useMemo(() => (org ? new Date(org.created_at) : null), [org]);
  const approvedAt = useMemo(() => (org?.approved_at ? new Date(org.approved_at) : null), [org]);
  const statusConfig = org ? STATUS_CONFIG[org.status] : null;

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600"></div>
          <p className="mt-4 text-sm text-gray-500">Loading organization details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center max-w-md">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-600" />
          <p className="mt-3 font-semibold text-rose-800">Failed to load organization</p>
          <p className="mt-1 text-sm text-rose-600">{error}</p>
          <button
            onClick={onBack}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!org) return null;

  const StatusIcon = statusConfig?.icon || Info;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:py-8 space-y-6">
        {/* Header with Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-700 transition-all hover:border-gray-300 hover:shadow-sm self-start"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to Organizations
          </button>
        </div>

        {/* Main Card */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-200">
          {/* Status Banner */}
          <div className={`px-5 py-3 ${statusConfig?.bg} border-b border-gray-100`}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusIcon className={`h-4 w-4 ${statusConfig?.text}`} />
              <span className={`text-[11px] font-bold uppercase tracking-widest ${statusConfig?.text}`}>
                {statusConfig?.label}
              </span>
              {org.rejection_reason && (
                <span className="text-[11px] font-medium text-rose-600">
                  • {org.rejection_reason}
                </span>
              )}
            </div>
          </div>

          <div className="p-5 md:p-8">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="flex h-16 w-16 md:h-20 md:w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/20">
                    <span className="text-2xl md:text-3xl font-bold">
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 leading-tight">
                      {org.name}
                    </h1>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold uppercase tracking-tight text-gray-600">
                        <MapPin className="h-3 w-3" />
                        {org.borough}
                      </span>
                      {org.category?.slice(0, 4).map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold uppercase tracking-tight text-teal-700"
                        >
                          <Briefcase className="h-3 w-3" />
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {org.description && (
                  <div className="mt-8 rounded-2xl bg-gray-50 p-5 md:p-6 border border-gray-100">
                    <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                      {org.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex-shrink-0 lg:w-80">
                <div className="space-y-4">
                  {org.status === "pending" && showRejectConfirm && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-rose-800">
                        <AlertCircle className="h-4 w-4" />
                        <label className="text-[11px] font-bold uppercase tracking-widest">
                          Rejection Reason
                        </label>
                      </div>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Why is this organization being rejected?"
                        rows={3}
                        className="w-full rounded-xl border border-rose-200 px-4 py-3 text-sm focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/10 transition-all bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleSetStatus("rejected")}
                          disabled={actionLoading || !rejectReason.trim()}
                          className="flex-1 h-10 rounded-xl bg-rose-600 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-rose-700 disabled:opacity-50 transition-all"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setShowRejectConfirm(false)}
                          className="flex-1 h-10 rounded-xl border border-rose-200 bg-white text-[11px] font-bold uppercase tracking-wider text-rose-600 hover:bg-rose-50 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2">
                    {(org.status === "pending" || org.status === "suspended" || org.status === "rejected") && (
                      <button
                        disabled={actionLoading}
                        onClick={() => void handleSetStatus("approved")}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/20 disabled:opacity-60"
                      >
                        <CheckCircle className="h-5 w-5" />
                        {org.status === "suspended" ? "Reinstate Org" : "Approve Org"}
                      </button>
                    )}
                    
                    {org.status === "approved" && (
                      <button
                        disabled={actionLoading}
                        onClick={() => void handleSetStatus("suspended")}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-6 py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-amber-700 hover:shadow-lg hover:shadow-amber-600/20 disabled:opacity-60"
                      >
                        <PauseCircle className="h-5 w-5" />
                        Suspend Org
                      </button>
                    )}
                    
                    {org.status === "pending" && !showRejectConfirm && (
                      <button
                        disabled={actionLoading}
                        onClick={() => setShowRejectConfirm(true)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-rose-700 hover:shadow-lg hover:shadow-rose-600/20 disabled:opacity-60"
                      >
                        <XCircle className="h-5 w-5" />
                        Reject Org
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Contact Information */}
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-teal-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Contact Information</h3>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <InfoRow icon={Mail} label="Email" value={org.email || "—"} />
                  <InfoRow icon={Phone} label="Phone" value={org.phone || "—"} />
                  <InfoRow 
                    icon={Globe} 
                    label="Website" 
                    value={
                      org.website ? (
                        <a
                          href={org.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 hover:underline break-all"
                        >
                          {org.website.replace(/^https?:\/\//, '')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : "—"
                    }
                  />
                  <InfoRow icon={MapPin} label="Address" value={org.address || "—"} />
                  <InfoRow icon={Languages} label="Languages" value={org.languages_supported?.join(", ") || "—"} />
                </div>
              </div>

              {/* Submission Information */}
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-teal-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Organization Details</h3>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <InfoRow 
                    icon={UserCheck} 
                    label="Owner" 
                    value={
                      <div>
                        <div className="font-semibold text-gray-900">
                          {org.owner?.full_name || "Unknown"}
                        </div>
                        {org.owner?.email && (
                          <div className="text-xs text-gray-500">{org.owner.email}</div>
                        )}
                      </div>
                    }
                  />
                  <InfoRow icon={Calendar} label="Submitted" value={submittedAt?.toLocaleDateString() || "—"} />
                  <InfoRow icon={Clock} label="Submitted Time" value={submittedAt?.toLocaleTimeString() || "—"} />
                  <InfoRow icon={CheckCircle} label="Approved" value={approvedAt?.toLocaleDateString() || "—"} />
                  <InfoRow icon={Award} label="Active Status" value={org.is_active ? "Active" : "Inactive"} />
                </div>
              </div>

              {/* Services */}
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-teal-600" />
                      <h3 className="text-sm font-semibold text-gray-900">Services</h3>
                    </div>
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">
                      {org.services?.length || 0}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  {!org.services?.length ? (
                    <div className="text-center py-8">
                      <Briefcase className="mx-auto h-8 w-8 text-gray-300" />
                      <p className="mt-2 text-sm text-gray-500">No services listed</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {org.services.map((svc) => (
                        <div key={svc.id} className="group rounded-lg border border-gray-100 bg-gray-50 p-3 transition-all hover:border-gray-200 hover:bg-white">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">{svc.name}</p>
                              {svc.description && (
                                <p className="mt-1 text-xs text-gray-600 line-clamp-2">{svc.description}</p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {svc.category && (
                                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                                  {svc.category}
                                </span>
                              )}
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                svc.is_available !== false 
                                  ? "bg-emerald-50 text-emerald-700" 
                                  : "bg-gray-100 text-gray-500"
                              }`}>
                                {svc.is_available !== false ? "Available" : "Unavailable"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Team Section */}
            <div className="mt-6 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Team Members</h3>
                  </div>
                  <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
                    {org.organization_members?.length || 0}
                  </span>
                </div>
              </div>
              <div className="p-6">
                {!org.organization_members?.length ? (
                  <div className="text-center py-8">
                    <Users className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">No team members found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {org.organization_members.map((member) => {
                      const roleConfig = ROLE_BADGE[member.role] || ROLE_BADGE.member;
                      const RoleIcon = roleConfig.icon;
                      return (
                        <div key={member.id} className="group rounded-xl border border-gray-100 bg-gray-50 p-4 transition-all hover:border-gray-200 hover:bg-white hover:shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 text-white">
                              <span className="text-sm font-bold">
                                {member.profile?.full_name?.charAt(0).toUpperCase() || "?"}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {member.profile?.full_name || "Unknown User"}
                                  </p>
                                  {member.profile?.email && (
                                    <p className="mt-0.5 text-xs text-gray-500 truncate">
                                      {member.profile.email}
                                    </p>
                                  )}
                                  <p className="mt-1 text-xs text-gray-400">
                                    Joined {new Date(member.joined_at).toLocaleDateString()}
                                  </p>
                                </div>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleConfig.bg} ${roleConfig.text}`}>
                                  <RoleIcon className="h-2.5 w-2.5" />
                                  {member.role}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced InfoRow Component
function InfoRow({ icon: Icon, label, value }: { icon?: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 text-gray-400 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </div>
        <div className="mt-1 text-sm text-gray-800 break-words">
          {value}
        </div>
      </div>
    </div>
  );
}