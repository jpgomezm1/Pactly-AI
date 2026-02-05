"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type State = "idle" | "recording" | "processing" | "error";

interface Props {
  onTranscribed: (text: string) => void;
  transcribeFn: (audio: Blob) => Promise<{ text: string }>;
  size?: "sm" | "default";
}

export function VoiceRecorder({ onTranscribed, transcribeFn, size = "default" }: Props) {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) {
          setState("idle");
          return;
        }

        setState("processing");
        try {
          const { text } = await transcribeFn(blob);
          onTranscribed(text);
          setState("idle");
        } catch {
          setState("error");
          setErrorMsg("Transcription failed");
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setElapsed(0);
      setState("recording");
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setState("error");
      setErrorMsg("Microphone access required");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const handleClick = () => {
    if (state === "recording") {
      stopRecording();
    } else if (state === "idle" || state === "error") {
      startRecording();
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const btnSize = size === "sm" ? "h-8 w-8" : "h-9 w-9";

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`${btnSize} p-0 shrink-0 ${
          state === "recording"
            ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100 animate-pulse"
            : state === "processing"
              ? "border-slate-300 text-slate-400 cursor-wait"
              : ""
        }`}
        onClick={handleClick}
        disabled={state === "processing"}
        title={
          state === "recording"
            ? "Click to stop recording"
            : state === "processing"
              ? "Transcribing..."
              : "Record voice input"
        }
      >
        {state === "processing" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
      {state === "recording" && (
        <span className="text-xs text-red-600 font-mono tabular-nums">{formatTime(elapsed)}</span>
      )}
      {state === "processing" && (
        <span className="text-xs text-slate-500">Transcribing...</span>
      )}
      {state === "error" && errorMsg && (
        <span className="text-xs text-red-500">{errorMsg}</span>
      )}
    </div>
  );
}
