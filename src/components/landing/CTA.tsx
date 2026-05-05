import { useRef, useState } from "react";
import { Briefcase, HeartPulse, Home, MessageCircle, Users, Check } from "lucide-react";

export function CTA({
  onSearch,
  onFindResources,
  onIntro,
}: {
  onSearch: (input: { query: string; category?: string }) => void;
  onFindResources: (query: string, category: string | null) => void;
  onIntro: () => void;
  onSignIn: () => void;
  onJoin: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  function handleFindResources() {
    const val = query.trim();
    if (!val) {
      searchInputRef.current?.classList.add("input-pulse");
      searchInputRef.current?.focus();
      setTimeout(() => {
        searchInputRef.current?.classList.remove("input-pulse");
      }, 820);
      return;
    }
    onFindResources(val, activeCategory);
    onSearch({ query: val, category: activeCategory || undefined });
  }

  const categories = [
    { icon: <Home className="h-4 w-4" />, label: "Housing", category: "housing" },
    { icon: <Users className="h-4 w-4" />, label: "Food", category: "food" },
    { icon: <HeartPulse className="h-4 w-4" />, label: "Healthcare", category: "healthcare" },
    { icon: <Briefcase className="h-4 w-4" />, label: "Employment", category: "job_training" },
    { icon: <MessageCircle className="h-4 w-4" />, label: "Community", category: undefined },
  ];

  const trustBadges = ["Free to use", "No account needed", "Privacy protected"];

  return (
    <section className="bg-[#1a3048] px-4 py-12 sm:px-8 sm:py-20 md:px-12 md:py-24 lg:px-16 lg:py-28">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-6 text-center sm:gap-8">

        {/* ── Badge ── */}
        <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-teal-300 sm:text-xs">
          Now available in New York City
        </div>

        {/* ── Heading ──
            FIX: was `sm:text-4xl sm:text-5xl` — second sm: overrode first.
            Correct tier: base → sm → md → lg
        */}
        <h2 className="text-balance text-[28px] font-extrabold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[56px]">
          The support you need is
          {/* Hide the line break on mobile so the heading wraps naturally */}
          <br className="hidden sm:block" />
          <span className="text-white/90"> closer than you think.</span>
        </h2>

        {/* ── Subtext ──
            FIX: was `sm:text-base sm:text-lg` — second sm: overrode first.
            Correct tier: base → sm → md
        */}
        <p className="max-w-sm text-sm leading-relaxed text-slate-300 sm:max-w-xl sm:text-base md:max-w-2xl md:text-lg">
          Search for resources near you — your community is ready to help. Or if
          you're an organization,{" "}
          <button
            onClick={onIntro}
            className="rounded font-extrabold text-teal-300 transition hover:text-teal-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300/30"
          >
            let's talk.
          </button>
        </p>

        {/* ── Search box ── */}
        <div className="w-full max-w-2xl rounded-2xl bg-white p-3 shadow-[0_22px_60px_rgba(0,0,0,0.25)] sm:rounded-3xl sm:p-4">

          {/* Input + button — stacked on mobile, side-by-side on sm+ */}
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFindResources()}
              placeholder="Enter your address or ZIP code"
              /*
                Use inline style for height so it cannot be purged by Tailwind JIT
                or overridden by a global CSS reset. 56px on mobile, 48px on desktop
                via the sm: class as a progressive enhancement.
              */
              style={{ minHeight: 56 }}
              className="w-full flex-1 rounded-xl border-2 border-gray-200 bg-white px-5 py-4 text-base font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100 sm:min-h-0 sm:py-0 sm:h-12 sm:px-4 sm:text-[15px]"
            />
            <button
              type="button"
              onClick={handleFindResources}
              style={{ minHeight: 56 }}
              className="w-full whitespace-nowrap rounded-xl bg-[#132435] px-6 py-4 text-[15px] font-extrabold text-white transition hover:bg-[#1a3048] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:min-h-0 sm:py-0 sm:h-12 sm:w-auto sm:text-sm"
            >
              Find resources
            </button>
          </div>

          {/* Category pills
              Mobile: single-row horizontal scroll (no wrap)
              sm+:    wraps, centered
          */}
          <div
            role="group"
            aria-label="Filter by category"
            className="mt-3 flex flex-nowrap justify-start gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible sm:pb-0"
          >
            {categories.map((p) => {
              const isActive = activeCategory === p.category;
              return (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveCategory(isActive ? null : (p.category ?? null))}
                  className={[
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold transition",
                    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100",
                    "sm:gap-2 sm:px-4 sm:py-2",
                    isActive
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-gray-200 bg-white text-slate-900 hover:bg-teal-50",
                  ].join(" ")}
                >
                  <span className={isActive ? "text-white" : "text-teal-600"}>
                    {p.icon}
                  </span>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="flex w-full max-w-2xl items-center gap-4 pt-1">
          <div className="h-px flex-1 bg-white/15" />
          <div className="text-xs font-semibold text-slate-400">for organizations</div>
          <div className="h-px flex-1 bg-white/15" />
        </div>

        {/* ── Org CTA ── */}
        <div className="flex flex-col items-center gap-4">
          <p className="max-w-sm text-[15px] leading-relaxed text-slate-300 sm:max-w-none">
            <strong className="text-slate-100">
              Ready to reach more people in your community?
            </strong>
            <br />
            Join the HealthPowr network and start receiving requests.
          </p>
          {/* FIX: added w-full sm:w-auto so button doesn't overflow on tiny phones */}
          <button
            onClick={onIntro}
            className="h-12 w-full max-w-xs rounded-full bg-teal-600 px-8 text-sm font-extrabold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a3048] sm:w-auto"
          >
            Schedule an intro call →
          </button>
        </div>

        {/* ── Trust badges ──
            FIX: added sm:gap-x-8, tightened base gap for tiny phones.
            On very small screens the 3 badges wrap into a 2+1 grid gracefully.
        */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 pt-2 text-xs font-semibold text-teal-200/80 sm:gap-x-8 sm:text-sm">
          {trustBadges.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 sm:gap-2">
              <Check className="h-3.5 w-3.5 shrink-0 text-teal-300 sm:h-4 sm:w-4" />
              {t}
            </span>
          ))}
        </div>

      </div>
    </section>
  );
}