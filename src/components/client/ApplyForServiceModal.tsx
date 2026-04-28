import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { requestsApi } from "../../api/requests";
import type { ServiceCategory } from "../../lib/types";


// ────────────────────── Types ─────────────────────────────────

export type ApplyServiceTarget = {
  id: string;
  name: string;
  orgName: string;
  location: string;
  distance?: string;
  imageUrl?: string;
  isOpen?: boolean;
  category: string;
};

type UrgencyValue = "urgent" | "this_week" | "exploring";

type Step1Form = {
  situation: string;
  urgency: UrgencyValue | null;
  householdSize: string;
};

type Step2Form = {
  firstName: string;
  lastName: string;
  phone: string;
  borough: string;
  note: string;
};

type Errors<T> = Partial<Record<keyof T, string>>;

// ─── Sub-components ───────────────────────────────────────────────────────────

function TrustRow({ items }: { items: React.ReactNode[] }) {
  return (
    <div className="flex justify-center gap-4 mt-1">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1 text-[11px] text-[#7a9e99]">
          {item}
        </span>
      ))}
    </div>
  );
}

/** Teal-header org card + progress bar */
function OrgProgressCard({
  service,
  step,
}: {
  service: ApplyServiceTarget;
  step: 1 | 2;
}) {
  return (
    <div className="rounded-2xl overflow-hidden mb-6">
      {/* Teal header */}
      <div className="bg-[#0d9b8a] px-4 py-[14px] flex items-center gap-3">
        {service.imageUrl ? (
          <img
            src={service.imageUrl}
            alt={service.name}
            className="w-[42px] h-[42px] rounded-[10px] object-cover flex-shrink-0 border-2 border-white/25"
          />
        ) : (
          <div className="w-[42px] h-[42px] rounded-[10px] bg-white/20 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold text-white leading-tight">
            {service.name}
          </div>
          <div className="text-[11px] text-white/75 font-medium mt-0.5">
            {service.orgName} · {service.location}
          </div>
        </div>
        {service.isOpen && (
          <div className="ml-auto flex-shrink-0 text-[10px] font-bold bg-white/20 text-white border border-white/30 rounded-full px-[10px] py-[3px] whitespace-nowrap">
            Open now
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-white px-4 py-3">
        <div className="flex justify-between mb-[7px]">
          <span
            className={`text-[11px] font-semibold ${
              step === 1 ? "text-[#0d9b8a]" : "text-[#7a9e99]"
            }`}
          >
            Step 1 — Your request
          </span>
          <span
            className={`text-[11px] font-semibold ${
              step === 2 ? "text-[#0d9b8a]" : "text-[#7a9e99]"
            }`}
          >
            Step 2 — Contact info
          </span>
        </div>
        <div className="h-1 bg-[#e8f0ee] rounded-sm overflow-hidden">
          <div
            className="h-full bg-[#0d9b8a] rounded-sm transition-all duration-300"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>
      </div>
    </div>
  );
}

/** Urgency radio card */
function UrgencyOption({
  value,
  label,
  sub,
  selected,
  onSelect,
}: {
  value: UrgencyValue;
  label: string;
  sub: string;
  selected: boolean;
  onSelect: (v: UrgencyValue) => void;
}) {
  return (
    <label
      onClick={() => onSelect(value)}
      className={`flex items-center gap-3 px-[14px] py-3 border-[1.5px] rounded-[10px] cursor-pointer transition-all duration-150 ${
        selected
          ? "border-[#0d9b8a] bg-[#e1f5ee]"
          : "border-[#c8e4dc] hover:border-[#c2e8e0] hover:bg-[#e1f5ee]"
      }`}
    >
      <input type="radio" name="urgency" value={value} className="hidden" readOnly />
      {/* Custom radio dot */}
      <div
        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-150 ${
          selected ? "border-[#0d9b8a] bg-[#0d9b8a]" : "border-[#c8e4dc]"
        }`}
      >
        {selected && (
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
        )}
      </div>
      <div>
        <div className="text-[13px] font-semibold text-[#0f1f2e]">{label}</div>
        <div className="text-[11px] text-[#7a9e99] mt-px">{sub}</div>
      </div>
    </label>
  );
}

/** Small inline SVG icon for trust / success rows */
function InlineIcon({ d, isCircle }: { d?: string; isCircle?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="w-[11px] h-[11px] text-[#0d9b8a]"
      style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }}
    >
      {isCircle ? (
        <>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v3l2 2" />
        </>
      ) : (
        <path d={d} />
      )}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ApplyForServiceModal({
  service,
  onClose,
  onGoToApplications,
  onGoToServices,
}: {
  service: ApplyServiceTarget;
  onClose: () => void;
  onGoToApplications: () => void;
  onGoToServices: () => void;
}) {
  const { user } = useAuth();
  const modalRef = useRef<HTMLDivElement | null>(null);

  const scrollToTop = () => {
    modalRef.current?.scrollTo({ top: 0 });
  };

  // Screen state
  type Screen = "step1" | "step2" | "success";
  const [screen, setScreen] = useState<Screen>("step1");
  const [loading, setLoading] = useState(false);

  // Step 1
  const [step1, setStep1] = useState<Step1Form>({
    situation: "",
    urgency: null,
    householdSize: "",
  });
  const [errors1, setErrors1] = useState<Errors<Step1Form>>({});

  // Step 2
  const [step2, setStep2] = useState<Step2Form>({
    firstName: "",
    lastName: "",
    phone: "",
    borough: "",
    note: "",
  });
  const [errors2, setErrors2] = useState<Errors<Step2Form>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Borough list from Supabase
  const [boroughs, setBoroughs] = useState<string[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase
      .from("boroughs")
      .select("name")
      .order("name")
      .then(({ data }) => {
        setBoroughs((data || []).map((b: { name: string }) => b.name));
      });

    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const full = String((data as any).full_name ?? "").trim();
        const parts = full ? full.split(/\s+/) : [];
        const first = parts.length > 0 ? parts[0] : "";
        const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
        setStep2((p) => ({
          ...p,
          firstName: p.firstName || first,
          lastName: p.lastName || last,
          phone: p.phone || String((data as any).phone ?? ""),
        }));
      });
  }, [user]);

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateStep1(): boolean {
    const e: Errors<Step1Form> = {};
    if (!step1.situation.trim()) e.situation = "Please describe your situation briefly.";
    if (!step1.urgency) e.urgency = "Please select how soon you need help.";
    setErrors1(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: Errors<Step2Form> = {};
    if (!step2.firstName.trim()) e.firstName = "Required";
    if (!step2.lastName.trim()) e.lastName = "Required";
    const digits = step2.phone.replace(/\D/g, "");
    if (!step2.phone || digits.length < 10) e.phone = "Please enter a valid phone number.";
    if (!step2.borough) e.borough = "Please select your borough.";
    setErrors2(e);
    return Object.keys(e).length === 0;
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleContinue() {
    if (validateStep1()) {
      setScreen("step2");
      scrollToTop();
    }
  }

  async function handleSubmit() {
    if (!validateStep2()) return;
    try {
      setLoading(true);
      setSubmitError(null);
      await requestsApi.create({
        category: service.category as ServiceCategory,
        borough: step2.borough,
        description: step1.situation,
        service_id: service.id,
        metadata: {
          urgency: step1.urgency,
          household_size: step1.householdSize || null,
          first_name: step2.firstName,
          last_name: step2.lastName,
          phone: step2.phone,
          note: step2.note || null,
        },
      });
      setScreen("success");
      scrollToTop();
    } catch {
      setSubmitError("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handlePhoneInput(raw: string) {
    const digits = raw.replace(/\D/g, "");
    let formatted = digits;
    if (digits.length >= 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    } else if (digits.length >= 3) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    setStep2((p) => ({ ...p, phone: formatted }));
  }

  function handleBack() {
    if (screen === "step2") {
      setScreen("step1");
      scrollToTop();
    } else {
      onClose();
    }
  }

  // ── Shared class helpers ─────────────────────────────────────────────────────

  const inputBase =
    "w-full border-[1.5px] border-[#c8e4dc] rounded-[10px] px-[14px] py-[11px] text-sm text-[#0f1f2e] font-[Inter,sans-serif] outline-none bg-white transition-colors duration-150 placeholder:text-[#bbb] focus:border-[#0d9b8a] focus:shadow-[0_0_0_3px_rgba(13,155,138,0.1)]";
  const inputError = "!border-[#dc2626]";
  const fieldErrorMsg = "text-[11px] text-[#dc2626] mt-1";
  const fieldLabel = "block text-[13px] font-semibold text-[#0f1f2e] mb-1.5";

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999] p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto font-[Inter,sans-serif]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-lg text-[#7a9e99] hover:text-[#0f1f2e] hover:bg-[#f6faf8] transition-colors"
          aria-label="Close"
        >
          <svg
            viewBox="0 0 16 16"
            className="w-4 h-4"
            style={{
              stroke: "currentColor",
              fill: "none",
              strokeWidth: 1.5,
              strokeLinecap: "round",
              strokeLinejoin: "round",
            }}
          >
            <path d="M4 4l8 8" />
            <path d="M12 4l-8 8" />
          </svg>
        </button>

        <div className="px-5 py-5">
          {screen === "success" && (
            <div className="max-w-[480px] mx-auto py-12 text-center">
          {/* Green check icon */}
          <div className="w-[72px] h-[72px] rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-6">
            <svg
              viewBox="0 0 16 16"
              className="w-8 h-8 text-[#15803d]"
              style={{ stroke: "currentColor", fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}
            >
              <path d="M2 8l4 4 8-8" />
            </svg>
          </div>

          <div className="text-[26px] font-extrabold text-[#0f1f2e] tracking-[-0.5px] mb-2.5">
            Request sent
          </div>
          <div className="text-[15px] text-[#7a9e99] leading-relaxed max-w-[340px] mx-auto mb-8">
            {service.orgName} will reach out to confirm your pickup time. You&apos;ll get a message through HealthPowr.
          </div>

          {/* What happens next card */}
          <div className="bg-white border border-[#e8f0ee] rounded-[14px] p-4 text-left mb-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#7a9e99] mb-3">
              What happens next
            </div>

            {[
              {
                icon: (
                  <svg viewBox="0 0 16 16" className="w-[13px] h-[13px] text-[#0d9b8a]" style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.5, strokeLinecap: "round" }}>
                    <circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 2" />
                  </svg>
                ),
                text: (
                  <>
                    <strong className="text-[#0f1f2e] font-semibold">Usually within a few hours</strong>
                    {" — a caseworker reviews your request"}
                  </>
                ),
              },
              {
                icon: (
                  <svg viewBox="0 0 16 16" className="w-[13px] h-[13px] text-[#0d9b8a]" style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.5, strokeLinecap: "round" }}>
                    <path d="M12 3H4a1 1 0 00-1 1v7a1 1 0 001 1h2l2 2 2-2h2a1 1 0 001-1V4a1 1 0 00-1-1z" />
                  </svg>
                ),
                text: (
                  <>
                    You&apos;ll get a <strong className="text-[#0f1f2e] font-semibold">message here</strong> confirming your pickup time
                  </>
                ),
              },
              {
                icon: (
                  <svg viewBox="0 0 16 16" className="w-[13px] h-[13px] text-[#0d9b8a]" style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.5, strokeLinecap: "round" }}>
                    <path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z" />
                  </svg>
                ),
                text: (
                  <>
                    <strong className="text-[#0f1f2e] font-semibold">{service.name}</strong>
                    {" · "}
                    {service.location}
                    {service.distance ? ` · ${service.distance}` : ""}
                  </>
                ),
              },
            ].map((row, i, arr) => (
              <div
                key={i}
                className={`flex items-center gap-2.5 py-2 ${i < arr.length - 1 ? "border-b border-[#e8f0ee]" : ""}`}
              >
                <div className="w-7 h-7 rounded-[7px] bg-[#e1f5ee] flex items-center justify-center flex-shrink-0">
                  {row.icon}
                </div>
                <div className="text-[13px] text-[#4b6b65]">{row.text}</div>
              </div>
            ))}
          </div>

          <button
            onClick={onGoToApplications}
            className="w-full h-12 bg-[#0d9b8a] hover:bg-[#0b8a7a] text-white border-none rounded-[12px] text-[15px] font-bold cursor-pointer mb-2.5 transition-colors"
          >
            View my requests
          </button>
          <button
            onClick={onGoToServices}
            className="w-full h-11 bg-transparent text-[#7a9e99] border-none text-[14px] font-semibold cursor-pointer"
          >
            Find more resources
          </button>
        </div>
          )}

          {screen === "step1" && (
            <div className="max-w-[560px] mx-auto pt-8">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 text-[12px] font-semibold text-[#7a9e99] hover:text-[#0d9b8a] mb-3 bg-transparent border-none cursor-pointer transition-colors"
          >
            ← Back to results
          </button>
          <OrgProgressCard service={service} step={1} />

          {/* Form card */}
          <div className="bg-white rounded-2xl px-6 py-7">
            <div className="text-[20px] font-extrabold text-[#0f1f2e] tracking-[-0.3px] mb-1">
              Tell them about your situation
            </div>
            <div className="text-sm text-[#7a9e99] leading-relaxed mb-6">
              This goes directly to a caseworker at {service.orgName}. Be as brief or detailed as you&apos;d like.
            </div>

            {/* Situation */}
            <div className="mb-[18px]">
              <label className={fieldLabel}>
                What do you need help with?{" "}
                <span className="text-[#dc2626]">*</span>
              </label>
              <textarea
                rows={4}
                value={step1.situation}
                onChange={(e) => {
                  setStep1((p) => ({ ...p, situation: e.target.value }));
                  if (errors1.situation) setErrors1((p) => ({ ...p, situation: undefined }));
                }}
                placeholder="e.g. I lost my job last month and need food for my family of 3. We're struggling this week."
                className={`${inputBase} resize-none leading-relaxed ${errors1.situation ? inputError : ""}`}
              />
              {errors1.situation && (
                <p className={fieldErrorMsg}>{errors1.situation}</p>
              )}
            </div>

            {/* Urgency */}
            <div className="mb-[18px]">
              <label className={fieldLabel}>
                How soon do you need help?{" "}
                <span className="text-[#dc2626]">*</span>
              </label>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { value: "urgent", label: "As soon as possible", sub: "I need help within the next few days" },
                    { value: "this_week", label: "This week", sub: "I need help sometime this week" },
                    { value: "exploring", label: "Just exploring options", sub: "No immediate urgency" },
                  ] as const
                ).map((opt) => (
                  <UrgencyOption
                    key={opt.value}
                    value={opt.value}
                    label={opt.label}
                    sub={opt.sub}
                    selected={step1.urgency === opt.value}
                    onSelect={(v) => {
                      setStep1((p) => ({ ...p, urgency: v }));
                      if (errors1.urgency) setErrors1((p) => ({ ...p, urgency: undefined }));
                    }}
                  />
                ))}
              </div>
              {errors1.urgency && (
                <p className={fieldErrorMsg}>{errors1.urgency}</p>
              )}
            </div>

            {/* Household size */}
            <div>
              <label className={fieldLabel}>Household size</label>
              <select
                value={step1.householdSize}
                onChange={(e) => setStep1((p) => ({ ...p, householdSize: e.target.value }))}
                className={`${inputBase} appearance-none cursor-pointer`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none' stroke='%237a9e99' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 14px center",
                  paddingRight: "36px",
                }}
              >
                <option value="">Select...</option>
                <option value="1">Just me</option>
                <option value="2">2 people</option>
                <option value="3">3 people</option>
                <option value="4">4 people</option>
                <option value="5+">5 or more</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={handleContinue}
              className="w-full h-12 bg-[#0d9b8a] hover:bg-[#0b8a7a] text-white border-none rounded-[12px] text-[15px] font-bold cursor-pointer flex items-center justify-center gap-2 transition-colors"
            >
              Continue
              <svg viewBox="0 0 16 16" className="w-4 h-4" style={{ stroke: "white", fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
            <TrustRow
              items={[
                <><InlineIcon isCircle /> 30 seconds</>,
                <><InlineIcon d="M3 7h10a1 1 0 010 8H3a1 1 0 010-8zM5 7V5a3 3 0 016 0v2" /> Private</>,
                <><InlineIcon d="M2 8l4 4 8-8" /> Free forever</>,
              ]}
            />
          </div>
        </div>
          )}

          {screen === "step2" && (
            <div className="max-w-[560px] mx-auto pt-8">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1 text-[12px] font-semibold text-[#7a9e99] hover:text-[#0d9b8a] mb-3 bg-transparent border-none cursor-pointer transition-colors"
        >
          ← Back to results
        </button>
        <OrgProgressCard service={service} step={2} />

        {/* Form card */}
        <div className="bg-white rounded-2xl px-6 py-7">
          <div className="text-[20px] font-extrabold text-[#0f1f2e] tracking-[-0.3px] mb-1">
            How can they reach you?
          </div>
          <div className="text-sm text-[#7a9e99] leading-relaxed mb-6">
            {service.orgName} will use this to confirm your request and schedule a pickup time.
          </div>

          {/* Autofill notice */}
          <div className="flex items-center gap-2 bg-[#e1f5ee] border border-[#c2e8e0] rounded-[10px] px-3 py-2.5 mb-[18px]">
            <svg viewBox="0 0 16 16" className="w-[14px] h-[14px] text-[#0d9b8a] flex-shrink-0" style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.5, strokeLinecap: "round" }}>
              <circle cx="8" cy="8" r="6" /><path d="M8 7v1M8 11h0" />
            </svg>
            <span className="text-[12px] text-[#4b6b65]">
              We filled in some details from your profile. Review and update if needed.
            </span>
          </div>

          {/* First / Last name */}
          <div className="grid grid-cols-2 gap-3 mb-[18px]">
            <div>
              <label className={fieldLabel}>
                First name <span className="text-[#dc2626]">*</span>
              </label>
              <input
                type="text"
                value={step2.firstName}
                onChange={(e) => {
                  setStep2((p) => ({ ...p, firstName: e.target.value }));
                  if (errors2.firstName) setErrors2((p) => ({ ...p, firstName: undefined }));
                }}
                placeholder="First name"
                className={`${inputBase} ${errors2.firstName ? inputError : ""}`}
              />
              {errors2.firstName && <p className={fieldErrorMsg}>{errors2.firstName}</p>}
            </div>
            <div>
              <label className={fieldLabel}>
                Last name <span className="text-[#dc2626]">*</span>
              </label>
              <input
                type="text"
                value={step2.lastName}
                onChange={(e) => {
                  setStep2((p) => ({ ...p, lastName: e.target.value }));
                  if (errors2.lastName) setErrors2((p) => ({ ...p, lastName: undefined }));
                }}
                placeholder="Last name"
                className={`${inputBase} ${errors2.lastName ? inputError : ""}`}
              />
              {errors2.lastName && <p className={fieldErrorMsg}>{errors2.lastName}</p>}
            </div>
          </div>

          {/* Phone */}
          <div className="mb-[18px]">
            <label className={fieldLabel}>
              Phone number <span className="text-[#dc2626]">*</span>
            </label>
            <input
              type="tel"
              value={step2.phone}
              onChange={(e) => {
                handlePhoneInput(e.target.value);
                if (errors2.phone) setErrors2((p) => ({ ...p, phone: undefined }));
              }}
              placeholder="(718) 555-0100"
              className={`${inputBase} ${errors2.phone ? inputError : ""}`}
            />
            {!errors2.phone && (
              <p className="text-[11px] text-[#7a9e99] mt-1">
                {service.orgName} will use this to confirm your appointment.
              </p>
            )}
            {errors2.phone && <p className={fieldErrorMsg}>{errors2.phone}</p>}
          </div>

          {/* Borough */}
          <div className="mb-[18px]">
            <label className={fieldLabel}>
              Your borough <span className="text-[#dc2626]">*</span>
            </label>
            <select
              value={step2.borough}
              onChange={(e) => {
                setStep2((p) => ({ ...p, borough: e.target.value }));
                if (errors2.borough) setErrors2((p) => ({ ...p, borough: undefined }));
              }}
              disabled={boroughs.length === 0}
              className={`${inputBase} appearance-none cursor-pointer ${errors2.borough ? inputError : ""} ${boroughs.length === 0 ? "opacity-60 cursor-not-allowed" : ""}`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none' stroke='%237a9e99' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 14px center",
                paddingRight: "36px",
              }}
            >
              {boroughs.length === 0 ? (
                <option value="">Loading...</option>
              ) : (
                <>
                  <option value="">Select your borough</option>
                  {boroughs.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </>
              )}
            </select>
            {errors2.borough && <p className={fieldErrorMsg}>{errors2.borough}</p>}
          </div>

          {/* Optional note */}
          <div>
            <label className={`${fieldLabel} flex items-center justify-between`}>
              Anything else to add?
              <span className="text-[11px] font-medium text-[#7a9e99]">Optional</span>
            </label>
            <input
              type="text"
              value={step2.note}
              onChange={(e) => setStep2((p) => ({ ...p, note: e.target.value }))}
              placeholder="e.g. I speak Spanish, or I have a mobility limitation"
              className={inputBase}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-12 bg-[#0d9b8a] hover:bg-[#0b8a7a] disabled:opacity-50 text-white border-none rounded-[12px] text-[15px] font-bold cursor-pointer flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? "Submitting…" : "Submit request →"}
          </button>
          {submitError && (
            <p className="text-[11px] text-[#dc2626] text-center">{submitError}</p>
          )}
          <button
            onClick={() => {
              setScreen("step1");
              scrollToTop();
            }}
            className="w-full h-11 bg-white text-[#0f1f2e] border-[1.5px] border-[#e8f0ee] hover:border-[#c8e4dc] rounded-[12px] text-sm font-semibold cursor-pointer transition-all"
          >
            ← Back
          </button>
          <p className="text-[11px] text-[#7a9e99] text-center mt-[-4px]">
            Free · Private · No spam
          </p>
        </div>
      </div>
          )}
        </div>
      </div>
    </div>
  );
}