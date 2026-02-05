"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, Users, FolderOpen, ChevronRight, Search,
  Activity, TrendingUp, Shield, Zap, Clock, MoreVertical,
  Snowflake, Power, Trash2, AlertTriangle,
} from "lucide-react";
import { superAdminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const planColors: Record<string, string> = {
  starter: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  growth: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  business: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  enterprise: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
};

const planTokens: Record<string, string> = {
  starter: "25",
  growth: "100",
  business: "500",
  enterprise: "Unlimited",
};

const planTokenNums: Record<string, number> = {
  starter: 25,
  growth: 100,
  business: 500,
  enterprise: 9999,
};

const planIcons: Record<string, typeof Zap> = {
  starter: Shield,
  growth: TrendingUp,
  business: Building2,
  enterprise: Zap,
};

const planDescriptions: Record<string, string> = {
  starter: "Best for individuals. 25 tokens/mo, up to 3 users.",
  growth: "For small teams. 100 tokens/mo, up to 10 users.",
  business: "For growing companies. 500 tokens/mo, up to 50 users.",
  enterprise: "Full power, unlimited tokens and users.",
};

const planBorderColors: Record<string, string> = {
  starter: "border-l-slate-400",
  growth: "border-l-teal-500",
  business: "border-l-blue-500",
  enterprise: "border-l-purple-500",
};

export default function SuperAdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", slug: "", plan: "growth" });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["super-admin-orgs"],
    queryFn: () => superAdminApi.listOrgs(),
  });

  const createMutation = useMutation({
    mutationFn: () => superAdminApi.createOrg(form),
    onSuccess: (newOrg) => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      setDialogOpen(false);
      setForm({ name: "", slug: "", plan: "growth" });
      toast({ title: "Organization created", variant: "success" });
      router.push(`/super-admin/${newOrg.id}`);
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "error" }),
  });

  const freezeMutation = useMutation({
    mutationFn: ({ orgId, freeze }: { orgId: string; freeze: boolean }) =>
      superAdminApi.updateOrg(orgId, { is_active: !freeze }),
    onSuccess: (_, { freeze }) => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      toast({ title: freeze ? "Organization frozen" : "Organization unfrozen", variant: "success" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (orgId: string) => superAdminApi.deleteOrg(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      setDeleteTarget(null);
      toast({ title: "Organization deleted", variant: "success" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete", description: err.message, variant: "error" });
    },
  });

  const filteredOrgs = orgs?.filter((org: any) =>
    org.name.toLowerCase().includes(search.toLowerCase()) ||
    org.slug.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalUsers = orgs?.reduce((sum: number, o: any) => sum + (o.user_count || 0), 0) || 0;
  const totalDeals = orgs?.reduce((sum: number, o: any) => sum + (o.deal_count || 0), 0) || 0;
  const activeOrgs = orgs?.filter((o: any) => o.is_active).length || 0;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-teal-500" />
            <h1 className="text-2xl font-bold tracking-tight">Platform Management</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage organizations, users, and plans across the platform
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> New Organization</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">Organization Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                    setForm({ ...form, name, slug });
                  }}
                  placeholder="Acme Realty Group"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slug (URL identifier)</label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  placeholder="acme-realty"
                  required
                />
                <p className="text-xs text-muted-foreground">Used in URLs. Only lowercase letters, numbers, and hyphens.</p>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">Plan</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["starter", "growth", "business", "enterprise"] as const).map((plan) => {
                    const PlanIcon = planIcons[plan];
                    const isSelected = form.plan === plan;
                    return (
                      <button
                        key={plan}
                        type="button"
                        onClick={() => setForm({ ...form, plan })}
                        className={`text-left rounded-lg border-2 p-3 transition-all ${
                          isSelected
                            ? "border-teal-500 bg-teal-50/50 dark:bg-teal-900/20"
                            : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <PlanIcon className={`h-3.5 w-3.5 ${isSelected ? "text-teal-500" : "text-muted-foreground"}`} />
                          <span className="text-sm font-semibold capitalize">{plan}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          {planDescriptions[plan]}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? <><Spinner size="sm" /> Creating...</> : "Create Organization"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-teal-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-sm">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeOrgs}</p>
                <p className="text-xs text-muted-foreground">Active Organizations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-sm">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalUsers}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-sm">
                <FolderOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalDeals}</p>
                <p className="text-xs text-muted-foreground">Total Deals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search organizations..."
          className="pl-10"
        />
      </div>

      {/* Org List */}
      {filteredOrgs.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground font-medium">
            {search ? "No organizations match your search" : "No organizations yet"}
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {search ? "Try a different search term" : "Create your first organization to get started."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredOrgs.map((org: any) => {
            const tokenLimit = planTokenNums[org.plan] || 25;
            const estimatedUsage = Math.min(tokenLimit, (org.deal_count || 0));
            const usagePct = tokenLimit === 9999 ? (org.deal_count > 0 ? Math.min(30, org.deal_count) : 0) : Math.round((estimatedUsage / tokenLimit) * 100);
            const PlanIcon = planIcons[org.plan] || Shield;

            return (
              <Card
                key={org.id}
                className={`cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:border-teal-500/40 transition-all duration-200 group border-l-4 ${planBorderColors[org.plan] || "border-l-slate-400"}`}
                onClick={() => router.push(`/super-admin/${org.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center shrink-0 text-xs font-bold text-slate-600 dark:text-slate-300">
                        {org.name?.charAt(0)?.toUpperCase() || "O"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate">{org.name}</p>
                        <p className="text-xs font-normal text-muted-foreground">{org.slug}</p>
                      </div>
                    </CardTitle>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 ${planColors[org.plan] || planColors.starter}`}>
                        <PlanIcon className="h-3 w-3" />
                        {org.plan}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                          >
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={() => freezeMutation.mutate({ orgId: org.id, freeze: org.is_active })}
                          >
                            {org.is_active ? (
                              <><Snowflake className="h-4 w-4 text-blue-500" /> Freeze</>
                            ) : (
                              <><Power className="h-4 w-4 text-emerald-500" /> Unfreeze</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget({ id: org.id, name: org.name })}
                            className="text-rose-500 focus:text-rose-500"
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> {org.user_count} users
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5" /> {org.deal_count} deals
                    </span>
                    <span className="flex items-center gap-1.5 ml-auto">
                      <Activity className="h-3.5 w-3.5" /> {planTokens[org.plan] || "25"} tokens/mo
                    </span>
                  </div>

                  {/* Usage bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-muted-foreground">Token usage estimate</span>
                      <span className="text-[11px] text-muted-foreground font-medium">{usagePct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${usagePct >= 80 ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-teal-400 to-teal-500"}`}
                        style={{ width: `${usagePct}%` }}
                      />
                    </div>
                  </div>

                  {/* Last activity indicator */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {!org.is_active ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          <span className="text-xs text-rose-500 font-medium">Deactivated</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3 text-muted-foreground/60" />
                          <span className="text-[11px] text-muted-foreground/60">
                            {org.updated_at ? `Updated ${new Date(org.updated_at).toLocaleDateString()}` : "Active"}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="text-xs text-teal-500 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Manage <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="h-5 w-5" /> Delete Organization
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to permanently delete <span className="font-semibold text-foreground">{deleteTarget?.name}</span>?
              This will deactivate all users in the organization. This action cannot be undone.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <><Spinner size="sm" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
