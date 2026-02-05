"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  FileText, MessageSquare, GitBranch, Clock, Shield, Upload, Download, Sparkles, ChevronDown,
  Share2, Copy, Trash2, ExternalLink, CheckCircle2, MapPin, HelpCircle, Keyboard, ClipboardList,
} from "lucide-react";
import { dealsApi, contractsApi, changeRequestsApi, versionsApi, timelineApi, settingsApi, shareLinksApi, deliverablesApi, offerLettersApi } from "@/lib/api";
import { ContractBuilder } from "@/components/contract-builder";
import { useAuth } from "@/hooks/use-auth";
import { usePollJob } from "@/hooks/use-poll-job";
import { toast } from "@/components/ui/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { DisclaimerBanner } from "@/components/disclaimer-banner";
import { ContractViewer } from "@/components/contract-viewer";
import { FieldSummaryCard } from "@/components/field-summary-card";
import { ChangeRequestComposer } from "@/components/change-request-composer";
import { AIAnalysisPanel } from "@/components/ai-analysis-panel";
import { InlineLoader } from "@/components/inline-loader";
import { VersionDiffViewer } from "@/components/version-diff-viewer";
import { TimelineView } from "@/components/timeline-view";
import { DeliverablesPanel } from "@/components/deliverables-panel";
import { AIBadge } from "@/components/ui/ai-badge";
import { RiskFlagsPanel } from "@/components/risk-flags-panel";
import { OfferLetterGenerator } from "@/components/offer-letter-generator";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const statusBadgeVariant: Record<string, string> = {
  open: "secondary",
  accepted: "success",
  rejected: "destructive",
  countered: "warning",
};

const statusColor: Record<string, string> = {
  open: "border-l-slate-400",
  accepted: "border-l-emerald-500",
  rejected: "border-l-rose-500",
  countered: "border-l-amber-500",
};

const statusPillColor: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-blue-100 text-blue-700",
  under_review: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  completed: "bg-emerald-100 text-emerald-700",
  contract_uploaded: "bg-indigo-100 text-indigo-700",
  ai_analyzed: "bg-purple-100 text-purple-700",
};

