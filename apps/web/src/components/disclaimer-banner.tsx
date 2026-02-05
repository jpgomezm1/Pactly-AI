"use client";

import { useState, useEffect } from "react";
import { Info, X } from "lucide-react";

export function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem("dismiss-disclaimer") === "true");
  }, []);

  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5 text-sm text-indigo-800 animate-slide-down mb-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0 text-indigo-500" />
        <span>This tool assists with drafting and coordination and is not legal advice.</span>
      </div>
      <button
        onClick={() => { setDismissed(true); localStorage.setItem("dismiss-disclaimer", "true"); }}
        className="text-indigo-400 hover:text-indigo-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
