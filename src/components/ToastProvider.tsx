import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone, durationMs?: number) => void;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION: Record<ToastTone, number> = {
  success: 2800,
  info: 3200,
  error: 4200,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef<Map<number, number>>(new Map());

  const dismissToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "info", durationMs?: number) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      const id = nextIdRef.current++;
      setToasts((prev) => [...prev.slice(-4), { id, message: trimmed, tone }]);

      const ms = durationMs ?? DEFAULT_DURATION[tone];
      const timer = window.setTimeout(() => dismissToast(id), ms);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-item toast-${toast.tone}`}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-dismiss"
              aria-label="Dismiss"
              onClick={() => dismissToast(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return {
    showToast: context.showToast,
    dismissToast: context.dismissToast,
    success: (message: string, durationMs?: number) =>
      context.showToast(message, "success", durationMs),
    error: (message: string, durationMs?: number) =>
      context.showToast(message, "error", durationMs),
    info: (message: string, durationMs?: number) =>
      context.showToast(message, "info", durationMs),
  };
}
