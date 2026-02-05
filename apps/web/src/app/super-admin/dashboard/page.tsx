"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, Users, FolderOpen, DollarSign, TrendingUp,
  Zap, Eye, UserPlus, ArrowUpRight, ArrowDownRight, Minus,
  BarChart3, Activity, Share2, Target,
} from "lucide-react";
import { superAdminApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "product", label: "Product" },
  { id: "growth", label: "Growth (PLG)" },
  { id: "ai-costs", label: "AI Costs" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function pctChange(current: number, previous: number): { value: string; positive: boolean | null } {
  if (previous === 0) return { value: current > 0 ? "+100%" : "0%", positive: current > 0 ? true : null };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { value: `${pct >= 0 ? "+" : ""}${pct}%`, positive: pct > 0 ? true : pct < 0 ? false : null };
}

function StatCard({ label, value, sub, icon: Icon, color, change }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: any;
  color: string;
  change?: { value: string; positive: boolean | null };
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center shadow-sm shrink-0`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        {change && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            {change.positive === true && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
            {change.positive === false && <ArrowDownRight className="h-3 w-3 text-rose-500" />}
            {change.positive === null && <Minus className="h-3 w-3 text-slate-400" />}
            <span className={change.positive === true ? "text-emerald-500 font-medium" : change.positive === false ? "text-rose-500 font-medium" : "text-muted-foreground"}>
              {change.value}
            </span>
            <span className="text-muted-foreground">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BarChart({ data, labelKey, valueKey, color = "bg-teal-500" }: {
  data: Record<string, number> | undefined;
  labelKey?: string;
  valueKey?: string;
  color?: string;
}) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No data</p>;
  }
  const max = Math.max(...Object.values(data), 1);
  return (
    <div className="space-y-2">
      {Object.entries(data).map(([key, val]) => (
        <div key={key} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-24 truncate text-right">{key}</span>
          <div className="flex-1 h-5 rounded bg-muted/50 overflow-hidden">
            <div
              className={`h-full ${color} rounded transition-all duration-500`}
              style={{ width: `${(val / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium w-10 text-right">{val}</span>
        </div>
      ))}
    </div>
  );
}

