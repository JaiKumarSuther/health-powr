"use client";

import { useEffect, useRef, useState } from "react";

// --- Reusable reveal hook ---
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
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

// --- Sub-components ---

function StepPill({
  label,
  dark = true,
}: {
  label: string;
  dark?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[11px] font-semibold uppercase tracking-widest ${
        dark
          ? "bg-teal-500/15 border-teal-400/30 text-teal-300"
          : "bg-emerald-800/10 border-emerald-700/25 text-emerald-700"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full animate-pulse ${
          dark ? "bg-teal-400" : "bg-emerald-700"
        }`}
      />
      {label}
    </span>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/5">
        <svg
          width="14"
          height="14"
          fill="none"
          stroke="#5eead4"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <polyline points="20,6 9,17 4,12" />
        </svg>
      </div>
      <span className="text-[13px] font-medium text-white/70">{text}</span>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex h-[60px] items-center justify-center bg-transparent">
      <div className="flex h-[60px] flex-col items-center">
        <div className="w-px flex-1 bg-white/10" />
        <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
        <div className="w-px flex-1 bg-white/10" />
      </div>
    </div>
  );
}

function DarkConnector() {
  return <Connector />;
}

// --- Step 1 ---
function Step1() {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`relative overflow-hidden transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
      }`}
      style={{
        background:
          "linear-gradient(135deg,#0b1c2a 0%,#0e2235 45%,#102840 75%,#0b1c2a 100%)",
      }}
    >
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle,rgba(255,255,255,.055) 1px,transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
      {/* Radial glows */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 65% 35%,rgba(20,184,166,.09) 0%,transparent 55%),radial-gradient(ellipse 55% 75% at 15% 85%,rgba(15,110,86,.07) 0%,transparent 50%)",
        }}
      />
      {/* Ghost number */}
      <span
        className="pointer-events-none absolute -top-8 -right-5 select-none font-serif text-[220px] font-black leading-none tracking-[-8px] text-white/[.03]"
        aria-hidden
      >
        01
      </span>

      <div className="relative z-10 mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-8 py-20 md:grid-cols-2 md:gap-16">
        {/* Text */}
        <div>
          <StepPill label="Step 01" />
          <h3 className="mt-4 font-serif text-3xl font-bold leading-tight tracking-tight text-white md:text-[2.25rem]">
            Maria searches{" "}
            <em className="not-italic text-teal-300">&ldquo;food&rdquo;</em>
            <br />
            near Mott Haven
          </h3>
          <p className="mt-4 text-[15px] leading-relaxed text-white/55">
            She opens HealthPowr, shares her location, and selects Food. Six
            pantries appear — open today, within walking distance. No hotline to
            call.
          </p>
        </div>

        {/* Card */}
        <div className="animate-[floatY_6s_ease-in-out_infinite]">
          <div className="rounded-[20px] border border-white/10 bg-white/5 backdrop-blur-md p-6 shadow-[0_24px_64px_-16px_rgba(0,0,0,.4)]">
            {/* Search header */}
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-teal-500/30 bg-white/5 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="#5eead4"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-white">
                  Mott Haven, Bronx
                </div>
                <div className="text-[11px] text-white/40">
                  Using your current location
                </div>
              </div>
              <span className="rounded-full bg-teal-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-200">
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
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 hover:translate-x-1 ${
                    row.active
                      ? "border-teal-500/50 bg-white/10"
                      : "border-white/5 bg-transparent hover:border-white/20"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      row.active
                        ? "border-teal-500/20 bg-teal-500/10"
                        : "border-white/5 bg-white/5"
                    }`}
                  >
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke={row.active ? "#5eead4" : "#94a3b8"}
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-white">
                      {row.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/30">
                      {row.meta}
                    </div>
                  </div>
                  <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-bold text-teal-300">
                    Open
                  </span>
                </div>
              ))}

              <div className="flex items-center gap-1.5 px-1 pt-1 text-[12px] font-semibold text-white/30">
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

