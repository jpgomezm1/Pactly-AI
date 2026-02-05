"use client";

import { Sparkles, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIBadgeProps {
  status?: "default" | "processing" | "complete";
  className?: string;
}

export function AIBadge({ status = "default", className }: AIBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "processing" && "bg-indigo-100 text-indigo-700 animate-pulse",
        status === "complete" && "bg-emerald-100 text-emerald-700",
        status === "default" && "bg-indigo-100 text-indigo-700",
        className,
      )}
    >
      {status === "complete" ? (
        <CheckCircle className="h-3 w-3" />
      ) : (
        <Sparkles className="h-3 w-3" />
      )}
      {status === "processing" ? "Analyzing..." : status === "complete" ? "AI Analysis" : "AI-Powered"}
    </span>
  );
}
