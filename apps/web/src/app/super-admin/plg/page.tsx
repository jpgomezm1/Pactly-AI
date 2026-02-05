"use client";

import { useQuery } from "@tanstack/react-query";
import { plgApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, MousePointer, UserPlus, FolderOpen, BarChart3, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PLGMetricsPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["plg-metrics"],
    queryFn: plgApi.metrics,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Growth Metrics</h1>
          <p className="text-sm text-muted-foreground mt-1">PLG funnel performance</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1,2,3,4].map(i => <Card key={i}><CardContent className="py-6"><Skeleton className="h-8 w-20" /><Skeleton className="h-4 w-32 mt-2" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  const funnel = metrics?.funnel || {};
  const timeSeries = metrics?.time_series || [];
  const topLinks = metrics?.top_links || [];

  const funnelSteps = [
    { key: "share_link_opened", label: "Opened", icon: MousePointer, color: "text-blue-600 bg-blue-100" },
    { key: "share_link_chat_used", label: "Chatted", icon: BarChart3, color: "text-indigo-600 bg-indigo-100" },
    { key: "cta_clicked", label: "CTA Clicked", icon: TrendingUp, color: "text-amber-600 bg-amber-100" },
    { key: "share_link_signup", label: "Signed Up", icon: UserPlus, color: "text-emerald-600 bg-emerald-100" },
    { key: "signup_first_deal", label: "First Deal", icon: FolderOpen, color: "text-teal-600 bg-teal-100" },
  ];

  const maxDaily = Math.max(...timeSeries.map((d: any) => d.count || 0), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Growth Metrics</h1>
        <p className="text-sm text-muted-foreground mt-1">PLG loop performance — share link acquisition funnel</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Opens</p>
            <p className="text-2xl font-bold mt-1">{funnel.share_link_opened || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Chat Engagement</p>
            <p className="text-2xl font-bold mt-1">{funnel.share_link_chat_used || 0}</p>
            <p className="text-xs text-muted-foreground">{funnel.share_link_opened ? ((funnel.share_link_chat_used || 0) / funnel.share_link_opened * 100).toFixed(1) : 0}% of opens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Signups</p>
            <p className="text-2xl font-bold mt-1">{funnel.share_link_signup || 0}</p>
            <p className="text-xs text-muted-foreground">{funnel.share_link_opened ? ((funnel.share_link_signup || 0) / funnel.share_link_opened * 100).toFixed(1) : 0}% conversion</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">First Deals</p>
            <p className="text-2xl font-bold mt-1">{funnel.signup_first_deal || 0}</p>
            <p className="text-xs text-muted-foreground">{funnel.share_link_signup ? ((funnel.signup_first_deal || 0) / funnel.share_link_signup * 100).toFixed(1) : 0}% activation</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Conversion Funnel (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            {funnelSteps.map((step, i) => {
              const count = funnel[step.key] || 0;
              const prevCount = i > 0 ? (funnel[funnelSteps[i-1].key] || 0) : count;
              const pct = prevCount > 0 ? ((count / prevCount) * 100).toFixed(1) : "0.0";
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className="flex flex-col items-center min-w-[100px]">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${step.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-xl font-bold mt-2">{count}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">{step.label}</p>
                    {i > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{pct}%</p>}
                  </div>
                  {i < funnelSteps.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-slate-300 shrink-0 mb-8" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Daily Opens Chart */}
      {timeSeries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Share Link Opens — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {timeSeries.map((d: any, i: number) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-teal-500 rounded-t min-h-[2px] transition-all"
                    style={{ height: `${(d.count / maxDaily) * 100}%` }}
                    title={`${d.date}: ${d.count} opens`}
                  />
                  {i % 7 === 0 && (
                    <span className="text-[8px] text-muted-foreground">{d.date?.slice(5)}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Links */}
      {topLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Top Performing Share Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider pb-2 border-b">
                <span>Share Link</span>
                <span className="text-right">Opens</span>
                <span className="text-right">Events</span>
              </div>
              {topLinks.map((link: any, i: number) => (
                <div key={i} className="grid grid-cols-3 text-sm py-1.5 border-b border-border/50 last:border-0">
                  <span className="font-medium truncate">{link.share_link_id?.slice(0, 8) || "—"}</span>
                  <span className="text-right text-muted-foreground">{link.opens || link.count || 0}</span>
                  <span className="text-right text-muted-foreground">{link.total || link.count || 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
