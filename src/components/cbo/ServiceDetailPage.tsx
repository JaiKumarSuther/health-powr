import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eye, Pencil, Save, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import type { OrganizationRow } from "../../lib/organzationsApi";
import { supabase } from "../../lib/supabase";
import {
  useServiceById,
  useServiceCategories,
  useUpdateService,
  type ServiceCategory,
} from "../../hooks/useServices";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function LocationPicker({
  value,
  onChange,
  disabled,
}: {
  value: { latitude: number; longitude: number } | null;
  onChange: (next: { latitude: number; longitude: number }) => void;
  disabled?: boolean;
}) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onChange({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });

  if (!value) return null;
  return <Marker position={[value.latitude, value.longitude]} icon={defaultIcon} />;
}

function MapPanTo({
  value,
}: {
  value: { latitude: number; longitude: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!value) return;
    map.setView([value.latitude, value.longitude], Math.max(map.getZoom(), 14), {
      animate: true,
    });
  }, [map, value]);
  return null;
}

function parseCoord(input: string) {
  if (!input.trim()) return null;
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

function validateLatLng(lat: number | null, lng: number | null) {
  if (lat == null && lng == null) return { ok: true, message: null as string | null };
  if (lat == null || lng == null) {
    return { ok: false, message: "Please provide both latitude and longitude." };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, message: "Latitude must be between -90 and 90." };
  }
  if (lng < -180 || lng > 180) {
    return { ok: false, message: "Longitude must be between -180 and 180." };
  }
  return { ok: true, message: null as string | null };
}

type FormState = {
  name: string;
  category: ServiceCategory;
  description: string;
  hours: string;
  eligibility: string;
  isAvailable: boolean;
  imageUrl: string;
  latitude: number | null;
  longitude: number | null;
};

function FieldView({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | null | undefined;
  helper?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="text-[13px] text-slate-900 mt-1 whitespace-pre-wrap">
        {value && value.trim() ? value : "—"}
      </p>
      {helper ? <p className="text-[11px] text-slate-400 mt-1">{helper}</p> : null}
    </div>
  );
}

