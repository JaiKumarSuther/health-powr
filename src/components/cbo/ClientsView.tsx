import { useMemo, useState, useEffect } from "react";
import { Search, ChevronRight } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { requestsApi } from "../../api/requests";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { getAvatarColor, getInitials } from "../../lib/utils";
import { StatusBadge } from "../shared/StatusBadge";
import { RequestDetailView } from "./RequestDetailView";
import { getUrgencyColor, getUrgencyLabel } from "../../api/requests";

export function ClientsView({
  staffMode = false,
  orgId: orgIdProp,
  membershipRole: membershipRoleProp,
}: {
  staffMode?: boolean;
  orgId: string | null;
  membershipRole: "owner" | "admin" | "member" | null;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { requestId } = useParams<{ requestId?: string }>();
  const requestIdFromPath = requestId ? String(requestId) : null;
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedUrgency, setSelectedUrgency] = useState("all");
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(orgIdProp);
  const [membershipRole, setMembershipRole] = useState<
    "owner" | "admin" | "member" | null
  >(membershipRoleProp);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRequest, setDetailRequest] = useState<any | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!user || !orgIdProp) return;
    async function loadRequests() {
      try {
        setLoading(true);
        setLoadError(null);
        const [membersResult, requestsResult] = await Promise.all([
          staffMode
            ? Promise.resolve({ data: [] })
            : supabase
                .from("organization_members")
                .select(
                  `
                  profile_id,
                  role,
                  profile:profiles!profile_id(id, full_name, email)
                `,
                )
                .eq("organization_id", orgIdProp)
                .in("role", ["member", "admin"])
                .order("joined_at", { ascending: true }),
          supabase
            .from("service_requests")
            .select(
              `
              *,
              assigned_staff:profiles!assigned_staff_id(
                id, full_name, email
              ),
              member:profiles!member_id(
                id, full_name, email, phone, borough
              ),
              notes:request_notes(
                id, content, is_internal, created_at,
                author_id,
                author:profiles(full_name)
              ),
              status_history:request_status_history(
                id, old_status, new_status, note, created_at,
                changed_by,
                changed_by_profile:profiles!changed_by(full_name)
              )
            `,
            )
            .eq("assigned_org_id", orgIdProp)
            .order("created_at", { ascending: false }),
        ]);
        if (membersResult.error) throw membersResult.error;
        if (requestsResult.error) throw requestsResult.error;
        setOrgId(orgIdProp);
        setMembershipRole(membershipRoleProp);
        setTeamMembers(
          (membersResult.data ?? []).map((m: any) => ({
            profile_id: m.profile_id,
            role: m.role,
            full_name: m.profile?.full_name ?? "Staff",
            email: m.profile?.email ?? "",
          })),
        );
        setRequests(requestsResult.data ?? []);
      } catch (e: any) {
        setLoadError(e?.message || "Failed to load requests.");
      } finally {
        setLoading(false);
      }
    }
    void loadRequests();
  }, [user, orgIdProp, membershipRoleProp, staffMode]);

  const reload = useMemo(() => {
    return async () => {
      if (!orgIdProp) return;
      const [membersResult, requestsResult] = await Promise.all([
        staffMode
          ? Promise.resolve({ data: [] })
          : supabase
              .from("organization_members")
              .select(
                `
                profile_id,
                role,
                profile:profiles!profile_id(id, full_name, email)
              `,
              )
              .eq("organization_id", orgIdProp)
              .in("role", ["member", "admin"])
              .order("joined_at", { ascending: true }),
        supabase
          .from("service_requests")
          .select(
            `
            *,
            assigned_staff:profiles!assigned_staff_id(id, full_name, email),
            member:profiles!member_id(id, full_name, email, phone, borough),
            notes:request_notes(
              id, content, is_internal, created_at,
              author_id,
              author:profiles(full_name)
            ),
            status_history:request_status_history(
              id, old_status, new_status, note, created_at,
              changed_by,
              changed_by_profile:profiles!changed_by(full_name)
            )
          `,
          )
          .eq("assigned_org_id", orgIdProp)
          .order("created_at", { ascending: false }),
      ]);
      if (membersResult.error) throw membersResult.error;
      if (requestsResult.error) throw requestsResult.error;
      setTeamMembers(
        (membersResult.data ?? []).map((m: any) => ({
          profile_id: m.profile_id,
          role: m.role,
          full_name: m.profile?.full_name ?? "Staff",
          email: m.profile?.email ?? "",
        })),
      );
      setRequests(requestsResult.data ?? []);
    };
  }, [staffMode, orgIdProp]);

  useEffect(() => {
    if (!user || !orgId) return;

    const channel = supabase
      .channel(`cbo-requests-${orgId}`)
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

  const filteredRequests = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const urgencyRank = (u?: string) =>
      u === "urgent" ? 0 : u === "this_week" ? 1 : u === "exploring" ? 2 : 3;
    return (requests ?? [])
      .filter((req) => {
        const meta = req.metadata ?? {};
        const applicant =
          meta.first_name || meta.last_name
            ? `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim()
            : req.member?.full_name ?? "";
        const matchesSearch =
          applicant.toLowerCase().includes(term) ||
          String(req.category ?? "").toLowerCase().includes(term) ||
          String(req.description ?? "").toLowerCase().includes(term);
        const matchesStatus = selectedStatus === "all" || req.status === selectedStatus;
        const matchesUrgency =
          selectedUrgency === "all" || String(meta.urgency ?? "") === selectedUrgency;
        return matchesSearch && matchesStatus && matchesUrgency;
      })
      .sort((a, b) => urgencyRank(a?.metadata?.urgency) - urgencyRank(b?.metadata?.urgency));
  }, [requests, searchTerm, selectedStatus, selectedUrgency]);

  const handleAssignStaff = async (requestId: string, staffId: string) => {
    try {
      await requestsApi.assignToStaff(requestId, staffId);
      await reload();
      setToast({ type: "success", message: "Staff member assigned successfully." });
    } catch (e: any) {
      setToast({ type: "error", message: e?.message || "Failed to assign request" });
    }
  };

  useEffect(() => {
    if (!requestIdFromPath) {
      setDetailRequest(null);
      return;
    }
    // If orgId hasn't loaded yet (route change), keep a loading state
    // so we don't flash the "not found" empty state.
    if (!orgId) {
      setDetailLoading(true);
      return;
    }
    let active = true;
    async function loadDetail() {
      try {
        setDetailLoading(true);
        const { data, error } = await supabase
          .from("service_requests")
          .select(
            `
            *,
            assigned_staff:profiles!assigned_staff_id(id, full_name, email),
            member:profiles!member_id(id, full_name, email, phone, borough),
            notes:request_notes(
              id, content, is_internal, created_at,
              author_id,
              author:profiles(full_name)
            ),
            status_history:request_status_history(
              id, old_status, new_status, note, created_at,
              changed_by,
              changed_by_profile:profiles!changed_by(full_name)
            )
          `,
          )
          .eq("id", requestIdFromPath)
          .eq("assigned_org_id", orgId)
          .maybeSingle();
        if (error) throw error;
        if (!active) return;
        setDetailRequest(data ?? null);
      } catch {
        if (!active) return;
        setDetailRequest(null);
      } finally {
        if (active) setDetailLoading(false);
      }
    }
    void loadDetail();
    return () => {
      active = false;
    };
  }, [orgId, requestIdFromPath]);

  if (requestIdFromPath) {
    // While orgId/requests are still loading, don't show "not found".
    const isDetailPending = detailLoading || loading || !orgId;
    if (isDetailPending) {
      return (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-72 bg-slate-100 rounded animate-pulse mt-3" />
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100/70 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/30">
                  <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="p-5 space-y-3">
                  {Array.from({ length: 4 }).map((__, i) => (
                    <div key={i} className="h-10 bg-slate-100/60 rounded-xl animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (!detailRequest) {
      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => navigate(staffMode ? "/cbo/assigned" : "/cbo/clients")}
            className="text-[13px] font-semibold text-teal-700 hover:text-teal-800"
          >
            ← Back
          </button>
          <div className="bg-white border border-gray-200 rounded-[14px] p-5 text-slate-600">
            Request not found or you don’t have access to it.
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {toast && (
          <div className="fixed top-4 right-4 z-[100]">
            <div
              className={[
                "rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm",
                "max-w-[360px] text-[13px] font-semibold",
                toast.type === "success"
                  ? "bg-teal-600 text-white border-teal-700/20"
                  : "bg-white text-red-700 border-red-200",
              ].join(" ")}
              role="status"
              aria-live="polite"
            >
              {toast.message}
            </div>
          </div>
        )}
        <RequestDetailView
          request={detailRequest}
          membershipRole={membershipRole ?? ""}
          teamMembers={teamMembers}
          onBack={() => navigate(staffMode ? "/cbo/assigned" : "/cbo/clients")}
          onAssignStaff={async (id, staffId) => {
            await handleAssignStaff(id, staffId);
            const { data } = await supabase
              .from("service_requests")
              .select(
                `
                *,
                assigned_staff:profiles!assigned_staff_id(id, full_name, email),
                member:profiles!member_id(id, full_name, email, phone, borough),
                notes:request_notes(id, content, is_internal, created_at, author:profiles(full_name)),
                status_history:request_status_history(id, old_status, new_status, note, created_at, changed_by_profile:profiles!changed_by(full_name))
              `,
              )
              .eq("id", id)
              .maybeSingle();
            setDetailRequest(data ?? null);
          }}
          onStatusChange={async (id, status) => {
            await requestsApi.updateStatus(id, status as any);
            await reload();
            const { data } = await supabase
              .from("service_requests")
              .select(
                `
                *,
                assigned_staff:profiles!assigned_staff_id(id, full_name, email),
                member:profiles!member_id(id, full_name, email, phone, borough),
                notes:request_notes(id, content, is_internal, created_at, author:profiles(full_name)),
                status_history:request_status_history(id, old_status, new_status, note, created_at, changed_by_profile:profiles!changed_by(full_name))
              `,
              )
              .eq("id", id)
              .maybeSingle();
            setDetailRequest(data ?? null);
          }}
        />

        <div className="bg-white border border-gray-200 rounded-[14px] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-slate-50/50">
            <p className="text-[13px] font-bold text-slate-900">Internal Note</p>
          </div>
          <div className="p-4 space-y-3">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={4}
              placeholder="Add an internal note for your team…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] bg-white focus:border-teal-600"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!noteDraft.trim() || noteSaving}
                onClick={async () => {
                  const content = noteDraft.trim();
                  if (!content || !user) return;
                  try {
                    setNoteSaving(true);
                    await supabase.from("request_notes").insert({
                      request_id: detailRequest.id,
                      author_id: user.id,
                      content,
                      is_internal: true,
                    });
                    setNoteDraft("");
                    const { data } = await supabase
                      .from("service_requests")
                      .select(
                        `
                        *,
                        assigned_staff:profiles!assigned_staff_id(id, full_name, email),
                        member:profiles!member_id(id, full_name, email, phone, borough),
                        notes:request_notes(id, content, is_internal, created_at, author:profiles(full_name)),
                        status_history:request_status_history(id, old_status, new_status, note, created_at, changed_by_profile:profiles!changed_by(full_name))
                      `,
                      )
                      .eq("id", detailRequest.id)
                      .maybeSingle();
                    setDetailRequest(data ?? null);
                  } finally {
                    setNoteSaving(false);
                  }
                }}
                className="h-9 px-3 rounded-lg bg-teal-600 text-white text-[12px] font-semibold hover:bg-teal-700 disabled:opacity-50"
              >
                {noteSaving ? "Saving…" : "Save Note"}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/cbo/messages?requestId=${detailRequest.id}`)}
                className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-slate-700 text-[12px] font-semibold hover:bg-slate-50"
              >
                Send Message
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-[20px] font-extrabold text-slate-900">
          {staffMode ? "My Workspace" : "Service Requests"}
        </h1>
        <p className="text-[12px] text-slate-500 mt-1">
          {staffMode
            ? "Assigned requests only"
            : membershipRole === "member"
              ? "Your assigned requests"
              : "Manage incoming requests from community members"}
        </p>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="text-sm font-semibold">Couldn’t load requests</p>
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

      <div className="bg-white border border-gray-200 rounded-[14px] p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search requests, clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 h-10 border border-gray-200 rounded-xl text-[13px] bg-slate-50/70 focus:border-teal-600 placeholder-slate-400"
            />
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-10 border border-gray-200 rounded-xl px-3 text-[13px] text-slate-700 bg-white focus:border-teal-600"
          >
            <option value="all">All status</option>
            <option value="new">New</option>
            <option value="in_review">In review</option>
            <option value="in_progress">In progress</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={selectedUrgency}
            onChange={(e) => setSelectedUrgency(e.target.value)}
            className="h-10 border border-gray-200 rounded-xl px-3 text-[13px] text-slate-700 bg-white focus:border-teal-600"
          >
            <option value="all">All urgency</option>
            <option value="urgent">Urgent</option>
            <option value="this_week">This week</option>
            <option value="exploring">Exploring</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-200 rounded-[14px] overflow-hidden">
            {/* Desktop Table Header */}
            <div className="hidden md:block bg-slate-50/60 border-b border-gray-200">
              <div className="grid grid-cols-[1.4fr_1fr_1.1fr_0.8fr_0.8fr_1.2fr] gap-4 px-6 py-3">
                {["Applicant", "Phone", "Service", "Borough", "Urgency", "Status"].map((h) => (
                  <div
                    key={h}
                    className="text-[10px] font-bold tracking-wider uppercase text-slate-500"
                  >
                    {h}
                  </div>
                ))}
              </div>
            </div>

            <div>
              {loading ? (
                <div className="divide-y divide-gray-100">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-4 py-6 md:py-3">
                      <div className="h-10 bg-slate-100/70 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-[13px] font-semibold text-slate-700">
                    No requests yet
                  </p>
                  <p className="text-[12px] text-slate-400 mt-1">
                    New community requests will appear here as they come in.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredRequests.map((req) => {
                    const meta = req.metadata ?? {};
                    const name =
                      meta.first_name || meta.last_name
                        ? `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim()
                        : req.member?.full_name || "Anonymous";
                    const phone = meta.phone || req.member?.phone || "";
                    const urgency = meta.urgency as string | undefined;
                    const initials = getInitials(name);
                    const avatarColor = getAvatarColor(name);
                    const ago = req.created_at
                      ? formatDistanceToNowStrict(new Date(req.created_at), { addSuffix: true })
                      : "";

                    return (
                      <div key={req.id}>
                        {/* Desktop Row */}
                        <div className="hidden md:grid grid-cols-[1.4fr_1fr_1.1fr_0.8fr_0.8fr_1.2fr] items-center px-6 py-4 gap-4 hover:bg-slate-50/60 transition-colors">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold border border-black/5 flex-shrink-0"
                                style={{ backgroundColor: avatarColor }}
                              >
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[13px] font-bold text-slate-900 truncate">{name}</div>
                                <div className="text-[10px] text-slate-400 truncate">{ago}</div>
                              </div>
                            </div>
                          </div>
                          <div className="text-[12px] text-slate-700 truncate">
                            {phone ? <a href={`tel:${phone}`} className="hover:underline">{phone}</a> : "—"}
                          </div>
                          <div className="text-[12px] text-slate-700 truncate">
                            {String(req.category ?? "").replace(/_/g, " ")}
                          </div>
                          <div className="text-[12px] text-slate-700 truncate">{req.borough ?? "—"}</div>
                          <div>
                            {urgency ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-bold ${getUrgencyColor(urgency)}`}>
                                {getUrgencyLabel(urgency)}
                              </span>
                            ) : "—"}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <StatusBadge status={req.status} />
                            <button
                              type="button"
                              onClick={() => navigate(`${staffMode ? "/cbo/assigned" : "/cbo/clients"}/${req.id}`)}
                              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 hover:bg-teal-100 transition-colors text-[12px] font-semibold"
                            >
                              Open <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Mobile Card */}
                        <div className="md:hidden p-4 hover:bg-slate-50/60 transition-colors cursor-pointer"
                          onClick={() => navigate(`${staffMode ? "/cbo/assigned" : "/cbo/clients"}/${req.id}`)}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold border border-black/5"
                                style={{ backgroundColor: avatarColor }}
                              >
                                {initials}
                              </div>
                              <div>
                                <div className="text-[14px] font-bold text-slate-900">{name}</div>
                                <div className="text-[10px] text-slate-400">{ago}</div>
                              </div>
                            </div>
                            <StatusBadge status={req.status} className="scale-90" />
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Service</p>
                              <p className="text-[12px] text-slate-700 font-medium">{String(req.category ?? "").replace(/_/g, " ")}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Borough</p>
                              <p className="text-[12px] text-slate-700 font-medium">{req.borough ?? "—"}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                              {urgency && (
                                <span className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-bold ${getUrgencyColor(urgency)}`}>
                                  {getUrgencyLabel(urgency)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[12px] font-bold text-teal-600">
                              View details <ChevronRight className="w-4 h-4" />
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
  );
}
