import { useEffect, useId, useRef } from "react";

type Props = {
  zoneName: string;
  onClose: () => void;
};

export function ServiceZoneUnavailableModal({ zoneName, onClose }: Props) {
  const titleId = useId();
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    okRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel zone-unavailable-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="zone-unavailable-icon" aria-hidden>
          i
        </div>
        <h2 id={titleId} className="notification-modal-title" style={{ textAlign: "center" }}>
          Not available yet
        </h2>
        <p className="notification-modal-body" style={{ textAlign: "center" }}>
          Hey GoQuicker, GoQuick is not available in <strong>{zoneName}</strong> yet but we are
          coming soon.
        </p>
        <p className="muted" style={{ textAlign: "center", margin: "0 0 20px" }}>
          Please choose another location.
        </p>
        <button ref={okRef} type="button" className="btn-primary" style={{ width: "100%" }} onClick={onClose}>
          I understand
        </button>
      </div>
    </div>
  );
}
