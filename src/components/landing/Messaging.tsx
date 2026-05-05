import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Clock, MessageSquare, ShieldCheck } from "lucide-react";
import { classNames } from "./utils";

function TrustItem({
  title,
  body,
  icon: Icon,
}: {
  title: string;
  body: string;
  icon: React.ElementType;
}) {
  return (
    <li className="flex items-center gap-x-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-400/25 bg-teal-400/12 text-teal-300">
        <Icon className="h-5 w-5 flex-shrink-0" />
      </span>
      <span className="text-sm leading-relaxed text-white/60">
        <strong className="text-white">{title}</strong> {body}
      </span>
    </li>
  );
}

function ChatBubble({
  inbound,
  sender,
  text,
  time,
}: {
  inbound?: boolean;
  sender: string;
  text: string;
  time: string;
}) {
  return (
    <div className={classNames("flex gap-2.5 sm:gap-3", !inbound && "flex-row-reverse")}>
      <div
        className={classNames(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white",
          inbound ? "bg-violet-400" : "bg-slate-600",
        )}
      >
        {inbound ? "R" : "J"}
      </div>
      <div className="max-w-[82%] sm:max-w-[78%]">
        <div
          className={classNames(
            "rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3",
            inbound
              ? "border-gray-200 bg-white rounded-bl-md"
              : "border-teal-700/30 bg-teal-600 text-white rounded-br-md",
          )}
        >
          <div
            className={classNames(
              "text-xs font-extrabold",
              inbound ? "text-slate-500" : "text-white/80",
            )}
          >
            {sender}
          </div>
          <div
            className={classNames(
              "mt-1 text-sm leading-relaxed",
              inbound ? "text-slate-900" : "text-white",
            )}
          >
            {text}
          </div>
        </div>
        <div
          className={classNames(
            "mt-1 text-xs font-semibold",
            inbound ? "text-slate-500" : "text-slate-400 text-right",
          )}
        >
          {time}
        </div>
      </div>
    </div>
  );
}

