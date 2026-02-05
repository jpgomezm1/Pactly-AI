import jsPDF from "jspdf";
import "jspdf-autotable";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface BrandSettings {
  logo_url?: string;
  primary_color?: string;
  company_name?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Strip markdown-style bold markers (**text**) and return segments
// so we know which parts should render bold.
interface TextSegment {
  text: string;
  bold: boolean;
}

function parseMarkdownBold(raw: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    if (match.index > last) {
      segments.push({ text: raw.slice(last, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    last = regex.lastIndex;
  }
  if (last < raw.length) {
    segments.push({ text: raw.slice(last), bold: false });
  }
  return segments.length ? segments : [{ text: raw, bold: false }];
}

// Detect if a line is a section header (numbered heading, ALL-CAPS, ARTICLE, etc.)
function isHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Numbered section: "1. PURCHASE PRICE", "12. CLOSING DATE"
  if (/^\d+\.\s+[A-Z]/.test(trimmed)) return true;
  // ARTICLE / SECTION prefixed
  if (/^ARTICLE\s/i.test(trimmed)) return true;
  if (/^SECTION\s/i.test(trimmed)) return true;
  // ALL-CAPS line (at least 4 alpha chars, short enough to be a heading)
  if (trimmed.length > 3 && trimmed.length < 120 && trimmed === trimmed.toUpperCase() && /[A-Z]{3,}/.test(trimmed)) return true;
  return false;
}

// Detect sub-items: (a), (b), (i), bullets, indented
function isSubItem(line: string): boolean {
  const trimmed = line.trim();
  if (/^\([a-z]\)\s/.test(trimmed)) return true;
  if (/^\([ivxlc]+\)\s/i.test(trimmed)) return true;
  if (/^[-•]\s/.test(trimmed)) return true;
  if (line.startsWith("    ") || line.startsWith("\t")) return true;
  return false;
}

// Render a line with inline bold segments using jsPDF
function renderLineWithBold(
  doc: jsPDF,
  rawLine: string,
  x: number,
  y: number,
  baseFontSize: number,
  isBoldLine: boolean,
) {
  const segments = parseMarkdownBold(rawLine);
  let cursorX = x;

  for (const seg of segments) {
    const fontStyle = (seg.bold || isBoldLine) ? "bold" : "normal";
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(baseFontSize);
    doc.text(seg.text, cursorX, y);
    cursorX += doc.getTextWidth(seg.text);
  }

  // Reset
  doc.setFont("helvetica", "normal");
}

export async function exportContractPdf(
  contract: {
    full_text: string;
    version_number: number;
    extracted_fields?: Record<string, any>;
    clause_tags?: Array<{ key: string; status: string; text?: string }>;
  },
  dealTitle: string,
  brandSettings?: BrandSettings,
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 60;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const brandColor = brandSettings?.primary_color
    ? hexToRgb(brandSettings.primary_color)
    : [20, 184, 166] as [number, number, number];
  const companyName = brandSettings?.company_name || "Pactly";

  const API_URL = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
    : "";

  // ── Page footer helper ──
  const addFooter = (pageNum: number, totalPages: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `${companyName}  ·  ${dealTitle}  ·  Page ${pageNum} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 24,
      { align: "center" },
    );
    // Thin top rule for footer
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 36, pageWidth - margin, pageHeight - 36);
  };

  // ── Header bar ──
  doc.setFillColor(brandColor[0], brandColor[1], brandColor[2]);
  doc.rect(0, 0, pageWidth, 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");

  let logoPlaced = false;
  if (brandSettings?.logo_url) {
    const logoUrl = `${API_URL}${brandSettings.logo_url}`;
    const dataUrl = await loadImageAsDataUrl(logoUrl);
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, "PNG", margin, 10, 36, 36);
        doc.text(companyName, margin + 44, 34);
        logoPlaced = true;
      } catch {
        // fallback to text
      }
    }
  }
  if (!logoPlaced) {
    doc.text(companyName, margin, 34);
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    pageWidth - margin,
    34,
    { align: "right" },
  );

  y = 76;

  // ── Deal title + version ──
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(dealTitle, margin, y);
  y += 16;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`Version ${contract.version_number}`, margin, y);
  y += 10;

  // Thin separator
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  // ── Contract body ──
  const FONT = "helvetica";
  const bodyFontSize = 9.5;
  const headerFontSize = 10.5;
  const lineSpacing = 13;
  const headerSpacingBefore = 14;
  const paragraphSpacing = 6;
  const subItemIndent = 18;
  const bottomMargin = 54;
  // Safety buffer: jsPDF splitTextToSize can slightly underestimate widths
  // on certain char combos — shave 10pt off the wrap to guarantee no overflow
  const wrapSafetyBuffer = 10;

  // Pre-process: strip all markdown bold markers from the full text
  // and normalize to a clean, consistent plain-text contract.
  // Also normalize unicode dashes, smart quotes, etc. to ASCII equivalents
  // since helvetica metrics handle ASCII more reliably.
  const cleanText = contract.full_text
    .replace(/\*\*/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...");
  const rawLines = cleanText.split("\n");

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Blank line → small paragraph gap
    if (!trimmed) {
      y += paragraphSpacing;
      continue;
    }

    const header = isHeaderLine(line);
    const sub = !header && isSubItem(line);

    const fontSize = header ? headerFontSize : bodyFontSize;
    const fontStyle = header ? "bold" : "normal";
    const xOffset = sub ? margin + subItemIndent : margin;
    const maxWrap = (sub ? contentWidth - subItemIndent : contentWidth) - wrapSafetyBuffer;

    // Set font once for this line — consistent throughout
    doc.setFont(FONT, fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(30, 30, 30);

    // Wrap text to fit within available width
    const wrappedLines: string[] = doc.splitTextToSize(trimmed, maxWrap);

    // Extra space before section headers
    if (header && i > 0) {
      y += headerSpacingBefore;
    }

    for (const wLine of wrappedLines) {
      // Page break check
      if (y > pageHeight - bottomMargin) {
        doc.addPage();
        y = margin;
        // Re-apply font after page break
        doc.setFont(FONT, fontStyle);
        doc.setFontSize(fontSize);
        doc.setTextColor(30, 30, 30);
      }

      doc.text(wLine, xOffset, y);
      y += lineSpacing;
    }

    // Reset to normal after each line to prevent bleed
    doc.setFont(FONT, "normal");
  }

  // ── Add page numbers to all pages ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addFooter(p, totalPages);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`${companyName.replace(/\s+/g, "_")}_v${contract.version_number}_${dateStr}.pdf`);
}

export async function exportOfferLetterPdf(
  offerLetter: {
    full_text: string;
    buyer_name?: string;
    seller_name?: string;
    property_address?: string;
    purchase_price?: number;
    earnest_money?: number;
    closing_date?: string;
    contingencies?: string[];
    additional_terms?: string;
    created_at: string;
  },
  dealTitle: string,
  brandSettings?: BrandSettings,
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 60;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const brandColor = brandSettings?.primary_color
    ? hexToRgb(brandSettings.primary_color)
    : [245, 158, 11] as [number, number, number]; // amber-500
  const companyName = brandSettings?.company_name || "Pactly";

  const API_URL = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
    : "";

  // ── Page footer helper ──
  const addFooter = (pageNum: number, totalPages: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `${companyName}  ·  Offer Letter  ·  Page ${pageNum} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 24,
      { align: "center" },
    );
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 36, pageWidth - margin, pageHeight - 36);
  };

  // ── Header bar ──
  doc.setFillColor(brandColor[0], brandColor[1], brandColor[2]);
  doc.rect(0, 0, pageWidth, 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");

  let logoPlaced = false;
  if (brandSettings?.logo_url) {
    const logoUrl = `${API_URL}${brandSettings.logo_url}`;
    const dataUrl = await loadImageAsDataUrl(logoUrl);
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, "PNG", margin, 10, 36, 36);
        doc.text(companyName, margin + 44, 34);
        logoPlaced = true;
      } catch {
        // fallback to text
      }
    }
  }
  if (!logoPlaced) {
    doc.text(companyName, margin, 34);
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    pageWidth - margin,
    34,
    { align: "right" },
  );

  y = 76;

  // ── Title ──
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Offer Letter", margin, y);
  y += 20;

  // ── Property & Deal info ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  if (offerLetter.property_address) {
    doc.text(offerLetter.property_address, margin, y);
    y += 14;
  }
  if (dealTitle) {
    doc.text(`Deal: ${dealTitle}`, margin, y);
    y += 14;
  }

  // Thin separator
  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  // ── Key Terms Grid ──
  const terms: Array<{ label: string; value: string }> = [];
  if (offerLetter.buyer_name) terms.push({ label: "Buyer", value: offerLetter.buyer_name });
  if (offerLetter.seller_name) terms.push({ label: "Seller", value: offerLetter.seller_name });
  if (offerLetter.purchase_price) terms.push({ label: "Purchase Price", value: `$${offerLetter.purchase_price.toLocaleString()}` });
  if (offerLetter.earnest_money) terms.push({ label: "Earnest Money", value: `$${offerLetter.earnest_money.toLocaleString()}` });
  if (offerLetter.closing_date) terms.push({ label: "Closing Date", value: offerLetter.closing_date });
  if (offerLetter.contingencies && offerLetter.contingencies.length > 0) {
    terms.push({ label: "Contingencies", value: offerLetter.contingencies.join(", ") });
  }

  if (terms.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Key Terms", margin, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const colWidth = contentWidth / 2;
    let col = 0;
    let startY = y;

    for (const term of terms) {
      const xOffset = margin + col * colWidth;
      doc.setTextColor(100, 100, 100);
      doc.text(term.label + ":", xOffset, y);
      doc.setTextColor(30, 30, 30);
      doc.text(term.value, xOffset + 80, y);

      col++;
      if (col >= 2) {
        col = 0;
        y += 14;
      }
    }
    if (col !== 0) y += 14;
    y += 10;

    // Separator
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
  }

  // ── Full Letter Text ──
  const FONT = "helvetica";
  const bodyFontSize = 10;
  const lineSpacing = 14;
  const bottomMargin = 54;

  doc.setFont(FONT, "normal");
  doc.setFontSize(bodyFontSize);
  doc.setTextColor(30, 30, 30);

  const cleanText = offerLetter.full_text
    .replace(/\*\*/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...");

  const wrappedLines: string[] = doc.splitTextToSize(cleanText, contentWidth - 10);

  for (const wLine of wrappedLines) {
    if (y > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin;
      doc.setFont(FONT, "normal");
      doc.setFontSize(bodyFontSize);
      doc.setTextColor(30, 30, 30);
    }
    doc.text(wLine, margin, y);
    y += lineSpacing;
  }

  // ── Add page numbers to all pages ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addFooter(p, totalPages);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const safeAddress = (offerLetter.property_address || "Offer_Letter")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 30);
  doc.save(`${companyName.replace(/\s+/g, "_")}_${safeAddress}_${dateStr}.pdf`);
}
