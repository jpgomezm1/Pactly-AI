"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  organization_id?: string | null;
  organization_name?: string | null;
  plan?: string | null;
  logo_url?: string | null;
  has_completed_onboarding?: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem("token", res.access_token);
    const me = await authApi.me();
    setUser(me);
    if (me.role === "super_admin") {
      router.push("/super-admin");
    } else {
      router.push("/deals");
    }
  }, [router]);

  const register = useCallback(async (data: {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
    plan?: string;
    billing_cycle?: string;
    ref_token?: string;
  }) => {
    const res = await authApi.register(data);
    localStorage.setItem("token", res.access_token);
    const me = await authApi.me();
    setUser(me);
    router.push("/deals");
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    router.push("/login");
  }, [router]);

  return { user, loading, login, register, logout };
}