export function Messaging() {
  const initial = useMemo(
    () =>
      [
        {
          id: "m1",
          inbound: true,
          sender: "Rosa · Urban Health Plan",
          text: "Hi James, I received your request. How can I help you and your son today?",
          time: "2:08 PM",
        },
        {
          id: "m2",
          inbound: false,
          sender: "James",
          text: "Hi Rosa. My son is 7 and hasn't had a checkup in over a year. We don't have insurance and I wasn't sure where to go.",
          time: "2:11 PM",
        },
        {
          id: "m3",
          inbound: true,
          sender: "Rosa · Urban Health Plan",
          text: "You came to the right place. We offer free pediatric care regardless of insurance. I have an opening this Friday at 11am at our East Harlem clinic on 116th St. Want me to book it?",
          time: "2:14 PM",
        },
      ] as const,
    [],
  );

  const [m1Typed, setM1Typed] = useState("");
  const [m2Typed, setM2Typed] = useState("");
  const [m3Typed, setM3Typed] = useState("");
  const [showM2, setShowM2] = useState(false);
  const [showM3, setShowM3] = useState(false);
  const [showT1, setShowT1] = useState(false);
  const [draft, setDraft] = useState("");
  const intervalsRef = useRef<Array<number>>([]);
  const timeoutsRef = useRef<Array<number>>([]);

  const clearTimers = () => {
    intervalsRef.current.forEach((t) => window.clearInterval(t));
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    intervalsRef.current = [];
    timeoutsRef.current = [];
  };

  useEffect(() => {
    const m1 = initial[0];
    const m2 = initial[1];
    const m3 = initial[2];

    const after = (ms: number, fn: () => void) => {
      timeoutsRef.current.push(window.setTimeout(fn, ms));
    };

    const typeText = (
      full: string,
      speedMs: number,
      set: (v: string) => void,
      done?: () => void,
    ) => {
      let i = 0;
      set("");
      const iv = window.setInterval(() => {
        i += 1;
        set(full.slice(0, i));
        if (i >= full.length) {
          window.clearInterval(iv);
          if (done) done();
        }
      }, speedMs);
      intervalsRef.current.push(iv);
    };

    const reset = () => {
      clearTimers();
      setM1Typed("");
      setM2Typed("");
      setM3Typed("");
      setShowM2(false);
      setShowM3(false);
      setShowT1(false);
    };

    const run = () => {
      reset();
      typeText(m1.text, 28, setM1Typed, () => {
        setShowT1(true);
        after(800, () => {
          setShowM2(true);
          after(300, () => {
            typeText(m2.text, 22, setM2Typed, () => {
              after(800, () => {
                setShowM3(true);
                after(300, () => {
                  typeText(m3.text, 22, setM3Typed, () => {
                    after(3000, run);
                  });
                });
              });
            });
          });
        });
      });
    };

    const startTimer = window.setTimeout(run, 600);
    timeoutsRef.current.push(startTimer);
    return () => clearTimers();
  }, [initial]);

  const send = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setDraft("");
  };

  return (
    <section id="mission" className="bg-[#1a3048] px-4 py-14 sm:py-20 md:px-12">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-10 sm:gap-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:gap-20">
        {/* Left: copy */}
        <div className="space-y-5 sm:space-y-6">
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-300">
            Real connections
          </div>
          <h2 className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-[44px]">
            You're not navigating this alone.
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-white/55 sm:text-[16px]">
            Every request reaches a real person at a verified organization —
            ready to help.
          </p>
          <ul className="space-y-3 pt-2">
            <TrustItem icon={Clock} title="Same-day responses" body="from verified caseworkers" />
            <TrustItem icon={MessageSquare} title="Direct messaging" body="— no phone tag, no hold music" />
            <TrustItem icon={ShieldCheck} title="Verified organizations" body="— every CBO is reviewed before joining" />
          </ul>
        </div>

        {/* Right: chat widget */}
        <div className="rounded-3xl border border-white/8 bg-white/4 p-1.5 sm:p-2">
          <div className="rounded-2xl bg-slate-50 p-4 sm:p-6">
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-gray-200 pb-3 sm:pb-4">
              <div className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-400 text-sm font-extrabold text-white sm:h-10 sm:w-10">
                R
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-50 bg-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-extrabold text-slate-900">
                  Rosa T. — Patient Navigator
                </div>
                <div className="truncate text-xs font-medium text-slate-500">
                  Urban Health Plan · East Harlem
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-extrabold text-teal-800 sm:px-3">
                Verified
              </span>
            </div>

            {/* Messages */}
            <div className="flex h-[340px] flex-col gap-3 overflow-hidden pt-4 sm:h-[420px] lg:h-[480px]">
              <ChatBubble inbound sender={initial[0].sender} text={m1Typed} time={initial[0].time} />
              <div className={classNames("transition-all duration-300", showT1 ? "opacity-100" : "opacity-0")}>
                <div className="mt-[-10px]" />
              </div>
              <div className={classNames("transition-all duration-300", showM2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5")}>
                <ChatBubble inbound={false} sender={initial[1].sender} text={m2Typed} time={initial[1].time} />
              </div>
              <div className={classNames("transition-all duration-300", showM3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5")}>
                <ChatBubble inbound sender={initial[2].sender} text={m3Typed} time={initial[2].time} />
              </div>
            </div>

            {/* Input */}
            <div className="mt-4 flex items-center gap-2.5 border-t border-gray-200 pt-3 sm:mt-5 sm:gap-3 sm:pt-4">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type a message..."
                className="h-10 flex-1 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              />
              <button
                type="button"
                onClick={send}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white transition hover:bg-teal-700"
                aria-label="Send message"
              >
                <ChevronRight className="h-5 w-5 rotate-[-45deg]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}