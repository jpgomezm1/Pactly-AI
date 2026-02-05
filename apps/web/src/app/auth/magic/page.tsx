"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { Loader2 } from "lucide-react";

function MagicLinkContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("No token provided");
      return;
    }

    authApi
      .validateMagicLink(token)
      .then((res: { access_token: string; redirect_path?: string }) => {
        localStorage.setItem("token", res.access_token);
        router.replace(res.redirect_path || "/deals");
      })
      .catch((err: Error) => {
        setError(err.message || "Invalid or expired magic link");
      });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4 max-w-sm mx-auto p-6">
          <h1 className="text-xl font-bold text-slate-900">Link Invalid</h1>
          <p className="text-sm text-slate-500">{error}</p>
          <a href="/login" className="text-sm text-teal-600 hover:text-teal-700 font-medium">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500 mx-auto" />
        <p className="text-sm text-slate-500">Signing you in...</p>
      </div>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500 mx-auto" />
            <p className="text-sm text-slate-500">Loading...</p>
          </div>
        </div>
      }
    >
      <MagicLinkContent />
    </Suspense>
  );
}
