import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, CircleMarker, TileLayer, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import {
  Baby,
  BookOpen,
  Brain,
  Briefcase,
  Crosshair,
  Heart,
  Home,
  LayoutGrid,
  Loader2,
  Minus,
  Plus,
  Scale,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePublicServices } from "../../hooks/useServices";
import { ApplicationFormSheet } from "./ApplicationFormSheet";
import { ServiceCard, Service } from "./ServiceCard";
import { supabase } from "../../lib/supabase";

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006]; // NYC

type MapCategory =
  | "all"
  | "food"
  | "housing"
  | "healthcare"
  | "job_training"
  | "legal"
  | "education"
  | "mental_health"
  | "childcare";

const MAP_CATEGORIES: Array<{
  value: MapCategory;
  label: string;
  icon: React.ElementType;
}> = [
    { value: "all", label: "All", icon: LayoutGrid },
    { value: "food", label: "Food", icon: ShoppingBag },
    { value: "housing", label: "Housing", icon: Home },
    { value: "healthcare", label: "Healthcare", icon: Heart },
    { value: "job_training", label: "Employment", icon: Briefcase },
    { value: "legal", label: "Legal", icon: Scale },
    { value: "education", label: "Education", icon: BookOpen },
    { value: "mental_health", label: "Mental Health", icon: Brain },
    { value: "childcare", label: "Childcare", icon: Baby },
  ];

type SheetSort = "open_first" | "nearest" | "az";

const CATEGORY_ICON: Record<MapCategory, React.ElementType> = {
  all: LayoutGrid,
  food: ShoppingBag,
  housing: Home,
  healthcare: Heart,
  job_training: Briefcase,
  legal: Scale,
  education: BookOpen,
  mental_health: Brain,
  childcare: Baby,
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function categoryLabel(cat: MapCategory) {
  if (cat === "all") return "All services";
  return MAP_CATEGORIES.find((c) => c.value === cat)?.label ?? "Services";
}

function MapInstanceBridge({ onMap }: { onMap: (m: LeafletMap | null) => void }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
    // In React 18 StrictMode/dev, effects mount/unmount twice.
    // Clearing the ref on cleanup prevents calling Leaflet methods on a torn-down map.
    return () => {
      onMap(null);
    };
  }, [map, onMap]);
  return null;
}

