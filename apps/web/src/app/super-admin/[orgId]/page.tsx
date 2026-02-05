"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, Users, FolderOpen, Plus, Save,
  Activity, Mail, Shield, UserCheck, UserX, MoreVertical,
  LayoutGrid, UserCog, BarChart3, Snowflake, Power, Trash2, AlertTriangle,
} from "lucide-react";
import { superAdminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const planColors: Record<string, string> = {
  starter: "bg-slate-100 text-slate-700",
  growth: "bg-teal-100 text-teal-700",
  business: "bg-blue-100 text-blue-700",
  enterprise: "bg-purple-100 text-purple-700",
};

const planLimits: Record<string, { tokens: string; users: string; branding: boolean }> = {
  starter:    { tokens: "25/mo",       users: "3",         branding: false },
  growth:     { tokens: "100/mo",      users: "10",        branding: true },
  business:   { tokens: "500/mo",      users: "50",        branding: true },
  enterprise: { tokens: "Unlimited",   users: "Unlimited", branding: true },
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  agent: "Agent",
};

const roleColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  agent: "bg-teal-100 text-teal-700",
};

const roleBorderColors: Record<string, string> = {
  admin: "border-l-purple-500",
  agent: "border-l-teal-500",
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "users", label: "Users", icon: UserCog },
  { id: "usage", label: "Usage", icon: BarChart3 },
  { id: "ai-usage", label: "AI Usage", icon: Activity },
] as const;

