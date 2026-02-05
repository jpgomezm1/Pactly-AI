"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Maximize2 } from "lucide-react";
import { notificationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import NotificationCenter from "@/components/notification-center";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    if (typeof window !== "undefined" && !localStorage.getItem("token")) return;
    try {
      const data = await notificationsApi.unreadCount();
      setUnreadCount(data.count);
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.list(10);
      setNotifications(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  const handleClick = async (n: any) => {
    if (!n.is_read) {
      try {
        await notificationsApi.markRead(n.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
      } catch {}
    }
    if (n.deal_id) {
      window.location.href = `/deals/${n.deal_id}`;
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 0) return "just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button className="relative h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-800 transition-colors">
            <Bell className="h-4 w-4 text-slate-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-indigo-500 text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right" className="w-80 bg-slate-900 border-slate-700 max-h-96 overflow-y-auto">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span className="text-slate-200">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={(e) => { e.preventDefault(); handleMarkAllRead(); }}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={(e) => { e.preventDefault(); setOpen(false); setFullscreen(true); }}
                className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition-colors"
                title="Open full view"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-800" />
          {notifications.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">No notifications</div>
          ) : (
            <>
              {notifications.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 py-2.5 cursor-pointer",
                    !n.is_read && "bg-slate-800/50"
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    {!n.is_read && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />}
                    <span className="text-sm font-medium text-slate-200 truncate">{n.title}</span>
                    <span className="text-[10px] text-slate-500 ml-auto shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 pl-3.5">{n.message}</p>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-slate-800" />
              <button
                onClick={(e) => { e.preventDefault(); setOpen(false); setFullscreen(true); }}
                className="w-full text-center text-xs text-indigo-400 hover:text-indigo-300 font-medium py-2"
              >
                View all notifications
              </button>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <NotificationCenter
        open={fullscreen}
        onClose={() => { setFullscreen(false); fetchUnreadCount(); }}
      />
    </>
  );
}