export function MapView() {
  const navigate = useNavigate();
  const mapRef = useRef<LeafletMap | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [activeCategory, setActiveCategory] = useState<MapCategory>("all");

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetServices, setSheetServices] = useState<any[]>([]);
  const [sheetSortBy, setSheetSortBy] = useState<SheetSort>("open_first");

  const [locationLoading, setLocationLoading] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [formServiceId, setFormServiceId] = useState<string | null>(null);
  const [isFormSheetOpen, setIsFormSheetOpen] = useState(false);

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

  const servicesQuery = usePublicServices({
    search: searchApplied,
    category: activeCategory === "all" ? "all" : activeCategory,
  });

  const allServices = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);

  const markerServices = useMemo(() => {
    // Map markers show matching category; if no coords, skip.
    return allServices.filter((svc: any) => {
      const lat = svc.organization?.latitude ?? svc.latitude;
      const lng = svc.organization?.longitude ?? svc.longitude;
      if (lat == null || lng == null) return false;
      if (activeCategory === "all") return true;
      return String(svc.category) === activeCategory;
    });
  }, [allServices, activeCategory]);

  function safeGetBounds(map: LeafletMap | null) {
    if (!map) return null;
    // Leaflet throws when map panes are not mounted yet (_leaflet_pos undefined),
    // or when the map has been torn down/unmounted.
    try {
      const container = map.getContainer?.();
      const isConnected = !!(container && (container as any).isConnected);
      const loaded = !!(map as any)._loaded;
      if (!isConnected || !loaded) return null;
      return map.getBounds();
    } catch {
      return null;
    }
  }

  function handleSearch() {
    setSearchApplied(searchQuery.trim());
  }

  function getSvcLatLng(svc: any): { lat: number; lng: number } | null {
    const lat = svc.organization?.latitude ?? svc.latitude;
    const lng = svc.organization?.longitude ?? svc.longitude;
    if (lat == null || lng == null) return null;
    return { lat: Number(lat), lng: Number(lng) };
  }

  function computeServicesInViewport(category: MapCategory) {
    const map = mapRef.current;
    const bounds = safeGetBounds(map);
    const filtered = allServices.filter((svc: any) => {
      const ll = getSvcLatLng(svc);
      if (!ll) return false;
      const inBounds = bounds ? bounds.contains([ll.lat, ll.lng]) : true;
      const matchesCat = category === "all" || String(svc.category) === category;
      return inBounds && matchesCat;
    });
    return filtered;
  }

  function handleCategorySelect(category: MapCategory) {
    setActiveCategory(category);
    // Open the sheet immediately; results will refresh on map move/data load.
    const filtered = computeServicesInViewport(category);
    const mapped = filtered.map((r: any) => ({
      id: r.id,
      name: r.name,
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
      organization: r.organization?.name ?? "",
      logoUrl: (r.organization as any)?.logo_url ?? null,
      imageUrl: r.image_url ?? null,
    }));
    setSheetServices(mapped);
    setIsSheetOpen(true);
  }

  const sortedSheetServices = useMemo(() => {
    const list = [...sheetServices];
    const here = userCoords;

    switch (sheetSortBy) {
      case "az":
        return list.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
      case "nearest":
        if (!here) return list;
        return list.sort((a: any, b: any) => {
          const aLat = a.orgLat;
          const aLng = a.orgLng;
          const bLat = b.orgLat;
          const bLng = b.orgLng;
          if (aLat == null || aLng == null) return 1;
          if (bLat == null || bLng == null) return -1;
          const da = haversineKm(here, { lat: aLat, lng: aLng });
          const db = haversineKm(here, { lat: bLat, lng: bLng });
          return da - db;
        });
      case "open_first":
      default:
        return list.sort((a: any, b: any) => {
          const aOpen = a.is_available;
          const bOpen = b.is_available;
          if (aOpen && !bOpen) return -1;
          if (!aOpen && bOpen) return 1;
          return String(a.name).localeCompare(String(b.name));
        });
    }
  }, [sheetServices, sheetSortBy, userCoords]);

  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    return haversineKm({ lat: lat1, lng: lon1 }, { lat: lat2, lng: lon2 });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!isSheetOpen) return;
    const onMoveEnd = () => {
      const inView = computeServicesInViewport(activeCategory);
      const mapped = inView.map((r: any) => ({
        id: r.id,
        name: r.name,
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
        organization: r.organization?.name ?? "",
        logoUrl: (r.organization as any)?.logo_url ?? null,
        imageUrl: r.image_url ?? null,
      }));
      setSheetServices(mapped);
    };
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
    };
  }, [isSheetOpen, activeCategory, allServices]);

  useEffect(() => {
    // When the query refetches after a category change, refresh the sheet list.
    if (!isSheetOpen) return;
    const inView = computeServicesInViewport(activeCategory);
    const mapped = inView.map((r: any) => ({
      id: r.id,
      name: r.name,
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
      organization: r.organization?.name ?? "",
      logoUrl: (r.organization as any)?.logo_url ?? null,
      imageUrl: r.image_url ?? null,
    }));
    setSheetServices(mapped);
  }, [allServices, activeCategory, isSheetOpen]);

  function handleServiceSelect(svc: any) {
    const map = mapRef.current;
    const lat = svc.organization?.latitude ?? svc.latitude;
    const lng = svc.organization?.longitude ?? svc.longitude;
    if (map && lat != null && lng != null) {
      map.setView([lat, lng], 15, { animate: true });
    }
  }

  function handleMyLocation() {
    if (!navigator.geolocation) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const here = { lat, lng };
        setUserCoords(here);
        setSheetSortBy("nearest");

        const map = mapRef.current;
        if (map) {
          // After recentering, open sheet with services in view.
          map.once("moveend", () => {
            const inView = computeServicesInViewport(activeCategory);
            if (inView.length > 0) {
              const mapped = inView.map((r: any) => ({
                id: r.id,
                name: r.name,
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
                organization: r.organization?.name ?? "",
                logoUrl: (r.organization as any)?.logo_url ?? null,
                imageUrl: r.image_url ?? null,
              }));
              setSheetServices(mapped);
              setIsSheetOpen(true);
              return;
            }

            // Fallback: if you're outside the service area, show nearest overall.
            const nearest = allServices
              .map((svc: any) => {
                const ll = getSvcLatLng(svc);
                if (!ll) return null;
                if (activeCategory !== "all" && String(svc.category) !== activeCategory) return null;
                const km = haversineKm(here, ll);
                return { svc, km };
              })
              .filter(Boolean) as Array<{ svc: any; km: number }>;
            nearest.sort((a, b) => a.km - b.km);
            const mappedNearest = nearest.slice(0, 25).map((x) => ({
              id: x.svc.id,
              name: x.svc.name,
              category: x.svc.category,
              description: x.svc.description ?? "",
              location: x.svc.organization?.borough ?? "",
              orgLat: (x.svc.organization as any)?.latitude ?? null,
              orgLng: (x.svc.organization as any)?.longitude ?? null,
              is_available: !!x.svc.is_available,
              openHours: x.svc.hours ?? "",
              eligibility: x.svc.eligibility ?? "",
              phone: x.svc.organization?.phone ?? "",
              boroughArea: x.svc.organization?.borough ?? "",
              organization: x.svc.organization?.name ?? "",
              logoUrl: (x.svc.organization as any)?.logo_url ?? null,
              imageUrl: x.svc.image_url ?? null,
            }));
            setSheetServices(mappedNearest);
            setIsSheetOpen(true);
          });

          map.setView([lat, lng], 15, { animate: true });
        }
        setLocationLoading(false);

        if (mapRef.current) {
          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([lat, lng]);
          } else {
            userMarkerRef.current = L.circleMarker([lat, lng], {
              radius: 8,
              fillColor: "#0d9b8a",
              fillOpacity: 1,
              color: "#ffffff",
              weight: 3,
            }).addTo(mapRef.current);
          }
        }
      },
      () => setLocationLoading(false),
      { timeout: 8000 },
    );
  }

  if (servicesQuery.isLoading) return <div className="py-20 text-center text-gray-500">Loading map…</div>;
  if (servicesQuery.isError) return <div className="py-20 text-center text-red-600">Failed to load services map.</div>;

  return (
    <div className="relative w-full h-full overflow-hidden">
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

      {/* MAP */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={12}
          className="h-full w-full"
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          scrollWheelZoom
        >
          <MapInstanceBridge onMap={(m) => { mapRef.current = m; }} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {markerServices.map((svc: any) => {
            const lat = svc.organization?.latitude ?? svc.latitude;
            const lng = svc.organization?.longitude ?? svc.longitude;
            if (lat == null || lng == null) return null;
            const isOpen = !!svc.is_available;
            return (
              <CircleMarker
                key={svc.id}
                center={[lat, lng]}
                radius={8}
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  fillOpacity: 0.9,
                  fillColor: isOpen ? "#0d9b8a" : "#f59e0b",
                }}
                eventHandlers={{
                  click: () => {
                    const mapped = {
                      id: svc.id,
                      name: svc.name,
                      category: svc.category,
                      description: svc.description ?? "",
                      location: svc.organization?.borough ?? "",
                      orgLat: (svc.organization as any)?.latitude ?? null,
                      orgLng: (svc.organization as any)?.longitude ?? null,
                      is_available: !!svc.is_available,
                      openHours: svc.hours ?? "",
                      eligibility: svc.eligibility ?? "",
                      phone: svc.organization?.phone ?? "",
                      boroughArea: svc.organization?.borough ?? "",
                      organization: svc.organization?.name ?? "",
                      logoUrl: (svc.organization as any)?.logo_url ?? null,
                      imageUrl: svc.image_url ?? null,
                    };
                    setSheetServices([mapped]);
                    setIsSheetOpen(true);
                  },
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* Floating controls (search + pills) */}
      <div className="absolute top-4 left-4 right-4 z-[1000] space-y-2">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-slate-100 flex items-center gap-3 px-4 py-3">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search services, areas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 text-sm text-slate-900 bg-transparent outline-none placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSearchApplied("");
              }}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" } as any}
        >
          {MAP_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.value;
            const Icon = cat.icon;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => handleCategorySelect(cat.value)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm border transition-all flex-shrink-0 ${isActive
                    ? "bg-teal-600 border-teal-600 text-white shadow-teal-200"
                    : "bg-white/95 backdrop-blur border-slate-200 text-slate-700 hover:border-teal-300"
                  }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* My location button */}
      <div
        className="absolute z-[1000] right-4 flex flex-col gap-2"
        style={{ bottom: isSheetOpen ? "calc(60vh + 16px)" : 24 }}
      >
        {/* Zoom controls */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            className="w-12 h-12 flex items-center justify-center hover:bg-slate-50 transition-colors"
            aria-label="Zoom in"
          >
            <Plus className="w-5 h-5 text-slate-700" />
          </button>
          <div className="h-px bg-slate-100" />
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            className="w-12 h-12 flex items-center justify-center hover:bg-slate-50 transition-colors"
            aria-label="Zoom out"
          >
            <Minus className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        {/* My location */}
        <button
          type="button"
          onClick={handleMyLocation}
          className="w-12 h-12 bg-white rounded-full shadow-lg border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-colors active:scale-95"
          aria-label="My location"
        >
          {locationLoading ? (
            <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
          ) : (
            <Crosshair className="w-5 h-5 text-teal-600" />
          )}
        </button>
      </div>

      {/* Backdrop */}
      {isSheetOpen && (
        <div
          className="absolute inset-0 z-[1999]"
          style={{ background: "rgba(0,0,0,0.15)" }}
          onClick={() => setIsSheetOpen(false)}
        />
      )}

      {/* Bottom sheet */}
      <div
        className="absolute left-0 right-0 bottom-0 z-[2000] bg-white rounded-t-3xl flex flex-col"
        style={{
          height: isSheetOpen ? "75vh" : "0",
          transform: isSheetOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.4s cubic-bezier(0.34,1.1,0.64,1)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-slate-100">
          <div>
            <div className="text-sm font-bold text-slate-900">{categoryLabel(activeCategory)}</div>
            <div className="text-xs text-slate-400 mt-0.5">{sortedSheetServices.length} in this area</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sheetSortBy}
              onChange={(e) => setSheetSortBy(e.target.value as SheetSort)}
              className="text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-100 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer"
            >
              <option value="open_first">Open first</option>
              <option value="nearest">Nearest</option>
              <option value="az">A – Z</option>
            </select>
            <button
              type="button"
              onClick={() => setIsSheetOpen(false)}
              className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
          {sortedSheetServices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No services in this area.</p>
              <p className="text-xs text-slate-300 mt-1">Try zooming out or changing the filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
              {sortedSheetServices.map((service: Service) => {
                const distance = userCoords
                  ? getDistanceKm(userCoords.lat, userCoords.lng, service.orgLat!, service.orgLng!)
                  : null;
                return (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    distance={distance}
                    onApply={handleApply}
                    onCopyPhone={(phone) => {
                      navigator.clipboard.writeText(phone);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}