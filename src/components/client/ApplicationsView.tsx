"use client";

import { useMemo, useState, useEffect } from "react";
import {
  getUrgencyLabel,
  requestsApi,
  type ServiceRequest,
} from "../../api/requests";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientApplication = ServiceRequest & {
  organization?: { name?: string; location?: string; imageUrl?: string } | null;
  status_history?: Array<{
    id?: string;
    new_status?: string;
    note?: string;
    created_at?: string;
    changed_by?: { full_name?: string };
  }>;
  assigned_staff_id?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; pillClass: string }> = {
  in_review: { label: "In Review",                pillClass: "bg-[#dbeafe] text-[#1d4ed8]" },
  pending:   { label: "Sent · Awaiting response", pillClass: "bg-[#dbeafe] text-[#1d4ed8]" },
  approved:  { label: "Approved",                 pillClass: "bg-[#dcfce7] text-[#15803d]" },
  completed: { label: "Completed",                pillClass: "bg-[#e1f5ee] text-[#0d9b8a]"  },
  rejected:  { label: "Rejected",                 pillClass: "bg-[#fee2e2] text-[#dc2626]"  },
};

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, pillClass: "bg-gray-100 text-gray-500" };
}

type TimelineStep = {
  label: string;
  state: "done" | "current" | "pending";
  note?: string;
  caseworkerNote?: string;
  time?: string;
};

function deriveTimeline(app: ClientApplication): TimelineStep[] {
  const history = app.status_history ?? [];

  if (history.length > 0) {
    const steps: TimelineStep[] = history.map((h, i) => ({
      label: String(h.new_status ?? "Update").replace(/_/g, " "),
      state: i < history.length - 1 ? "done" : "current",
      note: h.note || undefined,
      caseworkerNote:
        h.changed_by?.full_name && h.note
          ? `${h.changed_by.full_name}: "${h.note}"`
          : undefined,
      time: h.created_at
        ? new Date(h.created_at).toLocaleString("en-US", {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          })
        : undefined,
    }));

    if (!["approved", "completed", "rejected"].includes(app.status)) {
      steps.push({ label: "Response", state: "pending", note: "They'll message you here with next steps." });
    }
    return steps;
  }

  const base: TimelineStep[] = [
    {
      label: "Request submitted",
      state: "done",
      note: `Your request was sent to ${app.organization?.name ?? "the organization"}.`,
      time: app.created_at
        ? new Date(app.created_at).toLocaleString("en-US", {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          })
        : undefined,
    },
  ];

  if (app.status === "pending") {
    base.push(
      { label: "Caseworker assignment", state: "current", note: "Usually within a few hours." },
      { label: "Response", state: "pending", note: "They'll message you here with next steps." }
    );
  } else if (app.status === "in_review") {
    base.push(
      { label: "Caseworker assigned", state: "done" },
      { label: "In review", state: "current", note: "A caseworker is reviewing your request." },
      { label: "Response", state: "pending", note: "They'll message you here with next steps." }
    );
  } else if (app.status === "approved" || app.status === "completed") {
    base.push(
      { label: "Caseworker assigned", state: "done" },
      { label: "Approved", state: "done" }
    );
  } else if (app.status === "rejected") {
    base.push({ label: "Rejected", state: "current" });
  }

  return base;
}

// ─── TimelineNode ─────────────────────────────────────────────────────────────

