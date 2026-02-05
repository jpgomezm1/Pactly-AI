"use client";

import { useState, useCallback } from "react";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning";
}

let toastId = 0;
let listeners: Array<(toasts: Toast[]) => void> = [];
let memoryToasts: Toast[] = [];

function emitChange() {
  for (const listener of listeners) {
    listener(memoryToasts);
  }
}

export function toast({ title, description, variant = "default" }: Omit<Toast, "id">) {
  const id = String(++toastId);
  const newToast: Toast = { id, title, description, variant };
  memoryToasts = [...memoryToasts, newToast];
  emitChange();

  setTimeout(() => {
    memoryToasts = memoryToasts.filter((t) => t.id !== id);
    emitChange();
  }, 4000);
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(memoryToasts);

  useState(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  });

  return { toasts, toast };
}
