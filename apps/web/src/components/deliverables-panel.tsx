"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deliverablesApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  ClipboardList, Upload, Download, CheckCircle2, Clock, AlertTriangle, Sparkles,
} from "lucide-react";

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  pending:   { color: "bg-amber-100 text-amber-700", label: "Pending" },
  submitted: { color: "bg-blue-100 text-blue-700", label: "Submitted" },
  approved:  { color: "bg-emerald-100 text-emerald-700", label: "Approved" },
  overdue:   { color: "bg-rose-100 text-rose-700", label: "Overdue" },
};

interface DeliverablesPanelProps {
  dealId: string;
  deliverables: any[];
}

export function DeliverablesPanel({ dealId, deliverables }: DeliverablesPanelProps) {
  const queryClient = useQueryClient();
  const [editingParty, setEditingParty] = useState<Record<string, string>>({});

  const unconfirmed = deliverables.filter((d: any) => !d.is_confirmed);
  const confirmed = deliverables.filter((d: any) => d.is_confirmed);
  const isReviewMode = unconfirmed.length > 0;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      deliverablesApi.update(dealId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliverables", dealId] });
    },
  });

  const confirmAllMutation = useMutation({
    mutationFn: () => deliverablesApi.confirmAll(dealId),
    onSuccess: (data) => {
      toast({ title: "Deliverables confirmed", description: `${data.confirmed} deliverables confirmed.`, variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["deliverables", dealId] });
    },
  });

  const handleUpload = async (id: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        await deliverablesApi.upload(dealId, id, file);
        toast({ title: "File uploaded", variant: "success" });
        queryClient.invalidateQueries({ queryKey: ["deliverables", dealId] });
      } catch (err: any) {
        toast({ title: "Upload failed", description: err.message, variant: "error" });
      }
    };
    input.click();
  };

  const handleDownload = async (id: string, filename: string) => {
    try {
      const blob = await deliverablesApi.download(dealId, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "file";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "error" });
    }
  };

  if (deliverables.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <ClipboardList className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No deliverables yet. They will appear after both parties accept and the timeline is generated.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Review Mode: unconfirmed deliverables */}
      {isReviewMode && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                Review AI Assignments ({unconfirmed.length})
              </CardTitle>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => {
                  // Apply any pending party changes first
                  const updates = Object.entries(editingParty);
                  Promise.all(
                    updates.map(([id, party]) =>
                      deliverablesApi.update(dealId, id, { responsible_party: party })
                    )
                  ).then(() => {
                    confirmAllMutation.mutate();
                    setEditingParty({});
                  });
                }}
                disabled={confirmAllMutation.isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                {confirmAllMutation.isPending ? "Confirming..." : "Confirm All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unconfirmed.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between bg-white rounded-lg border border-amber-200 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{d.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{d.due_date}</span>
                      <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                        {d.category.replace(/_/g, " ")}
                      </span>
                      {d.ai_suggested_party && (
                        <span className="text-xs text-amber-600 flex items-center gap-0.5">
                          <Sparkles className="h-3 w-3" /> AI: {d.ai_suggested_party}
                        </span>
                      )}
                    </div>
                  </div>
                  <select
                    className="text-xs border rounded px-2 py-1 ml-3"
                    value={editingParty[d.id] || d.responsible_party}
                    onChange={(e) => setEditingParty({ ...editingParty, [d.id]: e.target.value })}
                  >
                    <option value="admin">Admin (You)</option>
                    <option value="counterparty">Counterparty</option>
                  </select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Mode: confirmed deliverables */}
      {confirmed.length > 0 && (
        <div className="space-y-3">
          {confirmed.map((d: any) => {
            const statusStyle = STATUS_STYLES[d.status] || STATUS_STYLES.pending;
            return (
              <Card key={d.id} className="hover:border-indigo-200 transition-colors">
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-900">{d.description}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyle.color}`}>
                          {statusStyle.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {d.due_date}
                        </span>
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded">
                          {d.category.replace(/_/g, " ")}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {d.responsible_party === "admin" ? "You" : "Counterparty"}
                        </Badge>
                      </div>
                      {d.filename && (
                        <p className="text-xs text-indigo-600 mt-1">{d.filename}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {d.responsible_party === "admin" && d.status === "pending" && (
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleUpload(d.id)}>
                          <Upload className="h-3 w-3 mr-1" /> Upload
                        </Button>
                      )}
                      {d.filename && (
                        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleDownload(d.id, d.filename)}>
                          <Download className="h-3 w-3 mr-1" /> Download
                        </Button>
                      )}
                      {d.responsible_party === "counterparty" && d.status === "submitted" && (
                        <Button
                          size="sm"
                          className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => updateMutation.mutate({ id: d.id, data: { status: "approved" } })}
                          disabled={updateMutation.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
