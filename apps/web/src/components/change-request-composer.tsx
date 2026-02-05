"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { VoiceRecorder } from "@/components/voice-recorder";
import { contractsApi } from "@/lib/api";

interface Props {
  onSubmit: (text: string) => void;
  loading?: boolean;
  dealId?: string;
}

export function ChangeRequestComposer({ onSubmit, loading, dealId }: Props) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>New Change Request</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Textarea
            placeholder="Describe the changes you want... e.g., 'Reduce purchase price to $340,000 and extend closing date by 2 weeks'"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="pr-4"
          />
          <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
            {text.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSubmit} disabled={!text.trim() || loading} className="gap-2">
            {loading ? (
              <><Spinner size="sm" /> Submitting...</>
            ) : (
              <><Send className="h-4 w-4" /> Submit Change Request</>
            )}
          </Button>
          {dealId && (
            <VoiceRecorder
              onTranscribed={(t) => setText((prev) => (prev ? prev + " " + t : t))}
              transcribeFn={(audio) => contractsApi.transcribe(dealId, audio)}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
