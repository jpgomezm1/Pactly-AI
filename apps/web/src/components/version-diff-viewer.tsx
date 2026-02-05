"use client";

import { Card, CardContent } from "@/components/ui/card";
import { GitBranch, ArrowRight } from "lucide-react";

interface FieldChange {
  field: string;
  from: any;
  to: any;
}

interface Props {
  diffHtml: string;
  versionANumber: number;
  versionBNumber: number;
  fieldChanges?: FieldChange[];
}

function formatFieldValue(val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") return `$${val.toLocaleString()}`;
  return String(val);
}

export function VersionDiffViewer({ diffHtml, versionANumber, versionBNumber, fieldChanges }: Props) {
  return (
    <Card>
      <div className="flex items-center gap-2 p-4 border-b">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          Diff: v{versionANumber} → v{versionBNumber}
        </span>
      </div>
      <CardContent className="p-0">
        {/* Field Change Summary Table */}
        {fieldChanges && fieldChanges.length > 0 && (
          <div className="border-b p-4">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Field Changes
            </h4>
            <div className="space-y-1.5">
              {fieldChanges.map((fc, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-medium min-w-[140px]">{fc.field.replace(/_/g, " ")}</span>
                  <span className="text-rose-500 line-through">{formatFieldValue(fc.from)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-emerald-600 font-medium">{formatFieldValue(fc.to)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {diffHtml ? (
          <div
            className="font-mono text-sm p-4 max-h-[600px] overflow-auto scrollbar-thin"
            dangerouslySetInnerHTML={{ __html: diffHtml }}
          />
        ) : (
          <p className="text-sm text-muted-foreground p-4">No differences found.</p>
        )}
      </CardContent>
    </Card>
  );
}
