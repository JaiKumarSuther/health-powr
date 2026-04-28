import { useMemo, useState, useEffect } from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  Check,
  Loader2,
  MapPin,
  Star,
  Heart,
  ArrowRight,
  Clock,
  Users,
  Phone,
  Home,
  Utensils,
  HeartPulse,
  Briefcase,
  BookOpen,
  Scale,
  Brain as BrainIcon,
  CheckCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { usePublicServices } from "../../hooks/useServices";
import { ApplicationFormSheet } from "./ApplicationFormSheet";
import { useNavigate } from "react-router-dom";

function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  orgLat?: number | null;
  orgLng?: number | null;
  rating: number;
  availability: "Available" | "Waitlist" | "Limited" | "Unavailable";
  openHours: string;
  eligibility: string;
  phone: string;
  boroughArea: string;
  organization: string;
  logoUrl?: string | null;
  imageUrl?: string | null;
}

const categoryIcons: Record<string, React.ElementType> = {
  housing: Home,
  food: Utensils,
  healthcare: HeartPulse,
  job_training: Briefcase,
  education: BookOpen,
  legal: Scale,
  mental_health: BrainIcon,
};

const CATEGORY_BG: Record<string, string> = {
  housing: "bg-slate-50",
  food: "bg-emerald-50",
  healthcare: "bg-rose-50",
  job_training: "bg-amber-50",
  education: "bg-indigo-50",
  legal: "bg-violet-50",
  mental_health: "bg-sky-50",
  childcare: "bg-teal-50",
  other: "bg-slate-50",
};

function ServiceIconBanner({
  category,
  logoUrl,
  imageUrl,
  orgName,
}: {
  category: string;
  logoUrl?: string | null;
  imageUrl?: string | null;
  orgName?: string | null;
}) {
  const Icon = categoryIcons[category] ?? Home;
  return (
    <div className="rounded-t-2xl overflow-hidden">
      {(imageUrl || logoUrl) ? (
        <img
          src={imageUrl || logoUrl || ""}
          alt={orgName ?? ""}
          className="w-full h-[140px] object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            (e.currentTarget.nextElementSibling as HTMLElement | null)?.removeAttribute("style");
          }}
        />
      ) : null}
      <div
        className={`w-full h-[140px] flex items-center justify-center ${imageUrl || logoUrl ? "hidden" : ""} ${
          CATEGORY_BG[category] ?? "bg-slate-50"
        }`}
        style={imageUrl || logoUrl ? { display: "none" } : undefined}
      >
        <Icon className="w-10 h-10 opacity-40 text-slate-500" strokeWidth={1.5} />
      </div>
    </div>
  );
}

type SortOption = "default" | "nearest" | "az";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "default", label: "Open first" },
  { value: "nearest", label: "Nearest first" },
  { value: "az", label: "A – Z" },
];

const SORT_LABELS: Record<SortOption, string> = {
  default: "Open first",
  nearest: "Nearest first",
  az: "A – Z",
};

