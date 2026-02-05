const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const authApi = {
  signup: (data: { email: string; password: string; full_name: string; role: string }) =>
    request<any>("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
    plan?: string;
    billing_cycle?: string;
    ref_token?: string;
  }) =>
    request<{ access_token: string }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<{ access_token: string }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  me: () => request<any>("/auth/me"),
  validateMagicLink: (token: string) =>
    fetch(`${API_URL}/auth/magic-link/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(r => { if (!r.ok) throw new Error("Invalid or expired magic link"); return r.json(); }),
};

// Deals
export const dealsApi = {
  list: (params?: { dealType?: string; withHealth?: boolean; sortBy?: string; healthStatus?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.dealType) searchParams.set("deal_type", params.dealType);
    if (params?.withHealth) searchParams.set("with_health", "true");
    if (params?.sortBy) searchParams.set("sort_by", params.sortBy);
    if (params?.healthStatus) searchParams.set("health_status", params.healthStatus);
    const qs = searchParams.toString();
    return request<any[]>(qs ? `/deals?${qs}` : "/deals");
  },
  create: (data: { title: string; address?: string; description?: string; deal_type?: string }) =>
    request<any>("/deals", { method: "POST", body: JSON.stringify(data) }),
  get: (id: string) => request<any>(`/deals/${id}`),
  acceptTerms: (dealId: string) =>
    request<any>(`/deals/${dealId}/accept-terms`, { method: "POST" }),
  assign: (dealId: string, data: { user_id: string; role_in_deal: string }) =>
    request<any>(`/deals/${dealId}/assign`, { method: "POST", body: JSON.stringify(data) }),
  share: (dealId: string, data: { user_id: string; role_in_deal?: string }) =>
    request<any>(`/deals/${dealId}/share`, { method: "POST", body: JSON.stringify(data) }),
  activityFeed: (limit = 10) => request<any[]>(`/deals/activity-feed?limit=${limit}`),
  healthSummary: () => request<any>("/deals/health-summary"),
  downloadTimelinePdf: async (dealId: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_URL}/deals/${dealId}/timeline-pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Timeline PDF not available");
    return res.blob();
  },
  generateTimeline: (dealId: string) =>
    request<{ job_id: string }>(`/deals/${dealId}/generate-timeline`, { method: "POST" }),
};

// Contracts
export const contractsApi = {
  upload: (dealId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<any>(`/deals/${dealId}/contract/upload`, { method: "POST", body: formData });
  },
  paste: (dealId: string, text: string) =>
    request<any>(`/deals/${dealId}/contract/paste`, { method: "POST", body: JSON.stringify({ text }) }),
  current: (dealId: string) => request<any>(`/deals/${dealId}/contract/current`),
  templates: () => request<any[]>("/contract-templates"),
  uploadDoc: (dealId: string, file: File, docType: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("doc_type", docType);
    return request<any>(`/deals/${dealId}/contract/documents`, { method: "POST", body: formData });
  },
  listDocs: (dealId: string) => request<any[]>(`/deals/${dealId}/contract/documents`),
  generate: (dealId: string, data: { template_id: string; deal_details: Record<string, any>; supporting_doc_ids: string[] }) =>
    request<any>(`/deals/${dealId}/contract/generate`, { method: "POST", body: JSON.stringify(data) }),
  transcribe: (dealId: string, audio: Blob) => {
    const formData = new FormData();
    formData.append("file", audio, "recording.webm");
    return request<{ text: string }>(`/deals/${dealId}/contract/transcribe`, { method: "POST", body: formData });
  },
  pdfTemplates: () =>
    request<Array<{ slug: string; name: string; version: string; pdf_file: string }>>(
      "/contract-templates/pdf-templates"
    ),
  generatePdf: (dealId: string, data: { template_slug: string; deal_data?: Record<string, any>; flatten?: boolean }) =>
    request<{
      pdf_base64: string;
      filename: string;
      template_used: string;
      template_version: string;
      warnings: string[];
    }>(`/deals/${dealId}/contract/generate-pdf`, { method: "POST", body: JSON.stringify(data) }),
  downloadPdfUrl: (dealId: string, templateSlug: string, flatten: boolean = false) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const params = new URLSearchParams({ template_slug: templateSlug, flatten: String(flatten) });
    return `${API_URL}/deals/${dealId}/contract/generate-pdf/download?${params}`;
  },
};

// Change Requests
export const changeRequestsApi = {
  list: (dealId: string) => request<any[]>(`/deals/${dealId}/change-requests`),
  create: (dealId: string, rawText: string) =>
    request<any>(`/deals/${dealId}/change-requests`, { method: "POST", body: JSON.stringify({ raw_text: rawText }) }),
  get: (dealId: string, crId: string) => request<any>(`/deals/${dealId}/change-requests/${crId}`),
  analyze: (dealId: string, crId: string) =>
    request<any>(`/deals/${dealId}/change-requests/${crId}/analyze`, { method: "POST" }),
  accept: (dealId: string, crId: string) =>
    request<any>(`/deals/${dealId}/change-requests/${crId}/accept`, { method: "POST" }),
  reject: (dealId: string, crId: string, reason?: string) =>
    request<any>(`/deals/${dealId}/change-requests/${crId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || null }),
    }),
  counter: (dealId: string, crId: string, counterText: string) =>
    request<any>(`/deals/${dealId}/change-requests/${crId}/counter`, {
      method: "POST",
      body: JSON.stringify({ counter_text: counterText }),
    }),
  batchAction: (dealId: string, data: { batch_id: string; action: string; reason?: string; counter_text?: string }) =>
    request<any>(`/deals/${dealId}/change-requests/batch-action`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Versions
export const versionsApi = {
  list: (dealId: string) => request<any[]>(`/deals/${dealId}/versions`),
  get: (dealId: string, versionId: string) => request<any>(`/deals/${dealId}/versions/${versionId}`),
  generate: (dealId: string, changeRequestId: string) =>
    request<any>(`/deals/${dealId}/versions/generate`, {
      method: "POST",
      body: JSON.stringify({ change_request_id: changeRequestId }),
    }),
  diff: (dealId: string, versionId: string, against: string = "prev") =>
    request<any>(`/deals/${dealId}/versions/${versionId}/diff?against=${against}`),
};

// Timeline/Audit
export const timelineApi = {
  get: (dealId: string) => request<any>(`/deals/${dealId}/timeline`),
  audit: (dealId: string) => request<any[]>(`/deals/${dealId}/audit`),
};

// Jobs
export const jobsApi = {
  get: (jobId: string) => request<any>(`/jobs/${jobId}`),
};

// Share Links
export const shareLinksApi = {
  create: (dealId: string, data: { counterparty_name: string; counterparty_email?: string; expires_at?: string }) =>
    request<any>(`/deals/${dealId}/share-links`, { method: "POST", body: JSON.stringify(data) }),
  list: (dealId: string) => request<any[]>(`/deals/${dealId}/share-links`),
  deactivate: (dealId: string, linkId: string) =>
    request<any>(`/deals/${dealId}/share-links/${linkId}`, { method: "DELETE" }),
  feedback: (dealId: string) => request<any[]>(`/deals/${dealId}/share-links/feedback`),
};

// Public (no auth)
export const publicApi = {
  getContract: (token: string) =>
    fetch(`${API_URL}/public/review/${token}`).then(r => { if (!r.ok) throw new Error("Link invalid or expired"); return r.json(); }),
  submitFeedback: (token: string, data: { reviewer_name?: string; reviewer_email?: string; feedback_text: string }) =>
    fetch(`${API_URL}/public/review/${token}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error("Failed to submit feedback"); return r.json(); }),
  getBrand: (token: string) =>
    fetch(`${API_URL}/public/review/${token}/brand`).then(r => r.json()),
  getFeedbackHistory: (token: string) =>
    fetch(`${API_URL}/public/review/${token}/feedback`).then(r => { if (!r.ok) throw new Error("Failed to load feedback history"); return r.json(); }),
  submitCounterResponse: (token: string, data: { reviewer_name?: string; reviewer_email?: string; response_text: string; original_feedback_id: string }) =>
    fetch(`${API_URL}/public/review/${token}/counter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error("Failed to submit response"); return r.json(); }),
  getTimeline: (token: string) =>
    fetch(`${API_URL}/public/review/${token}/timeline`)
      .then(r => { if (!r.ok) throw new Error("Failed to load timeline"); return r.json(); }),
  getVersions: (token: string) =>
    fetch(`${API_URL}/public/review/${token}/versions`)
      .then(r => { if (!r.ok) throw new Error("Failed to load versions"); return r.json(); }),
  chat: (token: string, question: string, history: { role: string; content: string }[], sessionId?: string) =>
    fetch(`${API_URL}/public/review/${token}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history, session_id: sessionId }),
    }),
  getInsight: (token: string) =>
    fetch(`${API_URL}/public/review/${token}/insight`).then(r => r.json()),
  submitBatchFeedback: (token: string, data: { items: Array<{ reviewer_name?: string; reviewer_email?: string; feedback_text: string }> }) =>
    fetch(`${API_URL}/public/review/${token}/feedback/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error("Failed to submit feedback"); return r.json(); }),
  groupFeedback: (token: string, data: { feedback_ids: string[] }) =>
    fetch(`${API_URL}/public/review/${token}/feedback/group`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error("Failed to group feedback"); return r.json(); }),
  downloadTimelinePdf: async (token: string) => {
    const res = await fetch(`${API_URL}/public/review/${token}/timeline-pdf`);
    if (!res.ok) throw new Error("Timeline PDF not available");
    return res.blob();
  },
  acceptTerms: (token: string) =>
    fetch(`${API_URL}/public/review/${token}/accept-terms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).then(r => { if (!r.ok) throw new Error("Failed to accept terms"); return r.json(); }),
  getVersionDiff: (token: string, versionId: string, against: string = "prev") =>
    fetch(`${API_URL}/public/review/${token}/versions/${versionId}/diff?against=${against}`)
      .then(r => { if (!r.ok) throw new Error("Failed to load diff"); return r.json(); }),
  getChangesSummary: (token: string) =>
    fetch(`${API_URL}/public/review/${token}/changes-summary`)
      .then(r => { if (!r.ok) throw new Error("Failed to load changes summary"); return r.json(); }),
  getDeliverables: (token: string) =>
    fetch(`${API_URL}/public/review/${token}/deliverables`)
      .then(r => { if (!r.ok) throw new Error("Failed to load deliverables"); return r.json(); }),
  transcribe: async (token: string, audio: Blob) => {
    const formData = new FormData();
    formData.append("file", audio, "recording.webm");
    const res = await fetch(`${API_URL}/public/review/${token}/transcribe`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Transcription failed");
    return res.json() as Promise<{ text: string }>;
  },
  uploadDeliverable: async (token: string, id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/public/review/${token}/deliverables/${id}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to upload deliverable");
    return res.json();
  },
};

// Deliverables
export const deliverablesApi = {
  list: (dealId: string) => request<any[]>(`/deals/${dealId}/deliverables`),
  update: (dealId: string, id: string, data: { responsible_party?: string; is_confirmed?: boolean; status?: string }) =>
    request<any>(`/deals/${dealId}/deliverables/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  upload: (dealId: string, id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<any>(`/deals/${dealId}/deliverables/${id}/upload`, { method: "POST", body: formData });
  },
  download: async (dealId: string, id: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_URL}/deals/${dealId}/deliverables/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Download failed");
    return res.blob();
  },
  confirmAll: (dealId: string) =>
    request<{ confirmed: number }>(`/deals/${dealId}/deliverables/confirm-all`, { method: "POST" }),
};

