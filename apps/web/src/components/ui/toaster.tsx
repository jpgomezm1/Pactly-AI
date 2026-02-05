"use client";

import { useToast } from "./use-toast";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  default: Info,
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
};

const styleMap = {
  default: "border-border bg-card",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

const iconColorMap = {
  default: "text-indigo-500",
  success: "text-emerald-500",
  error: "text-rose-500",
  warning: "text-amber-500",
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = iconMap[t.variant || "default"];
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 shadow-brand-lg animate-slide-up",
              styleMap[t.variant || "default"]
            )}
          >
            <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", iconColorMap[t.variant || "default"])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="text-xs mt-0.5 opacity-80">{t.description}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
