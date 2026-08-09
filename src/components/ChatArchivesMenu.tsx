import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export function ChatArchivesMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="chat-menu" ref={wrapRef}>
      <button
        type="button"
        className="chat-menu-trigger"
        aria-label="Chat options"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open ? (
        <div className="chat-menu-dropdown" role="menu">
          <Link
            to="/chats/archived"
            role="menuitem"
            className="chat-menu-item"
            onClick={() => setOpen(false)}
          >
            Archives
          </Link>
        </div>
      ) : null}
    </div>
  );
}