function AvailabilityBadge({ status }: { status: Service["availability"] }) {
  const styles: Record<Service["availability"], string> = {
    Available: "bg-teal-600 text-white",
    Limited: "bg-[#FFFBEB] text-[#B45309]",
    Waitlist: "bg-[#FFFBEB] text-[#B45309]",
    Unavailable: "bg-[#F9FAFB] text-[#6B7280]",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function ServicesView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBorough, setSelectedBorough] = useState("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [formServiceId, setFormServiceId] = useState<string | null>(null);
  const [isFormSheetOpen, setIsFormSheetOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>(
    [{ id: "all", label: "All" }],
  );
  const [boroughs, setBoroughs] = useState<string[]>([]);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");

  useEffect(() => {
    if (!isSortOpen) return;
    const handler = () => setIsSortOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [isSortOpen]);

  useEffect(() => {
    function onResize() {
      if (typeof window === "undefined") return;
      if (window.innerWidth > 768) {
        setIsFormSheetOpen(false);
        setFormServiceId(null);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function handleApply(serviceId: string) {
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setFormServiceId(serviceId);
      setIsFormSheetOpen(true);
    } else {
      navigate(`/client/apply/${serviceId}`);
    }
  }

  // DEV NOTE: If testing geolocation locally and the popup doesn't appear,
  // the permission may be cached as 'denied'. Reset it: Chrome → address bar
  // lock icon → Site settings → Location → Reset to default, then refresh.
  async function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      setSortBy("az");
      return;
    }

    try {
      const permission = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });

      if (permission.state === "denied") {
        setLocationStatus("denied");
        setSortBy("az");
        return;
      }

      setLocationStatus("loading");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationStatus("granted");
        },
        (err) => {
          console.warn("Geolocation error:", err.code, err.message);
          setLocationStatus("denied");
          setSortBy("az");
        },
        {
          timeout: 10000,
          maximumAge: 60000,
          enableHighAccuracy: false,
        },
      );
    } catch {
      setLocationStatus("loading");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationStatus("granted");
        },
        () => {
          setLocationStatus("denied");
          setSortBy("az");
        },
      );
    }
  }

  function handleSortChange(value: SortOption) {
    setSortBy(value);
    setIsSortOpen(false);

    if (value === "nearest") {
      if (userCoords) return;
      if (locationStatus === "denied") {
        setSortBy("az");
        return;
      }
      void requestLocation();
    }
  }

  function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Consume landing-page search handoff on first mount
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('hp_landing_search');
      if (!raw) return;
      window.sessionStorage.removeItem('hp_landing_search');
      const parsed = JSON.parse(raw) as { query?: string; category?: string };
      if (parsed.query) setSearchTerm(parsed.query);
      if (parsed.category) setSelectedCategory(parsed.category);
    } catch {
      // ignore malformed data
    }
  }, []);

  const publicServicesQuery = usePublicServices({
    category: selectedCategory,
    borough: selectedBorough,
    search: debouncedSearch,
  });

  const services: Service[] = useMemo(() => {
    const rows = publicServicesQuery.data ?? [];
    return rows.map((r) => {
      const availability: Service["availability"] = r.is_available
        ? "Available"
        : "Unavailable";
      return {
        id: r.id,
        name: r.name,
        organization: r.organization?.name ?? "Organization",
        category: r.category,
        description: r.description ?? "",
        location: r.organization?.borough ?? "",
        orgLat: (r.organization as any)?.latitude ?? null,
        orgLng: (r.organization as any)?.longitude ?? null,
        rating: 4.6, // best-effort default until ratings are implemented
        availability,
        openHours: r.hours ?? "",
        eligibility: r.eligibility ?? "",
        phone: r.organization?.phone ?? "",
        boroughArea: r.organization?.borough ?? "",
        logoUrl: (r.organization as any)?.logo_url ?? null,
        imageUrl: (r as any)?.image_url ?? null,
      };
    });
  }, [publicServicesQuery.data]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("service_categories")
      .select("slug, label")
      .order("label")
      .then(({ data }) => {
        const mapped = (data || []).map((c: any) => ({
          id: c.slug,
          label: c.label,
        }));
        setCategories([{ id: "all", label: "All" }, ...mapped]);
      });
    supabase
      .from("boroughs")
      .select("name")
      .order("name")
      .then(({ data }) => {
        setBoroughs((data || []).map((b: any) => b.name));
      });
  }, [user]);

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      service.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      service.organization
        .toLowerCase()
        .includes(debouncedSearch.toLowerCase()) ||
      service.description.toLowerCase().includes(debouncedSearch.toLowerCase());
    return matchesSearch;
  });

  const sortedServices = useMemo(() => {
    const list = [...filteredServices];
    switch (sortBy) {
      case "az":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "nearest":
        if (!userCoords) return list;
        return list.sort((a, b) => {
          const aLat = a.orgLat;
          const aLng = a.orgLng;
          const bLat = b.orgLat;
          const bLng = b.orgLng;
          if (!aLat || !aLng) return 1;
          if (!bLat || !bLng) return -1;
          const distA = getDistanceKm(userCoords.lat, userCoords.lng, aLat, aLng);
          const distB = getDistanceKm(userCoords.lat, userCoords.lng, bLat, bLng);
          return distA - distB;
        });
      case "default":
      default:
        return list.sort((a, b) => {
          const aOpen = a.availability === "Available";
          const bOpen = b.availability === "Available";
          if (aOpen && !bOpen) return -1;
          if (!aOpen && bOpen) return 1;
          return a.name.localeCompare(b.name);
        });
    }
  }, [filteredServices, sortBy, userCoords]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="md:hidden">
        <ApplicationFormSheet
          isOpen={isFormSheetOpen}
          serviceId={formServiceId}
          onClose={() => {
            setIsFormSheetOpen(false);
            setFormServiceId(null);
          }}
        />
      </div>
      <div className="mb-6">
        <p className="text-[12px] text-gray-400 mb-1">&nbsp;</p>
        <h1 className="text-[24px] font-bold tracking-tight text-gray-900">
          Find Services
        </h1>
        <p className="text-[14px] text-gray-500 mt-1">
          Discover services available in your community
        </p>
      </div>

      {locationStatus === "denied" && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3">
          <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-800 mb-0.5">
              Location access blocked
            </p>
            <p className="text-xs text-amber-600 leading-relaxed">
              To sort by distance, enable location in your browser&apos;s address bar (click the lock or location icon),
              then refresh the page. Showing results A–Z for now.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLocationStatus("idle")}
            className="text-amber-400 hover:text-amber-600 text-lg leading-none flex-shrink-0 mt-[-2px]"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 md:p-5 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-gray-400" />
            <input
              type="text"
              placeholder="Search services, organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 h-11 bg-gray-50 border border-gray-200 rounded-[10px] text-[14px] text-gray-900 placeholder-gray-400 focus:bg-white focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 outline-none transition-all"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSortOpen(!isSortOpen);
                }}
                className="flex items-center gap-2 px-4 h-11 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:border-slate-300 transition-colors"
              >
                {locationStatus === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <ArrowUpDown className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  Sort:{" "}
                  {locationStatus === "loading"
                    ? "Getting location..."
                    : SORT_LABELS[sortBy]}
                </span>
              </button>

              {isSortOpen && (
                <div
                  className="absolute top-[calc(100%+6px)] right-0 bg-white border border-slate-100 rounded-xl shadow-lg z-50 min-w-[180px] p-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSortChange(opt.value);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        sortBy === opt.value
                          ? "bg-teal-50 text-teal-700 font-semibold"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {sortBy === opt.value && (
                        <Check className="w-3.5 h-3.5 text-teal-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 h-11 border border-gray-200 rounded-[10px] text-[14px] font-medium text-gray-600 hover:bg-gray-50 hover:border-teal-600 hover:text-teal-600 transition-all flex-shrink-0"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>
            {showFilters && (
              <select
                value={selectedBorough}
                onChange={(e) => setSelectedBorough(e.target.value)}
                className="flex-1 md:flex-none h-11 border border-gray-200 rounded-[10px] px-3 text-[14px] bg-white outline-none focus:border-teal-600 transition-all"
              >
                <option value="all">Boroughs</option>
                {boroughs.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all flex-shrink-0 ${
                selectedCategory === cat.id
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-gray-500 border-gray-200 hover:border-teal-600 hover:text-teal-600 hover:bg-teal-50"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {publicServicesQuery.isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      ) : publicServicesQuery.isError ? (
        <div className="py-14 text-center text-red-600">
          Failed to load services.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] text-gray-400 font-medium">
              {sortedServices.length} service
              {sortedServices.length !== 1 ? "s" : ""} found
            </p>
          </div>

          {sortedServices.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {sortedServices.map((service) => {
                const isFav = favorites.has(service.id);
                const distance =
                  userCoords && sortBy === "nearest" && service.orgLat && service.orgLng
                    ? getDistanceKm(userCoords.lat, userCoords.lng, service.orgLat, service.orgLng)
                    : null;
                return (
                  <div
                    key={service.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col transition-all duration-200 hover:shadow-[0_8px_20px_rgba(13,148,136,0.10)] hover:border-teal-200 hover:-translate-y-0.5"
                  >
                    <ServiceIconBanner
                      category={service.category}
                      logoUrl={service.logoUrl}
                      imageUrl={service.imageUrl}
                      orgName={service.organization}
                    />
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-[15px] font-bold text-gray-900 leading-snug flex-1 pr-2">
                          {service.name}
                        </h3>
                        <button
                          onClick={() => toggleFavorite(service.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-red-50 flex-shrink-0"
                        >
                          <Heart
                            className={`w-4 h-4 transition-colors ${isFav ? "fill-red-500 text-red-500" : "text-gray-300"}`}
                          />
                        </button>
                      </div>
                      <p className="text-[13px] font-medium text-teal-600 mb-2.5 hover:underline cursor-pointer">
                        {service.organization}
                      </p>
                      <div className="flex items-center gap-2 mb-3">
                        <AvailabilityBadge status={service.availability} />
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span className="text-[12px] font-medium text-gray-600">
                            {service.rating}
                          </span>
                        </div>
                      </div>
                      <p className="text-[13px] text-gray-500 leading-relaxed mb-3 line-clamp-2 flex-1">
                        {service.description}
                      </p>
                      <div className="space-y-1.5 mb-4">
                        <div className="flex items-center gap-2 text-[12px] text-gray-500">
                          <MapPin className="w-[13px] h-[13px] text-gray-400 flex-shrink-0" />
                          <span>{service.location || "New York"}</span>
                          {distance !== null && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-teal-600 font-medium">
                                {distance < 1
                                  ? `${(distance * 1000).toFixed(0)}m`
                                  : `${distance.toFixed(1)}km`}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-gray-500">
                          <Clock className="w-[13px] h-[13px] text-gray-400 flex-shrink-0" />
                          <span>{service.openHours}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-gray-500">
                          <Users className="w-[13px] h-[13px] text-gray-400 flex-shrink-0" />
                          <span className="truncate">
                            {service.eligibility}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2.5 mt-auto">
                        <button
                          onClick={() => handleApply(service.id)}
                          className="flex-1 h-11 bg-teal-600 text-white rounded-[10px] font-semibold text-[13px] hover:bg-teal-700 transition-colors flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(13,148,136,0.20)]"
                        >
                          Request Now
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopyPhone(service.phone)}
                          className="w-11 h-11 rounded-[10px] border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:border-teal-600 hover:text-teal-600 transition-all flex-shrink-0"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-[17px] font-semibold text-gray-900 mb-1">
                No services found
              </h3>
              <p className="text-gray-400 text-[14px]">
                Try adjusting your search or category filter.
              </p>
            </div>
          )}
        </>
      )}

      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-teal-400" />
          Phone number copied!
        </div>
      )}
    </div>
  );
}
