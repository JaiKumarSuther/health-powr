import { createPortal } from "react-dom";
import { ApplicationFormContent } from "./ApplicationFormContent";

export function ApplicationFormSheet({
  isOpen,
  serviceId,
  onClose,
}: {
  isOpen: boolean;
  serviceId: string | null;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9000,
          backgroundColor: "rgba(15,23,42,0.5)",
          backdropFilter: "blur(4px)",
          opacity: isOpen ? 1 : 0,
          transition: "opacity 0.22s ease",
          pointerEvents: isOpen ? "all" : "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9001,
          height: "92vh",
          backgroundColor: "#ffffff",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
          transform: isOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.45s cubic-bezier(0.34,1.1,0.64,1)",
          pointerEvents: isOpen ? "all" : "none",
        }}
        aria-hidden={!isOpen}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: "#e2e8f0",
            margin: "12px auto 0",
            flexShrink: 0,
          }}
        />

        <div
          style={{ flex: 1, overflowY: "auto", paddingBottom: "40px" }}
          className="w-full overflow-hidden"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {serviceId && (
            <ApplicationFormContent serviceId={serviceId} onSuccess={onClose} onCancel={onClose} />
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

