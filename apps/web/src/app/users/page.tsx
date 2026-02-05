"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, MoreVertical, UserPlus, Circle } from "lucide-react";
import { usersApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  agent: "Agent",
};

const roleDescriptions: Record<string, string> = {
  admin: "Create deals, assign users, see all org deals, manage settings",
  agent: "See assigned deals, own metrics, create change requests",
};

const roleColors: Record<string, { bg: string; text: string; ring: string }> = {
  admin: { bg: "bg-purple-100", text: "text-purple-700", ring: "ring-purple-400" },
  agent: { bg: "bg-teal-100", text: "text-teal-700", ring: "ring-teal-400" },
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", password: "", role: "agent" });

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => usersApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDialogOpen(false);
      setForm({ email: "", full_name: "", password: "", role: "agent" });
      toast({ title: "Team member added", variant: "success" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "error" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ userId, is_active }: { userId: string; is_active: boolean }) =>
      usersApi.update(userId, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "User updated", variant: "success" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your Team</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage members and their roles</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {users?.length || 0} members
          </span>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4" /> Invite Member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Smith" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 8 characters" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <div className="space-y-2">
                  {Object.entries(roleLabels).map(([value, label]) => {
                    const colors = roleColors[value] || { bg: "bg-gray-100", text: "text-gray-700" };
                    return (
                      <label
                        key={value}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          form.role === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={value}
                          checked={form.role === value}
                          onChange={(e) => setForm({ ...form, role: e.target.value })}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{label}</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
                              {label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{roleDescriptions[value]}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? <><Spinner size="sm" /> Adding...</> : "Invite Member"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {users && users.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-semibold">Invite your first team member</h3>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
              Add agents and coordinators to collaborate on contracts and deals.
            </p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <UserPlus className="h-4 w-4" /> Invite Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {users?.map((u: any) => {
                const colors = roleColors[u.role] || { bg: "bg-gray-100", text: "text-gray-700", ring: "ring-gray-400" };
                return (
                  <div key={u.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                    <div className={`ring-2 ${colors.ring} rounded-full`}>
                      <Avatar size="sm">
                        <AvatarFallback>
                          {u.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{u.full_name}</p>
                        <Circle
                          className={`h-2 w-2 shrink-0 ${u.is_active ? "fill-emerald-500 text-emerald-500" : "fill-rose-400 text-rose-400"}`}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
                      {roleLabels[u.role] || u.role}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => toggleMutation.mutate({ userId: u.id, is_active: !u.is_active })}
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