function StatusFlowIndicator({ analysisStatus, status }: { analysisStatus: string; status: string }) {
  const steps = [
    { label: "Pending", active: true, done: analysisStatus !== "pending" },
    { label: "Analyzed", active: analysisStatus === "completed" || analysisStatus === "processing", done: analysisStatus === "completed" },
    { label: status === "rejected" ? "Rejected" : "Accepted", active: status === "accepted" || status === "rejected", done: status === "accepted" || status === "rejected" },
  ];

  return (
    <div className="flex items-center gap-1 py-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1">
          <div className="flex flex-col items-center">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                step.done
                  ? status === "rejected" && i === 2
                    ? "bg-rose-500"
                    : "bg-emerald-500"
                  : step.active
                    ? "bg-amber-400 animate-pulse"
                    : "bg-slate-200"
              }`}
            />
            <span className="text-[10px] text-muted-foreground mt-1">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-6 mb-4 ${
                step.done ? "bg-emerald-300" : "bg-slate-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function DealDetailPage() {
  const { id: dealId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [pasteText, setPasteText] = useState("");
  const [parseJobId, setParseJobId] = useState<string | null>(null);
  const [analyzeJobId, setAnalyzeJobId] = useState<string | null>(null);
  const [generateJobId, setGenerateJobId] = useState<string | null>(null);
  const [selectedDiffVersionId, setSelectedDiffVersionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("contract");
  const [generateInitialJobId, setGenerateInitialJobId] = useState<string | null>(null);
  const [showLegacyUpload, setShowLegacyUpload] = useState(false);

  // Share link dialog
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareName, setShareName] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [createdLinkUrl, setCreatedLinkUrl] = useState<string | null>(null);

  // Rejection dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectCrId, setRejectCrId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Counter dialog
  const [counterDialogOpen, setCounterDialogOpen] = useState(false);
  const [counterCrId, setCounterCrId] = useState<string | null>(null);
  const [counterText, setCounterText] = useState("");

  // Counter pre-fill ref
  const composerRef = useRef<{ prefill: (text: string) => void } | null>(null);

  // Queries
  const { data: deal, isLoading: dealLoading, refetch: refetchDeal } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => dealsApi.get(dealId),
  });
  const { data: contract, refetch: refetchContract } = useQuery({
    queryKey: ["contract", dealId],
    queryFn: () => contractsApi.current(dealId),
    retry: false,
  });
  const { data: changeRequests, refetch: refetchCRs } = useQuery({
    queryKey: ["change-requests", dealId],
    queryFn: () => changeRequestsApi.list(dealId),
  });
  const { data: versions, refetch: refetchVersions } = useQuery({
    queryKey: ["versions", dealId],
    queryFn: () => versionsApi.list(dealId),
  });
  const { data: timeline, refetch: refetchTimeline } = useQuery({
    queryKey: ["timeline", dealId],
    queryFn: () => timelineApi.get(dealId),
  });
  const { data: diffData } = useQuery({
    queryKey: ["diff", dealId, selectedDiffVersionId],
    queryFn: () => versionsApi.diff(dealId, selectedDiffVersionId!),
    enabled: !!selectedDiffVersionId,
    retry: false,
  });
  const { data: auditData } = useQuery({
    queryKey: ["audit", dealId],
    queryFn: () => timelineApi.audit(dealId),
    enabled: user?.role === "admin",
    retry: false,
  });
  const { data: brandSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });
  const { data: shareLinks, refetch: refetchShareLinks } = useQuery({
    queryKey: ["share-links", dealId],
    queryFn: () => shareLinksApi.list(dealId),
  });
  const { data: deliverables } = useQuery({
    queryKey: ["deliverables", dealId],
    queryFn: () => deliverablesApi.list(dealId),
  });
  const { data: externalFeedback, refetch: refetchFeedback } = useQuery({
    queryKey: ["external-feedback", dealId],
    queryFn: () => shareLinksApi.feedback(dealId),
  });

  const refetchAll = () => {
    refetchDeal();
    refetchCRs();
    refetchTimeline();
  };

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: (file: File) => contractsApi.upload(dealId, file),
    onSuccess: (data: any) => {
      toast({ title: "Contract uploaded", description: "Parsing with AI...", variant: "success" });
      setParseJobId(data.job_id);
      refetchContract();
      refetchTimeline();
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "error" }),
  });

  const pasteMutation = useMutation({
    mutationFn: () => contractsApi.paste(dealId, pasteText),
    onSuccess: (data: any) => {
      setPasteText("");
      toast({ title: "Contract saved", description: "Parsing with AI...", variant: "success" });
      setParseJobId(data.job_id);
      refetchContract();
      refetchTimeline();
    },
  });

  const createCRMutation = useMutation({
    mutationFn: (text: string) => changeRequestsApi.create(dealId, text),
    onSuccess: (data: any) => {
      toast({ title: "Change request created", description: "Auto-analyzing with AI...", variant: "success" });
      // CR now auto-dispatches analysis; poll for it
      if (data.analysis_job_id) {
        setAnalyzeJobId(data.analysis_job_id);
      }
      refetchAll();
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: (crId: string) => changeRequestsApi.analyze(dealId, crId),
    onSuccess: (data) => {
      setAnalyzeJobId(data.job_id);
      toast({ title: "Re-analysis started", description: "Processing your change request..." });
    },
  });

  const generateMutation = useMutation({
    mutationFn: (crId: string) => versionsApi.generate(dealId, crId),
    onSuccess: (data) => {
      setGenerateJobId(data.job_id);
      toast({ title: "Generating version", description: "Creating new contract version..." });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (crId: string) => changeRequestsApi.accept(dealId, crId),
    onSuccess: (data: any) => {
      toast({ title: "Changes accepted", description: "Generating new contract version...", variant: "success" });
      setGenerateJobId(data.job_id);
      refetchAll();
    },
    onError: (err: Error) => toast({ title: "Accept failed", description: err.message, variant: "error" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ crId, reason }: { crId: string; reason?: string }) =>
      changeRequestsApi.reject(dealId, crId, reason),
    onSuccess: () => {
      toast({ title: "Changes rejected", variant: "success" });
      setRejectDialogOpen(false);
      setRejectReason("");
      setRejectCrId(null);
      refetchAll();
    },
    onError: (err: Error) => toast({ title: "Reject failed", description: err.message, variant: "error" }),
  });

  const createShareLinkMutation = useMutation({
    mutationFn: () => shareLinksApi.create(dealId, {
      counterparty_name: shareName,
      counterparty_email: shareEmail || undefined,
    }),
    onSuccess: (data: any) => {
      toast({ title: "Share link created", variant: "success" });
      setCreatedLinkUrl(data.url);
      refetchShareLinks();
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "error" }),
  });

  const deactivateLinkMutation = useMutation({
    mutationFn: (linkId: string) => shareLinksApi.deactivate(dealId, linkId),
    onSuccess: () => {
      toast({ title: "Link deactivated", variant: "success" });
      refetchShareLinks();
    },
  });

  const counterMutation = useMutation({
    mutationFn: ({ crId, counterText }: { crId: string; counterText: string }) =>
      changeRequestsApi.counter(dealId, crId, counterText),
    onSuccess: () => {
      toast({ title: "Counter proposal sent", variant: "success" });
      refetchAll();
    },
    onError: (err: Error) => toast({ title: "Counter failed", description: err.message, variant: "error" }),
  });

  // Poll jobs
  usePollJob(parseJobId, () => {
    setParseJobId(null);
    toast({ title: "Contract parsed", description: "Fields and clauses extracted.", variant: "success" });
    refetchContract();
    refetchTimeline();
  });

  usePollJob(analyzeJobId, () => {
    setAnalyzeJobId(null);
    toast({ title: "Analysis complete", variant: "success" });
    refetchCRs();
    refetchTimeline();
  });

  usePollJob(generateJobId, () => {
    setGenerateJobId(null);
    toast({ title: "Version generated", variant: "success" });
    refetchVersions();
    refetchContract();
    refetchTimeline();
  });

  usePollJob(generateInitialJobId, () => {
    setGenerateInitialJobId(null);
    toast({ title: "Contract generated", description: "Your AI-drafted contract is ready.", variant: "success" });
    refetchContract();
    refetchVersions();
    refetchTimeline();
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  const handleCounter = (cr: any) => {
    // Pre-fill with AI suggestion if available
    let prefillText = "";
    if (cr.analysis_result?.counter_proposal) {
      const cp = cr.analysis_result.counter_proposal;
      const parts = Object.entries(cp).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
      prefillText = parts.join(", ");
    }
    setCounterCrId(cr.id);
    setCounterText(prefillText);
    setCounterDialogOpen(true);
  };

  const handleCounterConfirm = () => {
    if (counterCrId && counterText.trim()) {
      counterMutation.mutate({ crId: counterCrId, counterText: counterText.trim() });
      setCounterDialogOpen(false);
      setCounterText("");
      setCounterCrId(null);
    }
  };

  const handleRejectConfirm = () => {
    if (rejectCrId) {
      rejectMutation.mutate({ crId: rejectCrId, reason: rejectReason || undefined });
    }
  };

  const handleExportPdf = async () => {
    if (!contract || !deal) return;
    const { exportContractPdf } = await import("@/lib/pdf-export");
    await exportContractPdf(contract, deal.title, brandSettings ? {
      logo_url: brandSettings.logo_url,
      primary_color: brandSettings.primary_color,
      company_name: brandSettings.company_name,
    } : undefined);
    toast({ title: "PDF exported", variant: "success" });
  };

  const canAudit = user?.role === "admin";

  // Keyboard shortcuts
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input/textarea
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === "n") {
      e.preventDefault();
      setActiveTab("change-requests");
    } else if (ctrl && e.key === "e") {
      e.preventDefault();
      if (contract) handleExportPdf();
    } else if (ctrl && e.key === "1") {
      e.preventDefault();
      setActiveTab("contract");
    } else if (ctrl && e.key === "2") {
      e.preventDefault();
      setActiveTab("change-requests");
    } else if (ctrl && e.key === "3") {
      e.preventDefault();
      setActiveTab("versions");
    } else if (ctrl && e.key === "4") {
      e.preventDefault();
      setActiveTab("timeline");
    } else if (e.key === "?") {
      setShowShortcuts(prev => !prev);
    }
  }, [contract]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="space-y-6 animate-fade-in">
      <DisclaimerBanner />

      {/* Header */}
      {dealLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-64" />
        </div>
      ) : (
        <>
          <Breadcrumb items={[
            { label: "Deals", href: "/deals" },
            { label: deal?.title || "Deal" },
          ]} />
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{deal?.title}</h1>
                {deal && (
                  <>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      deal.deal_type === "purchase" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                    }`}>
                      {deal.deal_type === "purchase" ? "Purchase" : "Sale"}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusPillColor[deal.current_state] || "bg-slate-100 text-slate-700"}`}>
                      {deal.current_state.replace(/_/g, " ")}
                    </span>
                  </>
                )}
              </div>
              {deal?.address && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {deal.address}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShareDialogOpen(true)}
              >
                <Share2 className="h-4 w-4" /> Share
              </Button>
              {deal?.current_state === "accepted" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  onClick={async () => {
                    try {
                      const blob = await dealsApi.downloadTimelinePdf(dealId);
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `Critical_Dates_${deal?.title || "deal"}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: "Critical Dates PDF downloaded", variant: "success" });
                    } catch (err: any) {
                      toast({ title: "PDF not ready", description: err.message, variant: "error" });
                    }
                  }}
                >
                  <Clock className="h-4 w-4" /> Critical Dates
                </Button>
              )}
              {contract && (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={handleExportPdf}
                >
                  <FileText className="h-4 w-4" /> Export PDF
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Accept Terms */}
      {deal && contract && (
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-white">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Deal Acceptance</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className={deal.seller_accepted_at ? "text-emerald-600 font-medium" : ""}>
                    {deal.seller_accepted_at ? `Seller accepted ${new Date(deal.seller_accepted_at).toLocaleDateString()}` : "Seller: pending"}
                  </span>
                  <span className={deal.buyer_accepted_at ? "text-emerald-600 font-medium" : ""}>
                    {deal.buyer_accepted_at ? `Buyer accepted ${new Date(deal.buyer_accepted_at).toLocaleDateString()}` : "Buyer: pending"}
                  </span>
                </div>
              </div>
              {(() => {
                const adminSide = deal.deal_type === "sale" ? "seller" : "buyer";
                const alreadyAccepted = adminSide === "seller" ? deal.seller_accepted_at : deal.buyer_accepted_at;
                if (alreadyAccepted) return <Badge variant="success">You accepted</Badge>;
                return (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={async () => {
                      if (!confirm("Are you sure you want to accept the current terms?")) return;
                      try {
                        await dealsApi.acceptTerms(deal.id);
                        queryClient.invalidateQueries({ queryKey: ["deal", deal.id] });
                        toast({ title: "Terms accepted", variant: "success" });
                      } catch (err: any) {
                        toast({ title: "Failed", description: err.message, variant: "error" });
                      }
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Accept Terms
                  </Button>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deal Summary Card */}
      {contract?.extracted_fields && Object.keys(contract.extracted_fields).length > 0 && (
        <Card className="border-indigo-100 bg-gradient-to-r from-slate-50 to-indigo-50/30">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {contract.extracted_fields.purchase_price && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Purchase Price</p>
                  <p className="text-sm font-semibold">
                    {typeof contract.extracted_fields.purchase_price === "number"
                      ? `$${contract.extracted_fields.purchase_price.toLocaleString()}`
                      : contract.extracted_fields.purchase_price}
                  </p>
                </div>
              )}
              {contract.extracted_fields.closing_date && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Closing Date</p>
                  <p className="text-sm font-semibold">{contract.extracted_fields.closing_date}</p>
                </div>
              )}
              {contract.extracted_fields.inspection_period_days && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Inspection Period</p>
                  <p className="text-sm font-semibold">{contract.extracted_fields.inspection_period_days} days</p>
                </div>
              )}
              {contract.extracted_fields.financing_type && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Financing</p>
                  <p className="text-sm font-semibold">{contract.extracted_fields.financing_type}</p>
                </div>
              )}
              {contract.extracted_fields.earnest_money && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Earnest Money</p>
                  <p className="text-sm font-semibold">
                    {typeof contract.extracted_fields.earnest_money === "number"
                      ? `$${contract.extracted_fields.earnest_money.toLocaleString()}`
                      : contract.extracted_fields.earnest_money}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="contract" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" /> Contract
            {(!!parseJobId || !!generateInitialJobId) && activeTab !== "contract" && (
              <span className="ml-1.5 h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="change-requests" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <MessageSquare className="h-4 w-4" /> Changes
            {!!analyzeJobId && activeTab !== "change-requests" && (
              <span className="ml-1.5 h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            )}
            {(changeRequests?.length ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-slate-200 text-[11px] font-medium text-slate-600 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700">
                {changeRequests?.length || 0}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="versions" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <GitBranch className="h-4 w-4" /> Versions
            {!!generateJobId && activeTab !== "versions" && (
              <span className="ml-1.5 h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            )}
            {(versions?.length ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-slate-200 text-[11px] font-medium text-slate-600 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700">
                {versions?.length || 0}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Clock className="h-4 w-4" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="deliverables" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <ClipboardList className="h-4 w-4" /> Deliverables
            {(deliverables?.length ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-slate-200 text-[11px] font-medium text-slate-600 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700">
                {deliverables?.length || 0}
              </span>
            )}
          </TabsTrigger>
          {canAudit && (
            <TabsTrigger value="audit" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Shield className="h-4 w-4" /> Audit
            </TabsTrigger>
          )}
        </TabsList>

        {/* CONTRACT */}
        <TabsContent value="contract" className="space-y-4">
          {parseJobId && (
            <InlineLoader message="Pactly AI is parsing your contract — extracting fields and clauses..." />
          )}
          {generateInitialJobId && (
            <InlineLoader message="Pactly AI is drafting your contract..." />
          )}
          {!contract ? (
            <div className="space-y-6">
              {/* Offer Letter Generator */}
              <OfferLetterGenerator
                dealId={dealId}
                dealTitle={deal?.title}
                dealAddress={deal?.address}
              />

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">
                    Ready for the contract?
                  </span>
                </div>
              </div>

              {/* Primary: Contract Builder */}
              <ContractBuilder
                dealId={dealId}
                dealAddress={deal?.address}
                onGenerate={(jobId) => setGenerateInitialJobId(jobId)}
              />

              {/* Secondary: Legacy upload/paste */}
              <div className="border rounded-lg">
                <button
                  onClick={() => setShowLegacyUpload(!showLegacyUpload)}
                  className="w-full flex items-center justify-between p-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>I already have a contract</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showLegacyUpload ? "rotate-180" : ""}`} />
                </button>
                {showLegacyUpload && (
                  <div className="px-4 pb-4 space-y-6">
                    {/* Upload */}
                    <div>
                      <h4 className="text-sm font-medium mb-3">Upload Document</h4>
                      <label className="group flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all duration-200">
                        <div className="flex flex-col items-center justify-center">
                          <div className="h-12 w-12 rounded-xl bg-slate-100 group-hover:bg-teal-100 flex items-center justify-center mb-3 transition-colors">
                            <Upload className="h-6 w-6 text-slate-400 group-hover:text-teal-500 transition-colors" />
                          </div>
                          <span className="text-sm font-medium text-slate-600">
                            {uploadMutation.isPending ? "Uploading..." : "Click to upload"}
                          </span>
                          <span className="text-xs text-muted-foreground mt-1">
                            DOCX, PDF, or TXT files supported
                          </span>
                        </div>
                        <input
                          type="file"
                          accept=".docx,.pdf,.txt"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      {uploadMutation.isError && (
                        <p className="text-sm text-destructive mt-2">{(uploadMutation.error as Error).message}</p>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                      <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">or</span></div>
                    </div>

                    {/* Paste */}
                    <div>
                      <h4 className="text-sm font-medium mb-3">Paste Contract Text</h4>
                      <Textarea
                        rows={8}
                        placeholder="Paste the full contract text here..."
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                      />
                      <Button
                        className="mt-3"
                        onClick={() => pasteMutation.mutate()}
                        disabled={!pasteText.trim() || pasteMutation.isPending}
                      >
                        {pasteMutation.isPending ? <><Spinner size="sm" /> Saving...</> : "Save Contract"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <ContractViewer text={contract.full_text} />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const blob = new Blob([contract.full_text], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `contract_v${contract.version_number}.txt`;
                      a.click();
                      toast({ title: "Contract exported", variant: "success" });
                    }}
                  >
                    <Download className="h-4 w-4" /> Export .txt
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={handleExportPdf}
                  >
                    <FileText className="h-4 w-4" /> Export PDF
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                <FieldSummaryCard fields={contract.extracted_fields} clauses={contract.clause_tags} />
                {contract.risk_flags && contract.risk_flags.length > 0 && (
                  <RiskFlagsPanel flags={contract.risk_flags} suggestions={contract.suggestions} />
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* CHANGE REQUESTS */}
        <TabsContent value="change-requests" className="space-y-4">
          {analyzeJobId && (
            <InlineLoader message="Pactly AI is analyzing your change request..." />
          )}
          <ChangeRequestComposer onSubmit={(text) => createCRMutation.mutate(text)} loading={createCRMutation.isPending} dealId={dealId} />

          {changeRequests?.length === 0 && (
            <EmptyState
              icon={MessageSquare}
              title="No change requests"
              description="Submit a change request above to get started with AI analysis."
            />
          )}

          {changeRequests?.map((cr: any) => (
            <Card key={cr.id} className={`border-l-4 ${statusColor[cr.status] || "border-l-slate-300"}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">
                      CR by {cr.role.replace(/_/g, " ")}
                    </CardTitle>
                    {cr.parent_cr_id && (
                      <Badge variant="outline" className="text-[10px]">counter</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      (statusBadgeVariant[cr.status] || "secondary") as any
                    }>
                      {cr.status}
                    </Badge>
                    <Badge variant={
                      cr.analysis_status === "completed" ? "success" :
                      cr.analysis_status === "failed" ? "destructive" :
                      cr.analysis_status === "processing" ? "processing" : "secondary"
                    }>
                      {cr.analysis_status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusFlowIndicator analysisStatus={cr.analysis_status} status={cr.status} />

                <p className="text-sm bg-muted/50 p-3 rounded-lg">{cr.raw_text}</p>

                {cr.rejection_reason && (
                  <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg">
                    Rejection reason: {cr.rejection_reason}
                  </div>
                )}

                <div className="flex gap-2">
                  {cr.analysis_status === "processing" && (
                    <div className="flex items-center gap-2 text-sm text-indigo-600">
                      <Spinner size="sm" />
                      <span>Analyzing with AI...</span>
                    </div>
                  )}
                  {cr.analysis_status === "failed" && cr.status === "open" && (
                    <Button
                      size="sm"
                      onClick={() => analyzeMutation.mutate(cr.id)}
                      disabled={analyzeMutation.isPending || !!analyzeJobId}
                      className="gap-2"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Re-analyze with AI
                    </Button>
                  )}
                </div>

                {cr.analysis_result && (
                  <AIAnalysisPanel
                    result={cr.analysis_result}
                    crStatus={cr.status}
                    showActions={cr.analysis_status === "completed"}
                    onAccept={() => acceptMutation.mutate(cr.id)}
                    onReject={() => {
                      setRejectCrId(cr.id);
                      setRejectDialogOpen(true);
                    }}
                    onCounter={() => handleCounter(cr)}
                    acceptLoading={acceptMutation.isPending}
                    rejectLoading={rejectMutation.isPending}
                    counterLoading={counterMutation.isPending}
                    inputTokens={cr.input_tokens}
                    outputTokens={cr.output_tokens}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* VERSIONS */}
        <TabsContent value="versions" className="space-y-4">
          {generateJobId && (
            <InlineLoader message="Pactly AI is generating the new contract version..." />
          )}
          {versions?.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="No versions yet"
              description="Upload or paste a contract first, then generate versions from change requests."
            />
          ) : (
            <>
              {/* Vertical timeline stepper */}
              <div className="relative pl-8">
                {/* Vertical connecting line */}
                {(versions?.length ?? 0) > 1 && (
                  <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-slate-200" />
                )}

                <div className="space-y-4">
                  {versions?.map((v: any, index: number) => (
                    <div key={v.id} className="relative">
                      {/* Version circle on the line */}
                      <div className="absolute -left-8 top-3 flex items-center justify-center">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                          index === 0
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-indigo-600 border-indigo-300"
                        }`}>
                          v{v.version_number}
                        </div>
                      </div>

                      <Card className="hover:border-indigo-200 transition-colors">
                        <CardContent className="py-3 flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium">{v.source}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {new Date(v.created_at).toLocaleString()}
                            </span>
                            {v.change_summary && (
                              <Badge variant="outline" className="text-xs ml-2">
                                {(v.change_summary.changes?.length || 0)} changes
                              </Badge>
                            )}
                          </div>
                          {v.version_number > 0 && (
                            <Button size="sm" variant="outline" onClick={() => setSelectedDiffVersionId(v.id)}>
                              View Diff
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>

              {diffData && (
                <VersionDiffViewer
                  diffHtml={diffData.diff_html}
                  versionANumber={diffData.version_a_number}
                  versionBNumber={diffData.version_b_number}
                  fieldChanges={diffData.field_changes}
                />
              )}
            </>
          )}
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline">
          {timeline ? (
            <TimelineView currentState={timeline.current_state} events={timeline.events} />
          ) : (
            <Card><CardContent className="py-8"><Skeleton className="h-4 w-48 mx-auto" /></CardContent></Card>
          )}
        </TabsContent>

        {/* DELIVERABLES */}
        <TabsContent value="deliverables" className="space-y-4">
          <DeliverablesPanel dealId={dealId} deliverables={deliverables || []} />
        </TabsContent>

        {/* AUDIT */}
        {canAudit && (
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <CardTitle>Audit Log</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {!auditData || auditData.length === 0 ? (
                  <EmptyState icon={Shield} title="No audit events" className="py-8" />
                ) : (
                  <div className="space-y-2">
                    {auditData.map((e: any) => (
                      <div key={e.id} className="flex justify-between items-start text-sm border-b border-border/50 pb-2.5">
                        <div>
                          <span className="font-medium">{e.action.replace(/_/g, " ")}</span>
                          {e.details && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {Object.entries(e.details).map(([k, v]) => (
                                <span key={k} className="mr-3">{k}: {String(v)}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                          {new Date(e.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Share Links & External Feedback */}
      {((shareLinks?.length ?? 0) > 0 || (externalFeedback?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(shareLinks?.filter((l: any) => l.is_active).length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Share2 className="h-4 w-4" /> Active Share Links
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {shareLinks?.filter((l: any) => l.is_active).map((link: any) => (
                  <div key={link.id} className="flex items-center justify-between text-sm bg-muted/30 border border-border/50 p-3 rounded-lg">
                    <div className="min-w-0 flex-1 flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      <div className="min-w-0">
                        <span className="font-medium">{link.counterparty_name}</span>
                        {link.counterparty_email && (
                          <span className="text-muted-foreground ml-2 text-xs">{link.counterparty_email}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(link.url);
                          setCopiedLink(link.id);
                          setTimeout(() => setCopiedLink(null), 2000);
                        }}
                      >
                        {copiedLink === link.id ? (
                          <span className="text-xs text-green-600">Copied</span>
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600"
                        onClick={() => deactivateLinkMutation.mutate(link.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(externalFeedback?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" /> External Feedback
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {externalFeedback?.map((f: any) => (
                  <div key={f.id} className="text-sm bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{f.reviewer_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(f.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{f.feedback_text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Sharing prompts */}
      {contract && (!shareLinks || shareLinks.length === 0) && (
        <Card className="border-teal-200 bg-teal-50/30">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Share2 className="h-5 w-5 text-teal-600" />
              <div>
                <p className="text-sm font-medium text-slate-900">Share this contract for review</p>
                <p className="text-xs text-slate-500">Send a secure link to your counterparty for feedback</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-100" onClick={() => setShareDialogOpen(true)}>
              <Share2 className="h-3.5 w-3.5 mr-1.5" /> Create Share Link
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Share Link Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={(open) => {
        setShareDialogOpen(open);
        if (!open) {
          setShareName("");
          setShareEmail("");
          setCreatedLinkUrl(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdLinkUrl ? "Share Link Ready" : "Create Share Link"}</DialogTitle>
          </DialogHeader>

          {createdLinkUrl ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Your share link has been created. Copy it and send it to the counterparty.
              </p>
              <div className="bg-muted p-3 rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground font-mono break-all">
                  {createdLinkUrl.length > 60 ? createdLinkUrl.slice(0, 60) + "..." : createdLinkUrl}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(createdLinkUrl);
                    setCopiedLink("dialog");
                    setTimeout(() => setCopiedLink(null), 2000);
                  }}
                >
                  {copiedLink === "dialog" ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1 text-green-600" /> Copied!</> : <><Copy className="h-3.5 w-3.5 mr-1" /> Copy Link</>}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShareDialogOpen(false); setCreatedLinkUrl(null); setShareName(""); setShareEmail(""); }}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">
                  Create a public link for an external counterparty to review the contract and submit feedback.
                </p>
                <div>
                  <label className="text-sm font-medium mb-1 block">Counterparty Name *</label>
                  <Input
                    value={shareName}
                    onChange={(e) => setShareName(e.target.value)}
                    placeholder="e.g. John Smith (Buyer)"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Email (optional)</label>
                  <Input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={() => createShareLinkMutation.mutate()}
                  disabled={!shareName.trim() || createShareLinkMutation.isPending}
                >
                  {createShareLinkMutation.isPending ? "Creating..." : "Create Link"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Counter Dialog */}
      <Dialog open={counterDialogOpen} onOpenChange={(open) => {
        setCounterDialogOpen(open);
        if (!open) { setCounterText(""); setCounterCrId(null); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Counter Proposal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Describe your counter proposal. Be specific about which terms you want to change and what values you propose.
            </p>
            <Textarea
              placeholder="e.g. We can agree to a home warranty but capped at $400 instead of $500. The permit clause is acceptable."
              value={counterText}
              onChange={(e) => setCounterText(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              className="gap-1.5 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              variant="outline"
              onClick={handleCounterConfirm}
              disabled={!counterText.trim() || counterMutation.isPending}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {counterMutation.isPending ? "Sending..." : "Send Counter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Help */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" /> Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {[
              ["Ctrl+1", "Contract tab"],
              ["Ctrl+2", "Changes tab"],
              ["Ctrl+3", "Versions tab"],
              ["Ctrl+4", "Timeline tab"],
              ["Ctrl+N", "New change request"],
              ["Ctrl+E", "Export PDF"],
              ["?", "Toggle this help"],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">{desc}</span>
                <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono">{key}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Keyboard shortcuts help button */}
      <button
        onClick={() => setShowShortcuts(true)}
        className="fixed bottom-4 right-4 h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors z-40"
        title="Keyboard shortcuts (?)"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Change Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Provide an optional reason for rejecting this change request.
            </p>
            <Textarea
              placeholder="Reason for rejection (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
