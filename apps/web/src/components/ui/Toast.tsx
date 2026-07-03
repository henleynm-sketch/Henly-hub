"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";

interface ToastProps {
  message: string;
  type?: "success" | "warning" | "error" | "info";
  isOpen: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = "info", isOpen, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-450" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-450" />,
    error: <XCircle className="h-5 w-5 text-rose-450" />,
    info: <Info className="h-5 w-5 text-accent" />,
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div className="flex items-center gap-3 rounded-xl border border-glass-border bg-glass-bg/95 p-4 shadow-glass backdrop-blur-glass text-white min-w-[300px]">
        {icons[type]}
        <div className="flex-1 text-sm font-medium">{message}</div>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-slate-400 hover:bg-white/5 hover:text-white transition"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
