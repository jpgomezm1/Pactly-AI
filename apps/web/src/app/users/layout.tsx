"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { Spinner } from "@/components/ui/spinner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function UsersLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [mockMode, setMockMode] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((d) => setMockMode(!!d.llm_mock_mode))
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  if (user.role !== "admin") {
    router.push("/deals");
    return null;
  }

  return (
    <AppShell user={user} onLogout={logout} mockMode={mockMode}>
      {children}
    </AppShell>
  );
}