// --- Step 2 ---
function Step2() {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`relative overflow-hidden transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 80% 20%,rgba(20,184,166,.08) 0%,transparent 60%)",
        }}
      />
      <span
        className="pointer-events-none absolute -top-5 -left-5 select-none font-serif text-[220px] font-black leading-none tracking-[-8px]"
        style={{ color: "rgba(255,255,255,.035)" }}
        aria-hidden
      >
        02
      </span>

      <div className="relative z-10 mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-8 py-20 md:grid-cols-2 md:gap-16">
        {/* Card — first on mobile, first col on desktop */}
        <div
          className="order-1 animate-[floatY_6s_ease-in-out_infinite]"
          style={{ animationDelay: "0.5s" }}
        >
          <div className="rounded-[20px] border border-white/10 bg-white/5 backdrop-blur-md p-6 shadow-[0_24px_64px_-16px_rgba(0,0,0,.4)]">
            {/* Org header */}
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-teal-500/30 bg-white/5">
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  stroke="#5eead4"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9,22 9,12 15,12 15,22" />
                </svg>
              </div>
              <div>
                <div className="text-[14px] font-bold text-white">
                  BronxWorks Food Pantry
                </div>
                <div className="mt-0.5 text-[11px] text-white/40">
                  Request support · Verified organization
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-3 py-2.5">
              <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600"
                  style={{ width: "66%" }}
                />
              </div>
              <span className="whitespace-nowrap text-[11px] font-bold text-teal-300">
                Step 2 of 3
              </span>
            </div>

            {/* Form fields */}
            <div className="mt-1 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] font-medium text-white">
                  Maria R.
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] font-medium text-white">
                  Mott Haven, Bronx
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] font-medium text-white">
                Lost job last month, need food for family of 3
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] font-medium text-white/30">
                  Urgency level
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] font-medium text-white">
                  This week
                </div>
              </div>
            </div>

            <div className="mt-5">
              <button className="group relative h-[50px] w-full overflow-hidden rounded-[14px] bg-gradient-to-br from-teal-500 to-emerald-700 font-sans text-[14px] font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-6px_rgba(13,148,136,.45)]">
                <span className="relative z-10">Submit request →</span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              </button>
              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-white/30">
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

        {/* Text */}
        <div className="order-2 pl-0 md:pl-4">
          <StepPill label="Step 02" dark={true} />
          <h3 className="mt-4 font-serif text-3xl font-bold leading-tight tracking-tight text-white md:text-[2.25rem]">
            Support requested —
            <br />
            <em className="not-italic text-teal-300">2 minutes,</em> no
            paperwork
          </h3>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
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

// --- Step 3 ---
function Step3() {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`relative overflow-hidden transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
      }`}
      style={{
        background:
          "linear-gradient(135deg,#0b1c2a 0%,#0e2235 45%,#102840 75%,#0b1c2a 100%)",
      }}
    >
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle,rgba(255,255,255,.055) 1px,transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
      {/* Radial glows */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 65% 35%,rgba(20,184,166,.09) 0%,transparent 55%),radial-gradient(ellipse 55% 75% at 15% 85%,rgba(15,110,86,.07) 0%,transparent 50%)",
        }}
      />
      {/* Ghost number */}
      <span
        className="pointer-events-none absolute -bottom-10 -left-2.5 select-none font-serif text-[220px] font-black leading-none tracking-[-8px] text-white/[.03]"
        aria-hidden
      >
        03
      </span>

      <div className="relative z-10 mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-8 py-20 md:grid-cols-2 md:gap-16">
        {/* Text */}
        <div>
          <StepPill label="Step 03" />
          <h3 className="mt-4 font-serif text-3xl font-bold leading-tight tracking-tight text-white md:text-[2.25rem]">
            BronxWorks responds
            <br />
            <em className="not-italic text-teal-300">the same day</em>
          </h3>
          <p className="mt-4 text-[15px] leading-relaxed text-white/55">
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
          <div className="rounded-[20px] border border-white/10 bg-white/5 backdrop-blur-md p-6 shadow-[0_24px_64px_-16px_rgba(0,0,0,.4)]">
            <div className="mb-3 pb-0.5 text-[13px] font-bold text-white">
              My applications
            </div>
            <div className="rounded-[20px] border border-teal-500/20 bg-white/5 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-700 text-[12px] font-bold text-white">
                    BW
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-white">
                      BronxWorks Food Pantry
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/40">
                      Food assistance · Submitted today
                    </div>
                  </div>
                </div>
                <span className="whitespace-nowrap rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-[10px] font-bold text-teal-300">
                  ✓ Responded
                </span>
              </div>

              {/* Caseworker message */}
              <div className="mt-3.5 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_4px_16px_-4px_rgba(0,0,0,.2)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-teal-500/20 bg-teal-500/10">
                    <svg
                      width="15"
                      height="15"
                      fill="none"
                      stroke="#5eead4"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold text-white">
                      Caseworker Denise
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-white/70">
                      Hi Maria, your request is confirmed. Please come Thursday
                      between 10am–1pm. Bring a photo ID. We&apos;ll have a
                      full bag ready for your family.
                    </p>
                  </div>
                </div>
              </div>

              {/* Response time bar */}
              <div className="mt-3.5 flex items-center gap-3">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600"
                    style={{ width: "75%" }}
                  />
                </div>
                <span className="whitespace-nowrap text-[11px] font-semibold text-white/40">
                  Responded in 4 hrs
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-dashed border-white/10 bg-white/5 px-3.5 py-2.5">
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="#5eead4"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="text-[12px] font-medium text-white/30">
                Find more resources near you
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- CTA Footer ---
function CTAFooter() {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`bg-transparent px-12 py-16 text-center transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
      }`}
    >
      <p className="mb-4 text-[12px] font-bold uppercase tracking-[.08em] text-teal-400">
        Ready to get started?
      </p>
      <h3 className="mx-auto max-w-none whitespace-nowrap font-serif text-[clamp(24px,4vw,40px)] font-bold leading-tight tracking-tight text-white">
        Find support near you.
      </h3>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button className="rounded-full bg-teal-600 px-8 py-4 text-sm font-extrabold text-white transition-all duration-200 hover:bg-teal-700 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-4px_rgba(13,148,136,0.3)]">
          Find resources →
        </button>
        <a 
          href="https://calendly.com/mardoche-healthpowr/30min?month=2026-04"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-8 py-4 text-sm font-extrabold text-white transition-all duration-200 hover:bg-white/20"
        >
          For organizations
        </a>
      </div>
    </div>
  );
}

// --- Main export ---
export default function HowItWorks() {
  return (
    <>
      {/* Inject keyframes */}
      <style>{`
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      <section id="how-it-works" className="w-full font-sans bg-emerald-950">
        {/* Section header */}
        <div className="bg-transparent px-12 py-[72px] text-center">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.06em] text-teal-400">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
            How it works
          </div>
          <h2 className="mx-auto max-w-[560px] font-serif text-[clamp(32px,5vw,52px)] font-bold leading-tight tracking-tight text-white">
            From searching to supported.
          </h2>
          <p className="mx-auto mt-4 max-w-[440px] text-[16px] leading-[1.7] text-white/60">
            In one afternoon — no calls, no wrong numbers, no dead ends.
          </p>
        </div>

        <Step1 />
        <Connector />
        <Step2 />
        <DarkConnector />
        <Step3 />
        <CTAFooter />
      </section>
    </>
  );
}