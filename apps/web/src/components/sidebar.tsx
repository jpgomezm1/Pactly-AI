"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Users,
  Shield,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-media-query";
import { NotificationBell } from "@/components/notification-bell";
import { TokenUsageBadge } from "@/components/token-usage-badge";

interface SidebarProps {
  user: { full_name: string; email: string; role: string; organization_name?: string | null; plan?: string | null; logo_url?: string | null } | null;
  onLogout: () => void;
}

const navItems = [
  { href: "/deals", icon: FolderOpen, label: "Deals", roles: ["admin", "agent"], section: "workspace" },
  { href: "/users", icon: Users, label: "Team", roles: ["admin"], section: "admin" },
  { href: "/settings", icon: Settings, label: "Settings", roles: ["admin"], section: "admin" },
  { href: "/super-admin/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["super_admin"], section: "admin" },
  { href: "/super-admin", icon: Shield, label: "Platform", roles: ["super_admin"], section: "admin" },
  { href: "/super-admin/plg", icon: TrendingUp, label: "Growth", roles: ["super_admin"], section: "admin" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return user?.role && item.roles.includes(user.role);
  });

  const superAdminSubRoutes = navItems.filter(n => n.href.startsWith("/super-admin/")).map(n => n.href);
  const getIsActive = (href: string) => {
    if (href === "/super-admin") {
      // Platform: active only if on /super-admin exactly or an org detail page (not a known sub-route)
      if (pathname === "/super-admin") return true;
      if (!pathname.startsWith("/super-admin/")) return false;
      return !superAdminSubRoutes.some(sub => pathname.startsWith(sub));
    }
    return pathname.startsWith(href);
  };

  const workspaceItems = visibleItems.filter((item) => item.section === "workspace");
  const adminItems = visibleItems.filter((item) => item.section === "admin");

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo / Org */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-800/60">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-lg bg-teal-500/20 blur-md" />
          <img
            src={user?.logo_url || "https://storage.googleapis.com/cluvi/Pactly.AI/logo_pactly_final.png"}
            alt={user?.organization_name || "Pactly"}
            className="relative h-8 w-8 shrink-0 object-contain rounded-lg"
          />
        </div>
        <div
          className={cn(
            "flex items-center gap-2 min-w-0 transition-opacity duration-200",
            collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          )}
        >
          <span className="font-semibold text-white text-base tracking-tight truncate">
            {user?.organization_name || "Pactly"}
          </span>
          {user?.plan && (
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded">
              {user.plan}
            </span>
          )}
        </div>
        <div className="ml-auto shrink-0">
          <NotificationBell />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* Workspace section */}
        {workspaceItems.length > 0 && (
          <>
            <div
              className={cn(
                "transition-opacity duration-200",
                collapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
              )}
            >
              <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Workspace
              </span>
            </div>
            {workspaceItems.map((item) => {
              const isActive = getIsActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => isMobile && setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "border-l-[3px] border-teal-400 bg-white/5 text-white"
                      : "border-l-[3px] border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-teal-400" : "text-slate-500")} />
                  <span
                    className={cn(
                      "transition-opacity duration-200",
                      collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </>
        )}

        {/* Admin section */}
        {adminItems.length > 0 && (
          <>
            <div className={cn(
              "pt-3 transition-opacity duration-200",
              collapsed ? "opacity-0 h-0 overflow-hidden pt-0" : "opacity-100"
            )}>
              <div className="border-t border-slate-800/60 mb-3" />
              <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Admin
              </span>
            </div>
            {collapsed && <div className="border-t border-slate-800/60 my-2" />}
            {adminItems.map((item) => {
              const isActive = getIsActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => isMobile && setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "border-l-[3px] border-teal-400 bg-white/5 text-white"
                      : "border-l-[3px] border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-teal-400" : "text-slate-500")} />
                  <span
                    className={cn(
                      "transition-opacity duration-200",
                      collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Token Usage */}
      {user && user.role !== "super_admin" && (
        <div className="px-3 pb-2">
          <TokenUsageBadge collapsed={collapsed} />
        </div>
      )}

      {/* User */}
      {user && (
        <div className="p-3 border-t border-slate-800/60">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left",
                collapsed && "justify-center px-0"
              )}>
                <Avatar size="sm" className="ring-2 ring-teal-500/50">
                  <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "flex-1 min-w-0 transition-opacity duration-200",
                    collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                  )}
                >
                  <p className="text-sm font-medium truncate text-slate-200">{user.full_name}</p>
                  <p className="text-xs truncate text-slate-500">{user.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56 bg-slate-900 border-slate-700">
              <DropdownMenuLabel>
                <p className="font-medium text-slate-200">{user.full_name}</p>
                <p className="text-xs text-slate-500 font-normal">{user.role.replace(/_/g, " ")}</p>
                {user.organization_name && (
                  <p className="text-xs text-slate-500 font-normal mt-0.5">{user.organization_name}</p>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem onClick={onLogout} className="text-rose-400 focus:text-rose-400 focus:bg-slate-800">
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Developed by */}
      <div className={cn("px-3 pb-3", collapsed && "px-1")}>
        <a
          href="https://stayirrelevant.com/"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/5",
            collapsed && "justify-center px-0"
          )}
        >
          <span
            className={cn(
              "text-[10px] text-slate-500 transition-opacity duration-200",
              collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
            )}
          >
            Developed by
          </span>
          <img
            src="https://storage.googleapis.com/cluvi/nuevo_irre-removebg-preview.png"
            alt="Irrelevant"
            className={cn("object-contain", collapsed ? "h-5" : "h-4")}
          />
        </a>
      </div>

      {/* Collapse toggle (desktop only) */}
      {!isMobile && (
        <button
          onClick={toggleCollapsed}
          className="absolute top-20 -right-3 h-6 w-6 rounded-full border border-slate-700 bg-slate-900 shadow-sm flex items-center justify-center hover:bg-slate-800 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3 text-slate-400" />
          ) : (
            <ChevronLeft className="h-3 w-3 text-slate-400" />
          )}
        </button>
      )}
    </div>
  );

  // Mobile: overlay sidebar
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-40 h-10 w-10 rounded-lg border border-slate-700 bg-slate-900 shadow-sm flex items-center justify-center lg:hidden"
        >
          <Menu className="h-5 w-5 text-slate-400" />
        </button>
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 animate-slide-up">
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/5"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
              {sidebarContent}
            </aside>
          </>
        )}
      </>
    );
  }

  // Desktop: fixed sidebar
  return (
    <aside
      className={cn(
        "relative h-screen border-r border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {sidebarContent}
    </aside>
  );
}
