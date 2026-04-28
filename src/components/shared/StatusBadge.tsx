import { cn } from "../../lib/utils";

export type RequestStatus =
  | "in_review"
  | "approved"
  | "rejected"
  | "completed"
  | "pending"
  | string;

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  in_review: { label: "In review", className: "bg-amber-50 text-amber-700" },
  approved: { label: "Approved", className: "bg-green-50 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-600" },
  completed: { label: "Completed", className: "bg-teal-50 text-teal-700" },
  pending: { label: "Pending", className: "bg-gray-50 text-gray-500" },
};

function toLabel(status: string) {
  if (!status) return "—";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({
  status,
  className,
}: {
  status: RequestStatus;
  className?: string;
}) {
  const key = String(status ?? "").toLowerCase();
  const meta = STATUS_STYLES[key];
  const label = meta?.label ?? toLabel(key);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-bold leading-4 whitespace-nowrap",
        meta?.className ?? "bg-slate-100 text-slate-700",
        className,
      )}
    >
      {label}
    </span>
  );
}