export default function OrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: org, isLoading } = useQuery({
    queryKey: ["super-admin-org", orgId],
    queryFn: () => superAdminApi.getOrg(orgId),
  });

  const { data: orgUsers } = useQuery({
    queryKey: ["super-admin-org-users", orgId],
    queryFn: () => superAdminApi.listOrgUsers(orgId),
  });

  const { data: usage } = useQuery({
    queryKey: ["super-admin-org-usage", orgId],
    queryFn: () => superAdminApi.getOrgUsage(orgId),
  });

  const { data: aiUsage } = useQuery({
    queryKey: ["super-admin-org-ai-usage", orgId],
    queryFn: () => superAdminApi.getOrgAIUsage(orgId),
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [editPlan, setEditPlan] = useState<string | null>(null);
  const [editActive, setEditActive] = useState<boolean | null>(null);
  const [userDialog, setUserDialog] = useState(false);
  const [userForm, setUserForm] = useState({ email: "", full_name: "", password: "", role: "admin" });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, any>) => superAdminApi.updateOrg(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-org", orgId] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      setEditPlan(null);
      setEditActive(null);
      toast({ title: "Organization updated", variant: "success" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "error" }),
  });

  const freezeMutation = useMutation({
    mutationFn: (freeze: boolean) => superAdminApi.updateOrg(orgId, { is_active: !freeze }),
    onSuccess: (_, freeze) => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-org", orgId] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      toast({ title: freeze ? "Organization frozen" : "Organization unfrozen", variant: "success" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => superAdminApi.deleteOrg(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-orgs"] });
      toast({ title: "Organization deleted", variant: "success" });
      router.push("/super-admin");
    },
    onError: (err: Error) => toast({ title: "Failed to delete", description: err.message, variant: "error" }),
  });

  const createUserMutation = useMutation({
    mutationFn: () => superAdminApi.createOrgUser(orgId, userForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-org", orgId] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-org-users", orgId] });
      setUserDialog(false);
      setUserForm({ email: "", full_name: "", password: "", role: "admin" });
      toast({ title: "User created", variant: "success" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "error" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="text-center py-24">
        <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">Organization not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/super-admin")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  const displayPlan = editPlan ?? org.plan;
  const displayActive = editActive ?? org.is_active;
  const hasChanges = (editPlan !== null && editPlan !== org.plan) || (editActive !== null && editActive !== org.is_active);
  const limits = planLimits[displayPlan] || planLimits.starter;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/super-admin")}
          className="rounded-full h-9 w-9 p-0 hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
          <span className="text-sm font-bold text-white">
            {org.name?.charAt(0)?.toUpperCase() || "O"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${planColors[org.plan] || planColors.starter}`}>
              {org.plan}
            </span>
            {!org.is_active && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">Deactivated</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{org.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => freezeMutation.mutate(org.is_active)}
            disabled={freezeMutation.isPending}
          >
            {freezeMutation.isPending ? (
              <Spinner size="sm" />
            ) : org.is_active ? (
              <><Snowflake className="h-4 w-4 text-blue-500" /> Freeze</>
            ) : (
              <><Power className="h-4 w-4 text-emerald-500" /> Unfreeze</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-rose-500 hover:text-rose-600 hover:border-rose-300"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          {hasChanges && (
            <Button
              onClick={() => {
                const data: Record<string, any> = {};
                if (editPlan !== null) data.plan = editPlan;
                if (editActive !== null) data.is_active = editActive;
                updateMutation.mutate(data);
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <><Spinner size="sm" /> Saving...</> : <><Save className="h-4 w-4" /> Save Changes</>}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-sm">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold">{org.user_count}</p>
                <p className="text-xs text-muted-foreground">Users (max {limits.users})</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-sm">
                <FolderOpen className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold">{org.deal_count}</p>
                <p className="text-xs text-muted-foreground">Deals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-sm">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold">{limits.tokens}</p>
                <p className="text-xs text-muted-foreground">Token Limit</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold">{limits.branding ? "Yes" : "No"}</p>
                <p className="text-xs text-muted-foreground">Custom Branding</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-teal-500 text-teal-600 dark:text-teal-400"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Plan & Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Plan</label>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                value={displayPlan}
                onChange={(e) => setEditPlan(e.target.value)}
              >
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="business">Business</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Active</label>
              <button
                onClick={() => setEditActive(!displayActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${displayActive ? "bg-teal-500" : "bg-slate-600"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${displayActive ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            {/* Plan details */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Plan includes</p>
              <div className="flex justify-between"><span className="text-muted-foreground">Tokens</span><span className="font-medium">{limits.tokens}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Max Users</span><span className="font-medium">{limits.users}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Branding</span><span className="font-medium">{limits.branding ? "Included" : "Not included"}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Team Members
                <span className="text-xs font-normal text-muted-foreground">({orgUsers?.length || 0})</span>
              </CardTitle>
              <Dialog open={userDialog} onOpenChange={setUserDialog}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-3.5 w-3.5" /> Add User</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create User for {org.name}</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); createUserMutation.mutate(); }} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Full Name</label>
                      <Input value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })} placeholder="Jane Smith" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email</label>
                      <Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="jane@company.com" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Password</label>
                      <Input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Min. 8 characters" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role</label>
                      <select
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                        value={userForm.role}
                        onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      >
                        <option value="admin">Admin</option>
                        <option value="agent">Agent</option>
                      </select>
                    </div>
                    <Button type="submit" className="w-full" disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending ? <><Spinner size="sm" /> Creating...</> : "Create User"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!orgUsers || orgUsers.length === 0 ? (
              <div className="text-center py-10">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No users yet. Add the first admin.</p>
              </div>
            ) : (
              <div className="divide-y">
                {orgUsers.map((u: any) => (
                  <div
                    key={u.id}
                    className={`flex items-center gap-3 px-6 py-3.5 hover:bg-muted/30 transition-colors border-l-4 ${roleBorderColors[u.role] || "border-l-slate-300"}`}
                  >
                    <Avatar size="sm">
                      <AvatarFallback>{getInitials(u.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{u.full_name}</p>
                        {!u.is_active && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-500 font-medium">
                            <UserX className="h-3 w-3" /> Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {u.email}
                      </p>
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${roleColors[u.role] || "bg-slate-100 text-slate-700"}`}>
                      {roleLabels[u.role] || u.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Usage Tab */}
      {activeTab === "usage" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Token Usage History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!usage || usage.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No usage data yet. Tokens are consumed when deals are created.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Period</th>
                      <th className="pb-2 font-medium text-right">Included</th>
                      <th className="pb-2 font-medium text-right">Used</th>
                      <th className="pb-2 font-medium text-right">Extra</th>
                      <th className="pb-2 font-medium text-right">Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((u: any, i: number) => {
                      const pct = u.tokens_included > 0 ? Math.min(100, Math.round((u.tokens_used / u.tokens_included) * 100)) : 0;
                      return (
                        <tr key={i} className={`border-b border-border/50 ${i % 2 === 1 ? "bg-muted/30" : ""}`}>
                          <td className="py-3">{u.period_start} — {u.period_end}</td>
                          <td className="py-3 text-right">{u.tokens_included}</td>
                          <td className="py-3 text-right font-medium">{u.tokens_used}</td>
                          <td className="py-3 text-right">
                            {u.extra_tokens_used > 0
                              ? <span className="text-amber-500 font-medium">{u.extra_tokens_used}</span>
                              : <span className="text-muted-foreground">0</span>}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    pct >= 80
                                      ? "bg-gradient-to-r from-amber-400 to-rose-500"
                                      : "bg-gradient-to-r from-teal-400 to-teal-500"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Usage Tab */}
      {activeTab === "ai-usage" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              AI Token Consumption
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!aiUsage ? (
              <div className="text-center py-8">
                <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No AI usage data available.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Input Tokens</p>
                    <p className="text-xl font-bold mt-1">{aiUsage.total_input_tokens?.toLocaleString() || 0}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Output Tokens</p>
                    <p className="text-xl font-bold mt-1">{aiUsage.total_output_tokens?.toLocaleString() || 0}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Estimated Cost</p>
                    <p className="text-xl font-bold mt-1 text-amber-500">${aiUsage.estimated_cost?.toFixed(2) || "0.00"}</p>
                  </div>
                </div>

                {/* Daily usage chart */}
                {aiUsage.daily_usage && aiUsage.daily_usage.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Daily Token Usage</p>
                    <div className="relative">
                      <svg viewBox="-2 -2 104 104" className="w-full h-32" preserveAspectRatio="none">
                        {(() => {
                          const data = aiUsage.daily_usage;
                          const maxVal = Math.max(...data.map((d: any) => d.input_tokens + d.output_tokens), 1);
                          const points = data.map((d: any, i: number) => {
                            const x = (i / Math.max(data.length - 1, 1)) * 100;
                            const y = 100 - ((d.input_tokens + d.output_tokens) / maxVal) * 100;
                            return `${x},${y}`;
                          });
                          return (
                            <>
                              <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-teal-500" vectorEffect="non-scaling-stroke" />
                              <polyline points={`0,100 ${points.join(" ")} 100,100`} fill="currentColor" className="text-teal-500/10" />
                            </>
                          );
                        })()}
                      </svg>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>{aiUsage.daily_usage[0]?.date}</span>
                        <span>{aiUsage.daily_usage[aiUsage.daily_usage.length - 1]?.date}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Deals breakdown */}
                {aiUsage.deals_breakdown && aiUsage.deals_breakdown.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Cost by Deal</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 font-medium">Deal</th>
                            <th className="pb-2 font-medium text-right">Input</th>
                            <th className="pb-2 font-medium text-right">Output</th>
                            <th className="pb-2 font-medium text-right">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiUsage.deals_breakdown.map((d: any, i: number) => (
                            <tr key={d.deal_id} className={`border-b border-border/50 ${i % 2 === 1 ? "bg-muted/30" : ""}`}>
                              <td className="py-2.5 font-medium truncate max-w-[200px]">{d.title}</td>
                              <td className="py-2.5 text-right">{d.input_tokens?.toLocaleString()}</td>
                              <td className="py-2.5 text-right">{d.output_tokens?.toLocaleString()}</td>
                              <td className="py-2.5 text-right font-medium text-amber-500">${d.estimated_cost?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="h-5 w-5" /> Delete Organization
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to permanently delete <span className="font-semibold text-foreground">{org?.name}</span>?
              This will deactivate all users in the organization. This action cannot be undone.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
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
