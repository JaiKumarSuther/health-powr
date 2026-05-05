import { useEffect, useMemo, useRef, useState } from "react";
import { Home, Plus, Search } from "lucide-react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { classNames } from "./utils";

function InfoBubble({
  className,
  iconBg,
  icon,
  title,
  subtitle,
  badge,
  badgeTone,
  isClicked,
}: {
  className: string;
  iconBg: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: "success" | "info";
  isClicked?: boolean;
}) {
  return (
    <div
      className={classNames(
        "absolute z-[500] flex min-w-[180px] max-w-[88vw] items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm transition sm:min-w-[210px]",
        isClicked &&
          "border-teal-200 bg-teal-50 shadow-[0_10px_26px_rgba(13,148,136,0.14)] [transform:scale(1.03)]",
        className,
      )}
    >
      <div
        className={classNames(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          iconBg,
        )}
      >
        <span className="text-teal-600">{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold text-slate-900">
          {title}
        </div>
        <div className="truncate text-xs font-medium text-slate-500">
          {subtitle}
        </div>
      </div>
      <span
        className={classNames(
          "ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
          badgeTone === "success"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-teal-50 text-teal-800",
        )}
      >
        {badge}
      </span>
    </div>
  );
}

function useTypewriter(text: string, isActive: boolean, speedMs: number) {
  const [typed, setTyped] = useState("");
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    setTyped("");
    if (!isActive) return;

    let i = 0;
    intervalRef.current = window.setInterval(() => {
      i += 1;
      setTyped(text.slice(0, i));
      if (i >= text.length) {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, speedMs);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [text, isActive, speedMs]);

  const done = typed.length >= text.length;
  return { typed, done };
}

export function HeroMap() {
  const center: [number, number] = [40.81, -73.9265];
  const [phase, setPhase] = useState<
    "idle" | "bubble" | "form" | "formTypingSituation" | "submitFlash" | "track"
  >("idle");

  const nameText = "Maria R.";
  const situationText = "Lost job, need food for family of 3";
  const caseworkerText =
    "Hi Maria — confirmed for Thursday 10am–1pm. Bring photo ID, we'll have a bag ready.";

  const { typed: typedName, done: doneName } = useTypewriter(
    nameText,
    phase === "form" || phase === "formTypingSituation" || phase === "submitFlash",
    70,
  );
  const { typed: typedSituation } = useTypewriter(
    situationText,
    phase === "formTypingSituation" || phase === "submitFlash",
    55,
  );
  const { typed: typedCaseworker } = useTypewriter(
    caseworkerText,
    phase === "track",
    38,
  );

  // Looping animation cycle (matches prototype timing).
  useEffect(() => {
    const timers: Array<number> = [];
    const after = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const runCycle = () => {
      setPhase("idle");

      after(2000, () => setPhase("bubble"));
      after(2600, () => setPhase("form"));

      after(3100, () => {
        // once name is mostly underway, switch to situation typing
        setPhase("formTypingSituation");
      });

      after(6200, () => setPhase("submitFlash"));
      after(6800, () => setPhase("track"));
      after(11500, runCycle);
    };

    runCycle();
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.length = 0;
    };
  }, []);

  // Custom Leaflet div icons to match the prototype dots (and allow pulse).
  const markerIcons = useMemo(() => {
    const sm = L.divIcon({
      className: "",
      html:
        '<div style="width:12px;height:12px;border-radius:50%;background:#0D9488;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.18);"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    const lg = L.divIcon({
      className: "",
      html:
        '<div class="hp-pin-pulse" style="width:16px;height:16px;border-radius:50%;background:#0D9488;border:3px solid #fff;box-shadow:0 0 0 4px rgba(13,148,136,0.18);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    return { sm, lg };
  }, []);

  const markers = useMemo(
    () =>
      [
        { pos: [40.8118, -73.9242] as [number, number], big: true },
        { pos: [40.8082, -73.9198] as [number, number] },
        { pos: [40.8145, -73.931] as [number, number] },
        { pos: [40.8065, -73.928] as [number, number] },
        { pos: [40.813, -73.9175] as [number, number] },
      ] as const,
    [],
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl border border-teal-100 bg-slate-50 p-2 shadow-sm">
      <div className="relative h-full w-full overflow-hidden rounded-2xl [isolation:isolate]">
        <MapContainer
          center={center}
          zoom={14}
          zoomControl={false}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          attributionControl={false}
          keyboard={false}
          className="h-full w-full"
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          {markers.map((m, idx) => (
            <Marker
              key={idx}
              position={m.pos}
              icon={("big" in m && m.big) ? markerIcons.lg : markerIcons.sm}
            />
          ))}
        </MapContainer>

        <InfoBubble
          className="left-3 top-3"
          iconBg="bg-teal-50"
          icon={<Home className="h-4 w-4" />}
          title="Safe Haven Shelter"
          subtitle="0.3 mi · Emergency housing"
          badge="Open"
          badgeTone="success"
        />
        <InfoBubble
          className="right-3 top-[38%] hidden cursor-default sm:flex"
          iconBg="bg-amber-50"
          icon={<Search className="h-4 w-4 text-amber-700" />}
          title="BronxWorks Food Pantry"
          subtitle="0.6 mi · Open until 6pm"
          badge="Open"
          badgeTone="success"
          isClicked={phase === "bubble" || phase === "form" || phase === "formTypingSituation" || phase === "submitFlash"}
        />
        <InfoBubble
          className="bottom-3 left-[14%] hidden sm:flex"
          iconBg="bg-violet-50"
          icon={<Plus className="h-4 w-4 text-violet-700" />}
          title="Urban Health Plan Clinic"
          subtitle="1.1 mi · Free primary care"
          badge="3 slots"
          badgeTone="info"
        />

        {/* Animated bottom sheets (inside map widget only) */}
        <div
          className={classNames(
            "absolute inset-x-0 bottom-0 z-[600] rounded-t-2xl border-t border-gray-200 bg-white px-4 pb-4 pt-3 shadow-[0_-6px_40px_rgba(0,0,0,0.13)] transition-transform duration-[450ms] [transition-timing-function:cubic-bezier(0.34,1.1,0.64,1)]",
            phase === "form" ||
              phase === "formTypingSituation" ||
              phase === "submitFlash"
              ? "translate-y-0"
              : "translate-y-full",
          )}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
              <Search className="h-4 w-4 text-amber-700" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold text-slate-900">
                BronxWorks Food Pantry
              </div>
              <div className="text-xs font-medium text-slate-500">
                Request support · Verified
              </div>
            </div>
          </div>
          <div className="mb-3 h-[3px] w-full overflow-hidden rounded bg-gray-200">
            <div className="h-full w-[66%] rounded bg-teal-600" />
          </div>
          <div className="mb-3 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex min-h-[34px] items-center rounded-lg border border-gray-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900">
                <span>{typedName}</span>
                <span
                  className={classNames(
                    "ml-0.5 text-teal-600 animate-[hpBlink_0.7s_infinite]",
                    doneName ? "hidden" : "inline",
                  )}
                >
                  |
                </span>
              </div>
              <div className="flex min-h-[34px] items-center rounded-lg border border-gray-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900">
                Mott Haven, Bronx
              </div>
            </div>
            <div className="flex min-h-[34px] items-center rounded-lg border border-gray-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900">
              <span>{typedSituation}</span>
              <span className="ml-0.5 text-teal-600 animate-[hpBlink_0.7s_infinite]">
                |
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex min-h-[34px] items-center rounded-lg border border-gray-200 bg-slate-50 px-3 text-xs font-semibold text-slate-400">
                Urgency level
              </div>
              <div className="flex min-h-[34px] items-center rounded-lg border border-gray-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900">
                This week
              </div>
            </div>
          </div>
          <button
            type="button"
            className={classNames(
              "h-11 w-full rounded-xl bg-teal-600 text-sm font-extrabold text-white transition",
              phase === "submitFlash" && "scale-[0.98] bg-teal-700",
            )}
          >
            Submit request →
          </button>
          <div className="mt-2 text-center text-[11px] font-medium text-slate-400">
            Free · Private · No spam
          </div>
        </div>

        <div
          className={classNames(
            "absolute inset-x-0 bottom-0 z-[600] rounded-t-2xl border-t border-gray-200 bg-white px-4 pb-4 pt-3 shadow-[0_-6px_40px_rgba(0,0,0,0.13)] transition-transform duration-[450ms] [transition-timing-function:cubic-bezier(0.34,1.1,0.64,1)]",
            phase === "track" ? "translate-y-0" : "translate-y-full",
          )}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />
          <div className="mb-2 text-xs font-extrabold text-slate-900">
            My applications
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-[10px] font-extrabold text-white">
                BW
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-extrabold text-slate-900">
                  BronxWorks Food Pantry
                </div>
                <div className="text-[10px] font-medium text-slate-500">
                  Food assistance · Just submitted
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                Responded
              </span>
            </div>
            <div className="min-h-[38px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">
              <strong className="text-slate-900">Caseworker Denise:</strong>{" "}
              <span>{typedCaseworker}</span>
              <span className="ml-0.5 text-teal-600 animate-[hpBlink_0.7s_infinite]">
                |
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-[3px] flex-1 overflow-hidden rounded bg-teal-200">
                <div className="h-full w-full rounded bg-teal-600 transition-[width] duration-[3000ms] [transition-timing-function:linear]" />
              </div>
              <span className="text-[10px] font-medium text-slate-500">
                Responded in 4 hrs
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HeroMap;

