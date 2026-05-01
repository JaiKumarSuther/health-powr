// updated — accent map SVGs added
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

      {/* ── Background accent SVGs ── */}

      {/* Pin: top:3% left:3.5% · rotate(-8deg) · op:0.55 */}
      <span className="hp-accent" style={{ top: "3%", left: "3.5%", width: 38, height: 48, opacity: 0.55, transform: "rotate(-8deg)" }} aria-hidden="true">
        <svg viewBox="0 0 38 48" fill="none" stroke="#0d9b8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 4 C 10 4, 4 11, 5 19 C 6 28, 19 44, 19 44 C 19 44, 32 28, 33 19 C 34 11, 28 4, 19 4 Z" />
          <circle cx="19" cy="18" r="4.5" fill="#0d9b8a" stroke="none" opacity={0.7} />
        </svg>
      </span>

      {/* Spark: top:12% left:9% · rotate(20deg) · op:0.45 */}
      <span className="hp-accent" style={{ top: "12%", left: "9%", width: 28, height: 28, opacity: 0.45, transform: "rotate(20deg)" }} aria-hidden="true">
        <svg viewBox="0 0 28 28" fill="none" stroke="#0d9b8a" strokeWidth="2" strokeLinecap="round">
          <path d="M14 3 L14 25" /><path d="M3 14 L25 14" />
          <path d="M6.5 6.5 L21.5 21.5" /><path d="M21.5 6.5 L6.5 21.5" />
        </svg>
      </span>

      {/* Heart-small: top:8% right:46% · rotate(10deg) · op:0.5 · animated */}
      <span className="hp-accent hp-accent--heart-beat" style={{ top: "8%", right: "46%", width: 32, height: 30, opacity: 0.5 }} aria-hidden="true">
        <svg viewBox="0 0 32 30" fill="none" stroke="#0d9b8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 26 C 4 18, 2 10, 7 6 C 11 3, 14 5, 16 9 C 18 5, 21 3, 25 6 C 30 10, 28 18, 16 26 Z" />
        </svg>
      </span>

      {/* Bubble: top:16% right:3% · rotate(-6deg) · op:0.5 */}
      <span className="hp-accent" style={{ top: "16%", right: "3%", width: 56, height: 50, opacity: 0.5, transform: "rotate(-6deg)" }} aria-hidden="true">
        <svg viewBox="0 0 56 50" fill="none" stroke="#0d9b8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8 Q 6 4, 10 4 L 46 4 Q 50 4, 50 8 L 50 32 Q 50 36, 46 36 L 22 36 L 14 44 L 14 36 L 10 36 Q 6 36, 6 32 Z" />
          <path d="M18 20 L 24 26 L 36 14" strokeWidth="2.4" />
        </svg>
      </span>

      {/* Route: top:39% left:47% · op:0.4 (navy) */}
      <span className="hp-accent" style={{ top: "39%", left: "47%", width: 110, height: 80, opacity: 0.4 }} aria-hidden="true">
        <svg viewBox="0 0 110 80" fill="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <path d="M8 12 Q 30 8, 45 30 Q 60 52, 85 50 Q 100 49, 104 68" stroke="#1a3048" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 6" />
        </svg>
        <svg viewBox="0 0 110 80" fill="#1a3048" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <circle cx="8" cy="12" r="3" /><circle cx="104" cy="68" r="3" />
        </svg>
      </span>

      {/* Cluster: top:36% left:38% · op:0.45 */}
      <span className="hp-accent" style={{ top: "36%", left: "38%", width: 60, height: 40, opacity: 0.45 }} aria-hidden="true">
        <svg viewBox="0 0 60 40" fill="#0d9b8a" stroke="none">
          <circle cx="8" cy="20" r="3" /><circle cx="20" cy="10" r="2.5" opacity={0.85} />
          <circle cx="22" cy="28" r="2.2" opacity={0.7} /><circle cx="34" cy="18" r="3" opacity={0.9} />
          <circle cx="44" cy="8" r="2.2" opacity={0.7} /><circle cx="46" cy="28" r="2.5" opacity={0.8} />
          <circle cx="56" cy="20" r="2" opacity={0.6} />
        </svg>
      </span>

      {/* Heart-large: bottom:12% left:32% · op:0.5 */}
      <span className="hp-accent" style={{ bottom: "12%", left: "32%", width: 52, height: 42, opacity: 0.5 }} aria-hidden="true">
        <svg viewBox="0 0 52 42" fill="none" stroke="#0d9b8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M26 38 C8 26, 4 14, 10 8 C15 3, 20 6, 26 14 C32 6, 37 3, 42 8 C48 14, 44 26, 26 38 Z" />
        </svg>
      </span>

      {/* Squiggle: bottom:28% left:14% · rotate(-3deg) · op:0.35 */}
      <span className="hp-accent" style={{ bottom: "28%", left: "14%", width: 90, height: 18, opacity: 0.35, transform: "rotate(-3deg)" }} aria-hidden="true">
        <svg viewBox="0 0 90 18" fill="none" stroke="#0d9b8a" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4 9 Q14 3, 24 9 T44 9 T64 9 T86 9" />
        </svg>
      </span>

      {/* Calendar: bottom:22% left:4% · rotate(6deg) · op:0.45 */}
      <span className="hp-accent" style={{ bottom: "22%", left: "4%", width: 42, height: 42, opacity: 0.45, transform: "rotate(6deg)" }} aria-hidden="true">
        <svg viewBox="0 0 42 42" fill="none" stroke="#0d9b8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="8" width="34" height="30" rx="5" />
          <path d="M4 16h34" /><path d="M14 4v8M28 4v8" />
          <circle cx="14" cy="26" r="2" fill="#0d9b8a" stroke="none" />
          <circle cx="21" cy="26" r="2" fill="#0d9b8a" stroke="none" />
          <circle cx="28" cy="26" r="2" fill="#0d9b8a" stroke="none" />
        </svg>
      </span>

      {/* Cross: bottom:6% right:4% · rotate(15deg) · op:0.45 */}
      <span className="hp-accent" style={{ bottom: "6%", right: "4%", width: 36, height: 36, opacity: 0.45, transform: "rotate(15deg)" }} aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none" stroke="#0d9b8a" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6v24M6 18h24" />
        </svg>
      </span>

      {/* House: top:52% right:2% · rotate(-5deg) · op:0.4 */}
      <span className="hp-accent" style={{ top: "52%", right: "2%", width: 44, height: 40, opacity: 0.4, transform: "rotate(-5deg)" }} aria-hidden="true">
        <svg viewBox="0 0 44 40" fill="none" stroke="#0d9b8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20 L22 5 L40 20" />
          <path d="M8 18v18h10v-9h8v9h10V18" />
        </svg>
      </span>

      {/* ── Main content ── */}
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