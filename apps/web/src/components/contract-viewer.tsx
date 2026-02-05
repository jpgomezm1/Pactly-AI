"use client";

import { useState, useMemo } from "react";
import { Search, Copy, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

interface Props {
  text: string;
  title?: string;
}

function classifyLine(line: string): "header" | "subitem" | "text" {
  const trimmed = line.trim();
  if (!trimmed) return "text";
  // Section headers: numbered ("1.", "2.", "ARTICLE I") or ALL-CAPS lines (>3 chars)
  if (/^\d+\.\s/.test(trimmed)) return "header";
  if (/^ARTICLE\s/i.test(trimmed)) return "header";
  if (trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return "header";
  // Sub-items: (a), (b), (i), (ii), indented with dash/bullet
  if (/^\([a-z]\)\s/.test(trimmed)) return "subitem";
  if (/^\([ivxlc]+\)\s/i.test(trimmed)) return "subitem";
  if (/^[-•]\s/.test(trimmed)) return "subitem";
  if (line.startsWith("    ") || line.startsWith("\t")) return "subitem";
  return "text";
}

export function ContractViewer({ text, title = "Contract Text" }: Props) {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard", variant: "success" });
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightText = (content: string) => {
    if (!search.trim()) return content;
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return content.replace(
      new RegExp(`(${escaped})`, "gi"),
      '<mark class="bg-indigo-200/60 text-indigo-900 rounded px-0.5">$1</mark>'
    );
  };

  const lines = useMemo(() => text.split("\n"), [text]);

  const matchCount = useMemo(() => {
    if (!search.trim()) return 0;
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = text.match(new RegExp(escaped, "gi"));
    return matches?.length || 0;
  }, [text, search]);

  return (
    <Card>
      {/* Sticky toolbar */}
      <div className="flex items-center justify-between gap-2 p-4 border-b sticky top-0 bg-card z-10 rounded-t-xl">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44 h-8 pl-8 text-xs"
            />
            {search.trim() && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                {matchCount}
              </span>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={copyToClipboard} className="h-8 gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-auto scrollbar-thin">
          <div className="px-8 py-10 sm:px-12 max-w-none" style={{ fontFamily: "'Inter', sans-serif" }}>
            {lines.map((line, i) => {
              const type = classifyLine(line);
              const html = highlightText(line) || "&nbsp;";

              if (type === "header") {
                return (
                  <div
                    key={i}
                    className="mt-6 mb-2 first:mt-0"
                    style={{ lineHeight: 1.5 }}
                  >
                    <span
                      className="text-base font-bold text-foreground"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  </div>
                );
              }

              if (type === "subitem") {
                return (
                  <div
                    key={i}
                    className="pl-6 my-0.5"
                    style={{ lineHeight: 1.7 }}
                  >
                    <span
                      className="text-sm text-foreground/90"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  className="my-0.5"
                  style={{ lineHeight: 1.7 }}
                >
                  <span
                    className="text-sm text-foreground/90"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
