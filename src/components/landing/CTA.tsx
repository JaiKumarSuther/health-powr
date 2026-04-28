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

  return (
    <section className="bg-slate-950 px-4 py-16 sm:py-20 md:px-12 md:py-24">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-8 text-center">
        <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-300">
          Now available in New York City
        </div>
        <h2 className="text-balance text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-[56px]">
          The support you need is{" "}
          <span className="text-white/90">closer than you think.</span>
        </h2>
        <p className="max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
          Search for resources near you — your community is ready to help. Or if
          you’re an organization,{" "}
          <button
            onClick={onIntro}
            className="font-extrabold text-teal-300 transition hover:text-teal-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300/30 rounded"
          >
            let’s talk.
          </button>
        </p>

        <div
          className="w-full max-w-2xl rounded-3xl bg-white p-4 shadow-[0_22px_60px_rgba(0,0,0,0.25)]"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFindResources()}
              placeholder="Enter your address or ZIP code"
              className="h-12 w-full flex-1 rounded-xl border border-gray-200 bg-slate-50 px-4 text-[15px] font-semibold text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            />
            <button
              type="button"
              onClick={handleFindResources}
              className="h-12 whitespace-nowrap rounded-xl bg-teal-600 px-6 text-sm font-extrabold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Find resources
            </button>
          </div>
          <div className="mt-3 flex flex-nowrap justify-center gap-2 overflow-x-auto pb-1 scrollbar-hide sm:flex-wrap sm:overflow-visible sm:pb-0">
            {[
              { icon: <Home className="h-4 w-4" />, label: "Housing", category: "housing" },
              { icon: <Users className="h-4 w-4" />, label: "Food", category: "food" },
              { icon: <HeartPulse className="h-4 w-4" />, label: "Healthcare", category: "healthcare" },
              { icon: <Briefcase className="h-4 w-4" />, label: "Employment", category: "job_training" },
              { icon: <MessageCircle className="h-4 w-4" />, label: "Community", category: undefined },
            ].map((p) => {
              const isActive = activeCategory === p.category;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setActiveCategory(isActive ? null : (p.category || null))}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 sm:shrink ${
                    isActive ? "bg-teal-600 border-teal-600 text-white" : "border-gray-200 bg-white text-slate-900 hover:bg-teal-50"
                  }`}
                >
                  <span className={isActive ? "text-white" : "text-teal-600"}>{p.icon}</span>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>


        <div className="flex w-full max-w-2xl items-center gap-4 pt-2">
          <div className="h-px flex-1 bg-white/15" />
          <div className="text-xs font-semibold text-slate-400">
            for organizations
          </div>
          <div className="h-px flex-1 bg-white/15" />
        </div>

        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-slate-300">
            <strong className="text-slate-100">
              Ready to reach more people in your community?
            </strong>
            <br />
            Join the HealthPowr network and start receiving requests.
          </p>
          <button
            onClick={onIntro}
            className="h-12 rounded-full bg-teal-600 px-8 text-sm font-extrabold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300/30 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Schedule an intro call →
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-2 text-sm font-semibold text-teal-200/80">
          {["Free to use", "No account needed to search", "Privacy protected"].map(
            (t) => (
              <span key={t} className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-teal-300" />
                {t}
              </span>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

