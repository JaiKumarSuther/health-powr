import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { OrganizationRow } from "../../lib/organzationsApi";
import {
  type ServiceCategory,
  useCreateService,
  useServiceCategories,
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
}: {
  value: { latitude: number; longitude: number } | null;
  onChange: (next: { latitude: number; longitude: number }) => void;
}) {
  useMapEvents({
    click(e) {
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

export function CreateServicePage({ organization }: { organization: OrganizationRow | null }) {
  const navigate = useNavigate();
  const org = organization;

  const categoriesQuery = useServiceCategories();
  const createService = useCreateService();

  const [form, setForm] = useState({
    name: "",
    category: "" as unknown as ServiceCategory,
    description: "",
    hours: "",
    eligibility: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [geoQuery, setGeoQuery] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [coordError, setCoordError] = useState<string | null>(null);

  useEffect(() => {
    if (form.category) return;
    const first = categoriesQuery.data?.[0]?.slug;
    if (!first) return;
    setForm((s) => ({ ...s, category: first as ServiceCategory }));
  }, [categoriesQuery.data, form.category]);

  const canManageServices = useMemo(() => {
    if (!org) return false;
    return org.status === "approved";
  }, [org]);

  if (!org) {
    return (
      <div className="py-20 text-center text-gray-500">
        No organization found for your account.
      </div>
    );
  }

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
            <h2 className="text-[13px] font-bold text-slate-900">Create Service</h2>
            <p className="text-[12px] text-slate-500 mt-1">
              Add a service for {org.name ?? "your organization"}.
            </p>
          </div>
        </div>
      </div>

      {!canManageServices && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="font-medium">You can't add or manage services right now.</p>
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

      <div className="bg-white border border-gray-200 rounded-[14px] p-4">
        <h3 className="text-[13px] font-bold text-slate-900">Service details</h3>
        <p className="text-[12px] text-slate-500 mt-1">
          This will appear in the Client Portal under “Find Services”.
        </p>

        <form
          className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!canManageServices) return;
            if (!org?.id) return;
            if (!form.name.trim()) return;

            const coordCheck = validateLatLng(form.latitude, form.longitude);
            if (!coordCheck.ok) {
              alert(coordCheck.message);
              return;
            }

            await createService.mutateAsync({
              organizationId: org.id,
              name: form.name.trim(),
              category: form.category,
              description: form.description.trim() || undefined,
              hours: form.hours.trim() || undefined,
              eligibility: form.eligibility.trim() || undefined,
              isAvailable: true,
              latitude: form.latitude,
              longitude: form.longitude,
            });

            navigate("/cbo/services");
          }}
        >
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-600">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-lg text-sm"
              placeholder="e.g. Emergency Food Pantry"
              disabled={!canManageServices || createService.isPending}
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-600">Category</label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((s) => ({ ...s, category: e.target.value as ServiceCategory }))
              }
              className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white"
              disabled={
                !canManageServices ||
                createService.isPending ||
                categoriesQuery.isLoading ||
                categoriesQuery.isError
              }
            >
              {categoriesQuery.isLoading && <option value={form.category}>Loading...</option>}
              {categoriesQuery.isError && <option value={form.category}>Failed to load</option>}
              {!categoriesQuery.isLoading &&
                !categoriesQuery.isError &&
                (categoriesQuery.data ?? []).map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
            </select>
            {categoriesQuery.isError && (
              <p className="mt-1 text-xs text-red-600">Couldn’t load categories. Please refresh.</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              rows={3}
              placeholder="Short summary of what this service provides"
              disabled={!canManageServices || createService.isPending}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600">Hours</label>
            <input
              value={form.hours}
              onChange={(e) => setForm((s) => ({ ...s, hours: e.target.value }))}
              className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-lg text-sm"
              placeholder="e.g. Mon–Fri 9am–5pm"
              disabled={!canManageServices || createService.isPending}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600">Eligibility</label>
            <input
              value={form.eligibility}
              onChange={(e) => setForm((s) => ({ ...s, eligibility: e.target.value }))}
              className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-lg text-sm"
              placeholder="e.g. NYC residents"
              disabled={!canManageServices || createService.isPending}
            />
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
                disabled={!canManageServices || createService.isPending}
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

          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-1">
            {createService.isError && (
              <span className="text-[12px] text-red-600 mr-auto">Failed to create service.</span>
            )}
            <button
              type="button"
              onClick={() => navigate("/cbo/services")}
              className="h-9 px-3 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-[12px] font-semibold"
              disabled={createService.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canManageServices || createService.isPending}
              className="h-9 px-3 rounded-lg bg-teal-600 text-white text-[12px] font-semibold hover:bg-teal-700 disabled:opacity-60"
            >
              {createService.isPending ? "Creating..." : "Create service"}
            </button>
          </div>
        </form>
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
                />
                <button
                  type="button"
                  disabled={geoLoading || !geoQuery.trim()}
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
                      setForm((s) => ({ ...s, latitude: lat, longitude: lon }));
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
                  <label className="block text-xs font-medium text-gray-600">
                    Latitude
                  </label>
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
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Longitude
                  </label>
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
                      setForm((s) => ({ ...s, latitude: lat, longitude: lng }));
                    }}
                    className="h-10 px-4 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    disabled={
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
                  scrollWheelZoom
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
                      setForm((s) => ({ ...s, latitude: pos.latitude, longitude: pos.longitude }));
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
                    onClick={() => setForm((s) => ({ ...s, latitude: null, longitude: null }))}
                    className="h-10 px-4 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
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
                    className="h-10 px-4 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
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

