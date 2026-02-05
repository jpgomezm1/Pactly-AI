"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, MapPin, Calendar, Search, BarChart3, Activity, Building2, ShoppingCart, AlertTriangle, Heart, SortAsc, ChevronDown, ChevronUp, Maximize2, X, FileText, GitBranch, MessageSquare, Upload, CheckCircle2, Clock } from "lucide-react";
import { dealsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/components/ui/use-toast";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { DealHealthBadge } from "@/components/deal-health-badge";

const stateVariant: Record<string, "default" | "success" | "warning" | "secondary"> = {
  draft: "secondary",
  waiting_on_seller: "warning",
  waiting_on_buyer: "warning",
  counter_sent: "default",
  final_review: "default",
  accepted: "success",
};

const ACTIVE_STATES = ["waiting_on_buyer", "waiting_on_seller", "counter_sent", "final_review"];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "just now";
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusPillColor(state: string) {
  if (ACTIVE_STATES.includes(state)) return "bg-teal-100 text-teal-700";
  if (state === "accepted") return "bg-green-100 text-green-700";
  return "bg-slate-100 text-slate-600";
}

export default function DealsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dealTypeFilter, setDealTypeFilter] = useState("all");
  const [dealType, setDealType] = useState<"sale" | "purchase">("sale");
  const [sortBy, setSortBy] = useState("created_at");
  const [healthFilter, setHealthFilter] = useState<string | null>(null);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [activityFullscreen, setActivityFullscreen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const isReferred = searchParams.get("ref") !== null;

  // Show onboarding wizard for new users
  useEffect(() => {
    if (user && user.has_completed_onboarding === false) {
      if (isReferred) {
        setShowCreate(true);
      } else {
        setShowOnboarding(true);
      }
    }
  }, [user]);

  const { data: deals, isLoading } = useQuery({
    queryKey: ["deals", sortBy, healthFilter],
    queryFn: () => dealsApi.list({
      withHealth: true,
      sortBy,
      healthStatus: healthFilter || undefined,
    }),
  });

  const { data: healthSummary } = useQuery({
    queryKey: ["health-summary"],
    queryFn: () => dealsApi.healthSummary(),
  });

  const { data: activityFeed } = useQuery({
    queryKey: ["activity-feed"],
    queryFn: () => dealsApi.activityFeed(10),
  });

  const createMutation = useMutation({
    mutationFn: () => dealsApi.create({ title, address: address || undefined, deal_type: dealType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["health-summary"] });
      setShowCreate(false);
      setTitle("");
      setAddress("");
      setDealType("sale");
      toast({ title: "Deal created", variant: "success" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create deal", description: err.message, variant: "error" });
    },
  });

  const canCreate = user?.role === "admin";

  const filtered = deals
    ?.filter((d: any) =>
      !search || d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.address?.toLowerCase().includes(search.toLowerCase())
    )
    ?.filter((d: any) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "active") return ACTIVE_STATES.includes(d.current_state);
      if (statusFilter === "draft") return d.current_state === "draft";
      if (statusFilter === "completed") return d.current_state === "accepted";
      return true;
    })
    ?.filter((d: any) => dealTypeFilter === "all" || d.deal_type === dealTypeFilter);

  const totalCount = deals?.length ?? 0;
  const activeCount = deals?.filter((d: any) => ACTIVE_STATES.includes(d.current_state)).length ?? 0;
  const completedCount = deals?.filter((d: any) => d.current_state === "accepted").length ?? 0;

  const filterButtons = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "draft", label: "Draft" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deals</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your contract negotiations</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Deal
          </Button>
        )}
      </div>

      {/* Health Summary Bar */}
      {!isLoading && totalCount > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-700">
            <BarChart3 className="h-3.5 w-3.5" />
            {totalCount} Total
          </div>
          {healthSummary && (
            <>
              <button
                onClick={() => setHealthFilter(healthFilter === "healthy" ? null : "healthy")}
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  healthFilter === "healthy" ? "bg-green-600 text-white" : "bg-green-50 text-green-700 hover:bg-green-100"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {healthSummary.healthy_count} Healthy
              </button>
              <button
                onClick={() => setHealthFilter(healthFilter === "needs_attention" ? null : "needs_attention")}
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  healthFilter === "needs_attention" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {healthSummary.needs_attention_count} Need Attention
              </button>
              <button
                onClick={() => setHealthFilter(healthFilter === "at_risk" ? null : "at_risk")}
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  healthFilter === "at_risk" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {healthSummary.at_risk_count} At Risk
              </button>
            </>
          )}
          <div className="flex items-center gap-2 rounded-full bg-teal-50 px-4 py-1.5 text-sm font-medium text-teal-700">
            {activeCount} Active
          </div>
          <div className="flex items-center gap-2 rounded-full bg-green-50 px-4 py-1.5 text-sm font-medium text-green-700">
            {completedCount} Completed
          </div>
        </div>
      )}

      {/* Filter Pills + Search */}
      {(deals?.length ?? 0) > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            {filterButtons.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === f.key
                    ? "bg-teal-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-slate-200" />
          {[{ key: "all", label: "All Types" }, { key: "sale", label: "Sale" }, { key: "purchase", label: "Purchase" }].map((f) => (
            <button
              key={f.key}
              onClick={() => setDealTypeFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                dealTypeFilter === f.key
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <option value="created_at">Newest</option>
            <option value="health">Health Score</option>
            <option value="activity">Last Activity</option>
          </select>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered?.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={search ? "No matching deals" : "No deals yet"}
          description={
            search
              ? "Try adjusting your search."
              : canCreate
              ? "Create your first deal to get started."
              : "Ask an Admin to assign you to a deal."
          }
          action={
            canCreate && !search
              ? { label: "Create Deal", onClick: () => setShowCreate(true) }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered?.map((deal: any, i: number) => {
            const healthBorder = deal.health_status === "at_risk" ? "border-l-4 border-l-red-400"
              : deal.health_status === "needs_attention" ? "border-l-4 border-l-amber-400"
              : "";
            return (
            <Card
              key={deal.id}
              className={`cursor-pointer bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group ${healthBorder}`}
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => router.push(`/deals/${deal.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base group-hover:text-teal-600 transition-colors">
                    {deal.title}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {deal.health_score != null && (
                      <DealHealthBadge score={deal.health_score} issues={deal.issues} />
                    )}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      deal.deal_type === "purchase" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                    }`}>
                      {deal.deal_type === "purchase" ? <ShoppingCart className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                      {deal.deal_type === "purchase" ? "Purchase" : "Sale"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusPillColor(deal.current_state)}`}
                    >
                      {deal.current_state.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {deal.address && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {deal.address}
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {timeAgo(deal.updated_at ?? deal.created_at)}
                  </span>
                  {deal.open_crs != null && deal.open_crs > 0 && (
                    <span className="text-amber-600">{deal.open_crs} open CRs</span>
                  )}
                  {deal.days_since_last_activity != null && deal.days_since_last_activity > 2 && (
                    <span className="text-slate-400">Last activity {deal.days_since_last_activity}d ago</span>
                  )}
                  {deal.versions_count != null && (
                    <span>v{deal.versions_count}</span>
                  )}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* Activity Timeline */}
      {(activityFeed?.length ?? 0) > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setActivityExpanded(!activityExpanded)}
            className="w-full flex items-center justify-between mb-4 group"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 text-left">Activity Timeline</h2>
                <p className="text-xs text-muted-foreground">{activityFeed?.length} recent events across your deals</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activityExpanded && (
                <span
                  role="button"
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setActivityFullscreen(true); }}
                  title="Expand"
                >
                  <Maximize2 className="h-4 w-4" />
                </span>
              )}
              <span className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                {activityExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                )}
              </span>
            </div>
          </button>

          {activityExpanded && (
            <div className="relative pl-6 border-l-2 border-slate-200 ml-4 space-y-0">
              {activityFeed?.slice(0, 8).map((event: any, idx: number) => {
                const actionIcons: Record<string, { icon: any; color: string; bg: string }> = {
                  contract_parsed: { icon: FileText, color: "text-blue-600", bg: "bg-blue-100" },
                  contract_uploaded: { icon: Upload, color: "text-indigo-600", bg: "bg-indigo-100" },
                  version_generated: { icon: GitBranch, color: "text-purple-600", bg: "bg-purple-100" },
                  change_request_analyzed: { icon: MessageSquare, color: "text-amber-600", bg: "bg-amber-100" },
                  change_request_accepted: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
                  deal_created: { icon: Plus, color: "text-teal-600", bg: "bg-teal-100" },
                };
                const config = actionIcons[event.action] || { icon: Clock, color: "text-slate-600", bg: "bg-slate-100" };
                const Icon = config.icon;

                return (
                  <div
                    key={event.id}
                    className="relative flex items-start gap-4 py-3 cursor-pointer hover:bg-slate-50 rounded-lg px-3 -ml-3 transition-colors group"
                    style={{ animationDelay: `${idx * 40}ms` }}
                    onClick={() => router.push(`/deals/${event.deal_id}`)}
                  >
                    {/* Timeline dot */}
                    <div className={`absolute -left-[calc(1.5rem+5px)] h-2.5 w-2.5 rounded-full border-2 border-white ${config.bg} ring-2 ring-slate-200 group-hover:ring-teal-300 transition-colors`} />

                    <div className={`h-8 w-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 group-hover:text-teal-700 transition-colors">
                        {event.action.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {event.deal_title}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                      {timeAgo(event.created_at)}
                    </span>
                  </div>
                );
              })}

              {(activityFeed?.length ?? 0) > 8 && (
                <button
                  onClick={() => setActivityFullscreen(true)}
                  className="ml-3 text-sm text-teal-600 hover:text-teal-700 font-medium py-3 flex items-center gap-1.5"
                >
                  View all {activityFeed?.length} events
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full-screen Activity Panel */}
      <Dialog open={activityFullscreen} onOpenChange={setActivityFullscreen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-teal-600" />
              Activity Timeline
            </DialogTitle>
            <DialogDescription>
              Full history of actions across your deals
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            <div className="relative pl-6 border-l-2 border-slate-200 space-y-0">
              {activityFeed?.map((event: any, idx: number) => {
                const actionIcons: Record<string, { icon: any; color: string; bg: string }> = {
                  contract_parsed: { icon: FileText, color: "text-blue-600", bg: "bg-blue-100" },
                  contract_uploaded: { icon: Upload, color: "text-indigo-600", bg: "bg-indigo-100" },
                  version_generated: { icon: GitBranch, color: "text-purple-600", bg: "bg-purple-100" },
                  change_request_analyzed: { icon: MessageSquare, color: "text-amber-600", bg: "bg-amber-100" },
                  change_request_accepted: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
                  deal_created: { icon: Plus, color: "text-teal-600", bg: "bg-teal-100" },
                };
                const config = actionIcons[event.action] || { icon: Clock, color: "text-slate-600", bg: "bg-slate-100" };
                const Icon = config.icon;

                return (
                  <div
                    key={event.id}
                    className="relative flex items-start gap-4 py-3 cursor-pointer hover:bg-slate-50 rounded-lg px-3 -ml-3 transition-colors group"
                    onClick={() => { setActivityFullscreen(false); router.push(`/deals/${event.deal_id}`); }}
                  >
                    <div className={`absolute -left-[calc(1.5rem+5px)] h-2.5 w-2.5 rounded-full border-2 border-white ${config.bg} ring-2 ring-slate-200`} />
                    <div className={`h-8 w-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 group-hover:text-teal-700 transition-colors">
                        {event.action.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{event.deal_title}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                      {timeAgo(event.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Deal Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
            <DialogDescription>Add a new real estate deal to start negotiating.</DialogDescription>
            {isReferred && (
              <p className="text-xs text-teal-600 mt-1">Create your first deal — just add a title and paste or upload your contract.</p>
            )}
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Deal Type</label>
              <div className="grid grid-cols-2 gap-3">
                {([["sale", "Sale", "You are selling a property"], ["purchase", "Purchase", "You are buying a property"]] as const).map(([value, label, desc]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDealType(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-4 text-center transition-all ${
                      dealType === value
                        ? "border-teal-600 bg-teal-50 text-teal-700"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    {value === "sale" ? <Building2 className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
                    <span className="font-medium text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Deal Title</label>
              <Input
                placeholder="e.g. 123 Palm Beach Drive"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Property Address</label>
              <Input
                placeholder="Full property address (optional)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!title.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Deal"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Onboarding Wizard */}
      <OnboardingWizard
        open={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
        userName={user?.full_name || ""}
        userRole={user?.role || "agent"}
      />
    </div>
  );
}
