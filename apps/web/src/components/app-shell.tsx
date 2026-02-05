"use client";

import { Sidebar } from "./sidebar";
import { AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";

interface AppShellProps {
  children: React.ReactNode;
  user: { full_name: string; email: string; role: string; organization_name?: string | null; plan?: string | null; logo_url?: string | null } | null;
  onLogout: () => void;
  mockMode?: boolean;
}

export function AppShell({ children, user, onLogout, mockMode }: AppShellProps) {
  const [showMock, setShowMock] = useState(true);

  useEffect(() => {
    if (localStorage.getItem("dismiss-mock-banner") === "true") {
      setShowMock(false);
    }
  }, []);

  const dismissMock = () => {
    setShowMock(false);
    localStorage.setItem("dismiss-mock-banner", "true");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />
      <main className="flex-1 overflow-auto">
        <div className="h-px bg-gradient-to-r from-teal-500 to-transparent" />
        {mockMode && showMock && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 text-amber-800 text-sm animate-slide-down">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-200/60 shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <span>
                <strong className="font-semibold">Mock Mode</strong>
                <span className="mx-1.5 text-amber-400">&mdash;</span>
                <span className="text-amber-700">
                  AI responses are simulated. Set{" "}
                  <code className="text-xs bg-amber-100 px-1 py-0.5 rounded font-mono">
                    ANTHROPIC_API_KEY
                  </code>{" "}
                  for real analysis.
                </span>
              </span>
            </div>
            <button
              onClick={dismissMock}
              className="text-amber-600 hover:text-amber-800 text-xs font-medium whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="animate-fade-in p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