function TimeSeriesChart({ data }: { data: { date: string; input_tokens: number; output_tokens: number }[] | undefined }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No token usage data</p>;
  }

  const maxVal = Math.max(...data.map(d => d.input_tokens + d.output_tokens), 1);
  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * 100;
    const y = 100 - ((d.input_tokens + d.output_tokens) / maxVal) * 100;
    return `${x},${y}`;
  });

  return (
    <div className="relative">
      <svg viewBox="-2 -2 104 104" className="w-full h-40" preserveAspectRatio="none">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-teal-500"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={`0,100 ${points.join(" ")} 100,100`}
          fill="currentColor"
          className="text-teal-500/10"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function FunnelChart({ funnel }: { funnel: Record<string, number> | undefined }) {
  const stages = [
    { key: "share_link_opened", label: "Opened" },
    { key: "share_link_chat_used", label: "Chatted" },
    { key: "cta_clicked", label: "CTA Clicked" },
    { key: "share_link_signup", label: "Signed Up" },
    { key: "signup_first_deal", label: "First Deal" },
  ];
  const first = funnel?.[stages[0].key] || 0;

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const val = funnel?.[stage.key] || 0;
        const pct = first > 0 ? Math.round((val / first) * 100) : 0;
        const widthPct = Math.max(pct, 5);
        return (
          <div key={stage.key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium">{stage.label}</span>
              <span className="text-muted-foreground">{val} ({pct}%)</span>
            </div>
            <div className="h-7 rounded bg-muted/50 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded flex items-center justify-end pr-2 transition-all duration-500"
                style={{ width: `${widthPct}%` }}
              >
                {widthPct > 15 && <span className="text-[10px] text-white font-medium">{pct}%</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const { data: m, isLoading } = useQuery({
    queryKey: ["super-admin-dashboard"],
    queryFn: () => superAdminApi.getDashboard(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const dealChange = m ? pctChange(m.deals_this_month, m.deals_last_month) : undefined;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform analytics and metrics</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-teal-500 text-teal-600 dark:text-teal-400"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ──────────────────────────────────────────────── */}
      {activeTab === "overview" && m && (
        <div className="space-y-6">
          {/* Row 1: Top KPIs */}
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total Orgs" value={m.total_orgs} sub={`${m.active_orgs} active`} icon={Building2} color="from-blue-400 to-blue-600" />
            <StatCard label="Active Users" value={m.users_active_30d} sub={`${m.total_users} total`} icon={Users} color="from-purple-400 to-purple-600" />
            <StatCard label="Total Deals" value={m.total_deals} icon={FolderOpen} color="from-teal-400 to-teal-600" change={dealChange} />
            <StatCard label="AI Cost (30d)" value={fmtCost(m.estimated_cost_30d)} sub={`${fmt(m.total_input_tokens_30d + m.total_output_tokens_30d)} tokens`} icon={DollarSign} color="from-amber-400 to-amber-600" />
          </div>

          {/* Row 2: Secondary KPIs */}
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Deals This Month" value={m.deals_this_month} sub={`${m.deals_last_month} last month`} icon={FolderOpen} color="from-emerald-400 to-emerald-600" change={dealChange} />
            <StatCard label="New Users" value={m.new_users_this_month} sub="this month" icon={UserPlus} color="from-indigo-400 to-indigo-600" />
            <StatCard label="PLG Signups" value={m.plg_signups_30d} sub="last 30 days" icon={TrendingUp} color="from-rose-400 to-rose-600" />
            <StatCard label="Cost / Deal" value={fmtCost(m.ai_cost_per_deal)} sub="AI cost per deal (30d)" icon={Zap} color="from-orange-400 to-orange-600" />
          </div>

          {/* Row 3: Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Orgs by Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={m.orgs_by_plan} color="bg-blue-500" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Deals by State</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={m.deals_by_state} color="bg-teal-500" />
              </CardContent>
            </Card>
          </div>

          {/* Row 4: Token usage time series */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Daily Token Usage (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart data={m.daily_token_usage} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Product Tab ───────────────────────────────────────────────── */}
      {activeTab === "product" && m && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total Deals" value={m.total_deals} icon={FolderOpen} color="from-teal-400 to-teal-600" change={dealChange} />
            <StatCard label="Avg CRs / Deal" value={m.avg_crs_per_deal} icon={Activity} color="from-blue-400 to-blue-600" />
            <StatCard label="Avg Versions / Deal" value={m.avg_versions_per_deal} icon={BarChart3} color="from-purple-400 to-purple-600" />
            <StatCard label="Users Active (30d)" value={m.users_active_30d} sub={`of ${m.total_users} total`} icon={Users} color="from-emerald-400 to-emerald-600" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Deals by State</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={m.deals_by_state} color="bg-teal-500" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Orgs by Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={m.orgs_by_plan} color="bg-blue-500" />
              </CardContent>
            </Card>
          </div>

          {/* Org table */}
          {m.top_orgs_by_ai_cost && m.top_orgs_by_ai_cost.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Organizations by AI Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Organization</th>
                        <th className="pb-2 font-medium text-right">Input Tokens</th>
                        <th className="pb-2 font-medium text-right">Output Tokens</th>
                        <th className="pb-2 font-medium text-right">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.top_orgs_by_ai_cost.map((org: any, i: number) => (
                        <tr key={org.org_id} className={`border-b border-border/50 ${i % 2 === 1 ? "bg-muted/30" : ""}`}>
                          <td className="py-2.5 font-medium">{org.org_name}</td>
                          <td className="py-2.5 text-right">{fmt(org.input_tokens)}</td>
                          <td className="py-2.5 text-right">{fmt(org.output_tokens)}</td>
                          <td className="py-2.5 text-right font-medium">{fmtCost(org.estimated_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Growth (PLG) Tab ──────────────────────────────────────────── */}
      {activeTab === "growth" && m && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Share Links (30d)" value={m.share_links_created_30d} icon={Share2} color="from-blue-400 to-blue-600" />
            <StatCard label="Unique Visitors" value={m.unique_share_link_visitors_30d} sub="last 30 days" icon={Eye} color="from-purple-400 to-purple-600" />
            <StatCard label="Activation Rate" value={`${(m.activation_rate * 100).toFixed(1)}%`} sub="new users with deals" icon={Target} color="from-emerald-400 to-emerald-600" />
            <StatCard label="Growth Coeff." value={m.growth_coefficient.toFixed(2)} sub="links / active org" icon={TrendingUp} color="from-rose-400 to-rose-600" />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Conversion Funnel (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <FunnelChart funnel={m.plg_funnel} />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">PLG Signups (30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <p className="text-4xl font-bold text-teal-500">{m.plg_signups_30d}</p>
                  <p className="text-sm text-muted-foreground mt-1">sign-ups from share links</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Orgs Created by Month</CardTitle>
              </CardHeader>
              <CardContent>
                {m.orgs_created_by_month && m.orgs_created_by_month.length > 0 ? (
                  <BarChart
                    data={Object.fromEntries(m.orgs_created_by_month.map((r: any) => [r.month, r.count]))}
                    color="bg-indigo-500"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No data</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── AI Costs Tab ──────────────────────────────────────────────── */}
      {activeTab === "ai-costs" && m && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total Cost (30d)" value={fmtCost(m.estimated_cost_30d)} icon={DollarSign} color="from-amber-400 to-amber-600" />
            <StatCard label="Input Tokens (30d)" value={fmt(m.total_input_tokens_30d)} sub={fmtCost(m.total_input_tokens_30d * 3 / 1_000_000)} icon={Zap} color="from-blue-400 to-blue-600" />
            <StatCard label="Output Tokens (30d)" value={fmt(m.total_output_tokens_30d)} sub={fmtCost(m.total_output_tokens_30d * 15 / 1_000_000)} icon={Zap} color="from-purple-400 to-purple-600" />
            <StatCard label="Cost / Deal" value={fmtCost(m.ai_cost_per_deal)} icon={FolderOpen} color="from-teal-400 to-teal-600" />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Daily Cost (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart data={m.daily_token_usage} />
            </CardContent>
          </Card>

          {/* Top 10 orgs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top 10 Orgs by AI Cost</CardTitle>
            </CardHeader>
            <CardContent>
              {m.top_orgs_by_ai_cost && m.top_orgs_by_ai_cost.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">#</th>
                        <th className="pb-2 font-medium">Organization</th>
                        <th className="pb-2 font-medium text-right">Input</th>
                        <th className="pb-2 font-medium text-right">Output</th>
                        <th className="pb-2 font-medium text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.top_orgs_by_ai_cost.map((org: any, i: number) => (
                        <tr key={org.org_id} className={`border-b border-border/50 ${i % 2 === 1 ? "bg-muted/30" : ""}`}>
                          <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                          <td className="py-2.5 font-medium">{org.org_name}</td>
                          <td className="py-2.5 text-right">{fmt(org.input_tokens)}</td>
                          <td className="py-2.5 text-right">{fmt(org.output_tokens)}</td>
                          <td className="py-2.5 text-right font-medium text-amber-500">{fmtCost(org.estimated_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No AI usage data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Cost by job type */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Cost by Job Type</CardTitle>
            </CardHeader>
            <CardContent>
              {m.ai_cost_by_job_type && Object.keys(m.ai_cost_by_job_type).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(m.ai_cost_by_job_type as Record<string, number>)
                    .sort(([,a], [,b]) => b - a)
                    .map(([type, cost]) => {
                      const maxCost = Math.max(...Object.values(m.ai_cost_by_job_type as Record<string, number>), 0.01);
                      return (
                        <div key={type} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-24 truncate text-right">{type}</span>
                          <div className="flex-1 h-5 rounded bg-muted/50 overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded transition-all duration-500"
                              style={{ width: `${(cost / maxCost) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium w-16 text-right">{fmtCost(cost)}</span>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No data</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
