import { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { supabase } from "../../lib/supabase";
import { requestsApi } from "../../api/requests";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  PieChart as PieChartIcon,
  RefreshCw,
  TicketCheck,
  TrendingUp,
  Users,
  Activity,
  BarChart3,
  Maximize2,
  Minimize2,
} from "lucide-react";

type KV = { name: string; value: number };
type DateCount = { date: string; count: number };

const TEAL = "#0d9488";
const COLORS = ["#0d9488", "#0284c7", "#7c3aed", "#db2777", "#ea580c", "#16a34a"];

function groupAndCount(rows: Record<string, unknown>[] | null, field: string): KV[] {
  if (!rows?.length) return [];
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const val = String(r[field] ?? "unknown");
    counts[val] = (counts[val] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function groupByDate(rows: { created_at: string }[] | null): DateCount[] {
  if (!rows?.length) return [];
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const date = r.created_at.slice(0, 10);
    counts[date] = (counts[date] || 0) + 1;
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  color = "teal",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: any;
  trend?: { value: number; isPositive: boolean };
  color?: "teal" | "blue" | "purple" | "orange" | "emerald";
}) {
  const colorClasses = {
    teal: "from-teal-50 to-transparent",
    blue: "from-blue-50 to-transparent",
    purple: "from-purple-50 to-transparent",
    orange: "from-orange-50 to-transparent",
    emerald: "from-emerald-50 to-transparent",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-gray-100">
      <div className={`absolute top-0 right-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br ${colorClasses[color]} opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />
      
      <div className="relative">
        <div className="flex items-center justify-between">
          {Icon && <Icon className={`h-5 w-5 text-${color}-600`} />}
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        </div>
        <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">{value}</p>
        {hint && (
          <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
            <span className="inline-block h-1 w-1 rounded-full bg-gray-400" />
            {hint}
          </p>
        )}
        {trend && (
          <div className="mt-2 flex items-center gap-1">
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3 text-green-600" />
            ) : (
              <AlertCircle className="h-3 w-3 text-red-600" />
            )}
            <span className={`text-xs font-medium ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
              {trend.isPositive ? "+" : "-"}{trend.value}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
  defaultExpanded = false,
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-md ${isExpanded ? "lg:col-span-2" : ""}`}>
      <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-teal-600" />}
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-lg p-1 hover:bg-gray-100 transition-colors"
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4 text-gray-500" />
            ) : (
              <Maximize2 className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>
      <div className="p-4 md:p-6">
        {children}
      </div>
    </div>
  );
}

// Custom responsive tooltip
const CustomTooltip = ({ active, payload, label, type = "default" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-gray-900/95 backdrop-blur-sm px-3 py-2 shadow-xl border border-gray-700">
        <p className="text-xs font-medium text-gray-300">{label}</p>
        <p className="text-lg font-bold text-teal-400">
          {payload[0].value.toLocaleString()}
        </p>
        {type === "category" && (
          <p className="text-xs text-gray-400 mt-1">Requests</p>
        )}
      </div>
    );
  }
  return null;
};

// Responsive wrapper for charts
function ResponsiveChartWrapper({ children, height = 300 }: { children: React.ReactNode; height?: number }) {
  const [containerHeight, setContainerHeight] = useState(height);
  
  useEffect(() => {
    const updateHeight = () => {
      if (window.innerWidth < 640) {
        setContainerHeight(height * 0.7);
      } else if (window.innerWidth < 768) {
        setContainerHeight(height * 0.85);
      } else {
        setContainerHeight(height);
      }
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [height]);
  
  return (
    <ResponsiveContainer width="100%" height={containerHeight}>
      {children}
    </ResponsiveContainer>
  );
}

export function AdminOverviewView() {
  const [chartView, setChartView] = useState<"area" | "bar">("area");
  
  const overviewQuery = useQuery({
    queryKey: queryKeys.adminOverview(),
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        counts,
        { data: timeRaw, error: timeErr },
        { data: catRaw, error: catErr },
        { data: orgRaw, error: orgErr },
        { data: roleRaw, error: roleErr },
      ] = await Promise.all([
        requestsApi.getStatusCounts(),
        supabase
          .from("service_requests")
          .select("created_at, metadata")
          .gte("created_at", thirtyDaysAgo.toISOString()),
        supabase.from("service_requests").select("category, metadata, created_at"),
        supabase.from("organizations").select("status"),
        supabase.from("profiles").select("role"),
      ]);

      if (timeErr) throw timeErr;
      if (catErr) throw catErr;
      if (orgErr) throw orgErr;
      if (roleErr) throw roleErr;

      return {
        requestStatusCounts: counts,
        requestsOverTime: groupByDate((timeRaw ?? []) as { created_at: string }[]),
        requestsByCategory: groupAndCount(catRaw as Record<string, unknown>[], "category"),
        orgByStatus: groupAndCount(orgRaw as Record<string, unknown>[], "status"),
        userByRole: groupAndCount(roleRaw as Record<string, unknown>[], "role"),
      };
    },
    staleTime: Infinity,
    refetchOnMount: false,
  });

  const requestStatusCounts = overviewQuery.data?.requestStatusCounts ?? {};
  const requestsOverTime = overviewQuery.data?.requestsOverTime ?? [];
  const requestsByCategory = overviewQuery.data?.requestsByCategory ?? [];
  const orgByStatus = overviewQuery.data?.orgByStatus ?? [];
  const userByRole = overviewQuery.data?.userByRole ?? [];

  const totalRequests = useMemo(
    () => Object.values(requestStatusCounts).reduce((s, n) => s + n, 0),
    [requestStatusCounts],
  );
  const inProgress = (requestStatusCounts["in_progress"] ?? 0) + (requestStatusCounts["in_review"] ?? 0);
  const newCount = requestStatusCounts["new"] ?? 0;
  const closed = requestStatusCounts["closed"] ?? 0;

  const activeCBOs = useMemo(
    () => orgByStatus.find((o) => o.name === "approved")?.value ?? 0,
    [orgByStatus],
  );
  const pendingCBOs = useMemo(
    () => orgByStatus.find((o) => o.name === "pending")?.value ?? 0,
    [orgByStatus],
  );
  const communityMembers = useMemo(
    () => userByRole.find((o) => o.name === "community_member")?.value ?? 0,
    [userByRole],
  );

  const lastUpdatedLabel = overviewQuery.dataUpdatedAt
    ? new Date(overviewQuery.dataUpdatedAt).toLocaleTimeString()
    : null;

  if (overviewQuery.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
          <p className="mt-4 text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (overviewQuery.isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-8">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-8 w-8 text-red-600" />
          <div>
            <p className="font-semibold text-red-800">Dashboard load failed</p>
            <p className="text-sm text-red-700 mt-1">
              {overviewQuery.error instanceof Error
                ? overviewQuery.error.message
                : "Failed to load dashboard data."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void overviewQuery.refetch()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-red-700 hover:shadow-md"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Platform insights and performance metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdatedLabel && (
              <p className="hidden sm:block text-xs text-gray-400">
                Last updated: {lastUpdatedLabel}
              </p>
            )}
            <button
              type="button"
              onClick={() => void overviewQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${overviewQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Grid - Responsive */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total Requests" value={totalRequests} icon={TicketCheck} color="teal" />
          <StatCard label="New" value={newCount} icon={Clock} color="blue" />
          <StatCard label="In Progress" value={inProgress} icon={TrendingUp} color="purple" />
          <StatCard label="Closed" value={closed} icon={CheckCircle} color="emerald" />
          <StatCard label="Active Orgs" value={activeCBOs} icon={Building2} hint="Approved organizations" color="orange" />
          <StatCard label="Community Users" value={communityMembers} icon={Users} hint="Active community members" color="teal" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Panel title="Requests Trend (Last 30 Days)" icon={Calendar} defaultExpanded>
              <div className="space-y-4">
                {/* Chart type selector */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setChartView("area")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      chartView === "area"
                        ? "bg-teal-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Area
                  </button>
                  <button
                    onClick={() => setChartView("bar")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      chartView === "bar"
                        ? "bg-teal-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Bar
                  </button>
                </div>
                
                {requestsOverTime.length === 0 ? (
                  <div className="flex h-64 items-center justify-center">
                    <Activity className="h-12 w-12 text-gray-300" />
                    <p className="text-sm text-gray-400 ml-2">No data available</p>
                  </div>
                ) : (
                  <ResponsiveChartWrapper height={320}>
                    {chartView === "area" ? (
                      <AreaChart data={requestsOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="hpArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={TEAL} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: "#6b7280" }}
                          tickFormatter={(v: string) => {
                            const parts = v.split('-');
                            return `${parts[1]}/${parts[2]}`;
                          }}
                          interval={Math.ceil(requestsOverTime.length / 6)}
                          stroke="#e5e7eb"
                        />
                        <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} allowDecimals={false} stroke="#e5e7eb" width={40} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke={TEAL}
                          fill="url(#hpArea)"
                          strokeWidth={2}
                          animationDuration={1000}
                        />
                      </AreaChart>
                    ) : (
                      <BarChart data={requestsOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: "#6b7280" }}
                          tickFormatter={(v: string) => {
                            const parts = v.split('-');
                            return `${parts[1]}/${parts[2]}`;
                          }}
                          interval={Math.ceil(requestsOverTime.length / 6)}
                          stroke="#e5e7eb"
                        />
                        <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} allowDecimals={false} stroke="#e5e7eb" width={40} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" fill={TEAL} radius={[4, 4, 0, 0]} animationDuration={1000} />
                      </BarChart>
                    )}
                  </ResponsiveChartWrapper>
                )}
              </div>
            </Panel>
          </div>

          <Panel title="Organization Status" icon={Building2}>
            {orgByStatus.length === 0 ? (
              <div className="flex h-64 items-center justify-center">
                <Building2 className="h-12 w-12 text-gray-300" />
                <p className="text-sm text-gray-400 ml-2">No data available</p>
              </div>
            ) : (
              <>
                <ResponsiveChartWrapper height={280}>
                  <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Pie
                      data={orgByStatus}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={80}
                      innerRadius={40}
                      paddingAngle={2}
                      label={({ percent }) => {
                        const p = typeof percent === "number" ? percent : 0;
                        return p > 0.05 ? `${(p * 100).toFixed(0)}%` : "";
                      }}
                      labelLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                      animationDuration={1000}
                    >
                      {orgByStatus.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Legend 
                      wrapperStyle={{ fontSize: 10, paddingTop: 20 }}
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                    />
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveChartWrapper>
                {pendingCBOs > 0 && (
                  <div className="mt-4 rounded-lg bg-amber-50 p-3 border border-amber-200">
                    <p className="text-xs text-amber-800 flex items-center gap-2">
                      <AlertCircle className="h-3 w-3" />
                      Pending approvals: <span className="font-semibold">{pendingCBOs}</span>
                    </p>
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Requests by Category" icon={PieChartIcon}>
            {requestsByCategory.length === 0 ? (
              <div className="flex h-64 items-center justify-center">
                <BarChart3 className="h-12 w-12 text-gray-300" />
                <p className="text-sm text-gray-400 ml-2">No data available</p>
              </div>
            ) : (
              <ResponsiveChartWrapper height={320}>
                <BarChart 
                  data={requestsByCategory} 
                  layout={window.innerWidth < 640 ? "vertical" : "horizontal"}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  {window.innerWidth >= 640 ? (
                    <>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "#6b7280" }}
                        tickFormatter={(v: string) => v.replace(/_/g, " ").substring(0, 15)}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        stroke="#e5e7eb"
                      />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} allowDecimals={false} stroke="#e5e7eb" />
                    </>
                  ) : (
                    <>
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 9, fill: "#6b7280" }}
                        tickFormatter={(v: string) => v.replace(/_/g, " ").substring(0, 12)}
                        width={80}
                        stroke="#e5e7eb"
                      />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} allowDecimals={false} stroke="#e5e7eb" />
                    </>
                  )}
                  <Tooltip content={<CustomTooltip type="category" />} />
                  <Bar 
                    dataKey="value" 
                    fill={TEAL} 
                    radius={[4, 4, 0, 0]} 
                    animationDuration={1000}
                  />
                </BarChart>
              </ResponsiveChartWrapper>
            )}
          </Panel>

          <Panel title="Users by Role" icon={Users}>
            {userByRole.length === 0 ? (
              <div className="flex h-64 items-center justify-center">
                <Users className="h-12 w-12 text-gray-300" />
                <p className="text-sm text-gray-400 ml-2">No data available</p>
              </div>
            ) : (
              <ResponsiveChartWrapper height={320}>
                <BarChart 
                  data={userByRole} 
                  layout={window.innerWidth < 640 ? "vertical" : "horizontal"}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  {window.innerWidth >= 640 ? (
                    <>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "#6b7280" }}
                        tickFormatter={(v: string) => v.replace(/_/g, " ")}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        stroke="#e5e7eb"
                      />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} allowDecimals={false} stroke="#e5e7eb" />
                    </>
                  ) : (
                    <>
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 9, fill: "#6b7280" }}
                        tickFormatter={(v: string) => v.replace(/_/g, " ").substring(0, 12)}
                        width={80}
                        stroke="#e5e7eb"
                      />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} allowDecimals={false} stroke="#e5e7eb" />
                    </>
                  )}
                  <Tooltip content={<CustomTooltip type="category" />} />
                  <Bar 
                    dataKey="value" 
                    fill="#0284c7" 
                    radius={[4, 4, 0, 0]} 
                    animationDuration={1000}
                  />
                </BarChart>
              </ResponsiveChartWrapper>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}