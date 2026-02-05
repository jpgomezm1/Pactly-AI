"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Sparkles, Download, Trash2, Edit2, Check, X, RefreshCw, ChevronDown,
} from "lucide-react";
import { offerLettersApi, contractsApi } from "@/lib/api";
import { usePollJob } from "@/hooks/use-poll-job";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AIBadge } from "@/components/ui/ai-badge";
import { VoiceRecorder } from "@/components/voice-recorder";

interface OfferLetterGeneratorProps {
  dealId: string;
  dealTitle?: string;
  dealAddress?: string;
}

interface OfferLetter {
  id: string;
  deal_id: string;
  user_prompt: string;
  full_text: string;
  buyer_name?: string;
  seller_name?: string;
  property_address?: string;
  purchase_price?: number;
  earnest_money?: number;
  closing_date?: string;
  contingencies?: string[];
  additional_terms?: string;
  status: string;
  created_at: string;
}

type ViewState = "input" | "generating" | "result";

export function OfferLetterGenerator({ dealId, dealTitle, dealAddress }: OfferLetterGeneratorProps) {
  const queryClient = useQueryClient();
  const [viewState, setViewState] = useState<ViewState>("input");
  const [prompt, setPrompt] = useState("");
  const [generateJobId, setGenerateJobId] = useState<string | null>(null);
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<OfferLetter>>({});
  const [showExisting, setShowExisting] = useState(false);

  // Fetch existing offer letters
  const { data: offerLetters, refetch: refetchLetters } = useQuery({
    queryKey: ["offer-letters", dealId],
    queryFn: () => offerLettersApi.list(dealId),
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: (promptText: string) => offerLettersApi.generate(dealId, promptText),
    onSuccess: (data) => {
      setGenerateJobId(data.job_id);
      setViewState("generating");
    },
    onError: (err: Error) => {
      toast({ title: "Generation failed", description: err.message, variant: "error" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<OfferLetter> }) =>
      offerLettersApi.update(dealId, id, data),
    onSuccess: () => {
      toast({ title: "Offer letter updated", variant: "success" });
      setIsEditing(false);
      refetchLetters();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => offerLettersApi.delete(dealId, id),
    onSuccess: () => {
      toast({ title: "Offer letter deleted", variant: "success" });
      setSelectedLetterId(null);
      setViewState("input");
      refetchLetters();
    },
  });

  // Poll for job completion
  usePollJob(generateJobId, (result) => {
    setGenerateJobId(null);
    if (result?.offer_letter_id) {
      setSelectedLetterId(result.offer_letter_id);
      setViewState("result");
      refetchLetters();
      toast({ title: "Offer letter generated", variant: "success" });
    }
  });

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    generateMutation.mutate(prompt);
  };

  const handleVoiceTranscribed = (text: string) => {
    setPrompt((prev) => prev ? `${prev} ${text}` : text);
  };

  const handleStartOver = () => {
    setPrompt("");
    setSelectedLetterId(null);
    setViewState("input");
  };

  const handleViewLetter = (letter: OfferLetter) => {
    setSelectedLetterId(letter.id);
    setViewState("result");
  };

  const handleStartEdit = (letter: OfferLetter) => {
    setEditForm({
      buyer_name: letter.buyer_name,
      seller_name: letter.seller_name,
      property_address: letter.property_address,
      purchase_price: letter.purchase_price,
      earnest_money: letter.earnest_money,
      closing_date: letter.closing_date,
      contingencies: letter.contingencies,
      additional_terms: letter.additional_terms,
      full_text: letter.full_text,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (selectedLetterId) {
      updateMutation.mutate({ id: selectedLetterId, data: editForm });
    }
  };

  const handleExportPdf = async (letter: OfferLetter) => {
    const { exportOfferLetterPdf } = await import("@/lib/pdf-export");
    await exportOfferLetterPdf(letter, dealTitle || "Offer Letter");
    toast({ title: "PDF exported", variant: "success" });
  };

  const selectedLetter = offerLetters?.find((l: OfferLetter) => l.id === selectedLetterId);

  return (
    <Card className="border-amber-200 bg-gradient-to-r from-amber-50/30 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Offer Letter Generator
            <AIBadge />
          </CardTitle>
          {(offerLetters?.length ?? 0) > 0 && viewState === "input" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExisting(!showExisting)}
              className="text-xs"
            >
              {offerLetters?.length} existing
              <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showExisting ? "rotate-180" : ""}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Input State */}
        {viewState === "input" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Describe your offer and we'll generate a professional offer letter for the property.
            </p>

            {/* Existing letters dropdown */}
            {showExisting && (offerLetters?.length ?? 0) > 0 && (
              <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground">Previous offer letters:</p>
                {offerLetters?.map((letter: OfferLetter) => (
                  <div
                    key={letter.id}
                    className="flex items-center justify-between p-2 bg-background rounded border hover:border-amber-300 cursor-pointer transition-colors"
                    onClick={() => handleViewLetter(letter)}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {letter.property_address || "Offer Letter"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {letter.purchase_price ? `$${letter.purchase_price.toLocaleString()}` : "No price"} •{" "}
                          {new Date(letter.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={letter.status === "draft" ? "secondary" : "success"}>
                      {letter.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Textarea
                    placeholder={`Example: "Generate an offer letter for ${dealAddress || "123 Main St"} offering $350,000 with a 10-day inspection contingency and 30-day closing. The buyer is John Smith and financing will be conventional with 20% down."`}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
                <VoiceRecorder
                  onTranscribed={handleVoiceTranscribed}
                  transcribeFn={(audio) => contractsApi.transcribe(dealId, audio)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Include details like: offer price, earnest money, closing timeline, contingencies, buyer information.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || generateMutation.isPending}
                className="gap-2"
              >
                {generateMutation.isPending ? (
                  <>
                    <Spinner size="sm" /> Starting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Generate Offer Letter
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Generating State */}
        {viewState === "generating" && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-amber-500 animate-pulse" />
              </div>
              <div className="absolute inset-0 h-16 w-16 rounded-full border-2 border-amber-300 border-t-transparent animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-medium">Generating your offer letter...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Pactly AI is crafting a professional offer based on your description
              </p>
            </div>
          </div>
        )}

        {/* Result State */}
        {viewState === "result" && selectedLetter && (
          <div className="space-y-4">
            {/* Key Terms Summary */}
            {!isEditing && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg">
                {selectedLetter.buyer_name && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Buyer</p>
                    <p className="text-sm font-medium">{selectedLetter.buyer_name}</p>
                  </div>
                )}
                {selectedLetter.seller_name && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Seller</p>
                    <p className="text-sm font-medium">{selectedLetter.seller_name}</p>
                  </div>
                )}
                {selectedLetter.purchase_price && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Price</p>
                    <p className="text-sm font-medium">${selectedLetter.purchase_price.toLocaleString()}</p>
                  </div>
                )}
                {selectedLetter.earnest_money && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Earnest Money</p>
                    <p className="text-sm font-medium">${selectedLetter.earnest_money.toLocaleString()}</p>
                  </div>
                )}
                {selectedLetter.closing_date && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Closing</p>
                    <p className="text-sm font-medium">{selectedLetter.closing_date}</p>
                  </div>
                )}
                {selectedLetter.contingencies && selectedLetter.contingencies.length > 0 && (
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Contingencies</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedLetter.contingencies.map((c, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Edit Form */}
            {isEditing && (
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Buyer Name</label>
                    <Input
                      value={editForm.buyer_name || ""}
                      onChange={(e) => setEditForm({ ...editForm, buyer_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Seller Name</label>
                    <Input
                      value={editForm.seller_name || ""}
                      onChange={(e) => setEditForm({ ...editForm, seller_name: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">Property Address</label>
                    <Input
                      value={editForm.property_address || ""}
                      onChange={(e) => setEditForm({ ...editForm, property_address: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Purchase Price</label>
                    <Input
                      type="number"
                      value={editForm.purchase_price || ""}
                      onChange={(e) => setEditForm({ ...editForm, purchase_price: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Earnest Money</label>
                    <Input
                      type="number"
                      value={editForm.earnest_money || ""}
                      onChange={(e) => setEditForm({ ...editForm, earnest_money: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Closing Date</label>
                    <Input
                      value={editForm.closing_date || ""}
                      onChange={(e) => setEditForm({ ...editForm, closing_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Full Text</label>
                  <Textarea
                    value={editForm.full_text || ""}
                    onChange={(e) => setEditForm({ ...editForm, full_text: e.target.value })}
                    rows={10}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                    <X className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                    <Check className="h-3 w-3 mr-1" /> Save Changes
                  </Button>
                </div>
              </div>
            )}

            {/* Full Text Preview */}
            {!isEditing && (
              <div className="border rounded-lg p-4 max-h-80 overflow-y-auto bg-white">
                <pre className="text-sm whitespace-pre-wrap font-sans">{selectedLetter.full_text}</pre>
              </div>
            )}

            {/* Actions */}
            {!isEditing && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleStartOver}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Create New
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMutation.mutate(selectedLetter.id)}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleStartEdit(selectedLetter)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" onClick={() => handleExportPdf(selectedLetter)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Download PDF
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
