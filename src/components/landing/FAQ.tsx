import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { classNames } from "./utils";

export function FAQ({ onJoin }: { onJoin: () => void }) {
  const items = useMemo(
    () => [
      {
        q: "What is HealthPowr and who is it for?",
        a: "HealthPowr is a free platform connecting NYC residents to nearby housing, food, healthcare, employment, and community resources. It's built for individuals who need help finding services — and for organizations that want to reach and serve more people without the overhead.",
      },
      {
        q: "Is HealthPowr free to use?",
        a: "Yes — completely free for community members. You can search for resources, submit requests, and communicate with organizations at no cost.",
      },
      {
        q: "Do I need to create an account to search?",
        a: "No. You can search near you without creating an account. You'll only need to sign up when you're ready to submit a request.",
      },
      {
        q: "How does HealthPowr verify organizations?",
        a: "Every organization goes through a manual review before joining. You'll see a Verified badge on organization profiles so you know who you're connecting with.",
      },
      {
        q: "What neighborhoods and boroughs does HealthPowr cover?",
        a: "HealthPowr is launching first in New York City, with a focus on the Bronx and upper Manhattan. We're expanding across all five boroughs.",
      },
      {
        q: "I run a nonprofit. How can my organization join?",
        a: "Schedule an intro call with our team. We'll walk you through the platform, answer questions, and get your organization set up.",
      },
    ],
    [],
  );

  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section
      id="faq"
      className="relative overflow-hidden bg-white px-6 pb-24 pt-14 sm:pb-32 sm:pt-20 lg:px-12"
    >
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex justify-center">
        <div className="h-[800px] w-[800px] -translate-y-1/3 rounded-full bg-teal-200/30 blur-[120px]" />
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1fr_1.5fr] lg:gap-24">

          {/* Left column */}
          <div className="flex flex-col items-start lg:sticky lg:top-32 lg:h-max">
            <div className="inline-flex items-center rounded-full border border-teal-600/10 bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
              <span className="mr-2 flex h-1.5 w-1.5 rounded-full bg-teal-600" />
              Frequently Asked Questions
            </div>
            <h2 className="mt-6 text-balance text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Everything you need to know.
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-slate-600">
              Quick answers about how HealthPowr connects you to the resources you need, completely free.
            </p>
            <button
              onClick={onJoin}
              className="group relative mt-10 inline-flex h-12 items-center justify-center overflow-hidden rounded-full bg-teal-600 px-8 font-semibold text-white transition-all duration-300 hover:bg-teal-700 hover:shadow-[0_0_40px_-10px_rgba(13,148,136,0.6)]"
            >
              <span className="mr-2">Join the network</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </button>
          </div>

          {/* Right column: accordion */}
          <div className="flex flex-col gap-4">
            {items.map((it, idx) => {
              const isOpen = idx === openIdx;
              return (
                <div
                  key={idx}
                  className={classNames(
                    "group rounded-2xl border transition-all duration-300",
                    isOpen
                      ? "border-teal-200 bg-teal-50 shadow-lg shadow-teal-900/5 ring-1 ring-teal-900/5"
                      : "border-slate-200 bg-[#f6faf8] hover:bg-white hover:shadow-md",
                  )}
                >
                  <button
                    onClick={() => setOpenIdx((prev) => (prev === idx ? -1 : idx))}
                    className={classNames(
                      "flex w-full items-center justify-between gap-6 px-6 text-left focus-visible:outline-none rounded-2xl focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-inset",
                      isOpen ? "py-5" : "py-[13px]",
                    )}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${idx}`}
                  >
                    <span
                      className={classNames(
                        "text-base sm:text-lg font-semibold tracking-tight transition-colors",
                        isOpen ? "text-teal-950" : "text-slate-900",
                      )}
                    >
                      {it.q}
                    </span>
                    <div
                      className={classNames(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ease-out",
                        isOpen
                          ? "border-teal-600 bg-teal-600 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-500 group-hover:border-slate-300 group-hover:bg-slate-100",
                      )}
                    >
                      <Plus
                        className={classNames(
                          "h-5 w-5 transition-transform duration-200 ease-out",
                          isOpen ? "rotate-45" : "rotate-0",
                        )}
                        aria-hidden="true"
                      />
                    </div>
                  </button>

                  <div
                    id={`faq-panel-${idx}`}
                    className={classNames(
                      "grid overflow-hidden transition-all duration-200 ease-out",
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="pb-6 pl-6 pr-12 text-base leading-relaxed text-slate-600 sm:text-md">
                        {it.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
}