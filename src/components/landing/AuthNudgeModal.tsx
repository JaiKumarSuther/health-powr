import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Lock, Clock, ArrowLeft, Home, Users, HeartPulse, Briefcase, Scale, GraduationCap, MessageCircle, AlertCircle } from "lucide-react";

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
        padding: "1.5rem",
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
        className="relative bg-white rounded-2xl w-full max-w-[400px] shadow-2xl border border-slate-100 overflow-hidden"
        style={{
          transform: isOpen ? "translateY(0)" : "translateY(12px)",
          transition: "transform 0.28s cubic-bezier(0.34, 1.2, 0.64, 1)",
        }}
      >
        {/* Banner */}
        <div className="flex items-center gap-3 bg-emerald-50 border-b border-emerald-100 px-5 py-4">
          <div className="h-[42px] w-[42px] shrink-0 overflow-hidden rounded-xl bg-white border border-emerald-100">
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
            <div className="truncate text-[11px] font-semibold text-teal-600 uppercase tracking-wide">
              {service?.meta || "Available now"}
            </div>
          </div>
          <div className="rounded-full border border-green-200 bg-white px-2 py-1 text-[10px] font-semibold text-green-700 whitespace-nowrap">
            Saved ✓
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">Almost there</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-400 max-w-[280px]">
            Create a free account to submit your request to <span className="font-bold text-slate-600">{service?.orgName}</span>. Takes about 30 seconds.
          </p>

          <button
            onClick={onSignUp}
            className="mt-6 h-12 w-full rounded-xl bg-teal-600 text-[15px] font-bold text-white transition-colors hover:bg-teal-700 shadow-lg shadow-teal-600/20"
          >
            Create free account →
          </button>

          <div className="my-4 flex w-full items-center gap-3">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">already have an account?</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <button
            onClick={onSignIn}
            className="h-11 w-full rounded-xl border-[1.5px] border-slate-200 bg-white text-sm font-semibold text-slate-900 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            Sign in
          </button>

          {/* Reassurance */}
          <div className="mt-8 flex justify-center gap-5">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-[11px] font-medium text-slate-400">Free forever</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-emerald-500" />
              <span className="text-[11px] font-medium text-slate-400">Private</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-emerald-500" />
              <span className="text-[11px] font-medium text-slate-400">30 seconds</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="w-full border-t border-slate-50 py-4 text-[12px] font-bold text-slate-400 transition-colors hover:text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to results
        </button>
      </div>
    </div>,
    document.body
  );
}
