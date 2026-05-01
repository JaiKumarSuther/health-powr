import { lazy, Suspense, useMemo, useRef, useState } from "react";
import "./HeroExact.css";

const HeroMap = lazy(() =>
  import("./HeroMap").then((m) => ({ default: m.HeroMap })),
);

type Pill = { label: string; category?: string; svg: React.ReactNode };

interface HeroProps {
  onFindResources: (query: string, category: string | null) => void;
  onSignIn: () => void;
  onJoin: () => void;
}

export function Hero({
  onFindResources,
  onSignIn: _onSignIn,
  onJoin: _onJoin,
}: HeroProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [pulseInput, setPulseInput] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pills = useMemo<Pill[]>(
    () => [
      {
        label: "Housing",
        category: "housing",
        svg: (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z" />
            <path d="M6 15V9h4v6" />
          </svg>
        ),
      },
      {
        label: "Food",
        category: "food",
        svg: (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 5h10M3 8h10M3 11h6" />
            <rect x="1" y="2" width="14" height="12" rx="2" />
          </svg>
        ),
      },
      {
        label: "Healthcare",
        category: "healthcare",
        svg: (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1" y="1" width="14" height="14" rx="3" />
            <path d="M8 5v6M5 8h6" strokeWidth="2" />
          </svg>
        ),
      },
      {
        label: "Employment",
        category: "job_training",
        svg: (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2" y="5" width="12" height="9" rx="1" />
            <path d="M5 5V4a3 3 0 016 0v1" />
          </svg>
        ),
      },
    ],
    [],
  );

  const handleFindResources = (nextCategory?: string | null) => {
    const q = query.trim();
    if (!q) {
      setPulseInput(true);
      inputRef.current?.focus();
      window.setTimeout(() => setPulseInput(false), 820);
      return;
    }
    onFindResources(q, nextCategory ?? category);
  };

  const togglePill = (pillCategory?: string) => {
    const wasActive = category === (pillCategory ?? null);
    const next = wasActive ? null : (pillCategory ?? null);
    setCategory(next);
  };

  return (
    <section className="hp-landing-exact hero">
      <div className="hero-left">
        <div className="launch-badge">
          <div className="launch-badge-dot" />
          <span>Launching in New York City</span>
        </div>

        <h1>
          Support is out there.
          <br />
          Let's find it together.
        </h1>

        <p className="hero-sub">
          Communicate with real community resources in minutes and get personalized
          help<span className="hero-sub-break"> </span>— no cost, no pressure.
        </p>

        <div className="search-wrap">
          <div className="search-row">
            <input
              ref={inputRef}
              className={pulseInput ? "search-input input-pulse" : "search-input"}
              type="text"
              placeholder="Enter address, ZIP, or service name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleFindResources();
                }
              }}
            />
            <button
              className="search-btn"
              type="button"
              onClick={() => handleFindResources()}
            >
              Find resources
            </button>
          </div>

          <div className="pills" role="group" aria-label="Categories">
            {pills.map((p) => {
              const active = category === p.category;
              return (
                <button
                  key={p.label}
                  type="button"
                  className={active ? "pill active" : "pill"}
                  aria-pressed={active}
                  onClick={() => togglePill(p.category)}
                >
                  {p.svg}
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="org-link">
          Are you an organization?{" "}
          <a
            href="https://calendly.com/mardoche-healthpowr/30min?month=2026-04"
            target="_blank"
            rel="noopener noreferrer"
          >
            Schedule an intro call →
          </a>
        </p>
      </div>

      <div className="hero-right">
        <Suspense fallback={<div className="h-full w-full rounded-3xl bg-slate-50 animate-pulse" />}>
          <HeroMap />
        </Suspense>
      </div>
    </section>
  );
}