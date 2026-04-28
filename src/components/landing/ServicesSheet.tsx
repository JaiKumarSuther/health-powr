import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Filter,
  ArrowUpDown,
  Search,
  MapPin,
  Clock,
  ShieldCheck,
  ChevronRight,
  Home,
  Users,
  HeartPulse,
  Briefcase,
  Scale,
  GraduationCap,
  MessageCircle,
  AlertCircle,
} from "lucide-react";
import { PublicService } from "../../api/services";
import { usePublicServices } from "../../hooks/usePublicServices";

interface ServicesSheetProps {
  isOpen: boolean;
  query: string;
  initialCategory: string | null;
  onClose: () => void;
  onRequestNow: (service: PublicService) => void;
}

const CATEGORIES = [
  { id: "housing", label: "Housing", icon: Home },
  { id: "food", label: "Food", icon: Users },
  { id: "healthcare", label: "Healthcare", icon: HeartPulse },
  { id: "job_training", label: "Employment", icon: Briefcase },
  { id: "legal", label: "Legal", icon: Scale },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "community", label: "Community", icon: MessageCircle },
];

const SORTS = [
  { id: "open", label: "Open first" },
  { id: "nearest", label: "Nearest first" },
  { id: "az", label: "A–Z" },
];

export function ServicesSheet({
  isOpen,
  query: searchQuery,
  initialCategory,
  onClose,
  onRequestNow,
}: ServicesSheetProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory);
  const [activeSort, setActiveSort] = useState("open");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);

  const { data: services, isLoading, isError, refetch } = usePublicServices({
    category: activeCategory || undefined,
  });

  useEffect(() => {
    setActiveCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setShowSkeleton(true);
      const timer = setTimeout(() => setShowSkeleton(false), 900);
      return () => {
        clearTimeout(timer);
      };
    } else {
      document.body.style.overflow = "auto";
    }
  }, [isOpen]);

  const filteredAndSortedServices = useMemo(() => {
    if (!services) return [];

    // Fix 2: Filter out null-org services at the data level
    let list = services.filter((s) => s.organizations !== null);

    // Client-side category filtering
    if (activeCategory) {
      list = list.filter((s) => s.category === activeCategory);
    }

    // Sort logic
    if (activeSort === "open") {
      list.sort((a, b) => (a.is_available === b.is_available ? 0 : a.is_available ? -1 : 1));
    } else if (activeSort === "nearest") {
      // TODO: Implement real distance sorting with geolocation
      list.sort((a, b) => (a.organizations?.borough ?? "").localeCompare(b.organizations?.borough ?? ""));
    } else if (activeSort === "az") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [services, activeCategory, activeSort]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        pointerEvents: isOpen ? "all" : "none",
        visibility: isOpen ? "visible" : "hidden",
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200"
        style={{
          opacity: isOpen ? 1 : 0,
          transition: "opacity 0.22s ease",
        }}
        onClick={onClose}
      />

      {/* Sheet Container */}
      <div
        className="relative h-[82vh] w-full max-w-7xl rounded-t-[32px] bg-white shadow-2xl transition-transform duration-[450ms] cubic-bezier(0.34, 1.1, 0.64, 1) flex flex-col overflow-hidden"
        style={{
          transform: isOpen ? "translateY(0)" : "translateY(100%)",
        }}
      >
        {/* Drag Handle */}
        <div className="pt-3 pb-2 shrink-0">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
        </div>

        {/* Sticky Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 md:px-8 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">Services near you</h2>
            <p className="text-[12px] text-slate-400">
              {filteredAndSortedServices.length} results near {searchQuery || "your area"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeCategory && (
              <button
                onClick={() => setActiveCategory(null)}
                className="flex items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1.5 text-[12px] font-bold text-white transition-all hover:bg-teal-700"
              >
                {CATEGORIES.find((c) => c.id === activeCategory)?.label}
                <X className="h-3 w-3" />
              </button>
            )}

            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-[12px] font-semibold transition-all ${isFilterOpen ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                  }`}
              >
                <Filter className="h-3.5 w-3.5" />
                Filter
              </button>
              {isFilterOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-100 bg-white p-2 shadow-lg z-[9100]">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = activeCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setActiveCategory(cat.id);
                          setIsFilterOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
                          <span className={isActive ? "font-bold text-slate-900" : "text-slate-600"}>{cat.label}</span>
                        </div>
                        {isActive && <ShieldCheck className="h-4 w-4 text-teal-600" />}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      setActiveCategory(null);
                      setIsFilterOpen(false);
                    }}
                    className="mt-1 w-full rounded-lg border-t border-slate-100 px-3 py-2 text-left text-[13px] font-semibold text-slate-400 hover:bg-slate-50"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-[12px] font-semibold transition-all ${isSortOpen ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                  }`}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {SORTS.find((s) => s.id === activeSort)?.label || "Sort"}
              </button>
              {isSortOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-slate-100 bg-white p-2 shadow-lg z-[9100]">
                  {SORTS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setActiveSort(s.id);
                        setIsSortOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] hover:bg-slate-50"
                    >
                      <span className={activeSort === s.id ? "font-bold text-slate-900" : "text-slate-600"}>{s.label}</span>
                      {activeSort === s.id && <ShieldCheck className="h-4 w-4 text-teal-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-6 md:px-8">
          {isLoading || showSkeleton ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-slate-100 bg-white">
                  <div className="h-[110px] bg-slate-100" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 w-3/4 rounded bg-slate-100" />
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                    <div className="flex gap-2">
                      <div className="h-5 w-16 rounded-full bg-slate-100" />
                      <div className="h-5 w-16 rounded-full bg-slate-100" />
                    </div>
                    <div className="h-10 w-full rounded-lg bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex h-[400px] flex-col items-center justify-center text-center">
              <AlertCircle className="mb-4 h-12 w-12 text-slate-200" />
              <h3 className="text-base font-bold text-slate-900">Something went wrong</h3>
              <p className="mt-1 text-sm text-slate-400">Please try again.</p>
              <button
                onClick={() => refetch()}
                className="mt-4 rounded-xl bg-teal-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
              >
                Retry
              </button>
            </div>
          ) : filteredAndSortedServices.length === 0 ? (
            <div className="flex h-[400px] flex-col items-center justify-center text-center">
              <Search className="mb-4 h-12 w-12 text-slate-200" />
              <h3 className="text-base font-bold text-slate-900">No services found</h3>
              <p className="mt-1 text-sm text-slate-400">Try a different category or search term.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 opacity-0 animate-[fadeIn_0.2s_ease-out_forwards] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAndSortedServices.map((service) => {
                const CatIcon = CATEGORIES.find((c) => c.id === service.category)?.icon || AlertCircle;
                return (
                  <div
                    key={service.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-900/5"
                  >
                    {/* Photo / Header */}
                    <div className="relative h-[120px] w-full overflow-hidden bg-slate-50">
                      {service.image_url || service.organizations?.avatar_url ? (
                        <img
                          src={service.image_url || service.organizations?.avatar_url}
                          alt={service.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-teal-50/50 text-teal-600/30">
                          <CatIcon className="h-12 w-12" />
                        </div>
                      )}
                      {/* Availability Badge */}
                      <div className="absolute top-3 right-3">
                        <span
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-sm backdrop-blur-md ${service.is_available 
                            ? "bg-white/90 text-green-700" 
                            : "bg-white/90 text-amber-700"
                            }`}
                        >
                          <div className={`h-1.5 w-1.5 rounded-full ${service.is_available ? "bg-green-500" : "bg-amber-500"}`} />
                          {service.is_available ? "Open Now" : "Limited"}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="line-clamp-1 text-[14px] font-bold text-slate-900">{service.name}</h4>
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                        </div>
                        <div className="mt-0.5 truncate text-[12px] font-semibold text-teal-600">
                          {service.organizations?.name ?? "Unknown organization"}
                        </div>

                        <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-slate-500">
                          {service.description}
                        </p>

                        <div className="mt-4 space-y-2">
                          <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-50">
                              <MapPin className="h-3 w-3 text-slate-400" />
                            </div>
                            <span className="truncate">
                              {service.organizations?.borough ?? "New York"}
                            </span>
                          </div>
                          {service.hours && (
                            <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-50">
                                <Clock className="h-3 w-3 text-slate-400" />
                              </div>
                              <span className="truncate">{service.hours}</span>
                            </div>
                          )}
                          {service.eligibility && (
                            <div className="flex items-start gap-2.5 text-[11px] text-slate-400">
                              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-50">
                                <Users className="h-3 w-3 text-slate-400" />
                              </div>
                              <span className="line-clamp-2 leading-tight">{service.eligibility}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestNow(service);
                        }}
                        className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-[13px] font-bold text-white shadow-lg shadow-teal-600/10 transition-all hover:bg-teal-700 hover:shadow-teal-600/20 active:scale-[0.98]"
                      >
                        Request Now
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