function TimelineNode({ step, isLast }: { step: TimelineStep; isLast: boolean }) {
  return (
    <div className="flex gap-0 items-stretch">
      <div className="flex flex-col items-center w-7 flex-shrink-0">
        {step.state === "done" && (
          <div className="w-6 h-6 rounded-full bg-[#0d9b8a] shadow-[0_0_0_4px_#e1f5ee] flex items-center justify-center flex-shrink-0 z-10">
            <svg viewBox="0 0 16 16" className="w-3 h-3"
              style={{ stroke: "white", fill: "none", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <path d="M2 8l4 4 8-8" />
            </svg>
          </div>
        )}
        {step.state === "current" && (
          <div className="w-6 h-6 rounded-full bg-white border-[2.5px] border-[#0d9b8a] shadow-[0_0_0_4px_#e1f5ee] flex items-center justify-center flex-shrink-0 z-10">
            <div className="w-2.5 h-2.5 rounded-full bg-[#0d9b8a] animate-pulse" />
          </div>
        )}
        {step.state === "pending" && (
          <div className="w-6 h-6 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center flex-shrink-0 z-10">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
          </div>
        )}
        {!isLast && (
          <div
            className="w-0.5 flex-1 min-h-4 my-0.5"
            style={
              step.state === "done"
                ? { background: "#0d9b8a" }
                : { backgroundImage: "repeating-linear-gradient(to bottom, #e5e7eb 0, #e5e7eb 4px, transparent 4px, transparent 8px)" }
            }
          />
        )}
      </div>

      <div className="flex-1 pb-5 pl-3.5 pt-0.5">
        <div className={`text-[13px] font-bold mb-0.5 capitalize ${step.state === "pending" ? "text-gray-400 font-medium" : "text-[#0f1f2e]"}`}>
          {step.label}
        </div>
        {step.caseworkerNote ? (
          <div className="bg-white border border-[#e8f0ee] rounded-[10px] rounded-bl-[2px] px-3 py-2.5 text-[12px] text-[#4b6b65] leading-relaxed mt-1.5">
            {step.caseworkerNote}
          </div>
        ) : step.note ? (
          <div className="text-[12px] text-[#7a9e99] leading-relaxed">{step.note}</div>
        ) : null}
        {step.time && <div className="text-[10px] text-[#7a9e99] mt-1">{step.time}</div>}
      </div>
    </div>
  );
}

// ─── Detail Layout (Sheet + Page) ─────────────────────────────────────────────

function DetailLayout({
  app,
  onClose,
  onMessage,
  mode,
}: {
  app: ClientApplication;
  onClose: () => void;
  onMessage: () => void;
  mode: "sheet" | "page";
}) {
  const statusCfg = getStatusCfg(app.status);
  const timeline = deriveTimeline(app);
  const latestNote =
    app.status_history?.[app.status_history.length - 1]?.note ||
    (app.status === "pending"
      ? "Your request was received. A caseworker is usually assigned within a few hours."
      : app.status === "in_review"
        ? "A caseworker is reviewing your request and will reach out shortly."
        : "Your request has been processed.");

  const meta = (app.metadata ?? {}) as Record<string, unknown>;

  const chrome =
    mode === "sheet" ? (
      <>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#e8f0ee]" />
        </div>
      </>
    ) : null;

  return (
    <div
      className={
        mode === "sheet"
          ? "bg-white rounded-t-[20px] w-full max-w-[680px] max-h-[90%] flex flex-col shadow-[0_-8px_40px_rgba(0,0,0,0.14)] animate-slide-up mx-auto"
          : "bg-white rounded-[18px] w-full border border-[#e8f0ee] shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden"
      }
    >
      {chrome}

      {/* Header */}
      <div className="px-5 pt-4 pb-3.5 border-b border-[#e8f0ee] flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[17px] font-extrabold text-[#0f1f2e] tracking-[-0.3px] capitalize">
              {app.category?.replace(/_/g, " ") || "Service Request"}
            </div>
            {app.organization?.name && (
              <div className="text-[12px] font-semibold text-[#0d9b8a] mt-0.5">
                {app.organization.name}
                {app.organization.location ? ` · ${app.organization.location}` : ""}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[30px] h-[30px] rounded-full bg-gray-100 border border-[#e8f0ee] flex items-center justify-center flex-shrink-0 ml-3 hover:bg-gray-200 transition-colors"
            aria-label={mode === "sheet" ? "Close" : "Back"}
          >
            {mode === "sheet" ? (
              <svg
                viewBox="0 0 16 16"
                className="w-3 h-3 text-[#7a9e99]"
                style={{
                  stroke: "currentColor",
                  fill: "none",
                  strokeWidth: 1.5,
                  strokeLinecap: "round",
                }}
              >
                <path d="M2 2l12 12M14 2L2 14" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 16 16"
                className="w-4 h-4 text-[#0d9b8a]"
                style={{
                  stroke: "currentColor",
                  fill: "none",
                  strokeWidth: 2,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }}
              >
                <path d="M10.5 3.5L6 8l4.5 4.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className={mode === "sheet" ? "flex-1 overflow-y-auto px-5 pt-5 min-h-0" : "px-5 pt-5 pb-2"}>
        {/* Status hero */}
        <div className="rounded-[14px] overflow-hidden mb-5">
          <div className="bg-slate-900 px-4 py-3.5">
            <div className="text-[10px] font-bold uppercase tracking-[0.7px] text-white/70 mb-1">
              Current status
            </div>
            <div className="text-[20px] font-extrabold text-white tracking-[-0.4px] capitalize">
              {statusCfg.label}
            </div>
          </div>
          <div className="bg-white border border-[#e8f0ee] border-t-0 rounded-b-[14px] px-4 py-2.5">
            <div className="text-[12px] text-[#4b6b65] leading-relaxed">{latestNote}</div>
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#7a9e99] mb-3.5">
            Request timeline
          </div>
          {timeline.map((step, i) => (
            <TimelineNode key={i} step={step} isLast={i === timeline.length - 1} />
          ))}
        </div>

        {/* Your situation */}
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#7a9e99] mb-2.5">
            Your situation
          </div>
          <div className="bg-[#f3f4f6] rounded-[10px] px-3.5 py-3 text-[13px] text-[#0f1f2e] leading-relaxed">
            {app.description || "—"}
          </div>
        </div>

        {/* Details grid */}
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#7a9e99] mb-2.5">
            Request details
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: "Urgency",
                value: meta.urgency ? getUrgencyLabel(meta.urgency as string) : "—",
              },
              { label: "Household", value: (meta.household_size as string) || "—" },
              { label: "Borough", value: app.borough || "—" },
              {
                label: "Submitted",
                value: app.created_at
                  ? new Date(app.created_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—",
              },
            ].map((cell) => (
              <div key={cell.label} className="bg-[#f3f4f6] rounded-[10px] px-3 py-2.5">
                <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-[#7a9e99] mb-0.5">
                  {cell.label}
                </div>
                <div className="text-[13px] text-[#0f1f2e]">{cell.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-2" />
      </div>

      {/* Footer */}
      <div className="px-5 pt-3 pb-6 border-t border-[#e8f0ee] flex gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={app.assigned_staff_id ? onMessage : undefined}
          className={`flex-1 h-[46px] rounded-[12px] text-[14px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
            app.assigned_staff_id
              ? "bg-[#0d9b8a] hover:bg-[#0b8a7a] text-white"
              : "bg-gray-100 text-[#7a9e99] border border-[#e8f0ee] cursor-default"
          }`}
        >
          <svg
            viewBox="0 0 16 16"
            className="w-[15px] h-[15px]"
            style={{
              stroke: "currentColor",
              fill: "none",
              strokeWidth: 1.5,
              strokeLinecap: "round",
              strokeLinejoin: "round",
            }}
          >
            <path d="M12 3H4a1 1 0 00-1 1v7a1 1 0 001 1h2l2 2 2-2h2a1 1 0 001-1V4a1 1 0 00-1-1z" />
          </svg>
          Message caseworker
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-[46px] px-5 bg-white text-[#0f1f2e] border-[1.5px] border-[#e8f0ee] rounded-[12px] text-[14px] font-semibold hover:border-[#c8e4dc] transition-colors"
        >
          {mode === "sheet" ? "Close" : "Back"}
        </button>
      </div>
    </div>
  );
}

// ─── Application Card ─────────────────────────────────────────────────────────

function AppCard({ app, onClick }: { app: ClientApplication; onClick: () => void }) {
  const statusCfg = getStatusCfg(app.status);
  const latestUpdate = app.status_history?.[app.status_history.length - 1];
  const hasUpdate = !!latestUpdate?.note && !!latestUpdate?.changed_by?.full_name;

  return (
    <div onClick={onClick}
      className="bg-white rounded-[14px] p-4 mb-2.5 cursor-pointer transition-shadow duration-150 hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] select-none border border-[#e8f0ee]">
      <div className="flex items-start gap-3 mb-2.5">
        {app.organization?.imageUrl ? (
          <img src={app.organization.imageUrl} alt={app.organization.name}
            className="w-[38px] h-[38px] rounded-[10px] object-cover flex-shrink-0 border border-[#e8f0ee]" />
        ) : (
          <div className="w-[38px] h-[38px] rounded-[10px] bg-[#e1f5ee] flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 16 16" className="w-[17px] h-[17px] text-[#0d9b8a]"
              style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z" />
              <path d="M5 6h6M5 9h4" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-[#0f1f2e] mb-0.5 truncate capitalize">
            {app.category?.replace(/_/g, " ") || "Service Request"}
          </div>
          {app.organization?.name && (
            <div className="text-[11px] font-semibold text-[#0d9b8a] mb-1">
              {app.organization.name}
              {app.organization.location ? ` · ${app.organization.location}` : ""}
            </div>
          )}
          <div className="text-[12px] text-[#7a9e99] leading-relaxed overflow-hidden"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
            {app.description}
          </div>
        </div>

        <span className={`text-[10px] font-bold rounded-full px-3 py-[3px] whitespace-nowrap flex-shrink-0 ${statusCfg.pillClass}`}>
          {statusCfg.label}
        </span>
      </div>

      {hasUpdate && (
        <div className="bg-[#e1f5ee] rounded-[9px] px-3 py-2.5 flex items-start gap-1.5 mt-2 mb-2.5">
          <svg viewBox="0 0 16 16" className="w-3 h-3 text-[#0d9b8a] flex-shrink-0 mt-0.5"
            style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <path d="M12 3H4a1 1 0 00-1 1v7a1 1 0 001 1h2l2 2 2-2h2a1 1 0 001-1V4a1 1 0 00-1-1z" />
          </svg>
          <div className="text-[11px] text-[#4b6b65] leading-relaxed">
            <strong className="text-[#0f1f2e] font-semibold">{latestUpdate?.changed_by?.full_name}:</strong>{" "}
            {latestUpdate?.note}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-[#e8f0ee]">
        <div className="flex gap-3">
          <div className="flex items-center gap-1 text-[10px] text-[#7a9e99]">
            <svg viewBox="0 0 16 16" className="w-[11px] h-[11px]"
              style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 2" />
            </svg>
            {app.created_at
              ? new Date(app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "—"}
          </div>
          {app.borough && (
            <div className="flex items-center gap-1 text-[10px] text-[#7a9e99]">
              <svg viewBox="0 0 16 16" className="w-[11px] h-[11px]"
                style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
                <path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z" />
              </svg>
              {app.borough}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] font-semibold text-[#0d9b8a]">
          View
          <svg viewBox="0 0 16 16" className="w-[11px] h-[11px]"
            style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <path d="M6 4l4 4-4 4" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ApplicationsView({ requestId }: { requestId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState("all");
  const [applications, setApplications] = useState<ClientApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheetRequestId, setSheetRequestId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 50;

  useEffect(() => {
    if (!user) return;
    async function loadRequests() {
      try {
        setLoading(true);
        setLoadError(null);
        const data = (await requestsApi.getMyRequests({ page: 1, pageSize })) as unknown as ClientApplication[];
        setApplications(data ?? []);
        setPage(1);
        setHasMore((data?.length ?? 0) === pageSize);
      } catch (e: unknown) {
        const err = e as { message?: string };
        setLoadError(err?.message || "Failed to load applications.");
      } finally {
        setLoading(false);
      }
    }
    void loadRequests();
  }, [user]);

  useEffect(() => {
    function onResize() {
      if (typeof window === "undefined") return;
      if (window.innerWidth > 768) {
        setSheetRequestId(null);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const reload = useMemo(
    () => async () => {
      const data = (await requestsApi.getMyRequests({ page: 1, pageSize })) as unknown as ClientApplication[];
      setApplications(data ?? []);
      setPage(1);
      setHasMore((data?.length ?? 0) === pageSize);
    },
    []
  );

  async function loadMore() {
    if (!hasMore) return;
    const nextPage = page + 1;
    const data = (await requestsApi.getMyRequests({ page: nextPage, pageSize })) as unknown as ClientApplication[];
    setApplications((prev) => [...prev, ...(data ?? [])]);
    setPage(nextPage);
    setHasMore((data?.length ?? 0) === pageSize);
  }

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`client-applications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_requests", filter: `member_id=eq.${user.id}` },
        () => void reload()
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [reload, user]);

  const tabs = [
    { id: "all",       label: "All",       count: applications.length },
    { id: "in_review", label: "In Review", count: applications.filter((a) => a.status === "in_review").length },
    { id: "pending",   label: "Pending",   count: applications.filter((a) => a.status === "pending").length },
    { id: "approved",  label: "Approved",  count: applications.filter((a) => a.status === "approved").length },
    { id: "rejected",  label: "Rejected",  count: applications.filter((a) => a.status === "rejected").length },
    { id: "completed", label: "Completed", count: applications.filter((a) => a.status === "completed").length },
  ];

  const filtered =
    selectedTab === "all"
      ? applications
      : applications.filter((a) => a.status === selectedTab);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0d9b8a]" />
      </div>
    );
  }

  const activeApplication = requestId
    ? applications.find((a) => String(a.id) === String(requestId))
    : null;

  const sheetApplication = sheetRequestId
    ? applications.find((a) => String(a.id) === String(sheetRequestId))
    : null;

  if (requestId) {
    if (!activeApplication) {
      return (
        <div className="w-full">
          <div className="w-full">
            <button
              type="button"
              onClick={() => navigate("/client/applications")}
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#0d9b8a] hover:text-[#0b8a7a] mb-4"
            >
              <svg
                viewBox="0 0 16 16"
                className="w-4 h-4"
                style={{
                  stroke: "currentColor",
                  fill: "none",
                  strokeWidth: 2,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }}
              >
                <path d="M10.5 3.5L6 8l4.5 4.5" />
              </svg>
              Back to applications
            </button>

            <div className="rounded-xl border border-[#e8f0ee] bg-white p-5">
              <div className="text-[16px] font-extrabold text-[#0f1f2e]">Application not found</div>
              <div className="text-[13px] text-[#7a9e99] mt-1">
                This application may have been deleted or you may not have access.
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full">
        <div className="w-full">
          <div className="mb-4">
            <button
              type="button"
              onClick={() => navigate("/client/applications")}
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#0d9b8a] hover:text-[#0b8a7a]"
            >
              <svg
                viewBox="0 0 16 16"
                className="w-4 h-4"
                style={{
                  stroke: "currentColor",
                  fill: "none",
                  strokeWidth: 2,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }}
              >
                <path d="M10.5 3.5L6 8l4.5 4.5" />
              </svg>
              Back
            </button>
          </div>

          <DetailLayout
            app={activeApplication}
            mode="page"
            onClose={() => navigate("/client/applications")}
            onMessage={() => {
              navigate(`/client/messages?requestId=${activeApplication.id}`);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full">
        {/* Page header */}
        <div className="mb-5">
          <h1 className="text-[22px] font-extrabold tracking-[-0.3px] text-[#0f1f2e] mb-0.5">
            My Applications
          </h1>
          <p className="text-[13px] text-[#7a9e99]">
            Track your service applications and their status
          </p>
        </div>

        {/* Error */}
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 mb-4">
            <p className="text-sm font-semibold">Couldn&apos;t load applications</p>
            <p className="text-xs mt-1">{loadError}</p>
            <button type="button" onClick={() => window.location.reload()}
              className="mt-3 h-9 px-3 rounded-lg bg-white border border-red-200 text-red-700 text-[12px] font-semibold hover:bg-red-50">
              Refresh
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-0.5 scrollbar-hide">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setSelectedTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all duration-150 border-0 ${
                selectedTab === tab.id
                  ? "bg-[#0d9b8a] text-white"
                  : "bg-white text-[#6b7280] hover:bg-gray-50 border border-[#e8f0ee]"
              }`}>
              {tab.label}
              <span className={`text-[10px] font-bold rounded-full px-1.5 py-[1px] ${
                selectedTab === tab.id ? "bg-white/25 text-white" : "bg-[#f3f4f6] text-[#9ca3af]"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Cards */}
        <div>
          {filtered.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth <= 768) {
                  setSheetRequestId(String(app.id));
                } else {
                  navigate(`/client/applications/${app.id}`);
                }
              }}
            />
          ))}
        </div>

        {selectedTab === "all" && filtered.length > 0 && (
          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={!hasMore}
              className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
            >
              {hasMore ? "Load more" : "No more applications"}
            </button>
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-full bg-[#f3f4f6] border-[1.5px] border-[#e8f0ee] flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 16 16" className="w-6 h-6 text-[#7a9e99]"
                style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
                <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z" />
                <path d="M5 6h6M5 9h4" />
              </svg>
            </div>
            <h3 className="text-[16px] font-bold text-[#0f1f2e] mb-1.5">Nothing here yet</h3>
            <p className="text-[13px] text-[#7a9e99] leading-relaxed max-w-[240px] mx-auto mb-5">
              {selectedTab === "all"
                ? "You haven't submitted any applications yet."
                : "No requests in this category."}
            </p>
            {selectedTab !== "all" && (
              <button type="button" onClick={() => setSelectedTab("all")}
                className="bg-[#0d9b8a] text-white border-0 rounded-full px-5 py-2.5 text-[13px] font-semibold cursor-pointer hover:bg-[#0b8a7a] transition-colors">
                View all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile bottom sheet detail (≤768px) */}
      {sheetApplication && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Close application details"
            onClick={() => setSheetRequestId(null)}
          />
          <div className="relative w-full">
            <DetailLayout
              app={sheetApplication}
              mode="sheet"
              onClose={() => setSheetRequestId(null)}
              onMessage={() => {
                setSheetRequestId(null);
                navigate(`/client/messages?requestId=${sheetApplication.id}`);
              }}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}