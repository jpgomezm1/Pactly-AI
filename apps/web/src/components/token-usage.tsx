"use client";

import { Zap } from "lucide-react";

interface TokenUsageProps {
  inputTokens: number;
  outputTokens: number;
  model?: string;
}

export function TokenUsageDisplay({ inputTokens, outputTokens, model = "Pactly AI" }: TokenUsageProps) {
  const estimatedCost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-3 mt-3">
      <Zap className="h-3.5 w-3.5 text-amber-500" />
      <span>{inputTokens.toLocaleString()} in / {outputTokens.toLocaleString()} out</span>
      <span className="text-muted-foreground/60">~${estimatedCost.toFixed(4)}</span>
      <span className="text-muted-foreground/60">{model}</span>
    </div>
  );
}
