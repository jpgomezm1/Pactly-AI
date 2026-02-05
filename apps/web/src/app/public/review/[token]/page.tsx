"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { publicApi } from "@/lib/api";
import { VoiceRecorder } from "@/components/voice-recorder";
import { ContractViewer } from "@/components/contract-viewer";
import { FieldSummaryCard } from "@/components/field-summary-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText, Send, Download, AlertTriangle, ChevronDown, ChevronUp,
  Clock, CheckCircle2, XCircle, MessageSquare, ArrowRightLeft, Loader2,
  Bot, X, Activity, GitBranch, Eye, ExternalLink, Lock, Sparkles,
  Shield, PanelRightClose, PanelRightOpen, ArrowRight, ClipboardList, Upload,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open:       { label: "Pending Review", color: "bg-slate-100 text-slate-700", icon: Clock },
  processing: { label: "Analyzing...",   color: "bg-blue-100 text-blue-700",   icon: Loader2 },
  completed:  { label: "Analysis Ready", color: "bg-teal-100 text-teal-700", icon: CheckCircle2 },
  accepted:   { label: "Accepted",       color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected:   { label: "Rejected",       color: "bg-red-100 text-red-700",     icon: XCircle },
  countered:  { label: "Countered",      color: "bg-amber-100 text-amber-700", icon: ArrowRightLeft },
};

const ANALYSIS_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:    { label: "Awaiting Analysis", color: "bg-slate-100 text-slate-600" },
  processing: { label: "Analyzing...",      color: "bg-blue-100 text-blue-700" },
  completed:  { label: "Analysis Complete", color: "bg-teal-100 text-teal-700" },
  failed:     { label: "Analysis Failed",   color: "bg-red-100 text-red-600" },
};

function generateStarterQuestions(fields: Record<string, any> | null | undefined): string[] {
  if (!fields || Object.keys(fields).length === 0) {
    return [
      "What is the purchase price?",
      "What are the key contingencies?",
      "When is the closing date?",
      "Summarize the main terms",
    ];
  }

  const questions: string[] = [];

  if (fields.closing_date) {
    questions.push(`What happens if I miss the ${fields.closing_date} closing date?`);
  }
  if (fields.inspection_period_days) {
    questions.push(`Can the ${fields.inspection_period_days}-day inspection period be extended?`);
  }
  if (fields.financing_type) {
    questions.push(`What are the implications of ${fields.financing_type} financing?`);
  }
  if (fields.earnest_money) {
    const em = typeof fields.earnest_money === "number"
      ? `$${fields.earnest_money.toLocaleString()}`
      : fields.earnest_money;
    questions.push(`Under what conditions could I lose the ${em} earnest money?`);
  }
  if (fields.purchase_price) {
    const pp = typeof fields.purchase_price === "number"
      ? `$${fields.purchase_price.toLocaleString()}`
      : fields.purchase_price;
    questions.push(`How is the ${pp} purchase price structured?`);
  }

  // Fill up to 4 if needed
  const fallbacks = [
    "What are the key contingencies?",
    "Summarize the main terms",
    "What are my obligations under this contract?",
    "What are the key deadlines I should be aware of?",
  ];
  for (const fb of fallbacks) {
    if (questions.length >= 4) break;
    if (!questions.includes(fb)) questions.push(fb);
  }

  return questions.slice(0, 4);
}

type ChatMessage = { role: "user" | "assistant"; content: string };

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  contract_uploaded:          { label: "Contract Uploaded",          color: "bg-blue-500" },
  contract_pasted:            { label: "Contract Pasted",            color: "bg-blue-500" },
  contract_generated:         { label: "Contract Generated",         color: "bg-blue-500" },
  change_request_created:     { label: "Change Request Created",     color: "bg-purple-500" },
  change_request_analyzed:    { label: "Change Request Analyzed",    color: "bg-indigo-500" },
  change_request_accepted:    { label: "Change Request Accepted",    color: "bg-green-500" },
  change_request_rejected:    { label: "Change Request Rejected",    color: "bg-red-500" },
  change_request_countered:   { label: "Change Request Countered",   color: "bg-amber-500" },
  version_generated:          { label: "New Version Generated",      color: "bg-teal-500" },
  external_feedback_received: { label: "External Feedback Received", color: "bg-cyan-500" },
  external_counter_response:  { label: "Counter Response Received",  color: "bg-orange-500" },
  share_link_created:         { label: "Share Link Created",         color: "bg-emerald-500" },
  share_link_deactivated:     { label: "Share Link Deactivated",     color: "bg-slate-500" },
};

