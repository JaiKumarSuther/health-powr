import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, HeartPulse, Home, FileText, Eye } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useUserOrganization } from "../../hooks/useOrganizations";
import type { OrganizationRow } from "../../lib/organzationsApi";
import {
  useOrganizationServices,
  useUpdateServiceAvailability,
} from "../../hooks/useServices";

export function ServicesView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgQuery = useUserOrganization(user?.id);
  const org = (orgQuery.data ?? null) as OrganizationRow | null;
  const updateService = useUpdateServiceAvailability();

  const canManageServices = useMemo(() => {
    if (!org) return false;
    return org.status === "approved";
  }, [org]);

  const servicesQuery = useOrganizationServices(org?.id);

  if (orgQuery.isLoading) {
    return (
      <div className="py-20 text-center text-gray-500">
        Loading organization...
      </div>
    );
  }

  if (!org) {
    return (
      <div className="py-20 text-center text-gray-500">
        No organization found for your account.
      </div>
    );
  }

  if (servicesQuery.isLoading) {
    return (
      <div className="py-20 text-center text-gray-500">Loading services...</div>
    );
  }

  if (servicesQuery.isError) {
    return (
      <div className="py-20 text-center text-red-600">
        Failed to load services.
      </div>
    );
  }

  const services = servicesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-bold text-slate-900">Our Services</h2>
          <p className="text-[12px] text-slate-500 mt-1">
            Manage the services {org.name ?? "your organization"} offers to the community
          </p>
        </div>

        {canManageServices && (
          <button
            type="button"
            onClick={() => navigate("/cbo/services/new")}
            className="w-full sm:w-auto h-9 px-3 rounded-lg bg-teal-600 text-white text-[12px] font-semibold hover:bg-teal-700 transition-colors"
          >
            + Add Service
          </button>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-[14px] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-slate-50/50 flex items-center justify-between">
          <p className="text-[13px] font-bold text-slate-900">
            Current Services ({services.length})
          </p>
          {canManageServices && (
            <button
              type="button"
              onClick={() => navigate("/cbo/services/new")}
              className="text-[12px] font-semibold text-teal-700 hover:text-teal-800"
            >
              + Add new
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-100">
          {services.map((s) => {
            const cat = String(s.category ?? "").toLowerCase();
            const catLabel = String(s.category ?? "").replace(/_/g, " ");

            const iconMeta = (() => {
              if (cat === "food") {
                return {
                  Icon: FileText,
                  box: "bg-orange-50 text-orange-700 border-orange-100",
                };
              }
              if (cat === "housing") {
                return {
                  Icon: Home,
                  box: "bg-teal-50 text-teal-700 border-teal-100",
                };
              }
              if (cat === "healthcare" || cat === "mental_health") {
                return {
                  Icon: HeartPulse,
                  box: "bg-red-50 text-red-700 border-red-100",
                };
              }
              if (cat === "job_training" || cat === "employment") {
                return {
                  Icon: Briefcase,
                  box: "bg-amber-50 text-amber-700 border-amber-100",
                };
              }
              return {
                Icon: FileText,
                box: "bg-slate-50 text-slate-700 border-slate-200",
              };
            })();

            const isOn = !!s.is_available;

            return (
              <div
                key={s.id}
                className="px-4 py-4 sm:py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-[7px] border flex items-center justify-center flex-shrink-0 ${iconMeta.box}`}
                  >
                    <iconMeta.Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold text-slate-900 truncate">
                      {s.name}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {catLabel}
                      {s.hours ? ` · ${s.hours}` : ""}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-bold",
                        isOn ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700",
                      ].join(" ")}
                    >
                      {isOn ? "Active" : "Inactive"}
                    </span>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isOn}
                      onClick={async () => {
                        await updateService.mutateAsync({
                          serviceId: s.id,
                          isAvailable: !isOn,
                          hours: s.hours ?? undefined,
                        });
                      }}
                      className={[
                        "relative w-[32px] h-[18px] rounded-full transition-colors",
                        isOn ? "bg-teal-600" : "bg-slate-300",
                        "focus:outline-none",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full transition-all shadow",
                          isOn ? "left-[16px]" : "left-[2px]",
                        ].join(" ")}
                      />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="h-8 w-8 rounded-lg border border-gray-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center transition-colors"
                    onClick={() => navigate(`/cbo/services/${s.id}`)}
                    aria-label="View service"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {services.length === 0 && (
            <div className="p-10 text-center text-slate-500">
              <p className="text-[13px] font-semibold">No services yet</p>
              <p className="text-[12px] text-slate-400 mt-1">
                Add your first service to make it visible in the Client Portal.
              </p>
            </div>
          )}
        </div>
      </div>

      {!canManageServices && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="font-medium">
            You can't add or manage services right now.
          </p>
          <p className="text-sm mt-1">
            Your organization status is currently{" "}
            <span className="font-semibold capitalize">{org.status}</span>.
            {org.status === "pending"
              ? " Once approved by an admin, you’ll be able to add and manage services."
              : org.status === "rejected"
                ? " Your organization was rejected. Please contact support or update your details and request review."
                : " Your organization has been suspended. Please contact support."}
          </p>
        </div>
      )}
    </div>
  );
}
