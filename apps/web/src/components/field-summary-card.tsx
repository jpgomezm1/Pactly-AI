"use client";

import { DollarSign, Calendar, Clock, Shield, Building2, Home, CreditCard, CheckCircle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const FIELDS = [
  { key: "purchase_price", label: "Purchase Price", icon: DollarSign },
  { key: "closing_date", label: "Closing Date", icon: Calendar },
  { key: "inspection_period_days", label: "Inspection Period", icon: Clock },
  { key: "earnest_money", label: "Earnest Money", icon: CreditCard },
  { key: "financing_type", label: "Financing Type", icon: FileText },
  { key: "appraisal_contingency", label: "Appraisal Contingency", icon: Shield },
  { key: "title_company", label: "Title Company", icon: Building2 },
  { key: "occupancy_date", label: "Occupancy Date", icon: Home },
  { key: "seller_concessions", label: "Seller Concessions", icon: DollarSign },
];

interface Props {
  fields: Record<string, any> | null;
  clauses: Array<{ key: string; status: string }> | null;
}

export function FieldSummaryCard({ fields, clauses }: Props) {
  const filledCount = fields ? FIELDS.filter((f) => fields[f.key] != null).length : 0;
  const completion = Math.round((filledCount / FIELDS.length) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Field Summary</CardTitle>
          {fields && (
            <span className="text-xs text-muted-foreground">{completion}% extracted</span>
          )}
        </div>
        {fields && <Progress value={completion} className="mt-2" />}
      </CardHeader>
      <CardContent className="space-y-4">
        {fields ? (
          <div className="space-y-2.5">
            {FIELDS.map(({ key, label, icon: Icon }) => {
              const value = fields[key];
              const isMissing = value == null;
              return (
                <div key={key} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </div>
                  {isMissing ? (
                    <Badge variant="warning" className="shrink-0 text-[10px]">Missing</Badge>
                  ) : (
                    <span className="text-sm font-medium text-right truncate">
                      {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No fields extracted yet.</p>
        )}

        {clauses && clauses.length > 0 && (
          <div className="pt-3 border-t">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Clauses</h4>
            <div className="flex flex-wrap gap-1.5">
              {clauses.map((c) => (
                <Badge
                  key={c.key}
                  variant={c.status === "active" ? "success" : c.status === "removed" ? "destructive" : "secondary"}
                  className="text-[10px]"
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${
                    c.status === "active" ? "bg-emerald-500" : c.status === "removed" ? "bg-rose-500" : "bg-slate-400"
                  }`} />
                  {String(c.key).replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
