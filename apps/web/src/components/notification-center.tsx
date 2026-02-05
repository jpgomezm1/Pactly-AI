"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Bell,
  Sparkles,
  Filter,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { notificationsApi } from "@/lib/api";

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  deal_id?: string;
  is_read: boolean;
  created_at: string;
}

type FilterType = "all" | "unread" | string;

export default function NotificationCenter({
  open,
  onClose,
}: NotificationCenterProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [showAISummary, setShowAISummary] = useState(true);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationsApi.list(50);
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await notificationsApi.markRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.deal_id) {
      onClose();
      router.push(`/deals/${notification.deal_id}`);
    }
  };

  const generateAISummary = () => {
    const unreadCount = notifications.filter((n) => !n.is_read).length;
    const typeCounts: Record<string, number> = {};

    notifications
      .filter((n) => !n.is_read)
      .forEach((n) => {
        typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
      });

    const parts: string[] = [];

    if (typeCounts.stale_deal) {
      parts.push(
        `${typeCounts.stale_deal} ${typeCounts.stale_deal === 1 ? "deal needs" : "deals need"} attention`
      );
    }
    if (typeCounts.change_request) {
      parts.push(
        `${typeCounts.change_request} new change ${typeCounts.change_request === 1 ? "request" : "requests"}`
      );
    }
    if (typeCounts.version) {
      parts.push(
        `${typeCounts.version} ${typeCounts.version === 1 ? "version" : "versions"} generated`
      );
    }
    if (typeCounts.feedback) {
      parts.push(
        `${typeCounts.feedback} feedback ${typeCounts.feedback === 1 ? "item" : "items"} received`
      );
    }

    // Catch all other types
    const otherTypes = Object.keys(typeCounts).filter(
      (t) => !["stale_deal", "change_request", "version", "feedback"].includes(t)
    );
    const otherCount = otherTypes.reduce((sum, t) => sum + typeCounts[t], 0);
    if (otherCount > 0) {
      parts.push(`${otherCount} other ${otherCount === 1 ? "update" : "updates"}`);
    }

    if (parts.length === 0) {
      return "No unread notifications. You're all caught up!";
    }

    return parts.join(", ") + ".";
  };

  const getNotificationTypes = () => {
    const types = new Set(notifications.map((n) => n.type));
    return Array.from(types);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.is_read;
    return n.type === filter;
  });

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  };

  const getTypeLabel = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white ml-16 lg:ml-64 animate-in fade-in duration-200">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-teal-600" />
            <h1 className="text-2xl font-semibold text-slate-900">
              Notifications
            </h1>
            {notifications.filter((n) => !n.is_read).length > 0 && (
              <span className="px-2.5 py-0.5 text-xs font-medium bg-teal-100 text-teal-700 rounded-full">
                {notifications.filter((n) => !n.is_read).length} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.is_read) && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:text-teal-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 flex items-center gap-2 overflow-x-auto">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
              filter === "all"
                ? "bg-teal-100 text-teal-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
              filter === "unread"
                ? "bg-teal-100 text-teal-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Unread
          </button>
          {getNotificationTypes().map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                filter === type
                  ? "bg-teal-100 text-teal-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {getTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto h-[calc(100vh-140px)] px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : (
          <>
            {/* AI Summary */}
            {notifications.length > 0 && (
              <div className="mb-6 animate-in slide-in-from-top duration-300">
                <div className="rounded-lg border-2 border-transparent bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 p-[2px]">
                  <div className="bg-white rounded-md">
                    <button
                      onClick={() => setShowAISummary(!showAISummary)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-teal-600" />
                        <span className="font-semibold text-slate-900">
                          AI Summary
                        </span>
                      </div>
                      {showAISummary ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    {showAISummary && (
                      <div className="px-4 pb-4 text-sm text-slate-600 animate-in fade-in duration-200">
                        {generateAISummary()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notifications List */}
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">
                  {filter === "unread"
                    ? "No unread notifications"
                    : filter === "all"
                      ? "No notifications yet"
                      : `No ${getTypeLabel(filter)} notifications`}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredNotifications.map((notification, index) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`group p-4 rounded-lg border transition-all cursor-pointer animate-in slide-in-from-top duration-300 ${
                      !notification.is_read
                        ? "bg-teal-50 border-teal-200 hover:bg-teal-100"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex gap-3">
                      {/* Unread dot */}
                      <div className="flex-shrink-0 pt-1">
                        {!notification.is_read ? (
                          <div className="w-2 h-2 bg-teal-600 rounded-full"></div>
                        ) : (
                          <div className="w-2 h-2"></div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3
                            className={`font-medium ${
                              !notification.is_read
                                ? "text-slate-900"
                                : "text-slate-700"
                            }`}
                          >
                            {notification.title}
                          </h3>
                          <span className="text-xs text-slate-500 whitespace-nowrap">
                            {formatTimeAgo(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {getTypeLabel(notification.type)}
                          </span>
                          {notification.deal_id && (
                            <span className="text-xs text-teal-600 group-hover:underline">
                              View deal →
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mark as read button */}
                      {!notification.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          className="flex-shrink-0 p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