function toForm(service: {
  name: string;
  category: ServiceCategory;
  description: string | null;
  hours: string | null;
  eligibility: string | null;
  is_available: boolean;
  image_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): FormState {
  return {
    name: service.name ?? "",
    category: service.category,
    description: service.description ?? "",
    hours: service.hours ?? "",
    eligibility: service.eligibility ?? "",
    isAvailable: !!service.is_available,
    imageUrl: (service as any).image_url ?? "",
    latitude: (service as any).latitude ?? null,
    longitude: (service as any).longitude ?? null,
  };
}

export function ServiceDetailPage({ organization }: { organization: OrganizationRow | null }) {
  const navigate = useNavigate();
  const { serviceId } = useParams<{ serviceId: string }>();
  const org = organization;
  const canManageServices = useMemo(() => org?.status === "approved", [org?.status]);

  const serviceQuery = useServiceById(serviceId);
  const categoriesQuery = useServiceCategories();
  const updateService = useUpdateService();

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);

  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [geoQuery, setGeoQuery] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [coordError, setCoordError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    const svc = serviceQuery.data;
    if (!svc) return;
    const next = toForm(svc as any);
    setForm(next);
    setInitial(next);
    setLatInput(next.latitude != null ? String(next.latitude) : "");
    setLngInput(next.longitude != null ? String(next.longitude) : "");
  }, [serviceQuery.data]);

  if (serviceQuery.isLoading) {
    return <div className="py-20 text-center text-gray-500">Loading…</div>;
  }

  if (!org) {
    return (
      <div className="py-20 text-center text-gray-500">
        No organization found for your account.
      </div>
    );
  }

  if (serviceQuery.isError) {
    return (
      <div className="py-20 text-center text-red-600">
        Failed to load service.
      </div>
    );
  }

  if (!serviceQuery.data || !form) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate("/cbo/services")}
          className="text-[13px] font-semibold text-teal-700 hover:text-teal-800"
        >
          ← Back
        </button>
        <div className="bg-white border border-gray-200 rounded-[14px] p-5 text-slate-600">
          Service not found or you don’t have access to it.
        </div>
      </div>
    );
  }

  const isReadOnly = !isEditing || !canManageServices || updateService.isPending;

  const categoryLabel = (() => {
    const slug = String(form.category ?? "");
    const opt = (categoriesQuery.data ?? []).find((c) => String(c.slug) === slug);
    return opt?.label ?? slug.replace(/_/g, " ");
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate("/cbo/services")}
            className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center"
            aria-label="Back to services"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-[13px] font-bold text-slate-900">Service Details</h2>
            <p className="text-[12px] text-slate-500 mt-1">
              View and manage this service for {org.name ?? "your organization"}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={!canManageServices}
              className="h-9 px-3 rounded-lg bg-teal-600 text-white text-[12px] font-semibold hover:bg-teal-700 disabled:opacity-60 inline-flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (!initial) return;
                  setForm(initial);
                  setIsEditing(false);
                  setGeoError(null);
                  setCoordError(null);
                  setLatInput(initial.latitude != null ? String(initial.latitude) : "");
                  setLngInput(initial.longitude != null ? String(initial.longitude) : "");
                }}
                disabled={updateService.isPending}
                className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-slate-700 hover:bg-slate-50 text-[12px] font-semibold inline-flex items-center gap-2 disabled:opacity-60"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const coordCheck = validateLatLng(form.latitude, form.longitude);
                  if (!coordCheck.ok) {
                    alert(coordCheck.message);
                    return;
                  }
                  const updated = await updateService.mutateAsync({
                    serviceId: serviceQuery.data!.id,
                    name: form.name,
                    description: form.description,
                    isAvailable: form.isAvailable,
                    hours: form.hours,
                    eligibility: form.eligibility,
                    imageUrl: form.imageUrl?.trim() ? form.imageUrl.trim() : null,
                    latitude: form.latitude,
                    longitude: form.longitude,
                  });
                  const next = toForm(updated as any);
                  setForm(next);
                  setInitial(next);
                  setIsEditing(false);
                }}
                disabled={updateService.isPending}
                className="h-9 px-3 rounded-lg bg-teal-600 text-white text-[12px] font-semibold hover:bg-teal-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {updateService.isPending ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-[14px] p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-bold text-slate-900 inline-flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-500" />
            Service details
          </h3>
          <div className="flex items-center gap-2">
            <span
              className={[
                "text-[11px] font-semibold rounded-full px-2 py-0.5 border",
                isEditing
                  ? "bg-teal-50 text-teal-800 border-teal-200"
                  : "bg-slate-50 text-slate-700 border-slate-200",
              ].join(" ")}
            >
              {isEditing ? "Edit mode" : "View mode"}
            </span>
            {!canManageServices && (
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                Read-only (org {org.status})
              </span>
            )}
          </div>
        </div>

        {!isEditing ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldView label="Name" value={form.name} />
            <FieldView
              label="Category"
              value={categoryLabel}
              helper="Cannot be changed."
            />
            <div className="md:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Service image
              </p>
              {form.imageUrl ? (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={form.imageUrl}
                    alt="Service"
                    className="w-[140px] h-[84px] rounded-xl object-cover border border-gray-200 bg-slate-50"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-[12px] text-slate-500">
                    Shows on service cards in the Client Portal.
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-slate-900 mt-1">—</p>
              )}
            </div>
            <div className="md:col-span-2">
              <FieldView label="Description" value={form.description} />
            </div>
            <FieldView label="Hours" value={form.hours} />
            <FieldView label="Eligibility" value={form.eligibility} />
            <div className="md:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Availability
              </p>
              <p className="mt-1">
                <span
                  className={[
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border",
                    form.isAvailable
                      ? "bg-teal-600 text-white border-teal-700"
                      : "bg-slate-100 text-slate-700 border-slate-200",
                  ].join(" ")}
                >
                  {form.isAvailable ? "Available" : "Unavailable"}
                </span>
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Location (optional)
              </p>
              <p className="text-[13px] text-slate-900 mt-1">
                {form.latitude != null && form.longitude != null
                  ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}`
                  : "—"}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Map selection is available in edit mode.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600">Service image</label>
              <div className="mt-1 flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="w-[140px] h-[84px] rounded-xl border border-gray-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                    {form.imageUrl ? (
                      <img
                        src={form.imageUrl}
                        alt="Service"
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-[11px] text-slate-400">No image</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setImageError(null);
                        setImageUploading(true);
                        try {
                          const { data: auth } = await supabase.auth.getUser();
                          const uid = auth.user?.id;
                          if (!uid) throw new Error("Not authenticated");
                          const ext = file.name.split(".").pop() || "jpg";
                          const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
                          const path = `${uid}/service-${serviceQuery.data!.id}-${Date.now()}.${safeExt}`;
                          const { error: upErr } = await supabase.storage
                            .from("service-images")
                            .upload(path, file, {
                              upsert: true,
                              contentType: file.type || "image/jpeg",
                            });
                          if (upErr) throw upErr;
                          const pub = supabase.storage.from("service-images").getPublicUrl(path);
                          setForm((s) => (s ? { ...s, imageUrl: pub.data.publicUrl } : s));
                        } catch (err: any) {
                          setImageError(err?.message || "Failed to upload image");
                        } finally {
                          setImageUploading(false);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }
                      }}
                      disabled={isReadOnly}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isReadOnly || imageUploading}
                        className="h-10 px-4 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium disabled:opacity-60"
                      >
                        {imageUploading
                          ? "Uploading..."
                          : form.imageUrl
                            ? "Replace image"
                            : "Upload image"}
                      </button>
                      {form.imageUrl ? (
                        <button
                          type="button"
                          onClick={() => setForm((s) => (s ? { ...s, imageUrl: "" } : s))}
                          disabled={isReadOnly || imageUploading}
                          className="h-10 px-4 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium disabled:opacity-60"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-slate-400">Recommended: 1200×700 (PNG/JPG).</p>
                    {imageError ? <p className="text-[12px] text-red-600">{imageError}</p> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-gray-600">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((s) => (s ? { ...s, name: e.target.value } : s))}
                className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 outline-none"
                disabled={isReadOnly}
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-gray-600">Category</label>
              <select
                value={form.category}
                className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white"
                disabled
              >
                {(categoriesQuery.data ?? []).map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
                {!categoriesQuery.isLoading &&
                  !categoriesQuery.isError &&
                  (categoriesQuery.data ?? []).length === 0 && (
                    <option value={form.category}>{String(form.category)}</option>
                  )}
                {(categoriesQuery.isLoading || categoriesQuery.isError) && (
                  <option value={form.category}>{String(form.category)}</option>
                )}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">Category can’t be changed.</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600">Description</label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((s) => (s ? { ...s, description: e.target.value } : s))
                }
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 outline-none"
                rows={3}
                disabled={isReadOnly}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600">Hours</label>
              <input
                value={form.hours}
                onChange={(e) =>
                  setForm((s) => (s ? { ...s, hours: e.target.value } : s))
                }
                className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 outline-none"
                disabled={isReadOnly}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600">Eligibility</label>
              <input
                value={form.eligibility}
                onChange={(e) =>
                  setForm((s) => (s ? { ...s, eligibility: e.target.value } : s))
                }
                className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 outline-none"
                disabled={isReadOnly}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600">Availability</label>
              <select
                value={form.isAvailable ? "available" : "unavailable"}
                onChange={(e) =>
                  setForm((s) =>
                    s ? { ...s, isAvailable: e.target.value === "available" } : s,
                  )
                }
                className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-50 outline-none"
                disabled={isReadOnly}
              >
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600">
                Location (optional)
              </label>
              <div className="mt-1 flex flex-col sm:flex-row gap-2 sm:items-center">
                <button
                  type="button"
                  onClick={() => setIsPickingLocation(true)}
                  className="h-10 px-4 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                  disabled={isReadOnly}
                >
                  Pick on map
                </button>
                <p className="text-xs text-gray-500">
                  {form.latitude != null && form.longitude != null
                    ? `Selected: ${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}`
                    : "No coordinates selected yet."}
                </p>
              </div>
            </div>

            {updateService.isError && (
              <div className="md:col-span-2">
                <p className="text-sm text-red-600">Failed to save changes.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {isPickingLocation && (
        <div
          className="fixed inset-0 z-[400] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[12px] text-gray-500 uppercase tracking-wide">
                  Select service location
                </p>
                <p className="text-[14px] font-semibold text-gray-900">
                  Click on the map to drop a pin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPickingLocation(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex flex-col md:flex-row gap-2 md:items-center">
                <input
                  value={geoQuery}
                  onChange={(e) => setGeoQuery(e.target.value)}
                  placeholder="Search address (e.g. 123 Main St, NYC)"
                  className="h-10 w-full border border-gray-200 rounded-lg px-3 text-sm"
                  disabled={!isEditing}
                />
                <button
                  type="button"
                  disabled={!isEditing || geoLoading || !geoQuery.trim()}
                  onClick={async () => {
                    try {
                      setGeoLoading(true);
                      setGeoError(null);
                      const q = encodeURIComponent(geoQuery.trim());
                      const res = await fetch(
                        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`,
                        { headers: { "Accept-Language": "en" } },
                      );
                      if (!res.ok) throw new Error("Search failed");
                      const json = (await res.json()) as any[];
                      const first = json?.[0];
                      if (!first) {
                        setGeoError("No results found.");
                        return;
                      }
                      const lat = Number(first.lat);
                      const lon = Number(first.lon);
                      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                        setGeoError("Invalid coordinates returned.");
                        return;
                      }
                      setForm((s) => (s ? { ...s, latitude: lat, longitude: lon } : s));
                      setLatInput(String(lat));
                      setLngInput(String(lon));
                    } catch (e: any) {
                      setGeoError(e?.message || "Failed to search address.");
                    } finally {
                      setGeoLoading(false);
                    }
                  }}
                  className="h-10 px-4 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
                >
                  {geoLoading ? "Searching..." : "Search"}
                </button>
              </div>
              {geoError && <p className="text-sm text-red-600">{geoError}</p>}
              {coordError && <p className="text-sm text-red-600">{coordError}</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Latitude</label>
                  <input
                    value={latInput}
                    onChange={(e) => {
                      const next = e.target.value;
                      setLatInput(next);
                      const lat = parseCoord(next.trim());
                      const lng = parseCoord(lngInput.trim());
                      const check = validateLatLng(lat, lng);
                      setCoordError(check.ok ? null : check.message);
                    }}
                    placeholder="e.g. 40.7128"
                    className="mt-1 h-10 w-full border border-gray-200 rounded-lg px-3 text-sm"
                    inputMode="decimal"
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">Longitude</label>
                  <input
                    value={lngInput}
                    onChange={(e) => {
                      const next = e.target.value;
                      setLngInput(next);
                      const lat = parseCoord(latInput.trim());
                      const lng = parseCoord(next.trim());
                      const check = validateLatLng(lat, lng);
                      setCoordError(check.ok ? null : check.message);
                    }}
                    placeholder="e.g. -74.0060"
                    className="mt-1 h-10 w-full border border-gray-200 rounded-lg px-3 text-sm"
                    inputMode="decimal"
                    disabled={!isEditing}
                  />
                </div>
                <div className="md:col-span-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!latInput.trim() && !lngInput.trim()) {
                        setGeoError(null);
                        setCoordError(
                          "Enter latitude and longitude (or use the map) before setting coordinates.",
                        );
                        return;
                      }
                      const lat = parseCoord(latInput.trim());
                      const lng = parseCoord(lngInput.trim());
                      const check = validateLatLng(lat, lng);
                      if (!check.ok) {
                        setGeoError(null);
                        setCoordError(check.message);
                        return;
                      }
                      setGeoError(null);
                      setCoordError(null);
                      setForm((s) => (s ? { ...s, latitude: lat, longitude: lng } : s));
                    }}
                    className="h-10 px-4 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    disabled={
                      !isEditing ||
                      (!latInput.trim() && !lngInput.trim()) ||
                      !!coordError ||
                      (latInput.trim().length > 0 && parseCoord(latInput.trim()) == null) ||
                      (lngInput.trim().length > 0 && parseCoord(lngInput.trim()) == null)
                    }
                  >
                    Set coordinates
                  </button>
                </div>
              </div>

              <div className="h-[420px] w-full rounded-xl overflow-hidden border border-gray-200">
                <MapContainer
                  center={[form.latitude ?? 40.7128, form.longitude ?? -74.006]}
                  zoom={12}
                  className="h-full w-full"
                  scrollWheelZoom={isEditing}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapPanTo
                    value={
                      form.latitude != null && form.longitude != null
                        ? { latitude: form.latitude, longitude: form.longitude }
                        : null
                    }
                  />
                  <LocationPicker
                    disabled={!isEditing}
                    value={
                      form.latitude != null && form.longitude != null
                        ? { latitude: form.latitude, longitude: form.longitude }
                        : null
                    }
                    onChange={(pos) => {
                      setGeoError(null);
                      setCoordError(null);
                      setLatInput(String(pos.latitude));
                      setLngInput(String(pos.longitude));
                      setForm((s) =>
                        s ? { ...s, latitude: pos.latitude, longitude: pos.longitude } : s,
                      );
                    }}
                  />
                </MapContainer>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500">
                  {form.latitude != null && form.longitude != null
                    ? `Selected: ${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}`
                    : "Tip: click anywhere on the map to set the location."}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((s) => (s ? { ...s, latitude: null, longitude: null } : s))}
                    className="h-10 px-4 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                    disabled={!isEditing}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const check = validateLatLng(form.latitude, form.longitude);
                      if (!check.ok) {
                        setCoordError(check.message);
                        return;
                      }
                      setIsPickingLocation(false);
                    }}
                    className="h-10 px-4 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
                    disabled={!isEditing}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

