"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RiskFlag {
  category: string;
  severity: string;
  title: string;
  description: string;
  affected_field?: string | null;
  suggestion?: string;
}

interface Suggestion {
  context: string;
  title: string;
  description: string;
  reference_data?: string;
}

interface RiskFlagsPanelProps {
  flags: RiskFlag[];
  suggestions?: Suggestion[];
}

const SEVERITY_CONFIG: Record<string, { border: string; bg: string; text: string; label: string }> = {
  high:   { border: "border-l-red-500",   bg: "bg-red-50",   text: "text-red-700",   label: "High" },
  medium: { border: "border-l-amber-500", bg: "bg-amber-50", text: "text-amber-700", label: "Medium" },
  low:    { border: "border-l-blue-500",  bg: "bg-blue-50",  text: "text-blue-700",  label: "Low" },
};

export function RiskFlagsPanel({ flags, suggestions = [] }: RiskFlagsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (!flags || flags.length === 0) return null;

  const highCount = flags.filter(f => f.severity === "high").length;
  const mediumCount = flags.filter(f => f.severity === "medium").length;
  const lowCount = flags.filter(f => f.severity === "low").length;

  // Sort: high → medium → low
  const sorted = [...flags].sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Risk Analysis
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs">
                {highCount > 0 && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">{highCount} high</span>}
                {mediumCount > 0 && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">{mediumCount} medium</span>}
                {lowCount > 0 && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{lowCount} low</span>}
              </div>
              <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-slate-600">
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardHeader>
        {expanded && (
          <CardContent className="space-y-3">
            {sorted.map((flag, i) => {
              const config = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.low;
              return (
                <div key={i} className={`border-l-4 ${config.border} ${config.bg} rounded-r-lg p-3 space-y-1.5`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${config.text}`}>
                      {config.label}
                    </span>
                    {flag.category && (
                      <span className="text-[10px] text-slate-500 bg-white/60 px-1.5 py-0.5 rounded">
                        {flag.category}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-900">{flag.title}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{flag.description}</p>
                  {flag.affected_field && (
                    <p className="text-[10px] text-slate-500">
                      Affects: <span className="font-medium">{flag.affected_field.replace(/_/g, " ")}</span>
                    </p>
                  )}
                  {flag.suggestion && (
                    <p className="text-xs text-teal-700 bg-teal-50 rounded px-2 py-1 border border-teal-100">
                      {flag.suggestion}
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-teal-500" />
              AI Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((s, i) => (
              <div key={i} className="bg-teal-50/50 border border-teal-100 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-teal-600 bg-teal-100 px-1.5 py-0.5 rounded font-medium">
                    {s.context}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900">{s.title}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{s.description}</p>
                {s.reference_data && (
                  <p className="text-[10px] text-slate-500 italic">{s.reference_data}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
