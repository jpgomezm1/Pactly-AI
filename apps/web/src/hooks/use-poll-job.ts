"use client";

import { useState, useEffect, useCallback } from "react";
import { jobsApi } from "@/lib/api";

export function usePollJob(jobId: string | null, onComplete?: (result: any) => void) {
  const [status, setStatus] = useState<string>("idle");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    setStatus("polling");
    setError(null);

    const interval = setInterval(async () => {
      try {
        const job = await jobsApi.get(jobId);
        setStatus(job.status);
        if (job.status === "completed") {
          setResult(job.result);
          clearInterval(interval);
          onComplete?.(job.result);
        } else if (job.status === "failed") {
          setError(job.error || "Job failed");
          clearInterval(interval);
        }
      } catch {
        // Keep polling on network errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  return { status, result, error };
}
