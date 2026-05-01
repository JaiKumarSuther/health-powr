import React from "react";
import {
  MapPin,
  Heart,
  ArrowRight,
  Clock,
  Users,
  Phone,
  Home,
  Utensils,
  HeartPulse,
  Briefcase,
  BookOpen,
  Scale,
  Brain as BrainIcon,
} from "lucide-react";
import { useFavorites, useToggleFavorite } from "../../api/favorites";

export interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  orgLat?: number | null;
  orgLng?: number | null;
  is_available: boolean;
  openHours: string;
  eligibility: string;
  phone: string;
  boroughArea: string;
  organization: string;
  logoUrl?: string | null;
  imageUrl?: string | null;
}

export const categoryIcons: Record<string, React.ElementType> = {
  housing: Home,
  food: Utensils,
  healthcare: HeartPulse,
  job_training: Briefcase,
  education: BookOpen,
  legal: Scale,
  mental_health: BrainIcon,
};

export const CATEGORY_BG: Record<string, string> = {
  housing: "bg-slate-50",
  food: "bg-emerald-50",
  healthcare: "bg-rose-50",
  job_training: "bg-amber-50",
  education: "bg-indigo-50",
  legal: "bg-violet-50",
  mental_health: "bg-sky-50",
  childcare: "bg-teal-50",
  other: "bg-slate-50",
};

export function ServiceIconBanner({
  category,
  logoUrl,
  imageUrl,
  orgName,
}: {
  category: string;
  logoUrl?: string | null;
  imageUrl?: string | null;
  orgName?: string | null;
}) {
  const Icon = categoryIcons[category] ?? Home;
  return (
    <div className="rounded-t-2xl overflow-hidden">
      {(imageUrl || logoUrl) ? (
        <img
          src={imageUrl || logoUrl || ""}
          alt={orgName ?? ""}
          className="w-full h-[140px] object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            (e.currentTarget.nextElementSibling as HTMLElement | null)?.removeAttribute("style");
          }}
        />
      ) : null}
      <div
        className={`w-full h-[140px] flex items-center justify-center ${imageUrl || logoUrl ? "hidden" : ""} ${
          CATEGORY_BG[category] ?? "bg-slate-50"
        }`}
        style={imageUrl || logoUrl ? { display: "none" } : undefined}
      >
        <Icon className="w-10 h-10 opacity-40 text-slate-500" strokeWidth={1.5} />
      </div>
    </div>
  );
}

export function AvailabilityBadge({ status }: { status: "Available" | "Limited" | "Waitlist" | "Unavailable" }) {
  const styles: Record<string, string> = {
    Available: "bg-teal-600 text-white",
    Limited: "bg-[#FFFBEB] text-[#B45309]",
    Waitlist: "bg-[#FFFBEB] text-[#B45309]",
    Unavailable: "bg-[#F9FAFB] text-[#6B7280]",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium ${styles[status] || styles.Unavailable}`}
    >
      {status}
    </span>
  );
}

interface ServiceCardProps {
  service: Service;
  isFav?: boolean;
  distance?: number | null;
  onToggleFavorite?: (id: string) => void;
  onApply: (id: string) => void;
  onCopyPhone: (phone: string) => void;
}

export function ServiceCard({
  service,
  distance,
  onApply,
  onCopyPhone,
}: ServiceCardProps) {
  const { data: favoriteIds = [] } = useFavorites();
  const { mutate: toggleFavorite } = useToggleFavorite();
  const isFav = favoriteIds.includes(service.id);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col transition-all duration-200 hover:shadow-[0_8px_20px_rgba(13,148,136,0.10)] hover:border-teal-200 hover:-translate-y-0.5 h-full">
      <ServiceIconBanner
        category={service.category}
        logoUrl={service.logoUrl}
        imageUrl={service.imageUrl}
        orgName={service.organization}
      />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-[15px] font-bold text-gray-900 leading-snug flex-1 pr-2">
            {service.name}
          </h3>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(service.id);
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-red-50 flex-shrink-0"
            aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                isFav
                  ? "fill-red-500 text-red-500"
                  : "fill-none text-gray-300"
              }`}
            />
          </button>
        </div>
        <p className="text-[13px] font-medium text-teal-600 mb-2.5 hover:underline cursor-pointer">
          {service.organization}
        </p>
        <div className="flex items-center gap-2 mb-3">
          {service.is_available === true && <AvailabilityBadge status="Available" />}
        </div>
        <p className="text-[13px] text-gray-500 leading-relaxed mb-3 line-clamp-2 flex-1">
          {service.description}
        </p>
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            <MapPin className="w-[13px] h-[13px] text-gray-400 flex-shrink-0" />
            <span>{service.location || "New York"}</span>
            {distance !== null && distance !== undefined && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-teal-600 font-medium">
                  {distance < 1
                    ? `${(distance * 1000).toFixed(0)}m`
                    : `${distance.toFixed(1)}km`}
                </span>
              </>
            )}
          </div>
          {service.openHours && (
            <div className="flex items-center gap-2 text-[12px] text-gray-500">
              <Clock className="w-[13px] h-[13px] text-gray-400 flex-shrink-0" />
              <span>{service.openHours}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            <Users className="w-[13px] h-[13px] text-gray-400 flex-shrink-0" />
            <span className="truncate">
              {service.eligibility}
            </span>
          </div>
        </div>
        <div className="flex gap-2.5 mt-auto">
          <button
            onClick={() => onApply(service.id)}
            className="flex-1 h-11 bg-teal-600 text-white rounded-[10px] font-semibold text-[13px] hover:bg-teal-700 transition-colors flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(13,148,136,0.20)]"
          >
            Request Now
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onCopyPhone(service.phone)}
            className="w-11 h-11 rounded-[10px] border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:border-teal-600 hover:text-teal-600 transition-all flex-shrink-0"
          >
            <Phone className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
