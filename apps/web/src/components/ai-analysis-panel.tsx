"use client";

import { Sparkles, CheckCircle, XCircle, MessageSquare, ArrowRight, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AIBadge } from "@/components/ui/ai-badge";
import { TokenUsageDisplay } from "@/components/token-usage";

interface RiskSummary {
  level: "low" | "medium" | "high";
  explanation: string;
}

interface AnalysisResult {
  risk_summary?: RiskSummary;
  changes: Array<{
    field: string;
    action: string;
    from?: string;
    to?: string;
    confidence: number;
  }>;
  clause_actions: Array<{
    clause_key: string;
    action: string;
    details: string;
    confidence: number;
  }>;
  questions: string[];
  recommendation: string;
  counter_proposal?: Record<string, any> | null;
}

interface Props {
  result: AnalysisResult;
  crStatus?: string;
  showActions?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onCounter?: () => void;
  acceptLoading?: boolean;
  rejectLoading?: boolean;
  counterLoading?: boolean;
  inputTokens?: number | null;
  outputTokens?: number | null;
}

const recConfig: Record<string, { icon: typeof CheckCircle; variant: "success" | "destructive" | "warning"; label: string }> = {
  accept: { icon: CheckCircle, variant: "success", label: "Accept" },
  reject: { icon: XCircle, variant: "destructive", label: "Reject" },
  counter: { icon: MessageSquare, variant: "warning", label: "Counter" },
};

export function AIAnalysisPanel({
  result, crStatus = "open", showActions = false,
  onAccept, onReject, onCounter,
  acceptLoading, rejectLoading, counterLoading,
  inputTokens, outputTokens,
}: Props) {
  const rec = recConfig[result.recommendation] || recConfig.counter;
  const RecIcon = rec.icon;

  return (
    <Card className="animate-slide-up border-indigo-200/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-indigo-600" />
            </div>
            <CardTitle>AI Analysis</CardTitle>
            <AIBadge status="complete" />
          </div>
          <Badge variant={rec.variant} className="gap-1">
            <RecIcon className="h-3 w-3" />
            {rec.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Risk Summary Banner */}
        {result.risk_summary && (
          <div className={`flex items-start gap-3 p-3 rounded-lg border ${
            result.risk_summary.level === "low"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : result.risk_summary.level === "medium"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
          }`}>
            {result.risk_summary.level === "low" ? (
              <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
            ) : result.risk_summary.level === "medium" ? (
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-semibold capitalize">{result.risk_summary.level} Risk</p>
              <p className="text-sm mt-0.5">{result.risk_summary.explanation}</p>
            </div>
          </div>
        )}

        {/* AI Clarifying Questions — Prominent Callout */}
        {result.questions.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h4 className="text-sm font-semibold text-amber-800">AI needs clarification</h4>
            </div>
            <ol className="list-decimal list-inside space-y-1.5">
              {result.questions.map((q, i) => (
                <li key={i} className="text-sm text-amber-900">{q}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Field Changes */}
        {result.changes.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Field Changes
            </h4>
            <div className="space-y-2">
              {result.changes.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <span className="font-medium">{c.field.replace(/_/g, " ")}</span>
                    {c.from && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <span className="line-through">{c.from}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="text-foreground font-medium">{c.to}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Progress value={c.confidence * 100} className="w-16 h-1.5" />
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {Math.round(c.confidence * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clause Actions */}
        {result.clause_actions.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Clause Actions
            </h4>
            <div className="space-y-2">
              {result.clause_actions.map((ca, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-[10px]">{ca.action}</Badge>
                    <span>{ca.clause_key.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Progress value={ca.confidence * 100} className="w-16 h-1.5" />
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {Math.round(ca.confidence * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Counter Proposal */}
        {result.counter_proposal && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Counter Proposal
            </h4>
            <div className="rounded-lg bg-muted/50 border-l-2 border-indigo-500 p-3">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {JSON.stringify(result.counter_proposal, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {showActions && crStatus === "open" && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onAccept}
              disabled={acceptLoading}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {acceptLoading ? "Accepting..." : "Accept Changes"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-rose-300 text-rose-600 hover:bg-rose-50"
              onClick={onReject}
              disabled={rejectLoading}
            >
              <XCircle className="h-3.5 w-3.5" />
              {rejectLoading ? "Rejecting..." : "Reject"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={onCounter}
              disabled={counterLoading}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {counterLoading ? "Countering..." : "Counter"}
            </Button>
          </div>
        )}

        {/* Token Usage */}
        {inputTokens != null && outputTokens != null && (
          <TokenUsageDisplay inputTokens={inputTokens} outputTokens={outputTokens} />
        )}
      </CardContent>
    </Card>
  );
}
