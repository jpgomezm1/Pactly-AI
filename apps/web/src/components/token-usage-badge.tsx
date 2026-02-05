"use client";

import { useQuery } from "@tanstack/react-query";
import { usageApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TokenUsageBadgeProps {
  collapsed?: boolean;
}

export function TokenUsageBadge({ collapsed }: TokenUsageBadgeProps) {
  const { data } = useQuery({
    queryKey: ["usage"],
    queryFn: () => usageApi.get(),
    refetchInterval: 30000,
  });

  if (!data) return null;

  const used = data.used + data.extra;
  const limit = data.limit;
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const isHigh = pct >= 80;
  const isCritical = pct >= 90;

  if (collapsed) {
    return (
      <div className="flex justify-center">
        <div
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold",
            isHigh ? "bg-amber-900/50 text-amber-400" : "bg-slate-800 text-slate-400"
          )}
          title={isUnlimited ? "Unlimited" : `${used}/${limit} tokens (${pct}%)`}
        >
          {isUnlimited ? "\u221E" : used}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-slate-800/50 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">Tokens</span>
        <span className={cn("font-medium", isHigh ? "text-amber-400" : "text-slate-300")}>
          {isUnlimited ? `${used} used` : `${used} / ${limit}`}
          {!isUnlimited && <span className="ml-1 text-slate-500">({pct}%)</span>}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isHigh
                ? "bg-gradient-to-r from-amber-400 to-amber-600"
                : "bg-gradient-to-r from-teal-400 to-teal-600",
              isCritical && "animate-pulse"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {data.extra > 0 && (
        <p className="text-[10px] text-amber-400">{data.extra} extra tokens used</p>
      )}
      {isHigh && !isUnlimited && (
        <a
          href="/settings/billing"
          className="block text-[10px] text-teal-400 hover:text-teal-300 font-medium transition-colors"
        >
          Upgrade plan &rarr;
        </a>
      )}
    </div>
  );
}