function formatActionLabel(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known.label;
  return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getActionColor(action: string): string {
  return ACTION_LABELS[action]?.color || "bg-slate-400";
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function StatusBadge({ status, type }: { status: string; type: "cr" | "analysis" }) {
  const config = type === "cr" ? STATUS_CONFIG[status] : ANALYSIS_STATUS_CONFIG[status];
  if (!config) return null;
  const isProcessing = status === "processing";
  const IconComp = type === "cr" ? (config as any).icon : null;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${config.color}`}>
      {IconComp && <IconComp className={`h-3 w-3 ${isProcessing ? "animate-spin" : ""}`} />}
      {isProcessing && type === "analysis" && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" /></span>}
      {config.label}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function PublicReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [feedbackHistory, setFeedbackHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Chat bubble state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Feedback form (multi-item)
  const [feedbackItems, setFeedbackItems] = useState<string[]>([""]);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Counter response form
  const [counterFormId, setCounterFormId] = useState<string | null>(null);
  const [counterText, setCounterText] = useState("");
  const [submittingCounter, setSubmittingCounter] = useState(false);

  // Expanded feedback items
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Tabs & timeline
  const [activeTab, setActiveTab] = useState<"feedback" | "summary" | "versions" | "activity">("feedback");
  const [timeline, setTimeline] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);

  // Deliverables
  const [deliverables, setDeliverables] = useState<any[]>([]);

  // Diff & changes summary
  const [selectedVersionForDiff, setSelectedVersionForDiff] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<any>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [changesSummary, setChangesSummary] = useState<any>(null);

  // Right panel toggle (mobile)
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Reading progress
  const [readingProgress, setReadingProgress] = useState(0);
  const contractViewerRef = useRef<HTMLDivElement>(null);

  // PLG: Session tracking
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return "";
    let sid = localStorage.getItem("pactly_session");
    if (!sid) { sid = crypto.randomUUID(); localStorage.setItem("pactly_session", sid); }
    return sid;
  });

  // Chat rate limit
  const [chatCount, setChatCount] = useState(0);
  const [chatLimitReached, setChatLimitReached] = useState(false);
  const CHAT_LIMIT = 5;

  // AI Insight
  const [insight, setInsight] = useState<string | null>(null);

  // CTA dismiss state
  const [feedbackCtaDismissed, setFeedbackCtaDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("pactly_feedback_cta_dismissed") === "true";
  });
  const [scrollCtaDismissed, setScrollCtaDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("pactly_scroll_cta_dismissed") === "true";
  });

  const firePlgEvent = (eventType: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${API_URL}/plg/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: eventType, share_link_id: null, session_id: sessionId }),
    }).catch(() => {});
  };

  const fetchData = useCallback(async () => {
    try {
      const [c, b, fh, tl, vl] = await Promise.all([
        publicApi.getContract(token),
        publicApi.getBrand(token),
        publicApi.getFeedbackHistory(token).catch(() => []),
        publicApi.getTimeline(token).catch(() => []),
        publicApi.getVersions(token).catch(() => []),
      ]);
      setContract(c);
      setBrand(b);
      setFeedbackHistory(fh);
      setTimeline(tl);
      setVersions(vl);
      // Fetch deliverables
      publicApi.getDeliverables(token).then((data: any) => {
        if (Array.isArray(data)) setDeliverables(data);
      }).catch(() => {});
      // Fetch AI insight
      publicApi.getInsight(token).then((data: any) => {
        if (data?.insight) setInsight(data.insight);
      }).catch(() => {});
      // Fetch changes summary
      publicApi.getChangesSummary(token).then((data: any) => {
        setChangesSummary(data);
      }).catch(() => {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Onboarding wizard for first-time visitors
  useEffect(() => {
    if (!loading && contract && typeof window !== "undefined") {
      const key = `pactly_onboarding_${token}`;
      if (!localStorage.getItem(key)) {
        setShowOnboarding(true);
      }
    }
  }, [loading, contract, token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Scroll tracking for reading progress
  useEffect(() => {
    const el = contractViewerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const max = scrollHeight - clientHeight;
      if (max > 0) {
        setReadingProgress(Math.min(100, Math.round((scrollTop / max) * 100)));
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [contract]);

  const handleSendChat = async (question?: string) => {
    const q = question || chatInput.trim();
    if (!q || chatStreaming) return;
    if (chatLimitReached) return;
    setChatInput("");

    const history = [...chatMessages];
    setChatMessages(prev => [...prev, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setChatStreaming(true);

    try {
      const res = await publicApi.chat(token, q, history, sessionId);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") break;
          try {
            const { text } = JSON.parse(payload);
            if (text) {
              setChatMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + text };
                }
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.message?.includes("429") || err?.message?.includes("free AI messages")) {
        setChatLimitReached(true);
      }
      setChatMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && !last.content) {
          updated[updated.length - 1] = { ...last, content: "Sorry, something went wrong. Please try again." };
        }
        return updated;
      });
    } finally {
      setChatStreaming(false);
      setChatCount(prev => {
        const next = prev + 1;
        if (next >= CHAT_LIMIT) setChatLimitReached(true);
        return next;
      });
    }
  };

  const handleSubmitFeedback = async () => {
    const validItems = feedbackItems.filter(t => t.trim());
    if (validItems.length === 0) return;
    setSubmitting(true);
    setSubmitSuccess(false);
    try {
      if (validItems.length === 1) {
        await publicApi.submitFeedback(token, { feedback_text: validItems[0] });
      } else {
        await publicApi.submitBatchFeedback(token, {
          items: validItems.map(t => ({ feedback_text: t })),
        });
      }
      setFeedbackItems([""]);
      setFeedbackText("");
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      const fh = await publicApi.getFeedbackHistory(token).catch(() => []);
      setFeedbackHistory(fh);
    } catch {
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptTerms = async () => {
    if (!confirm("Are you sure you want to accept the current terms? This action cannot be undone.")) return;
    try {
      await publicApi.acceptTerms(token);
      // Refresh contract data
      const c = await publicApi.getContract(token);
      setContract(c);
    } catch (err: any) {
      setError(err.message || "Failed to accept terms");
    }
  };

  const handleSubmitCounter = async (originalFeedbackId: string) => {
    if (!counterText.trim()) return;
    setSubmittingCounter(true);
    try {
      await publicApi.submitCounterResponse(token, {
        response_text: counterText,
        original_feedback_id: originalFeedbackId,
      });
      setCounterText("");
      setCounterFormId(null);
      const fh = await publicApi.getFeedbackHistory(token).catch(() => []);
      setFeedbackHistory(fh);
    } catch {
      setError("Failed to submit response. Please try again.");
    } finally {
      setSubmittingCounter(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDownloadPdf = async () => {
    if (!contract) return;
    const { exportContractPdf } = await import("@/lib/pdf-export");
    await exportContractPdf(contract, contract.deal_title, brand);
  };

  const handleViewDiff = async (versionId: string) => {
    if (selectedVersionForDiff === versionId) {
      setSelectedVersionForDiff(null);
      setDiffData(null);
      return;
    }
    setSelectedVersionForDiff(versionId);
    setDiffLoading(true);
    try {
      const data = await publicApi.getVersionDiff(token, versionId);
      setDiffData(data);
    } catch {
      setDiffData(null);
    } finally {
      setDiffLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-8 w-8 border-2 border-teal-600 border-t-transparent rounded-full" />
          <p className="text-sm text-slate-500">Loading contract...</p>
        </div>
      </div>
    );
  }

  if (error && !contract) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h1 className="text-xl font-semibold">Link unavailable</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  const primaryColor = brand?.primary_color || "#14B8A6";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[70] h-1 bg-slate-200/50">
        <div
          className="h-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all duration-150 ease-out"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Header bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-md">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              {brand?.logo_url ? (
                <img src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${brand.logo_url}`} alt="" className="h-6 w-6 object-contain" />
              ) : (
                <FileText className="h-4 w-4 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 truncate">
                {brand?.company_name || "Pactly"}
              </h1>
              <p className="text-xs text-slate-500 truncate">{contract.deal_title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Secure document badge */}
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
              <Lock className="h-3 w-3" />
              <span>Secure Document</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-emerald-600">
              <Shield className="h-3 w-3" />
              <span>End-to-end secure</span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="hidden sm:inline">v{contract.version_number}</span>
              {contract.contract_type && contract.contract_type !== "UNKNOWN" && (
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium">
                  {contract.contract_type}
                </span>
              )}
            </div>
            {contract?.buyer_accepted_at && contract?.seller_accepted_at && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                onClick={async () => {
                  try {
                    const blob = await publicApi.downloadTimelinePdf(token);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Critical_Dates.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {
                    // PDF may not be generated yet
                  }
                }}
              >
                <Clock className="h-3.5 w-3.5 mr-1.5" /> Critical Dates
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="h-8 text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Download PDF
            </Button>
            {/* Mobile right panel toggle */}
            <button
              onClick={() => setRightPanelOpen(prev => !prev)}
              className="lg:hidden flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {rightPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
            <span className="hidden sm:inline text-[10px] text-slate-300 font-medium">Powered by Pactly</span>
          </div>
        </div>
      </header>

      {/* AI Insight Card */}
      {insight && (
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-gradient-to-r from-teal-50 to-indigo-50 border border-teal-200/50 rounded-xl p-4 flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-teal-700 mb-1">AI Quick Insight</p>
              <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
              <button onClick={() => setChatOpen(true)} className="text-xs text-teal-600 hover:text-teal-700 mt-1.5 font-medium">
                Ask more questions →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left panel -- Contract */}
          <div className={`${rightPanelOpen ? "lg:w-2/3" : "lg:w-full"} space-y-4`}>
            <div ref={contractViewerRef} className="overflow-y-auto max-h-[calc(100vh-10rem)] rounded-xl border border-slate-200 bg-white shadow-sm">
              <ContractViewer text={contract.full_text} title={contract.deal_title} />
            </div>

            {/* Scroll CTA */}
            {readingProgress >= 75 && !scrollCtaDismissed && (
              <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-white/95 backdrop-blur border border-slate-200 rounded-full shadow-lg px-4 py-2 flex items-center gap-3 animate-in slide-in-from-bottom-4">
                <span className="text-xs text-slate-600">Need AI help with your own contracts?</span>
                <a
                  href={`/signup?ref=share_link&token=${token}`}
                  onClick={() => firePlgEvent("cta_clicked")}
                  className="text-xs font-medium text-teal-600 hover:text-teal-700 whitespace-nowrap"
                >
                  Try Pactly Free →
                </a>
                <button onClick={() => { setScrollCtaDismissed(true); localStorage.setItem("pactly_scroll_cta_dismissed", "true"); }} className="text-slate-400 hover:text-slate-500">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Right panel -- Tabbed */}
          {rightPanelOpen && (
          <div className="lg:w-1/3 space-y-4">
            {/* What's New banner */}
            {changesSummary && changesSummary.new_versions_count > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <GitBranch className="h-3 w-3 text-blue-600" />
                  </div>
                  <p className="text-xs font-semibold text-blue-700">
                    {changesSummary.new_versions_count} change{changesSummary.new_versions_count > 1 ? "s" : ""} since your last visit
                  </p>
                </div>
                {changesSummary.changes?.length > 0 && (
                  <div className="space-y-1 pl-8">
                    {changesSummary.changes.slice(0, 5).map((c: any, i: number) => (
                      <p key={i} className="text-[11px] text-slate-600">
                        <span className="font-medium">{c.field?.replace(/_/g, " ")}:</span>{" "}
                        {c.from_value && <><span className="line-through text-red-400">{c.from_value}</span> → </>}
                        <span className="text-green-600">{c.to_value}</span>
                      </p>
                    ))}
                  </div>
                )}
                {Object.keys(changesSummary.feedback_incorporated || {}).length > 0 && (
                  <div className="pl-8 space-y-1">
                    {Object.values(changesSummary.feedback_incorporated).map((inc: any, i: number) => (
                      <p key={i} className="text-[11px] text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Your feedback was incorporated in v{inc.version_number}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pill-style tab bar */}
            <div className="bg-slate-100 rounded-xl p-1 flex">
              <button
                onClick={() => setActiveTab("feedback")}
                className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                  activeTab === "feedback"
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Feedback</span>
                {feedbackHistory.length > 0 && (
                  <span className="bg-teal-100 text-teal-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                    {feedbackHistory.length}
                  </span>
                )}
              </button>
              {contract.extracted_fields && (
                <button
                  onClick={() => setActiveTab("summary")}
                  className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                    activeTab === "summary"
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Summary</span>
                </button>
              )}
              <button
                onClick={() => setActiveTab("versions")}
                className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                  activeTab === "versions"
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <GitBranch className="h-3.5 w-3.5" />
                <span>Versions</span>
                {versions.length > 0 && (
                  <span className="bg-slate-200 text-slate-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                    {versions.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                  activeTab === "activity"
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Activity</span>
                {timeline.length > 0 && (
                  <span className="bg-slate-200 text-slate-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                    {timeline.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === "feedback" && (<>
            {/* Deal info */}
            <Card>
              <CardContent className="py-4 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Shared with:</span>
                  <span className="font-medium text-slate-900">{contract.counterparty_name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Version {contract.version_number}</span>
                  {contract.contract_type && contract.contract_type !== "UNKNOWN" && (
                    <>
                      <span>&middot;</span>
                      <span>{contract.contract_type}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Accept Terms */}
            {contract && (
              <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/30 to-white">
                <CardContent className="py-4 space-y-2">
                  <p className="text-sm font-semibold">Deal Acceptance</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className={contract.seller_accepted_at ? "text-emerald-600 font-medium" : ""}>
                      {contract.seller_accepted_at ? "Seller accepted" : "Seller: pending"}
                    </span>
                    <span className={contract.buyer_accepted_at ? "text-emerald-600 font-medium" : ""}>
                      {contract.buyer_accepted_at ? "Buyer accepted" : "Buyer: pending"}
                    </span>
                  </div>
                  {(() => {
                    const counterpartySide = contract.deal_type === "sale" ? "buyer" : "seller";
                    const alreadyAccepted = counterpartySide === "buyer" ? contract.buyer_accepted_at : contract.seller_accepted_at;
                    if (alreadyAccepted) {
                      return <div className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> You have accepted these terms</div>;
                    }
                    return (
                      <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleAcceptTerms}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Accept Terms
                      </Button>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Deliverables */}
            {deliverables.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Your Deliverables
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {deliverables.map((d: any) => {
                    const isYours = d.responsible_party === "counterparty";
                    const statusColor = d.status === "overdue" ? "bg-rose-100 text-rose-700"
                      : d.status === "submitted" ? "bg-blue-100 text-blue-700"
                      : d.status === "approved" ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700";
                    return (
                      <div key={d.id} className={`border rounded-lg p-3 space-y-1.5 ${isYours ? "border-teal-200 bg-teal-50/30" : "border-slate-200"}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-slate-900">{d.description}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor}`}>
                            {d.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span>{d.due_date}</span>
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded">{d.category}</span>
                          <span className={isYours ? "text-teal-600 font-medium" : "text-slate-400"}>
                            {isYours ? "Your responsibility" : "Admin responsibility"}
                          </span>
                        </div>
                        {isYours && d.status === "pending" && (
                          <div>
                            <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer px-3 py-1.5 rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 transition-colors">
                              <Upload className="h-3 w-3" /> Upload File
                              <input
                                type="file"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    await publicApi.uploadDeliverable(token, d.id, file);
                                    const updated = await publicApi.getDeliverables(token);
                                    if (Array.isArray(updated)) setDeliverables(updated);
                                  } catch {
                                    setError("Failed to upload file");
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}
                        {d.filename && (
                          <p className="text-[10px] text-indigo-600">{d.filename}</p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Feedback form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Submit Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-slate-50 rounded-md px-3 py-2 text-xs text-slate-600">
                  Submitting as <span className="font-semibold text-slate-800">{contract.counterparty_name}</span>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                {submitSuccess && (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-md px-3 py-2">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Feedback submitted successfully
                  </div>
                )}
                {submitSuccess && !feedbackCtaDismissed && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-slate-600">Managing your own contracts? Get AI analysis, version tracking, and secure sharing.</p>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/signup?ref=share_link&token=${token}`}
                        onClick={() => firePlgEvent("cta_clicked")}
                        className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"
                      >
                        Create Your First Deal <ArrowRight className="h-3 w-3" />
                      </a>
                      <button onClick={() => { setFeedbackCtaDismissed(true); localStorage.setItem("pactly_feedback_cta_dismissed", "true"); }} className="text-[10px] text-slate-400 hover:text-slate-500 ml-auto">Dismiss</button>
                    </div>
                  </div>
                )}
                {feedbackItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Textarea
                      rows={3}
                      placeholder={idx === 0 ? "Share your comments, requested changes, or concerns..." : "Additional point..."}
                      value={item}
                      onChange={(e) => {
                        const next = [...feedbackItems];
                        next[idx] = e.target.value;
                        setFeedbackItems(next);
                      }}
                      className="text-sm flex-1"
                    />
                    <div className="flex flex-col gap-1 self-start mt-1">
                      <VoiceRecorder
                        size="sm"
                        onTranscribed={(t) => {
                          const next = [...feedbackItems];
                          next[idx] = next[idx] ? next[idx] + " " + t : t;
                          setFeedbackItems(next);
                        }}
                        transcribeFn={(audio) => publicApi.transcribe(token, audio)}
                      />
                      {feedbackItems.length > 1 && (
                        <button
                          onClick={() => setFeedbackItems(feedbackItems.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setFeedbackItems([...feedbackItems, ""])}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                >
                  + Add another point
                </button>
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={!feedbackItems.some(t => t.trim()) || submitting}
                  className="w-full"
                  style={{ backgroundColor: primaryColor }}
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Submit Feedback{feedbackItems.filter(t => t.trim()).length > 1 ? ` (${feedbackItems.filter(t => t.trim()).length} points)` : ""}</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Negotiation thread */}
            {feedbackHistory.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Negotiation Log ({feedbackHistory.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {feedbackHistory.map((item: any) => {
                    const isExpanded = expandedItems.has(item.id);
                    const isLong = item.feedback_text.length > 150;

                    return (
                      <div key={item.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Avatar circle with initials */}
                            <div
                              className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                              style={{ backgroundColor: primaryColor }}
                            >
                              {getInitials(item.reviewer_name || "R")}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900">{item.reviewer_name}</p>
                              <p className="text-[10px] text-slate-400">{relativeTime(item.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {item.cr_status && <StatusBadge status={item.cr_status} type="cr" />}
                            {item.analysis_status && <StatusBadge status={item.analysis_status} type="analysis" />}
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed">
                          {isLong && !isExpanded
                            ? item.feedback_text.slice(0, 150) + "..."
                            : item.feedback_text}
                        </p>
                        {isLong && (
                          <button
                            onClick={() => toggleExpand(item.id)}
                            className="text-[10px] text-teal-600 hover:text-teal-800 flex items-center gap-0.5"
                          >
                            {isExpanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show more</>}
                          </button>
                        )}

                        {item.analysis_status === "completed" && item.analysis_result && (
                          <div className="bg-slate-50 rounded-md p-2.5 space-y-2 border border-slate-100">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">AI Analysis</p>
                            {item.analysis_result.recommendation && (
                              <div>
                                <p className="text-[10px] font-medium text-slate-600">Recommendation</p>
                                <p className="text-xs text-slate-800">{item.analysis_result.recommendation}</p>
                              </div>
                            )}
                            {item.analysis_result.changes && Array.isArray(item.analysis_result.changes) && item.analysis_result.changes.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-slate-600">Field Changes</p>
                                <ul className="space-y-1">
                                  {item.analysis_result.changes.map((ch: any, i: number) => (
                                    <li key={i} className="text-xs text-slate-700">
                                      <span className="font-medium">{ch.field || ch.key}:</span>{" "}
                                      {ch.from && <><span className="line-through text-red-500">{ch.from}</span> &rarr; </>}
                                      <span className="text-green-700">{ch.to || ch.value}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {item.analysis_result.clause_actions && Array.isArray(item.analysis_result.clause_actions) && item.analysis_result.clause_actions.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-slate-600">Clause Impacts</p>
                                <ul className="space-y-1">
                                  {item.analysis_result.clause_actions.map((ca: any, i: number) => (
                                    <li key={i} className="text-xs text-slate-700">
                                      <span className="font-medium">{ca.clause || ca.key}:</span> {ca.action || ca.status}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {item.cr_status === "countered" && item.counter_proposal && (
                          <div className="bg-amber-50 rounded-md p-2.5 border border-amber-200 space-y-2">
                            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Counter-Proposal</p>
                            <p className="text-xs text-amber-900">{item.counter_proposal}</p>
                            {counterFormId === item.id ? (
                              <div className="space-y-2 pt-1">
                                <Textarea
                                  rows={3}
                                  placeholder="Your response to the counter-proposal..."
                                  value={counterText}
                                  onChange={(e) => setCounterText(e.target.value)}
                                  className="text-xs"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSubmitCounter(item.id)}
                                    disabled={!counterText.trim() || submittingCounter}
                                    style={{ backgroundColor: primaryColor }}
                                    className="text-xs h-7"
                                  >
                                    {submittingCounter ? "Submitting..." : "Send Response"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => { setCounterFormId(null); setCounterText(""); }}
                                    className="text-xs h-7"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCounterFormId(item.id)}
                                className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100"
                              >
                                <ArrowRightLeft className="h-3 w-3 mr-1" /> Respond to Counter
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
            </>)}

            {activeTab === "summary" && contract.extracted_fields && (
              <div className="space-y-4">
                {/* Key Terms Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Key Terms
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(contract.extracted_fields).map(([key, value]: [string, any]) => {
                        if (value === null || value === undefined || value === "") return null;
                        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                        let displayValue = value;
                        if (typeof value === "number" && (key.includes("price") || key.includes("money") || key.includes("concession"))) {
                          displayValue = `$${value.toLocaleString()}`;
                        } else if (typeof value === "number" && key.includes("days")) {
                          displayValue = `${value} days`;
                        } else if (typeof value === "object") {
                          displayValue = JSON.stringify(value);
                        }
                        return (
                          <div key={key} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
                            <p className="text-sm font-semibold text-slate-900 mt-0.5">{String(displayValue)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Clause Tags */}
                <FieldSummaryCard
                  fields={contract.extracted_fields}
                  clauses={contract.clause_tags?.map((t: any) => typeof t === "string" ? { key: t, status: "active" } : { key: t.key || String(t), status: t.status || "active" }) || null}
                />

                {/* Risk Flags (softer styling for public) */}
                {contract.risk_flags && contract.risk_flags.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Risk Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {contract.risk_flags.map((flag: any, i: number) => {
                        const borderColor = flag.severity === "high" ? "border-l-red-400" : flag.severity === "medium" ? "border-l-amber-400" : "border-l-blue-400";
                        return (
                          <div key={i} className={`border-l-2 ${borderColor} bg-slate-50 rounded-r-lg p-3 space-y-1`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                                flag.severity === "high" ? "text-red-600" : flag.severity === "medium" ? "text-amber-600" : "text-blue-600"
                              }`}>{flag.severity}</span>
                              {flag.category && <span className="text-[10px] text-slate-400">{flag.category}</span>}
                            </div>
                            <p className="text-xs font-medium text-slate-800">{flag.title}</p>
                            <p className="text-[11px] text-slate-600">{flag.description}</p>
                            {flag.suggestion && (
                              <p className="text-[11px] text-teal-600 italic">{flag.suggestion}</p>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Suggestions */}
                {contract.suggestions && contract.suggestions.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-teal-500" />
                        Tips & Suggestions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {contract.suggestions.map((s: any, i: number) => (
                        <div key={i} className="bg-teal-50/50 border border-teal-100 rounded-lg p-3 space-y-1">
                          <p className="text-xs font-medium text-slate-800">{s.title}</p>
                          <p className="text-[11px] text-slate-600">{s.description}</p>
                          {s.reference_data && (
                            <p className="text-[10px] text-slate-500 italic">{s.reference_data}</p>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === "versions" && (
              <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Contract Versions ({versions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {versions.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No versions available.</p>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((v: any) => {
                        const isCurrent = v.version_number === contract.version_number;
                        const isSelected = selectedVersionForDiff === v.id;
                        return (
                          <div
                            key={v.id}
                            className={`border rounded-lg p-3 space-y-1.5 ${
                              isCurrent ? "border-teal-300 bg-teal-50/50" : isSelected ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-900">
                                  v{v.version_number}
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] font-medium bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Eye className="h-2.5 w-2.5" /> Viewing
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                  {v.source}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {v.contract_type && v.contract_type !== "UNKNOWN" && (
                                  <span className="text-[10px] text-slate-500">{v.contract_type}</span>
                                )}
                                {v.has_diff && (
                                  <button
                                    onClick={() => handleViewDiff(v.id)}
                                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                                      isSelected
                                        ? "bg-indigo-100 text-indigo-700"
                                        : "bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                                    }`}
                                  >
                                    {isSelected ? "Hide Diff" : "View Diff"}
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-400">{formatDate(v.created_at)}</p>
                            {v.change_summary && (
                              <div className="bg-white rounded-md p-2 border border-slate-100 space-y-1">
                                {v.change_summary.summary && (
                                  <p className="text-[10px] text-slate-600">{v.change_summary.summary}</p>
                                )}
                                {v.change_summary.fields_changed && Array.isArray(v.change_summary.fields_changed) && v.change_summary.fields_changed.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {v.change_summary.fields_changed.map((f: string, i: number) => (
                                      <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                        {f}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Diff viewer */}
              {diffLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                  <span className="text-xs text-slate-500 ml-2">Loading diff...</span>
                </div>
              )}
              {diffData && !diffLoading && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">
                      Diff: v{diffData.version_a_number} → v{diffData.version_b_number}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div
                      className="text-xs font-mono overflow-x-auto max-h-80 overflow-y-auto bg-slate-50 rounded-lg p-3 border border-slate-200"
                      dangerouslySetInnerHTML={{ __html: diffData.diff_html }}
                    />
                    <style jsx global>{`
                      .diff-add { background-color: #dcfce7; color: #166534; }
                      .diff-remove { background-color: #fef2f2; color: #991b1b; text-decoration: line-through; }
                      .diff-context { color: #6b7280; }
                      .diff-header { color: #6b7280; font-weight: bold; }
                      .diff-hunk { color: #7c3aed; font-weight: 600; }
                    `}</style>
                    {diffData.field_changes?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Field Changes</p>
                        <div className="space-y-1">
                          {diffData.field_changes.map((c: any, i: number) => (
                            <div key={i} className="text-xs text-slate-700 flex items-center gap-1">
                              <span className="font-medium">{c.field?.replace(/_/g, " ")}:</span>
                              {c.from != null && <span className="line-through text-red-400">{String(c.from)}</span>}
                              {c.from != null && <span>→</span>}
                              <span className="text-green-600">{String(c.to)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              </div>
            )}

            {activeTab === "activity" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Deal Activity ({timeline.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {timeline.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No activity yet.</p>
                  ) : (
                    <div className="relative pl-6 space-y-4">
                      {/* Vertical line */}
                      <div className="absolute left-[9px] top-1 bottom-1 w-px bg-slate-200" />
                      {timeline.map((ev: any) => (
                        <div key={ev.id} className="relative">
                          {/* Dot */}
                          <div className={`absolute -left-6 top-0.5 h-[18px] w-[18px] rounded-full border-2 border-white ${getActionColor(ev.action)}`} />
                          <div>
                            <p className="text-xs font-medium text-slate-900">{formatActionLabel(ev.action)}</p>
                            <p className="text-[10px] text-slate-400">{relativeTime(ev.created_at)}</p>
                            {ev.details && Object.keys(ev.details).length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {Object.entries(ev.details).map(([k, v]) => (
                                  <p key={k} className="text-[10px] text-slate-500">
                                    <span className="font-medium text-slate-600">{k.replace(/_/g, " ")}:</span>{" "}
                                    {typeof v === "string" ? v : JSON.stringify(v)}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Pactly bottom bar (elegant, single line) */}
      <div className="border-t border-slate-200 bg-white">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://storage.googleapis.com/cluvi/Pactly.AI/logo_pactly_final.png" alt="Pactly" className="h-6 w-6 rounded-md" />
            <span className="text-xs text-slate-500">
              Powered by <span className="font-semibold text-slate-700">Pactly</span> — AI-powered contract management
            </span>
          </div>
          <div className="flex items-center">
            <span className="text-xs text-slate-400 hidden sm:inline mr-3">Secure AI-powered contract review</span>
            <a
              href={`/signup?ref=share_link&token=${token}`}
              onClick={() => firePlgEvent("cta_clicked")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
            >
              Get Started <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>


      {/* Floating Chat Bubble + Window */}

      {/* Chat window */}
      {chatOpen && (
        <div className="fixed bottom-24 right-6 z-[60] w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-2 text-white">
              <Bot className="h-5 w-5" />
              <div>
                <p className="text-sm font-semibold leading-tight">Pactly AI</p>
                <p className="text-[10px] opacity-80">Ask anything about this contract · Powered by Pactly</p>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-2">
                <Bot className="h-9 w-9 text-teal-500 mb-2" />
                <p className="text-sm font-medium text-slate-700 mb-1">Ask about this contract</p>
                <p className="text-xs text-slate-500 mb-4">
                  I can answer questions based on the contract content.
                </p>
                <div className="flex flex-col gap-2 w-full">
                  {generateStarterQuestions(contract?.extracted_fields).map(q => (
                    <button
                      key={q}
                      onClick={() => handleSendChat(q)}
                      className="text-left text-xs bg-slate-50 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 hover:border-teal-300 rounded-lg px-3 py-2 transition-colors flex items-center gap-2"
                    >
                      <Sparkles className="h-3 w-3 text-teal-400 shrink-0" />
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {chatMessages.map((msg, i) => (
                  <div key={i}>
                    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-teal-500 text-white rounded-br-md"
                            : "bg-slate-100 text-slate-800 rounded-bl-md"
                        }`}
                      >
                        {msg.content ? renderMarkdown(msg.content) : (
                          <span className="inline-flex items-center gap-1.5 py-1">
                            <span className="h-2 w-2 bg-teal-500 rounded-full animate-pulse" />
                            <span className="h-2 w-2 bg-teal-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
                            <span className="h-2 w-2 bg-teal-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Timestamp under message pair (show after assistant reply) */}
                    {msg.role === "assistant" && msg.content && (
                      <p className="text-[9px] text-slate-300 text-center mt-1">
                        {new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          {chatLimitReached ? (
            <div className="p-4 text-center space-y-2 bg-slate-50 rounded-lg mx-3 mb-3">
              <p className="text-sm font-medium text-slate-700">Want unlimited AI insights on all your contracts?</p>
              <a
                href={`/signup?ref=share_chat&token=${token}`}
                onClick={() => firePlgEvent("cta_clicked")}
                className="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
              >
                Create Your First Deal <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : (
            <div className="border-t border-slate-200 p-3 shrink-0">
              {!chatLimitReached && chatCount > 0 && (
                <p className="text-[10px] text-slate-400 text-center mb-1">{CHAT_LIMIT - chatCount} of {CHAT_LIMIT} AI questions remaining</p>
              )}
              <div className="flex gap-2">
                <Textarea
                  rows={1}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder="Ask a question..."
                  className="text-sm resize-none min-h-[36px]"
                  disabled={chatStreaming}
                />
                <Button
                  size="sm"
                  onClick={() => handleSendChat()}
                  disabled={!chatInput.trim() || chatStreaming}
                  style={{ backgroundColor: primaryColor }}
                  className="shrink-0 h-9 w-9 p-0"
                >
                  {chatStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating bubble button with pulse ring */}
      <button
        onClick={() => setChatOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-[60] h-14 w-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: primaryColor }}
      >
        {!chatOpen && (
          <span className="absolute inset-0 rounded-full animate-pulse ring-4 ring-teal-400/30" />
        )}
        {chatOpen ? (
          <X className="h-6 w-6 relative z-10" />
        ) : (
          <Bot className="h-6 w-6 relative z-10" />
        )}
      </button>

      {/* Onboarding Wizard */}
      {showOnboarding && contract && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-fade-in">
            <OnboardingSteps
              companyName={brand?.company_name || ""}
              logoUrl={brand?.logo_url ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${brand.logo_url}` : undefined}
              primaryColor={primaryColor}
              onComplete={() => {
                setShowOnboarding(false);
                localStorage.setItem(`pactly_onboarding_${token}`, "true");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function OnboardingSteps({ companyName, logoUrl, primaryColor, onComplete }: {
  companyName: string;
  logoUrl?: string;
  primaryColor: string;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome",
      content: (
        <div className="text-center space-y-4 py-6 px-6">
          {logoUrl && <img src={logoUrl} alt="" className="h-12 mx-auto" />}
          <h2 className="text-xl font-bold text-slate-900">
            {companyName ? `${companyName} shared a contract with you` : "You've been invited to review a contract"}
          </h2>
          <p className="text-sm text-slate-500">
            Powered by Pactly — AI-powered contract negotiation
          </p>
        </div>
      ),
    },
    {
      title: "How it works",
      content: (
        <div className="space-y-4 py-6 px-6">
          <h2 className="text-lg font-bold text-slate-900 text-center">How it works</h2>
          {[
            { icon: "1", title: "Read the contract", desc: "Review the full contract text in the left panel" },
            { icon: "2", title: "Submit feedback", desc: "Share your comments or request changes in the right panel" },
            { icon: "3", title: "Chat with AI", desc: "Use the AI assistant to ask questions about the contract" },
          ].map((item) => (
            <div key={item.icon} className="flex items-start gap-3">
              <div className="flex items-center justify-center h-7 w-7 rounded-full text-white text-sm font-bold shrink-0" style={{ backgroundColor: primaryColor }}>
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Ready",
      content: (
        <div className="text-center space-y-4 py-8 px-6">
          <div className="text-4xl">&#x1f389;</div>
          <h2 className="text-xl font-bold text-slate-900">You're all set!</h2>
          <p className="text-sm text-slate-500">Start reviewing the contract now.</p>
        </div>
      ),
    },
  ];

  return (
    <div>
      {steps[step].content}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i <= step ? "bg-teal-500" : "bg-slate-200"}`} />
          ))}
        </div>
        <Button
          size="sm"
          style={{ backgroundColor: primaryColor }}
          onClick={() => {
            if (step < steps.length - 1) setStep(step + 1);
            else onComplete();
          }}
        >
          {step < steps.length - 1 ? "Next" : "Start Review"}
        </Button>
      </div>
    </div>
  );
}
