"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimelineEvent {
  id: string;
  action: string;
  details: Record<string, any> | null;
  user_id: string | null;
  created_at: string;
}

interface Props {
  currentState: string;
  events: TimelineEvent[];
}

const STATE_VARIANT: Record<string, "secondary" | "warning" | "default" | "success"> = {
  draft: "secondary",
  waiting_on_seller: "warning",
  waiting_on_buyer: "warning",
  counter_sent: "default",
  final_review: "default",
  accepted: "success",
};

const ACTION_LABELS: Record<string, string> = {
  deal_created: "Deal Created",
  contract_uploaded: "Contract Uploaded",
  contract_pasted: "Contract Pasted",
  contract_parsed: "Contract Parsed",
  change_request_created: "Change Request Created",
  change_request_analyzed: "Change Request Analyzed",
  version_generated: "New Version Generated",
  state_transition: "State Changed",
  user_assigned: "User Assigned",
};

const ACTION_COLORS: Record<string, string> = {
  deal_created: "bg-indigo-500",
  contract_uploaded: "bg-indigo-500",
  contract_pasted: "bg-indigo-500",
  contract_parsed: "bg-violet-500",
  change_request_created: "bg-indigo-500",
  change_request_analyzed: "bg-violet-500",
  version_generated: "bg-emerald-500",
  state_transition: "bg-amber-500",
  user_assigned: "bg-slate-400",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function TimelineView({ currentState, events }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle>Timeline</CardTitle>
        <Badge variant={STATE_VARIANT[currentState] || "secondary"}>
          {currentState.replace(/_/g, " ")}
        </Badge>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border" />

            <div className="space-y-4">
              {events.map((event, i) => (
                <div
                  key={event.id}
                  className="flex items-start gap-4 relative animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* Dot */}
                  <div className={`relative z-10 h-3.5 w-3.5 rounded-full border-2 border-background shrink-0 mt-0.5 ${
                    ACTION_COLORS[event.action] || "bg-slate-400"
                  }`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {ACTION_LABELS[event.action] || event.action}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(event.created_at)}
                      </span>
                    </div>
                    {event.details && Object.keys(event.details).length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                        {Object.entries(event.details).map(([k, v]) => (
                          <span key={k}>{k}: {String(v)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
