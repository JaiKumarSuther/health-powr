import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Lock,
  Clock,
  ArrowLeft,
  Home,
  Users,
  HeartPulse,
  Briefcase,
  Scale,
  GraduationCap,
  MessageCircle,
  AlertCircle,
} from "lucide-react";

interface AuthNudgeModalProps {
  isOpen: boolean;
  service: { name: string; orgName: string; photoUrl?: string; meta: string; category?: string } | null;
  onClose: () => void;
  onSignUp: () => void;
  onSignIn: () => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  housing: Home,
  food: Users,
  healthcare: HeartPulse,
  job_training: Briefcase,
  legal: Scale,
  education: GraduationCap,
  community: MessageCircle,
};

export function AuthNudgeModal({
  isOpen,
  service,
  onClose,
  onSignUp,
  onSignIn,
}: AuthNudgeModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        backgroundColor: "rgba(15, 23, 42, 0.3)",
        backdropFilter: "blur(2px)",
        pointerEvents: isOpen ? "all" : "none",
        visibility: isOpen ? "visible" : "hidden",
        opacity: isOpen ? 1 : 0,
        transition: "opacity 0.22s ease",
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Card */}
      <div
        className="relative w-full max-w-[400px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
        style={{
          transform: isOpen ? "translateY(0)" : "translateY(12px)",
          transition: "transform 0.28s cubic-bezier(0.34, 1.2, 0.64, 1)",
        }}
      >
        {/* Banner */}
        <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="h-[42px] w-[42px] shrink-0 overflow-hidden rounded-xl border border-emerald-100 bg-white">
            {service?.photoUrl ? (
              <img src={service.photoUrl} alt={service.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-teal-50 text-teal-600">
                {service?.category && CATEGORY_ICONS[service.category] ? (
                  (() => {
                    const Icon = CATEGORY_ICONS[service.category!];
                    return <Icon className="h-6 w-6" />;
                  })()
                ) : (
                  <AlertCircle className="h-6 w-6" />
                )}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-slate-900">{service?.name}</div>
            <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-teal-600">
              {service?.meta || "Available now"}
            </div>
          </div>
          <div className="shrink-0 rounded-full border border-green-200 bg-white px-2 py-1 text-[10px] font-semibold text-green-700 whitespace-nowrap">
            Saved ✓
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center px-5 py-7 text-center sm:px-6 sm:py-8">
          <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">Almost there</h3>
          <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-slate-400">
            Create a free account to submit your request to{" "}
            <span className="font-bold text-slate-600">{service?.orgName}</span>. Takes about 30 seconds.
          </p>

          <button
            onClick={onSignUp}
            className="mt-6 h-12 w-full rounded-xl bg-teal-600 text-[15px] font-bold text-white shadow-lg shadow-teal-600/20 transition-colors hover:bg-teal-700"
          >
            Create free account →
          </button>

          <div className="my-4 flex w-full items-center gap-3">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
              already have an account?
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <button
            onClick={onSignIn}
            className="h-11 w-full rounded-xl border-[1.5px] border-slate-200 bg-white text-sm font-semibold text-slate-900 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            Sign in
          </button>

          {/* Reassurance */}
          <div className="mt-7 flex flex-wrap justify-center gap-4 sm:mt-8 sm:gap-5">
            {[
              { Icon: CheckCircle2, text: "Free forever" },
              { Icon: Lock, text: "Private" },
              { Icon: Clock, text: "30 seconds" },
            ].map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-emerald-500" />
                <span className="text-[11px] font-medium text-slate-400">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 border-t border-slate-50 py-4 text-[12px] font-bold text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to results
        </button>
      </div>
    </div>,
    document.body
  );
}