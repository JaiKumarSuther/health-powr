  import { useNavigate, useParams } from "react-router-dom";
  import {
    CheckCircle2,
    Clock,
    Info,
    MapPin,
    Shield,
  } from "lucide-react";
  import { ApplicationFormContent } from "../../components/client/ApplicationFormContent";

  export function ApplicationFormPage({ serviceId: serviceIdProp }: { serviceId?: string }) {
    const { serviceId: serviceIdFromParams } = useParams<{ serviceId: string }>();
    const navigate = useNavigate();
    const serviceId = serviceIdProp ?? serviceIdFromParams;

    return (
      <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 lg:gap-6 items-start">
          {/* LEFT — Form */}
          <div className="min-w-0">
            <ApplicationFormContent
              serviceId={serviceId}
              onSuccess={() => navigate("/client/applications")}
              onCancel={() => navigate(-1)}
            />
          </div>

          {/* RIGHT — Info panel (desktop only) */}
          <div className="hidden lg:flex flex-col gap-4 sticky top-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4">
                What happens next?
              </h3>
              <div className="flex flex-col gap-4">
                {[
                  {
                    icon: CheckCircle2,
                    color: "text-teal-600",
                    bg: "bg-teal-50",
                    title: "Request received",
                    desc: "The organization gets notified immediately.",
                  },
                  {
                    icon: Clock,
                    color: "text-blue-600",
                    bg: "bg-blue-50",
                    title: "Caseworker responds",
                    desc: "Most requests get a response same day.",
                  },
                  {
                    icon: MapPin,
                    color: "text-purple-600",
                    bg: "bg-purple-50",
                    title: "Get connected",
                    desc: "They’ll confirm details and next steps via message.",
                  },
                ].map((step) => (
                  <div key={step.title} className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl ${step.bg} flex items-center justify-center flex-shrink-0`}
                    >
                      <step.icon
                        className={`w-4 h-4 ${step.color}`}
                        strokeWidth={1.5}
                      />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 leading-none mb-1">
                        {step.title}
                      </div>
                      <div className="text-xs text-slate-400 leading-relaxed">
                        {step.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4">
              <div className="flex items-start gap-2.5">
                <Shield
                  className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5"
                  strokeWidth={1.5}
                />
                <div>
                  <div className="text-xs font-semibold text-emerald-900 mb-1">
                    Your info is private
                  </div>
                  <div className="text-xs text-emerald-700 leading-relaxed">
                    Only the organization you&apos;re contacting can see your request
                    details. We never share or sell your data.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 px-1">
              <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400 leading-relaxed">
                This form takes about 2 minutes. You can submit requests to multiple
                organizations.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

