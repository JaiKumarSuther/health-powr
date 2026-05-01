"use client";

import { useEffect, useRef, useState } from "react";

// ─── Reveal hook ──────────────────────────────────────────────────────────────

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StepPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-teal-600/25 bg-teal-50 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-teal-700">
      <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" />
      {label}
    </span>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-teal-200 bg-teal-50">
        <svg
          width="14"
          height="14"
          fill="none"
          stroke="#0d9b8a"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <polyline points="20,6 9,17 4,12" />
        </svg>
      </div>
      <span className="text-[13px] font-medium text-slate-600">{text}</span>
    </div>
  );
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────
// Background: off-white (#f6faf8) — alternates with white for Step 2

function Step1() {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-[#f6faf8] transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
      }`}
    >
      {/* Subtle dot grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle,rgba(13,155,138,0.07) 1px,transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 65% 30%,rgba(13,155,138,0.06) 0%,transparent 55%),radial-gradient(ellipse 50% 70% at 15% 80%,rgba(26,48,72,0.04) 0%,transparent 50%)",
        }}
      />
      {/* Ghost number */}
      <span
        className="pointer-events-none absolute -top-8 -right-5 select-none text-[220px] font-black leading-none tracking-[-8px]"
        style={{ color: "rgba(13,155,138,0.04)" }}
        aria-hidden
      >
        01
      </span>

      <div className="relative z-10 mx-auto grid max-w-[1100px] grid-cols-1 items-center gap-16 px-16 py-20 md:grid-cols-2">
        {/* Text */}
        <div>
          <StepPill label="Step 01" />
          <h3 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-[2.25rem]">
            Maria searches{" "}
            <em className="not-italic text-teal-600">&ldquo;food&rdquo;</em>
            <br />
            near Mott Haven
          </h3>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
            She opens HealthPowr, shares her location, and selects Food. Six
            pantries appear — open today, within walking distance. No hotline to
            call.
          </p>
        </div>

        {/* Card */}
        <div className="animate-[floatY_6s_ease-in-out_infinite]">
          <div className="rounded-[20px] border border-gray-200 bg-white p-6 shadow-[0_8px_32px_-8px_rgba(15,31,46,0.10)]">
            {/* Search header */}
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-gray-200 bg-[#f6faf8] px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-teal-50">
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="#0d9b8a"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-slate-900">
                  Mott Haven, Bronx
                </div>
                <div className="text-[11px] text-slate-400">
                  Using your current location
                </div>
              </div>
              <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-700">
                Food · 6 found
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {[
                {
                  name: "BronxWorks Food Pantry",
                  meta: "0.4 mi · Mon–Fri 9am–5pm",
                  active: true,
                },
                {
                  name: "Hunts Point Community Fridge",
                  meta: "0.7 mi · Open 24 hrs",
                  active: false,
                },
                {
                  name: "St. Augustine Food Pantry",
                  meta: "0.9 mi · Sat 10am–2pm",
                  active: false,
                },
              ].map((row) => (
                <div
                  key={row.name}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 ${
                    row.active
                      ? "border-teal-200 bg-teal-50"
                      : "border-gray-200 bg-[#f6faf8]"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      row.active
                        ? "border-teal-200 bg-teal-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke={row.active ? "#0d9b8a" : "#94a3b8"}
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-slate-900">
                      {row.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {row.meta}
                    </div>
                  </div>
                  <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[10px] font-bold text-teal-700">
                    Open
                  </span>
                </div>
              ))}

              <div className="flex items-center gap-1.5 px-1 pt-1 text-[12px] font-semibold text-slate-400">
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4m0 4h.01" />
                </svg>
                + 3 more nearby
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────
// Background: white — alternates with Step 1's off-white

function Step2() {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-white transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 80% 20%,rgba(13,155,138,0.05) 0%,transparent 60%)",
        }}
      />
      <span
        className="pointer-events-none absolute -top-5 -left-5 select-none text-[220px] font-black leading-none tracking-[-8px]"
        style={{ color: "rgba(13,155,138,0.04)" }}
        aria-hidden
      >
        02
      </span>

      <div className="relative z-10 mx-auto grid max-w-[1100px] grid-cols-1 items-center gap-16 px-16 py-20 md:grid-cols-2">
        {/* Card — left on desktop */}
        <div
          className="order-1 animate-[floatY_6s_ease-in-out_infinite]"
          style={{ animationDelay: "0.5s" }}
        >
          <div className="rounded-[20px] border border-gray-200 bg-white p-6 shadow-[0_8px_32px_-8px_rgba(15,31,46,0.10)]">
            {/* Org header */}
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-teal-200 bg-teal-50">
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  stroke="#0d9b8a"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9,22 9,12 15,12 15,22" />
                </svg>
              </div>
              <div>
                <div className="text-[14px] font-bold text-slate-900">
                  BronxWorks Food Pantry
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Request support · Verified ✓
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-3 py-2.5">
              <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-teal-600"
                  style={{ width: "66%" }}
                />
              </div>
              <span className="whitespace-nowrap text-[11px] font-bold text-teal-600">
                Step 2 of 3
              </span>
            </div>

            {/* Form fields */}
            <div className="mt-1 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200 bg-[#f6faf8] px-4 py-3 text-[13px] font-medium text-slate-900">
                  Maria R.
                </div>
                <div className="rounded-xl border border-gray-200 bg-[#f6faf8] px-4 py-3 text-[13px] font-medium text-slate-900">
                  Mott Haven, Bronx
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-[#f6faf8] px-4 py-3 text-[13px] font-medium text-slate-900">
                Lost job last month, need food for family of 3
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200 bg-[#f6faf8] px-4 py-3 text-[13px] font-medium text-slate-400">
                  Urgency level
                </div>
                <div className="rounded-xl border border-gray-200 bg-[#f6faf8] px-4 py-3 text-[13px] font-medium text-slate-900">
                  This week
                </div>
              </div>
            </div>

            <div className="mt-5">
              <button className="h-[50px] w-full rounded-[14px] bg-teal-600 font-sans text-[14px] font-bold text-white transition hover:bg-teal-700 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-6px_rgba(13,155,138,0.35)]">
                Submit request →
              </button>
              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
                <svg
                  width="11"
                  height="11"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Free to use · Your info is private and protected
              </p>
            </div>
          </div>
        </div>

        {/* Text — right on desktop */}
        <div className="order-2 pl-0 md:pl-4">
          <StepPill label="Step 02" />
          <h3 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-[2.25rem]">
            Support requested —
            <br />
            <em className="not-italic text-teal-600">2 minutes,</em> no
            paperwork
          </h3>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
            Maria taps BronxWorks and fills a short form. Her request goes
            directly to a verified caseworker — no middleman, no waiting room.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            <CheckRow text="No account required to browse" />
            <CheckRow text="Direct to caseworker, no middleman" />
            <CheckRow text="Info is encrypted and never sold" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────
// Background: off-white — mirrors Step 1

function Step3() {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-[#f6faf8] transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle,rgba(13,155,138,0.07) 1px,transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 65% 35%,rgba(13,155,138,0.06) 0%,transparent 55%)",
        }}
      />
      <span
        className="pointer-events-none absolute -bottom-10 -left-2.5 select-none text-[220px] font-black leading-none tracking-[-8px]"
        style={{ color: "rgba(13,155,138,0.04)" }}
        aria-hidden
      >
        03
      </span>

      <div className="relative z-10 mx-auto grid max-w-[1100px] grid-cols-1 items-center gap-16 px-16 py-20 md:grid-cols-2">
        {/* Text */}
        <div>
          <StepPill label="Step 03" />
          <h3 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-[2.25rem]">
            BronxWorks responds
            <br />
            <em className="not-italic text-teal-600">the same day</em>
          </h3>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
            Maria gets a message from her caseworker — confirmed for pickup this
            Thursday. She tracks everything in her dashboard. No phone tag. No
            lost paperwork.
          </p>
        </div>

        {/* Card */}
        <div
          className="animate-[floatY_6s_ease-in-out_infinite]"
          style={{ animationDelay: "1s" }}
        >
          <div className="rounded-[20px] border border-gray-200 bg-white p-6 shadow-[0_8px_32px_-8px_rgba(15,31,46,0.10)]">
            <div className="mb-3 text-[13px] font-bold text-slate-900">
              My applications
            </div>
            <div className="rounded-[18px] border border-teal-200 bg-teal-50 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[12px] font-bold text-white">
                    BW
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-slate-900">
                      BronxWorks Food Pantry
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      Food assistance · Submitted today
                    </div>
                  </div>
                </div>
                <span className="whitespace-nowrap rounded-full border border-teal-200 bg-[#dcfce7] px-3 py-1 text-[10px] font-bold text-green-700">
                  Responded
                </span>
              </div>

              {/* Caseworker message */}
              <div className="mt-3.5 rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-teal-200 bg-teal-50">
                    <svg
                      width="15"
                      height="15"
                      fill="none"
                      stroke="#0d9b8a"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold text-slate-900">
                      Caseworker Denise
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                      Hi Maria, your request is confirmed. Please come Thursday
                      between 10am–1pm. Bring a photo ID. We&apos;ll have a
                      full bag ready for your family.
                    </p>
                  </div>
                </div>
              </div>

              {/* Response time */}
              <div className="mt-3.5 flex items-center gap-3">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-teal-600"
                    style={{ width: "75%" }}
                  />
                </div>
                <span className="whitespace-nowrap text-[11px] font-semibold text-slate-400">
                  Responded in 4 hrs
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-dashed border-gray-300 bg-[#f6faf8] px-3.5 py-2.5">
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="#0d9b8a"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="text-[12px] font-medium text-slate-400">
                Find more resources near you
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function HowItWorks() {
  return (
    <>
      <style>{`
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      <section id="how-it-works" className="w-full font-sans bg-white">

        {/* Section header */}
        <div className="bg-[#1a3048] px-12 py-[72px] text-center">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.06em] text-teal-400">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
            How it works
          </div>

          <h2 className="mx-auto whitespace-nowrap text-[42px] font-bold leading-tight tracking-tight text-white">
            From searching to supported.
          </h2>

          <p className="mx-auto mt-4 text-[15px] leading-[1.7] text-white/50">
            Here's how Maria, a Bronx resident, found food assistance after losing her job.
            <br />
            No calls, no wrong numbers, no dead ends.
          </p>
        </div>

        <Step1 />
        <Step2 />
        <Step3 />

      </section>
    </>
  );
}