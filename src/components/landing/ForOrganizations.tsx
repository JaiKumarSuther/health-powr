import { ChevronRight, Inbox, TrendingUp, GitMerge } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { classNames } from "./utils";

function OrgFeature({ 
  title, 
  desc, 
  icon: Icon 
}: { 
  title: string; 
  desc: string; 
  icon: React.ElementType 
}) {
  return (
    <div className="flex gap-4 p-5">
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
        <div className="mt-1 text-sm leading-relaxed text-slate-500">{desc}</div>
      </div>
    </div>
  );
}

function Metric({
  value,
  delta,
  label,
}: {
  value: string;
  delta?: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-2xl font-extrabold tracking-tight text-slate-900">
        {value}
        {delta ? (
          <sup className="ml-1 text-xs font-extrabold text-teal-700">
            {delta}
          </sup>
        ) : null}
      </div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{label}</div>
    </div>
  );
}

function RequestRow({
  tone,
  name,
  meta,
  badge,
  initials,
  avatarClassName,
  borderClassName,
  badgeClassName,
}: {
  tone: "new" | "urgent" | "done";
  name: string;
  meta: string;
  badge: string;
  initials?: string;
  avatarClassName?: string;
  borderClassName?: string;
  badgeClassName?: string;
}) {
  const left =
    borderClassName
      ? `border-l-4 ${borderClassName}`
      : tone === "urgent"
        ? "border-l-4 border-amber-400"
        : tone === "done"
          ? "border-l-4 border-emerald-500"
          : "border-l-4 border-teal-600";
  const badgeCls =
    badgeClassName
      ? badgeClassName
      : tone === "urgent"
        ? "bg-amber-50 text-amber-800"
        : tone === "done"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-teal-50 text-teal-800";
  return (
    <div
      className={classNames(
        "flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3",
        left,
      )}
    >
      <div
        className={classNames(
          "inline-flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-extrabold text-white",
          avatarClassName ?? "bg-teal-600",
        )}
      >
        {initials ??
          name
            .split(" ")
            .slice(0, 2)
            .map((p) => p[0])
            .join("")}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-extrabold text-slate-900">
          {name}
        </div>
        <div className="truncate text-xs font-medium text-slate-500">{meta}</div>
      </div>
      <span
        className={classNames(
          "rounded-full px-3 py-1 text-[11px] font-extrabold",
          badgeCls,
        )}
      >
        {badge}
      </span>
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-slate-50 text-teal-700">
        <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );
}

export function ForOrganizations({ onIntro }: { onIntro: () => void }) {
  return (
    <section
      id="for-organizations"
      className="border-y border-gray-100 bg-slate-50 px-4 py-24 md:px-12"
    >
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-14 md:grid-cols-2 md:gap-16">
        <div className="space-y-6">
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-700">
            For organizations
          </div>
          <h2 className="text-balance text-4xl font-extrabold tracking-tight text-slate-900 md:text-[42px]">
            Reach more people.
            <br />
            <span className="text-slate-900/90">With less overhead.</span>
          </h2>
          <p className="text-[16px] leading-relaxed text-slate-500">
            Give your team the tools to receive requests, coordinate referrals,
            and track impact — all in one place.
          </p>

          <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
            <OrgFeature
              icon={Inbox}
              title="Centralized request inbox"
              desc="All incoming community requests in one dashboard. No lost emails, no missed calls."
            />
            <OrgFeature
              icon={TrendingUp}
              title="Real-time impact tracking"
              desc="See service demand, response times, and outcomes — data you can use directly in grant reporting."
            />
            <OrgFeature
              icon={GitMerge}
              title="Referral coordination"
              desc="Connect clients to partner organizations directly from your dashboard — no back-and-forth."
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onIntro}
              className="h-12 rounded-full bg-teal-600 px-6 text-sm font-extrabold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
            >
              Schedule an intro call
            </button>
            <button className="h-12 rounded-full border border-gray-200 bg-white px-6 text-sm font-extrabold text-slate-900 transition hover:border-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50">
              Learn more →
            </button>
          </div>
        </div>

        <div className="relative">

        <div className="rounded-3xl border border-gray-200 bg-white p-2 shadow-[0_18px_50px_rgba(2,6,23,0.08)]">
          <div className="rounded-2xl bg-white p-4">
            <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600 text-white">
                <BrandMark className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-extrabold text-slate-900">
                  BronxWorks
                </div>
                <div className="truncate text-xs font-medium text-slate-500">
                  Organization dashboard
                </div>
              </div>
              <div className="hidden gap-1 sm:flex">
                <span className="rounded-lg bg-teal-50 px-3 py-1 text-xs font-extrabold text-teal-800">
                  Requests
                </span>
                <span className="rounded-lg px-3 py-1 text-xs font-extrabold text-slate-400">
                  Referrals
                </span>
                <span className="rounded-lg px-3 py-1 text-xs font-extrabold text-slate-400">
                  Reports
                </span>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Metric value="24" delta="+3" label="Open requests" />
                <Metric value="3.2h" label="Avg. response" />
                <Metric value="91%" label="Resolution rate" />
              </div>

              <div className="text-xs font-extrabold text-slate-900">
                New requests today
              </div>
              <div className="space-y-2">
                <RequestRow
                  tone="new"
                  initials="MR"
                  avatarClassName="bg-teal-500"
                  borderClassName="border-l-teal-500"
                  badgeClassName="bg-teal-50 text-teal-700"
                  name="Maria R."
                  meta="Food · Mott Haven · 2 min ago"
                  badge="New"
                />
                <RequestRow
                  tone="urgent"
                  initials="JT"
                  avatarClassName="bg-amber-500"
                  borderClassName="border-l-amber-500"
                  badgeClassName="bg-amber-50 text-amber-700"
                  name="James T."
                  meta="Housing · South Bronx · 14 min ago"
                  badge="In Review"
                />
                <RequestRow
                  tone="done"
                  initials="RM"
                  avatarClassName="bg-green-500"
                  borderClassName="border-l-green-500"
                  badgeClassName="bg-green-50 text-green-700"
                  name="Rosa M."
                  meta="Healthcare · East Harlem · 1 hr ago"
                  badge="Done"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="text-sm font-semibold text-slate-500">
                Showing 3 of 24 open requests
              </div>
              <button className="text-sm font-extrabold text-teal-700 transition hover:text-teal-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 rounded">
                View all →
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}