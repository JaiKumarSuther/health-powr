import { Inbox, TrendingUp, GitMerge } from "lucide-react";
import { classNames } from "./utils";

function OrgFeature({
  title,
  desc,
  icon: Icon,
}: {
  title: string;
  desc: string;
  icon: React.ElementType;
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

// ─── Dashboard sub-components ────────────────────────────────────────────────

function StatCard({
  value,
  tag,
  tagColor,
  label,
  sparkline,
}: {
  value: string;
  tag: string;
  tagColor: "teal" | "amber" | "muted";
  label: string;
  sparkline?: React.ReactNode;
}) {
  const tagCls =
    tagColor === "teal"
      ? "text-teal-600"
      : tagColor === "amber"
        ? "text-amber-600"
        : "text-slate-400";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between">
        <div className="text-xl font-extrabold tracking-tight text-slate-900">
          {value}
        </div>
        <div className={classNames("text-[9px] font-bold whitespace-nowrap", tagCls)}>
          {tag}
        </div>
      </div>
      <div className="mt-1 text-[10px] font-semibold text-slate-400">{label}</div>
      {sparkline && <div className="mt-2">{sparkline}</div>}
    </div>
  );
}

function Sparkline({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 80 18" fill="none" className="w-full h-[18px]">
      <path d={path} stroke="#93c5fd" strokeWidth="1.5" fill="none" />
      <path d={`${path} L80 18 L0 18Z`} fill="rgba(147,197,253,0.2)" />
    </svg>
  );
}

function DashTab({
  label,
  count,
  active,
}: {
  label: string;
  count?: number;
  active?: boolean;
}) {
  return (
    <div
      className={classNames(
        "flex shrink-0 items-center gap-1 border-b-2 pb-2 text-[9px] font-bold",
        active
          ? "border-teal-600 text-teal-600"
          : "border-transparent text-slate-400",
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={classNames(
            "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-extrabold",
            active
              ? "bg-teal-100 text-teal-700"
              : "bg-slate-100 text-slate-400",
          )}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function InboxRow({
  initials,
  avatarBg,
  accentColor,
  name,
  meta,
  urgentTag,
  time,
}: {
  initials: string;
  avatarBg: string;
  accentColor: string; // Tailwind border-l color e.g. "border-teal-500"
  name: string;
  meta: string;
  urgentTag?: boolean;
  time: string;
}) {
  return (
    <div
      className={classNames(
        "flex items-center gap-2 border-b border-gray-100 border-l-[3px] px-3 py-2 last:border-b-0",
        accentColor,
      )}
    >
      <div
        className={classNames(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-extrabold text-white",
          avatarBg,
        )}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold text-slate-900">{name}</div>
        <div className="truncate text-[8.5px] text-slate-400">
          {meta}
          {urgentTag && (
            <span className="ml-1 font-bold text-amber-500">· 48h+</span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-[8.5px] text-slate-400">{time}</div>
    </div>
  );
}

function ActivityItem({
  dotColor,
  children,
  time,
}: {
  dotColor: string;
  children: React.ReactNode;
  time: string;
}) {
  return (
    <div className="flex items-start gap-2 border-b border-gray-100 py-2 last:border-b-0">
      <div
        className={classNames(
          "mt-1 h-2 w-2 shrink-0 rounded-full",
          dotColor,
        )}
      />
      <div>
        <div className="text-[9px] leading-snug text-slate-700">{children}</div>
        <div className="mt-0.5 text-[8px] text-slate-400">{time}</div>
      </div>
    </div>
  );
}

// ─── Main dashboard visual ────────────────────────────────────────────────────

function OrgDashboard() {
  return (
    <div className="rounded-3xl border border-gray-200 bg-slate-50 p-2 shadow-[0_18px_50px_rgba(2,6,23,0.08)]">
      <div className="overflow-hidden rounded-2xl bg-slate-50">

        {/* Header */}
        <div className="flex items-start justify-between bg-slate-50 px-4 py-3">
          <div>
            <div className="text-[17px] font-extrabold tracking-tight text-slate-900">
              Overview
            </div>
            <div className="text-[10px] text-slate-400">Monday, April 21, 2026</div>
          </div>
          <button className="rounded-full bg-teal-600 px-3 py-1.5 text-[10px] font-bold text-white">
            + New announcement
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-1.5 px-3">
          <StatCard value="7" tag="+3 today" tagColor="muted" label="Unopened" />
          <StatCard value="3" tag="⚠ needs action" tagColor="amber" label="Urgent requests" />
          <StatCard
            value="2.4h"
            tag="↓ improving"
            tagColor="teal"
            label="Avg. response"
            sparkline={<Sparkline path="M0 14 Q20 10,40 12 Q60 14,80 6" />}
          />
          <StatCard
            value="91%"
            tag="+2% this week"
            tagColor="teal"
            label="Resolution rate"
            sparkline={<Sparkline path="M0 12 Q20 14,40 11 Q60 8,80 10" />}
          />
        </div>

        {/* Alert banner */}
        <div className="mx-3 mt-2 flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5">
          <div className="flex items-center gap-2 text-[9.5px] font-semibold text-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            3 requests haven't been opened in over 48 hours
          </div>
          <span className="text-[9px] font-bold text-amber-600">Dismiss</span>
        </div>

        {/* Body: inbox + team activity */}
        <div className="mt-2 grid grid-cols-[1fr_0.65fr] gap-2 px-3 pb-3">

          {/* Request inbox */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-3 pt-2.5">
              <div className="text-[11px] font-extrabold text-slate-900">Request inbox</div>
              <div className="text-[9px] font-bold text-teal-600">View all →</div>
            </div>

            {/* Tabs */}
            <div className="mt-1.5 flex gap-3 overflow-x-auto border-b border-gray-100 px-3">
              <DashTab label="Unopened" count={7} active />
              <DashTab label="Opened" count={4} />
              <DashTab label="In Progress" count={8} />
              <DashTab label="Responded" count={5} />
              <DashTab label="Urgent" count={3} />
              <DashTab label="All" />
            </div>

            {/* Hint */}
            <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-1.5 text-[8.5px] text-slate-400">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-slate-300" />
              <strong className="text-slate-600">Unopened</strong> — submitted by the client, not yet viewed by anyone on your team
            </div>

            {/* Rows */}
            <InboxRow initials="JR" avatarBg="bg-teal-600" accentColor="border-l-teal-500" name="James Rivera" meta='Healthcare · East Harlem · "Need doctor for my son, no insurance"' time="14 min ago" />
            <InboxRow initials="DM" avatarBg="bg-amber-500" accentColor="border-l-amber-500" name="Denise Morris" meta='Housing · South Bronx · "Facing eviction next week, two kids"' urgentTag time="3 days ago" />
            <InboxRow initials="SP" avatarBg="bg-violet-500" accentColor="border-l-teal-500" name="Sandra Perez" meta='Food access · Mott Haven · "Family of 4, lost job last month"' time="1 hr ago" />
            <InboxRow initials="KJ" avatarBg="bg-teal-700" accentColor="border-l-amber-500" name="Kevin Johnson" meta='Food access · Fordham · "Need groceries this week"' urgentTag time="2 days ago" />

            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[8.5px] text-slate-400">Showing 4 of 7 unopened</span>
              <span className="text-[8.5px] font-bold text-teal-600">View all →</span>
            </div>
          </div>

          {/* Team activity */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white px-3 py-2.5">
            <div className="mb-2 text-[11px] font-extrabold text-slate-900">Team activity</div>
            <ActivityItem dotColor="bg-teal-500" time="9 minutes ago">
              <strong>Carlos M.</strong> responded to James Rivera's request
            </ActivityItem>
            <ActivityItem dotColor="bg-blue-500" time="1 hour ago">
              <strong>Rosa T.</strong> opened Tanya Williams · Employment
            </ActivityItem>
            <ActivityItem dotColor="bg-amber-400" time="1 hour ago">
              <strong>You</strong> flagged Denise Morris as Urgent
            </ActivityItem>
            <ActivityItem dotColor="bg-teal-500" time="Yesterday, 4:12 PM">
              <strong>Carlos M.</strong> closed Marcus Greene's case
            </ActivityItem>
            <ActivityItem dotColor="bg-teal-500" time="Yesterday, 2:30 PM">
              <strong>Rosa T.</strong> added case notes to Ana Lebron
            </ActivityItem>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Section export ───────────────────────────────────────────────────────────

export function ForOrganizations({ onIntro }: { onIntro: () => void }) {
  return (
    <section
      id="for-organizations"
      className="border-y border-gray-100 bg-slate-50 px-4 py-24 md:px-12"
    >
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-start gap-14 md:grid-cols-2 md:gap-16">
        {/* Left: copy + features */}
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

        {/* Right: dashboard visual */}
        <OrgDashboard />
      </div>
    </section>
  );
}