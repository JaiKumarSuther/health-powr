import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  Check,
  Loader2,
  MapPin,
  Heart,
  CheckCircle,
} from "lucide-react";
import { ServiceCard, Service } from "./ServiceCard";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { usePublicServices } from "../../hooks/useServices";
import { ApplicationFormSheet } from "./ApplicationFormSheet";
import { useFavorites } from "../../api/favorites";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys";

function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Reusable components moved to ServiceCard.tsx

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

export function ServicesView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBorough, setSelectedBorough] = useState("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { data: favoriteIds = [] } = useFavorites();
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

  const handleApply = useCallback((serviceId: string) => {
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setFormServiceId(serviceId);
      setIsFormSheetOpen(true);
    } else {
      navigate(`/client/apply/${serviceId}`);
    }
  }, [navigate]);

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
      return {
        id: r.id,
        name: r.name,
        organization: r.organization?.name ?? "Organization",
        category: r.category,
        description: r.description ?? "",
        location: r.organization?.borough ?? "",
        orgLat: (r.organization as any)?.latitude ?? null,
        orgLng: (r.organization as any)?.longitude ?? null,
        is_available: !!r.is_available,
        openHours: r.hours ?? "",
        eligibility: r.eligibility ?? "",
        phone: r.organization?.phone ?? "",
        boroughArea: r.organization?.borough ?? "",
        logoUrl: (r.organization as any)?.logo_url ?? null,
        imageUrl: (r as any)?.image_url ?? null,
      };
    });
  }, [publicServicesQuery.data]);

  const servicesMetaQuery = useQuery({
    queryKey: queryKeys.clientServicesMeta(user?.id ?? ""),
    enabled: !!user,
    queryFn: async () => {
      const [catsRes, boroughsRes] = await Promise.all([
        supabase.from("service_categories").select("slug, label").order("label"),
        supabase.from("boroughs").select("name").order("name"),
      ]);
      return {
        categories: (catsRes.data || []).map((c: any) => ({ id: c.slug, label: c.label })),
        boroughs: (boroughsRes.data || []).map((b: any) => b.name as string),
      };
    },
  });

  useEffect(() => {
    if (!servicesMetaQuery.data) return;
    setCategories([{ id: "all", label: "All" }, ...servicesMetaQuery.data.categories]);
    setBoroughs(servicesMetaQuery.data.boroughs);
  }, [servicesMetaQuery.data]);

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      service.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      service.organization
        .toLowerCase()
        .includes(debouncedSearch.toLowerCase()) ||
      service.description.toLowerCase().includes(debouncedSearch.toLowerCase());
    
    if (showFavoritesOnly && !favoriteIds.includes(service.id)) return false;
    
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
          const aOpen = a.is_available;
          const bOpen = b.is_available;
          if (aOpen && !bOpen) return -1;
          if (!aOpen && bOpen) return 1;
          return a.name.localeCompare(b.name);
        });
    }
  }, [filteredServices, sortBy, userCoords]);

  // Replaced manual favorites logic with useFavorites and useToggleFavorite hooks inside ServiceCard

  const handleCopyPhone = useCallback((phone: string) => {
    navigator.clipboard.writeText(phone).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  }, []);

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 h-11 border border-gray-200 rounded-[10px] text-[14px] font-medium text-gray-600 hover:bg-gray-50 hover:border-teal-600 hover:text-teal-600 transition-all"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>
            <div className="relative flex-shrink-0">
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
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              showFavoritesOnly
                ? "border-red-400 bg-red-50 text-red-600"
                : "bg-white text-gray-500 border-gray-200 hover:border-red-600 hover:text-red-600 hover:bg-red-50"
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? "fill-red-500 text-red-500" : ""}`} />
            Favorites
          </button>
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
                const distance =
                  userCoords && sortBy === "nearest" && service.orgLat && service.orgLng
                    ? getDistanceKm(userCoords.lat, userCoords.lng, service.orgLat, service.orgLng)
                    : null;
                return (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    distance={distance}
                    onApply={handleApply}
                    onCopyPhone={handleCopyPhone}
                  />
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
              {showFavoritesOnly && (
                <p className="text-gray-400 text-[14px] mt-2">
                  Tap the heart on any service to save it here.
                </p>
              )}
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
