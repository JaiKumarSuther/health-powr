import { useMemo, useState } from "react";
import { 
  Check, 
  MapPin, 
  PauseCircle, 
  Search, 
  X, 
  Building2,
  Mail,
  Phone,
  Calendar,
  Filter,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  RefreshCw
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  useAdminOrganizations,
  useUpdateOrganizationStatus,
  type AdminOrg,
  type AdminOrgStatus,
} from "../../hooks/useAdminOrganizations";

const STATUS_LABELS: Record<string, string> = {
  all: "All Statuses",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

const STATUS_BADGE: Record<AdminOrgStatus, { bg: string; text: string; icon: any }> = {
  pending: { bg: "bg-amber-50", text: "text-amber-700", icon: Clock },
  approved: { bg: "bg-emerald-50", text: "text-emerald-700", icon: CheckCircle },
  rejected: { bg: "bg-rose-50", text: "text-rose-700", icon: XCircle },
  suspended: { bg: "bg-gray-100", text: "text-gray-600", icon: PauseCircle },
};

const STATUS_ACTIONS: Record<
  AdminOrgStatus,
  { approve?: boolean; reject?: boolean; suspend?: boolean }
> = {
  pending: { approve: true, reject: true },
  approved: { suspend: true },
  rejected: { approve: true },
  suspended: { approve: true },
};

interface Props {
  onViewDetails: (orgId: string) => void;
}

export function OrganizationsListView({ onViewDetails }: Props) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const orgsQuery = useAdminOrganizations(!!user);
  const updateStatus = useUpdateOrganizationStatus();

  const orgs = (orgsQuery.data ?? []) as AdminOrg[];
  const loading = orgsQuery.isLoading;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: orgs.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      suspended: 0,
    };
    for (const o of orgs) counts[o.status] = (counts[o.status] ?? 0) + 1;
    return counts;
  }, [orgs]);

  const filtered = useMemo(() => {
    const items = orgs.filter((o) => {
      const matchesSearch = `${o.name} ${o.borough} ${(o.category ?? []).join(" ")}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    return [...items].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [orgs, searchTerm, statusFilter]);

  async function handleSetStatus(
    id: string,
    status: Exclude<AdminOrgStatus, "pending">,
  ) {
    try {
      setUpdatingId(id);
      await updateStatus.mutateAsync({
        orgId: id,
        status,
        reason:
          status === "rejected"
            ? rejectReason[id] || "Not provided"
            : undefined,
      });
      if (status === "rejected") {
        setRejectReason((prev) => {
          const newState = { ...prev };
          delete newState[id];
          return newState;
        });
      }
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600"></div>
          <p className="mt-4 text-sm text-gray-500">Loading organizations...</p>
        </div>
      </div>
    );
  }

  if (orgsQuery.isError) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-600" />
          <p className="mt-3 font-semibold text-rose-800">Failed to load organizations</p>
          <p className="mt-1 text-sm text-rose-600">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Organizations
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and review organization applications
            </p>
          </div>
          <button
            onClick={() => orgsQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div 
            onClick={() => setStatusFilter("all")}
            className={`cursor-pointer rounded-2xl border-2 p-4 transition-all hover:shadow-md ${
              statusFilter === "all"
                ? "border-teal-500 bg-gradient-to-br from-teal-50 to-white shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <Building2 className={`h-5 w-5 ${statusFilter === "all" ? "text-teal-600" : "text-gray-400"}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === "all" ? "text-teal-600" : "text-gray-400"}`}>Total</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{statusCounts.all}</p>
          </div>
          
          <div 
            onClick={() => setStatusFilter("pending")}
            className={`cursor-pointer rounded-2xl border-2 p-4 transition-all hover:shadow-md ${
              statusFilter === "pending"
                ? "border-amber-500 bg-gradient-to-br from-amber-50 to-white shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <Clock className={`h-5 w-5 ${statusFilter === "pending" ? "text-amber-600" : "text-gray-400"}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === "pending" ? "text-amber-600" : "text-gray-400"}`}>Pending</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{statusCounts.pending}</p>
          </div>
          
          <div 
            onClick={() => setStatusFilter("approved")}
            className={`cursor-pointer rounded-2xl border-2 p-4 transition-all hover:shadow-md ${
              statusFilter === "approved"
                ? "border-emerald-500 bg-gradient-to-br from-emerald-50 to-white shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <CheckCircle className={`h-5 w-5 ${statusFilter === "approved" ? "text-emerald-600" : "text-gray-400"}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === "approved" ? "text-emerald-600" : "text-gray-400"}`}>Approved</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{statusCounts.approved}</p>
          </div>
          
          <div 
            onClick={() => setStatusFilter("rejected")}
            className={`cursor-pointer rounded-2xl border-2 p-4 transition-all hover:shadow-md ${
              statusFilter === "rejected"
                ? "border-rose-500 bg-gradient-to-br from-rose-50 to-white shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <XCircle className={`h-5 w-5 ${statusFilter === "rejected" ? "text-rose-600" : "text-gray-400"}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === "rejected" ? "text-rose-600" : "text-gray-400"}`}>Rejected</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{statusCounts.rejected}</p>
          </div>
          
          <div 
            onClick={() => setStatusFilter("suspended")}
            className={`cursor-pointer rounded-2xl border-2 p-4 transition-all hover:shadow-md md:col-span-2 lg:col-span-1 ${
              statusFilter === "suspended"
                ? "border-gray-500 bg-gradient-to-br from-gray-50 to-white shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <PauseCircle className={`h-5 w-5 ${statusFilter === "suspended" ? "text-gray-600" : "text-gray-400"}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === "suspended" ? "text-gray-600" : "text-gray-400"}`}>Suspended</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{statusCounts.suspended}</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, borough, category..."
                  className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/10 transition-all"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex-1 lg:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 h-11 px-4 text-sm font-bold uppercase tracking-wider transition-all ${
                    showFilters ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  Status Filters
                  <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>

            <div className={`mt-4 transition-all duration-300 ${showFilters ? "opacity-100 max-h-40" : "opacity-0 max-h-0 pointer-events-none overflow-hidden"}`}>
              <div className="flex flex-wrap gap-2 py-2">
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStatusFilter(val)}
                    className={`rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-tight transition-all ${
                      statusFilter === val
                        ? "bg-teal-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                    <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${
                      statusFilter === val
                        ? "bg-white/20 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}>
                      {statusCounts[val] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Showing <span className="text-gray-900">{filtered.length}</span> of {orgs.length} orgs
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-[11px] font-bold text-teal-600 hover:text-teal-700 uppercase"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Organizations Grid */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-12 text-center">
              <Building2 className="h-16 w-16 text-gray-300" />
              <p className="mt-4 text-lg font-semibold text-gray-900">No organizations found</p>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your search or filter criteria
              </p>
              {(searchTerm || statusFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                  className="mt-6 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((org) => {
                const StatusIcon = STATUS_BADGE[org.status].icon;
                return (
                  <div
                    key={org.id}
                    className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                      org.status === "pending"
                        ? "border-amber-200 bg-gradient-to-br from-amber-50/30 to-white"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    {/* Status indicator bar */}
                    <div className={`absolute top-0 left-0 h-1 w-full ${
                      org.status === "pending" ? "bg-amber-500" :
                      org.status === "approved" ? "bg-emerald-500" :
                      org.status === "rejected" ? "bg-rose-500" : "bg-gray-500"
                    }`} />

                    <div className="p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg">
                            <span className="text-lg font-bold">
                              {org.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => onViewDetails(org.id)}
                              className="text-left w-full group/name"
                            >
                              <p className="font-bold text-gray-900 truncate group-hover/name:text-teal-600 transition-colors">
                                {org.name}
                              </p>
                            </button>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[org.status].bg} ${STATUS_BADGE[org.status].text}`}>
                                <StatusIcon className="h-3 w-3" />
                                {org.status}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                                <MapPin className="h-3 w-3" />
                                {org.borough}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="mt-4 space-y-2">
                        {org.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="h-3.5 w-3.5 text-gray-400" />
                            <span className="truncate">{org.email}</span>
                          </div>
                        )}
                        {org.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="h-3.5 w-3.5 text-gray-400" />
                            <span>{org.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Dates */}
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-gray-50 px-3 py-2">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            <span>Submitted</span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {new Date(org.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <CheckCircle className="h-3 w-3" />
                            <span>Approved</span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {org.approved_at ? new Date(org.approved_at).toLocaleDateString() : "—"}
                          </p>
                        </div>
                      </div>

                      {/* Categories */}
                      {org.category && org.category.length > 0 && (
                        <div className="mt-4">
                          <div className="flex flex-wrap gap-2">
                            {org.category.slice(0, 3).map((cat) => (
                              <span
                                key={cat}
                                className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700"
                              >
                                {cat}
                              </span>
                            ))}
                            {org.category.length > 3 && (
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                +{org.category.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Rejection Reason */}
                      {org.rejection_reason && (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                          <p className="text-xs font-semibold text-rose-800">Rejection Reason</p>
                          <p className="mt-1 text-xs text-rose-700">{org.rejection_reason}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-6 space-y-3" onClick={(e) => e.stopPropagation()}>
                        {org.status === "pending" && (
                          <input
                            value={rejectReason[org.id] || ""}
                            onChange={(e) =>
                              setRejectReason((prev) => ({
                                ...prev,
                                [org.id]: e.target.value,
                              }))
                            }
                            placeholder="Add rejection reason (required for rejection)"
                            className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm placeholder:text-gray-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                          />
                        )}

                        <div className="flex flex-wrap gap-2">
                          {/* View Details Button */}
                          <button
                            onClick={() => onViewDetails(org.id)}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 hover:border-gray-300"
                          >
                            <Eye className="h-4 w-4" />
                            View Details
                          </button>

                          {/* Status Action Buttons */}
                          {STATUS_ACTIONS[org.status].approve && (
                            <button
                              disabled={updatingId === org.id}
                              onClick={() => void handleSetStatus(org.id, "approved")}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-700 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <Check className="h-4 w-4" />
                              {org.status === "suspended" ? "Reinstate" : "Approve"}
                            </button>
                          )}

                          {STATUS_ACTIONS[org.status].suspend && (
                            <button
                              disabled={updatingId === org.id}
                              onClick={() => void handleSetStatus(org.id, "suspended")}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-amber-700 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <PauseCircle className="h-4 w-4" />
                              Suspend
                            </button>
                          )}

                          {STATUS_ACTIONS[org.status].reject && (
                            <button
                              disabled={updatingId === org.id}
                              onClick={() => void handleSetStatus(org.id, "rejected")}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-rose-700 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <X className="h-4 w-4" />
                              Reject
                            </button>
                          )}
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
  );
}