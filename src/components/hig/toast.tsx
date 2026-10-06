"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

type ToastInput = {
  message: string;
  tone?: "neutral" | "error";
  action?: { label: string; onClick: () => void };
  duration?: number;
};

type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { ...toast, id }]);
      timers.current.set(id, setTimeout(() => dismiss(id), toast.duration ?? (toast.action ? 6000 : 4000)));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 desk:bottom-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className="pointer-events-auto flex max-w-[min(32rem,100%)] items-center gap-3 rounded-full bg-text py-2 pl-4 pr-2 text-callout font-medium text-[var(--color-base)] shadow-xl shadow-black/50"
            style={{ animation: "toast-in 220ms var(--ease-standard)" }}
          >
            {toast.tone === "error" && <AlertCircle className="size-4 shrink-0 text-danger" strokeWidth={2} />}
            <span className="min-w-0 py-0.5">{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
                className="shrink-0 rounded-full px-3 py-1 font-semibold text-[#c9461a] transition-colors hover:bg-black/5"
              >
                {toast.action.label}
              </button>
            ) : (
              <span className="w-2" />
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
