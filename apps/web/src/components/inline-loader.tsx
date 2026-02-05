"use client";

import { Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AIBadge } from "@/components/ui/ai-badge";

interface InlineLoaderProps {
  message: string;
  className?: string;
}

export function InlineLoader({ message, className = "" }: InlineLoaderProps) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/50 text-sm text-indigo-700 animate-fade-in ${className}`}>
      <Spinner size="sm" />
      <Sparkles className="h-4 w-4 animate-pulse" />
      <span>{message}</span>
      <AIBadge status="processing" className="ml-auto" />
    </div>
  );
}
