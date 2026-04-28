import { BrandMark } from "./BrandMark";

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-extrabold tracking-wide text-slate-900">
        {title}
      </div>
      <div className="space-y-2">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            className="block text-sm font-semibold text-slate-500 hover:text-teal-700"
          >
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white px-4 pt-14 md:px-12">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-10 md:grid-cols-4 md:gap-12">
        <div className="space-y-3 md:col-span-1">
          <div className="flex items-center gap-2">
            <BrandMark className="h-8 w-8" />
            <span className="text-base font-extrabold tracking-tight text-slate-900">
              <span className="text-teal-600">Health</span>
              <span className="text-emerald-500">Powr</span>
            </span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-slate-500">
            Connecting NYC communities to the resources that matter most.
          </p>
        </div>

        <FooterCol
          title="Services"
          links={[
            { label: "Find resources", href: "#top" },
            { label: "Map view", href: "/client" },
            { label: "Emergency help", href: "#how-it-works" },
          ]}
        />
        <FooterCol
          title="Organizations"
          links={[
            { label: "Join network", href: "#for-organizations" },
            { label: "Organization dashboard", href: "/auth?mode=signin" },
            { label: "Schedule a call", href: "#for-organizations" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { label: "Mission", href: "#mission" },
            { label: "Contact", href: "mailto:hello@healthpowr.app" },
            { label: "Privacy policy", href: "#faq" },
            { label: "Terms of service", href: "#faq" },
          ]}
        />
      </div>

      <div className="mt-12 border-t border-gray-100 py-6">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center justify-between gap-2 text-center text-xs font-semibold text-slate-500 md:flex-row md:text-left">
          <span>© 2026 HealthPowr Technologies LLC. All rights reserved.</span>
          <span>New York City</span>
        </div>
      </div>
    </footer>
  );
}