// PLG Events
export const plgApi = {
  recordEvent: (data: { event_type: string; share_link_id?: string; session_id?: string; metadata?: Record<string, any> }) =>
    fetch(`${API_URL}/plg/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {}),
  metrics: () => request<any>("/plg/metrics"),
};

// Notifications
export const notificationsApi = {
  list: (limit = 20, offset = 0) => request<any[]>(`/notifications?limit=${limit}&offset=${offset}`),
  unreadCount: () => request<{ count: number }>("/notifications/unread-count"),
  markRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: "PUT" }),
  markAllRead: () => request<any>("/notifications/read-all", { method: "PUT" }),
};

// Settings
export const settingsApi = {
  get: () => request<any>("/settings"),
  update: (data: { primary_color?: string; company_name?: string; logo_url?: string }) =>
    request<any>("/settings", { method: "PUT", body: JSON.stringify(data) }),
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<any>("/settings/logo", { method: "POST", body: formData });
  },
  deleteLogo: () => request<any>("/settings/logo", { method: "DELETE" }),
};

// Super Admin
export const superAdminApi = {
  listOrgs: () => request<any[]>("/super-admin/organizations"),
  createOrg: (data: { name: string; slug: string; plan?: string; billing_anchor_day?: number; billing_cycle?: string }) =>
    request<any>("/super-admin/organizations", { method: "POST", body: JSON.stringify(data) }),
  getOrg: (orgId: string) => request<any>(`/super-admin/organizations/${orgId}`),
  listOrgUsers: (orgId: string) => request<any[]>(`/super-admin/organizations/${orgId}/users`),
  updateOrg: (orgId: string, data: Record<string, any>) =>
    request<any>(`/super-admin/organizations/${orgId}`, { method: "PUT", body: JSON.stringify(data) }),
  createOrgUser: (orgId: string, data: { email: string; full_name: string; password: string; role?: string }) =>
    request<any>(`/super-admin/organizations/${orgId}/users`, { method: "POST", body: JSON.stringify(data) }),
  getOrgUsage: (orgId: string) => request<any[]>(`/super-admin/organizations/${orgId}/usage`),
  deleteOrg: (orgId: string) =>
    request<any>(`/super-admin/organizations/${orgId}`, { method: "DELETE" }),
  getDashboard: () => request<any>("/super-admin/dashboard"),
  getOrgAIUsage: (orgId: string) => request<any>(`/super-admin/organizations/${orgId}/ai-usage`),
};

// Users (org admin)
export const usersApi = {
  list: () => request<any[]>("/users"),
  create: (data: { email: string; full_name: string; password: string; role?: string }) =>
    request<any>("/users", { method: "POST", body: JSON.stringify(data) }),
  update: (userId: string, data: { role?: string; is_active?: boolean; full_name?: string }) =>
    request<any>(`/users/${userId}`, { method: "PUT", body: JSON.stringify(data) }),
  completeOnboarding: () =>
    request<any>("/users/me/onboarding", { method: "PATCH" }),
};

// Usage
export const usageApi = {
  get: () => request<any>("/usage"),
};

// Property Lookup
export const propertyApi = {
  lookup: (address: string) =>
    request<{
      parcel_id: string | null;
      county: string | null;
      county_code: number | null;
      property_address: string | null;
      property_city: string | null;
      property_zip: string | null;
      owner_name: string | null;
      owner_address: string | null;
      owner_city: string | null;
      owner_state: string | null;
      owner_zip: string | null;
      legal_description: string | null;
      property_type: string | null;
      living_area_sqft: number | null;
      year_built: number | null;
      num_buildings: number | null;
      num_units: number | null;
      land_value: number | null;
      just_value: number | null;
      assessed_value: number | null;
      last_sale_price: number | null;
      last_sale_year: number | null;
      geocoded_coordinates: { x: number; y: number } | null;
    }>(`/property/lookup?address=${encodeURIComponent(address)}`),
};

// Offer Letters
export const offerLettersApi = {
  generate: (dealId: string, prompt: string) =>
    request<{ job_id: string }>(`/deals/${dealId}/offer-letters/generate`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),
  list: (dealId: string) =>
    request<any[]>(`/deals/${dealId}/offer-letters`),
  get: (dealId: string, id: string) =>
    request<any>(`/deals/${dealId}/offer-letters/${id}`),
  update: (dealId: string, id: string, data: {
    buyer_name?: string;
    seller_name?: string;
    property_address?: string;
    purchase_price?: number;
    earnest_money?: number;
    closing_date?: string;
    contingencies?: string[];
    additional_terms?: string;
    full_text?: string;
    status?: string;
  }) =>
    request<any>(`/deals/${dealId}/offer-letters/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (dealId: string, id: string) =>
    request<any>(`/deals/${dealId}/offer-letters/${id}`, {
      method: "DELETE",
    }),
};
