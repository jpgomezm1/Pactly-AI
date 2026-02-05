"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, ChevronLeft, ChevronRight, Download, FileText, Search, Sparkles, Upload, X,
} from "lucide-react";
import { contractsApi, propertyApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { AIBadge } from "@/components/ui/ai-badge";

interface ContractBuilderProps {
  dealId: string;
  dealAddress?: string;
  onGenerate: (jobId: string) => void;
}

type Step = 1 | 2 | 3 | 4;

const PROPERTY_TYPES = ["Single Family", "Condo", "Townhouse", "Multi-Family"];
const FINANCING_TYPES = ["Cash", "Conventional", "FHA", "VA"];

const DOC_SLOTS = [
  { key: "mls_listing", label: "MLS Listing" },
  { key: "inspection_report", label: "Inspection Report" },
  { key: "pre_approval_letter", label: "Pre-Approval Letter" },
] as const;

export function ContractBuilder({ dealId, dealAddress, onGenerate }: ContractBuilderProps) {
  const [step, setStep] = useState<Step>(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateSlug, setSelectedTemplateSlug] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupSuccess, setLookupSuccess] = useState(false);
  const { toast } = useToast();

  // Deal details form
  const [form, setForm] = useState({
    buyer_name: "",
    seller_name: "",
    buyer_agent: "",
    seller_agent: "",
    property_address: dealAddress || "",
    property_county: "",
    property_tax_id: "",
    legal_description: "",
    property_type: "Single Family",
    purchase_price: "",
    earnest_money: "",
    additional_deposit: "",
    financing_type: "Conventional",
    loan_approval_period_days: "30",
    interest_rate_cap: "",
    loan_term_years: "30",
    seller_concessions: "",
    closing_date: "",
    acceptance_deadline: "",
    inspection_period_days: "15",
    occupancy_date: "",
    inspection_contingency: true,
    financing_contingency: true,
    appraisal_contingency: false,
    title_contingency: true,
    escrow_agent_name: "",
    escrow_agent_address: "",
    escrow_agent_phone: "",
    escrow_agent_email: "",
    title_company: "",
    title_insurance_paid_by: "seller",
    home_warranty: "N/A",
    home_warranty_provider: "",
    home_warranty_cost: "",
    assignability: "may_not_assign",
    personal_property_included: "",
    personal_property_excluded: "",
    special_conditions: "",
  });

  // Supporting docs
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { id: string; filename: string }>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  // Pre-fill address from deal
  useEffect(() => {
    if (dealAddress && !form.property_address) {
      setForm((f) => ({ ...f, property_address: dealAddress }));
    }
  }, [dealAddress]);

  const { data: templates } = useQuery({
    queryKey: ["contract-templates"],
    queryFn: () => contractsApi.templates(),
  });

  const updateForm = (key: string, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const mapPropertyType = (type: string | null): string => {
    if (!type) return "Single Family";
    const map: Record<string, string> = {
      "Single Family": "Single Family",
      "Condo": "Condo",
      "Townhouse": "Townhouse",
      "Multi-Family": "Multi-Family",
    };
    return map[type] || "Single Family";
  };

  const handlePropertyLookup = async () => {
    if (!form.property_address.trim()) return;

    setLookupLoading(true);
    setLookupSuccess(false);

    try {
      const result = await propertyApi.lookup(form.property_address);

      // Auto-fill form fields
      setForm(f => ({
        ...f,
        property_county: result.county || f.property_county,
        property_tax_id: result.parcel_id || f.property_tax_id,
        legal_description: result.legal_description || f.legal_description,
        property_type: mapPropertyType(result.property_type) || f.property_type,
        seller_name: result.owner_name || f.seller_name,
      }));

      setLookupSuccess(true);
      toast({
        title: "Property found",
        description: `${result.county} County - ${result.parcel_id}`,
      });
    } catch (err: any) {
      toast({
        title: "Property not found",
        description: err.message || "Could not find property. Please fill in details manually.",
        variant: "error",
      });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleDocUpload = async (docType: string, file: File) => {
    setUploading(docType);
    try {
      const result = await contractsApi.uploadDoc(dealId, file, docType);
      setUploadedDocs((prev) => ({ ...prev, [docType]: { id: result.id, filename: result.filename } }));
    } catch {
      // Silently handle — user can retry
    } finally {
      setUploading(null);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplateId) return;
    setGenerating(true);
    try {
      const data = {
        template_id: selectedTemplateId,
        deal_details: {
          buyer_name: form.buyer_name,
          seller_name: form.seller_name,
          buyer_agent: form.buyer_agent || undefined,
          seller_agent: form.seller_agent || undefined,
          property_address: form.property_address,
          property_county: form.property_county || undefined,
          property_tax_id: form.property_tax_id || undefined,
          legal_description: form.legal_description || undefined,
          property_type: form.property_type,
          purchase_price: parseFloat(form.purchase_price) || 0,
          earnest_money: parseFloat(form.earnest_money) || 0,
          additional_deposit: form.additional_deposit ? parseFloat(form.additional_deposit) : undefined,
          financing_type: form.financing_type,
          loan_approval_period_days: form.financing_type !== "Cash" ? (parseInt(form.loan_approval_period_days) || 30) : undefined,
          interest_rate_cap: form.interest_rate_cap ? parseFloat(form.interest_rate_cap) : undefined,
          loan_term_years: form.financing_type !== "Cash" ? (parseInt(form.loan_term_years) || 30) : undefined,
          seller_concessions: form.seller_concessions ? parseFloat(form.seller_concessions) : undefined,
          closing_date: form.closing_date,
          acceptance_deadline: form.acceptance_deadline || undefined,
          inspection_period_days: parseInt(form.inspection_period_days) || 15,
          occupancy_date: form.occupancy_date || undefined,
          inspection_contingency: form.inspection_contingency,
          financing_contingency: form.financing_contingency,
          appraisal_contingency: form.appraisal_contingency,
          title_contingency: form.title_contingency,
          escrow_agent_name: form.escrow_agent_name || undefined,
          escrow_agent_address: form.escrow_agent_address || undefined,
          escrow_agent_phone: form.escrow_agent_phone || undefined,
          escrow_agent_email: form.escrow_agent_email || undefined,
          title_company: form.title_company || undefined,
          title_insurance_paid_by: form.title_insurance_paid_by,
          assignability: form.assignability,
          home_warranty: form.home_warranty,
          home_warranty_provider: form.home_warranty_provider || undefined,
          home_warranty_cost: form.home_warranty_cost ? parseFloat(form.home_warranty_cost) : undefined,
          personal_property_included: form.personal_property_included || undefined,
          personal_property_excluded: form.personal_property_excluded || undefined,
          special_conditions: form.special_conditions || undefined,
        },
        supporting_doc_ids: Object.values(uploadedDocs).map((d) => d.id),
      };
      const result = await contractsApi.generate(dealId, data);
      onGenerate(result.job_id);
    } catch {
      setGenerating(false);
    }
  };

  const handleDownloadOfficialPDF = async () => {
    if (!selectedTemplateSlug) {
      toast({
        title: "No template selected",
        description: "Please select a template first.",
        variant: "error",
      });
      return;
    }

    setDownloadingPdf(true);
    try {
      // Build deal data from form
      const dealData = {
        buyer_name: form.buyer_name,
        seller_name: form.seller_name,
        buyer_agent: form.buyer_agent || undefined,
        seller_agent: form.seller_agent || undefined,
        property_address: form.property_address,
        property_county: form.property_county || undefined,
        property_tax_id: form.property_tax_id || undefined,
        legal_description: form.legal_description || undefined,
        property_type: form.property_type,
        purchase_price: parseFloat(form.purchase_price) || 0,
        earnest_money: parseFloat(form.earnest_money) || 0,
        additional_deposit: form.additional_deposit ? parseFloat(form.additional_deposit) : undefined,
        financing_type: form.financing_type,
        loan_approval_period_days: form.financing_type !== "Cash" ? (parseInt(form.loan_approval_period_days) || 30) : undefined,
        interest_rate_cap: form.interest_rate_cap ? parseFloat(form.interest_rate_cap) : undefined,
        loan_term_years: form.financing_type !== "Cash" ? (parseInt(form.loan_term_years) || 30) : undefined,
        seller_concessions: form.seller_concessions ? parseFloat(form.seller_concessions) : undefined,
        closing_date: form.closing_date,
        acceptance_deadline: form.acceptance_deadline || undefined,
        inspection_period_days: parseInt(form.inspection_period_days) || 15,
        occupancy_date: form.occupancy_date || undefined,
        inspection_contingency: form.inspection_contingency,
        financing_contingency: form.financing_contingency,
        appraisal_contingency: form.appraisal_contingency,
        title_contingency: form.title_contingency,
        escrow_agent_name: form.escrow_agent_name || undefined,
        escrow_agent_address: form.escrow_agent_address || undefined,
        escrow_agent_phone: form.escrow_agent_phone || undefined,
        escrow_agent_email: form.escrow_agent_email || undefined,
        title_company: form.title_company || undefined,
        title_insurance_paid_by: form.title_insurance_paid_by,
        assignability: form.assignability,
        home_warranty: form.home_warranty,
        home_warranty_provider: form.home_warranty_provider || undefined,
        home_warranty_cost: form.home_warranty_cost ? parseFloat(form.home_warranty_cost) : undefined,
        personal_property_included: form.personal_property_included || undefined,
        personal_property_excluded: form.personal_property_excluded || undefined,
        special_conditions: form.special_conditions || undefined,
      };

      const result = await contractsApi.generatePdf(dealId, {
        template_slug: selectedTemplateSlug,
        deal_data: dealData,
        flatten: false,
      });

      // Convert base64 to blob and download
      const binaryString = atob(result.pdf_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (result.warnings.length > 0) {
        toast({
          title: "PDF generated with warnings",
          description: `${result.warnings.length} field(s) could not be filled. The PDF may be incomplete.`,
          variant: "default",
        });
      } else {
        toast({
          title: "PDF downloaded",
          description: `Official ${result.template_version} form generated.`,
        });
      }
    } catch (err: any) {
      toast({
        title: "PDF generation failed",
        description: err.message || "Could not generate the official PDF. The template may not be available.",
        variant: "error",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const canProceedStep2 = form.buyer_name && form.seller_name && form.property_address
    && form.purchase_price && form.earnest_money && form.closing_date;

  const selectedTemplate = templates?.find((t: any) => t.id === selectedTemplateId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Contract Builder
          </CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-full ${s <= step ? "bg-indigo-500" : "bg-border"}`} />
                {s < 4 && <div className={`h-px w-4 ${s < step ? "bg-indigo-500" : "bg-border"}`} />}
              </div>
            ))}
            <span className="ml-2">Step {step} of 4</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Step 1: Select Template */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose a contract template to get started.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates?.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTemplateId(t.id); setSelectedTemplateSlug(t.slug); }}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    selectedTemplateId === t.id
                      ? "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-200"
                      : "border-border hover:border-indigo-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-sm">{t.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">{t.state}</Badge>
                      {selectedTemplateId === t.id && (
                        <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!selectedTemplateId}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Deal Details Form */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Parties */}
            <div>
              <h4 className="text-sm font-medium mb-3">Parties</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Buyer Name *</label>
                  <Input value={form.buyer_name} onChange={(e) => updateForm("buyer_name", e.target.value)} placeholder="John Smith" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Buyer Agent</label>
                  <Input value={form.buyer_agent} onChange={(e) => updateForm("buyer_agent", e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Seller Name *</label>
                  <Input value={form.seller_name} onChange={(e) => updateForm("seller_name", e.target.value)} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Seller Agent</label>
                  <Input value={form.seller_agent} onChange={(e) => updateForm("seller_agent", e.target.value)} placeholder="Optional" />
                </div>
              </div>
            </div>

            {/* Property */}
            <div>
              <h4 className="text-sm font-medium mb-3">Property</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Property Address *</label>
                  <div className="flex gap-2">
                    <Input
                      value={form.property_address}
                      onChange={(e) => {
                        updateForm("property_address", e.target.value);
                        setLookupSuccess(false);
                      }}
                      placeholder="1340 S Ocean Blvd, Pompano Beach, FL 33062"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePropertyLookup}
                      disabled={lookupLoading || !form.property_address.trim()}
                      className={lookupSuccess ? "border-green-500 text-green-600" : ""}
                    >
                      {lookupLoading ? (
                        <Spinner size="sm" />
                      ) : lookupSuccess ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      <span className="ml-1.5 hidden sm:inline">
                        {lookupSuccess ? "Found" : "Lookup"}
                      </span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter address and click Lookup to auto-fill property details from Florida records
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">County</label>
                  <Input value={form.property_county} onChange={(e) => updateForm("property_county", e.target.value)} placeholder="Miami-Dade" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Property Tax ID #</label>
                  <Input value={form.property_tax_id} onChange={(e) => updateForm("property_tax_id", e.target.value)} placeholder="Optional" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Legal Description</label>
                  <Textarea value={form.legal_description} onChange={(e) => updateForm("legal_description", e.target.value)} placeholder="Lot, Block, Subdivision as recorded in Plat Book..." rows={2} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Property Type</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.property_type}
                    onChange={(e) => updateForm("property_type", e.target.value)}
                  >
                    {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Financial */}
            <div>
              <h4 className="text-sm font-medium mb-3">Financial</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Purchase Price *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input className="pl-7" type="number" value={form.purchase_price} onChange={(e) => updateForm("purchase_price", e.target.value)} placeholder="350000" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Initial Deposit (Earnest Money) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input className="pl-7" type="number" value={form.earnest_money} onChange={(e) => updateForm("earnest_money", e.target.value)} placeholder="10000" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Additional Deposit</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input className="pl-7" type="number" value={form.additional_deposit} onChange={(e) => updateForm("additional_deposit", e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Financing Type</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.financing_type}
                    onChange={(e) => updateForm("financing_type", e.target.value)}
                  >
                    {FINANCING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {form.financing_type !== "Cash" && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">Loan Approval Period (days)</label>
                      <Input type="number" value={form.loan_approval_period_days} onChange={(e) => updateForm("loan_approval_period_days", e.target.value)} placeholder="30" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Max Interest Rate %</label>
                      <Input type="number" step="0.125" value={form.interest_rate_cap} onChange={(e) => updateForm("interest_rate_cap", e.target.value)} placeholder="Prevailing rate" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Loan Term (years)</label>
                      <Input type="number" value={form.loan_term_years} onChange={(e) => updateForm("loan_term_years", e.target.value)} placeholder="30" />
                    </div>
                  </>
                )}
                <div>
                  <label className="text-xs text-muted-foreground">Seller Concessions</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input className="pl-7" type="number" value={form.seller_concessions} onChange={(e) => updateForm("seller_concessions", e.target.value)} placeholder="Optional" />
                  </div>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div>
              <h4 className="text-sm font-medium mb-3">Dates</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Closing Date *</label>
                  <Input type="date" value={form.closing_date} onChange={(e) => updateForm("closing_date", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Acceptance Deadline</label>
                  <Input type="date" value={form.acceptance_deadline} onChange={(e) => updateForm("acceptance_deadline", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Inspection Period (days)</label>
                  <Input type="number" value={form.inspection_period_days} onChange={(e) => updateForm("inspection_period_days", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Occupancy Date</label>
                  <Input type="date" value={form.occupancy_date} onChange={(e) => updateForm("occupancy_date", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Contingencies */}
            <div>
              <h4 className="text-sm font-medium mb-3">Contingencies</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: "inspection_contingency", label: "Inspection" },
                  { key: "financing_contingency", label: "Financing" },
                  { key: "appraisal_contingency", label: "Appraisal" },
                  { key: "title_contingency", label: "Title" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(form as any)[key]}
                      onChange={(e) => updateForm(key, e.target.checked)}
                      className="rounded border-input"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* Escrow & Title */}
            <div>
              <h4 className="text-sm font-medium mb-3">Escrow Agent & Title</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Escrow Agent Name</label>
                  <Input value={form.escrow_agent_name} onChange={(e) => updateForm("escrow_agent_name", e.target.value)} placeholder="e.g. First American Title" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Escrow Agent Phone</label>
                  <Input value={form.escrow_agent_phone} onChange={(e) => updateForm("escrow_agent_phone", e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Escrow Agent Address</label>
                  <Input value={form.escrow_agent_address} onChange={(e) => updateForm("escrow_agent_address", e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Escrow Agent Email</label>
                  <Input value={form.escrow_agent_email} onChange={(e) => updateForm("escrow_agent_email", e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Title Company</label>
                  <Input value={form.title_company} onChange={(e) => updateForm("title_company", e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Title Insurance Paid By</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.title_insurance_paid_by}
                    onChange={(e) => updateForm("title_insurance_paid_by", e.target.value)}
                  >
                    <option value="seller">Seller designates & pays (9c-i)</option>
                    <option value="buyer">Buyer designates & pays (9c-ii)</option>
                    <option value="miami_dade_broward">Miami-Dade/Broward (9c-iii)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contract Terms */}
            <div>
              <h4 className="text-sm font-medium mb-3">Contract Terms</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Assignability</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.assignability}
                    onChange={(e) => updateForm("assignability", e.target.value)}
                  >
                    <option value="may_not_assign">Buyer may NOT assign</option>
                    <option value="assign_and_release">Buyer may assign and be released</option>
                    <option value="assign_not_released">Buyer may assign but NOT be released</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Home Warranty</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.home_warranty}
                    onChange={(e) => updateForm("home_warranty", e.target.value)}
                  >
                    <option value="N/A">N/A</option>
                    <option value="buyer">Buyer pays</option>
                    <option value="seller">Seller pays</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Other Personal Property Included</label>
                  <Input value={form.personal_property_included} onChange={(e) => updateForm("personal_property_included", e.target.value)} placeholder="e.g. Pool equipment, outdoor furniture" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Items Excluded from Purchase</label>
                  <Input value={form.personal_property_excluded} onChange={(e) => updateForm("personal_property_excluded", e.target.value)} placeholder="e.g. Dining room chandelier" />
                </div>
              </div>
            </div>

            {/* Additional Terms */}
            <div>
              <h4 className="text-sm font-medium mb-3">Additional Terms</h4>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Special Conditions / Additional Terms</label>
                  <Textarea value={form.special_conditions} onChange={(e) => updateForm("special_conditions", e.target.value)} placeholder="Any additional terms, conditions, or rider notes (Paragraph 20)" rows={3} />
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Supporting Documents */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Optionally upload supporting documents. These help generate a more accurate contract.
            </p>
            <div className="space-y-3">
              {DOC_SLOTS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3 p-3 rounded-lg border">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    {uploadedDocs[key] ? (
                      <div className="flex items-center gap-2 mt-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-green-600 truncate">{uploadedDocs[key].filename}</span>
                        <button
                          onClick={() => setUploadedDocs((prev) => {
                            const next = { ...prev };
                            delete next[key];
                            return next;
                          })}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Optional</p>
                    )}
                  </div>
                  {!uploadedDocs[key] && (
                    <label className="shrink-0">
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDocUpload(key, file);
                          e.target.value = "";
                        }}
                      />
                      <Button variant="outline" size="sm" asChild disabled={uploading === key}>
                        <span>
                          {uploading === key ? <Spinner size="sm" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                          Upload
                        </span>
                      </Button>
                    </label>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep(4)}>Skip</Button>
                <Button onClick={() => setStep(4)}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review & Generate */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Template badge */}
            {selectedTemplate && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedTemplate.name}</Badge>
                <Badge variant="outline" className="text-[10px]">{selectedTemplate.state}</Badge>
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1.5">
                <h4 className="font-medium text-muted-foreground">Parties</h4>
                <p>Buyer: {form.buyer_name}</p>
                <p>Seller: {form.seller_name}</p>
                {form.buyer_agent && <p>Buyer Agent: {form.buyer_agent}</p>}
                {form.seller_agent && <p>Seller Agent: {form.seller_agent}</p>}
              </div>
              <div className="space-y-1.5">
                <h4 className="font-medium text-muted-foreground">Property</h4>
                <p>{form.property_address}</p>
                {form.property_county && <p>{form.property_county} County, FL</p>}
                <p>{form.property_type}</p>
                {form.legal_description && <p className="text-xs truncate">{form.legal_description}</p>}
              </div>
              <div className="space-y-1.5">
                <h4 className="font-medium text-muted-foreground">Financial</h4>
                <p>Price: ${Number(form.purchase_price).toLocaleString()}</p>
                <p>Deposit: ${Number(form.earnest_money).toLocaleString()}</p>
                {form.additional_deposit && <p>Addl. Deposit: ${Number(form.additional_deposit).toLocaleString()}</p>}
                <p>Financing: {form.financing_type}</p>
                {form.seller_concessions && <p>Concessions: ${Number(form.seller_concessions).toLocaleString()}</p>}
              </div>
              <div className="space-y-1.5">
                <h4 className="font-medium text-muted-foreground">Dates & Terms</h4>
                <p>Closing: {form.closing_date}</p>
                {form.acceptance_deadline && <p>Acceptance: {form.acceptance_deadline}</p>}
                <p>Inspection: {form.inspection_period_days} days</p>
                {form.occupancy_date && <p>Occupancy: {form.occupancy_date}</p>}
                {form.escrow_agent_name && <p>Escrow: {form.escrow_agent_name}</p>}
                {form.title_company && <p>Title Co: {form.title_company}</p>}
              </div>
            </div>

            {/* Contingencies */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Contingencies</h4>
              <div className="flex flex-wrap gap-2">
                {form.inspection_contingency && <Badge>Inspection</Badge>}
                {form.financing_contingency && <Badge>Financing</Badge>}
                {form.appraisal_contingency && <Badge>Appraisal</Badge>}
                {form.title_contingency && <Badge>Title</Badge>}
              </div>
            </div>

            {/* Documents */}
            {Object.keys(uploadedDocs).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Supporting Documents</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(uploadedDocs).map(([type, doc]) => (
                    <Badge key={type} variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {doc.filename}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {form.special_conditions && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Special Conditions</h4>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">{form.special_conditions}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleDownloadOfficialPDF}
                  disabled={downloadingPdf || generating}
                  className="gap-2"
                >
                  {downloadingPdf ? (
                    <><Spinner size="sm" /> Generating PDF...</>
                  ) : (
                    <><Download className="h-4 w-4" /> Official FAR/BAR PDF</>
                  )}
                </Button>
                <AIBadge />
                <Button
                  size="lg"
                  onClick={handleGenerate}
                  disabled={generating || downloadingPdf}
                  className="gap-2"
                >
                  {generating ? (
                    <><Spinner size="sm" /> Generating...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Generate Contract with AI</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
