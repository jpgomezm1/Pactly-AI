"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  FileSearch,
  MessageSquareText,
  FileClock,
  Share2,
  Bot,
  ShieldCheck,
  Upload,
  Handshake,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Star,
  Zap,
  Clock,
  ArrowRight,
  Play,
  Lock,
  BadgeCheck,
} from "lucide-react";

/* ───────────────────────── DATA ───────────────────────── */

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    desc: "For solo agents getting started",
    monthlyPrice: 99,
    annualPrice: 79,
    deals: 5,
    users: 3,
    features: [
      "AI Contract Parsing",
      "Smart Change Requests",
      "Auto-Generated Versions",
      "Email Support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    desc: "For growing teams that negotiate daily",
    monthlyPrice: 249,
    annualPrice: 199,
    deals: 15,
    users: 10,
    popular: true,
    features: [
      "Everything in Starter",
      "Counterparty Sharing",
      "AI Chat for Reviewers",
      "Full Audit Trail",
      "Priority Support",
    ],
  },
  {
    id: "business",
    name: "Business",
    desc: "For brokerages with high volume",
    monthlyPrice: 499,
    annualPrice: 399,
    deals: 40,
    users: 30,
    features: [
      "Everything in Growth",
      "Custom Branding & Logo",
      "Advanced Analytics",
      "Dedicated Account Manager",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    desc: "For large organizations with custom needs",
    monthlyPrice: 999,
    annualPrice: 799,
    deals: 100,
    users: -1,
    features: [
      "Everything in Business",
      "Unlimited Users",
      "Custom Integrations",
      "SLA Guarantee",
      "On-boarding & Training",
    ],
  },
];

const FEATURES = [
  {
    icon: FileSearch,
    title: "AI Contract Parsing",
    desc: "Upload any Florida real estate contract and AI extracts every key field, date, and clause in seconds. No more manual data entry.",
    tag: "Save 4+ hrs/deal",
  },
  {
    icon: MessageSquareText,
    title: "Smart Change Requests",
    desc: "Submit changes in plain English. AI analyzes impact across every clause, flags risks, and drafts counter-proposals automatically.",
    tag: "AI-Powered",
  },
  {
    icon: FileClock,
    title: "Auto-Generated Versions",
    desc: "Every accepted change creates a clean new version with full diff tracking. See exactly what changed, line by line — no manual redlines.",
    tag: "Zero Redlines",
  },
  {
    icon: Share2,
    title: "Counterparty Sharing",
    desc: "Send a branded, secure link so the other side can review, comment, and negotiate — no login or account needed.",
    tag: "No Login Required",
  },
  {
    icon: Bot,
    title: "AI Chat for Reviewers",
    desc: "External reviewers ask questions about the contract and get instant, accurate AI answers. Reduces back-and-forth by 80%.",
    tag: "Reduce Back & Forth",
  },
  {
    icon: ShieldCheck,
    title: "Full Audit Trail",
    desc: "Every action logged with timestamps, user details, and IP addresses. Complete compliance trail for FREC and brokerage audits.",
    tag: "Audit-Ready",
  },
];

const STEPS = [
  {
    icon: Upload,
    num: "01",
    title: "Upload Your Contract",
    desc: "Drop a PDF, paste text, or generate from a template. AI parses every field in seconds and shows you a structured summary.",
  },
  {
    icon: Handshake,
    num: "02",
    title: "Negotiate with AI",
    desc: "Request changes in plain language, let AI analyze risk, share with the counterparty for feedback, and track every revision.",
  },
  {
    icon: CheckCircle2,
    num: "03",
    title: "Close the Deal",
    desc: "Accept the final version, download the executed contract, and keep a full audit trail for your records.",
  },
];

const TESTIMONIALS = [
  {
    quote: "We used to spend an entire day going back and forth on contract changes. Now it takes us under an hour. Pactly has been a game-changer for our team.",
    name: "Maria Gonzalez",
    role: "Broker/Owner",
    company: "Sunshine Realty Group",
    rating: 5,
  },
  {
    quote: "The counterparty sharing feature alone is worth the price. My clients love being able to review and ask questions without needing another app.",
    name: "James Carter",
    role: "Transaction Coordinator",
    company: "Coastal Properties FL",
    rating: 5,
  },
  {
    quote: "As a managing broker, having a complete audit trail for every deal gives me peace of mind. The AI parsing saves my agents hours every week.",
    name: "Sofia Martinez",
    role: "Managing Broker",
    company: "Premier South Realty",
    rating: 5,
  },
];

const FAQS = [
  {
    q: "What types of contracts does Pactly support?",
    a: "Pactly is optimized for Florida real estate contracts including FAR/BAR As-Is, FAR/BAR Standard, and custom brokerage forms. We support PDF uploads, pasted text, and AI-generated contracts from templates. We're expanding to more states soon.",
  },
  {
    q: "How does the deal limit work?",
    a: "Each deal represents one transaction with a contract. Your monthly plan includes a set number of deals you can create. If you exceed your limit, you can purchase additional deals at a per-deal rate or upgrade your plan. Unused deals do not roll over.",
  },
  {
    q: "Can the other party see my internal notes or AI analysis?",
    a: "Absolutely not. When you share a contract via a secure link, the counterparty only sees the contract document itself. Your internal change requests, AI risk analysis, and team notes remain completely private to your organization.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We follow industry-standard security practices, never share your data with third parties, and our infrastructure is hosted on enterprise-grade cloud providers.",
  },
  {
    q: "Can I cancel or change my plan anytime?",
    a: "Yes. You can upgrade instantly or downgrade at any time — changes take effect at the start of your next billing cycle. There are no long-term contracts or cancellation fees.",
  },
  {
    q: "Do my agents need separate accounts?",
    a: "Yes, each team member gets their own login. As the admin, you control user roles and permissions. Your plan includes a set number of user seats, and you can always add more by upgrading.",
  },
];

const STATS = [
  { value: "4.2hrs", label: "Saved per deal on average" },
  { value: "87%", label: "Faster contract turnaround" },
  { value: "500+", label: "Real estate teams in Florida" },
  { value: "12,000+", label: "Deals closed with Pactly" },
];

/* ───────────────────────── COMPONENT ───────────────────────── */

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [annual, setAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 scroll-smooth">
      {/* ─── NAVBAR ─── */}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/90 backdrop-blur-lg shadow-sm border-b border-slate-200/60" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="https://storage.googleapis.com/cluvi/Pactly.AI/logo_pactly_final.png" alt="Pactly" className="h-8 w-8 object-contain" />
            <span className="text-lg font-bold tracking-tight">Pactly</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">FAQ</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link href="/signup" className="group text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-all px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm shadow-teal-600/20 hover:shadow-md hover:shadow-teal-600/25">
              Start Free Trial
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <button className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileMenu ? "max-h-80 border-t border-slate-200" : "max-h-0"}`}>
          <div className="bg-white px-4 py-4 space-y-1">
            {["Features", "How It Works", "Pricing", "FAQ"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`} className="block text-sm font-medium text-slate-600 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors" onClick={() => setMobileMenu(false)}>
                {item}
              </a>
            ))}
            <div className="pt-3 border-t border-slate-200 flex flex-col gap-2 mt-2">
              <Link href="/login" className="text-sm font-medium text-slate-600 text-center py-2.5 rounded-lg hover:bg-slate-50">Sign In</Link>
              <Link href="/signup" className="text-sm font-medium text-white bg-teal-600 text-center py-2.5 rounded-lg">Start Free Trial</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-white" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-teal-100/40 via-emerald-50/30 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-sky-100/30 to-transparent rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20 sm:pb-32">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <AnimatedSection>
              <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200/60 text-teal-700 rounded-full px-4 py-1.5 text-sm font-medium mb-8">
                <Zap className="h-3.5 w-3.5" />
                Built for Florida Real Estate Professionals
              </div>
            </AnimatedSection>

            {/* Headline */}
            <AnimatedSection delay={100}>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-6xl font-extrabold tracking-tight leading-[1.1]">
                Stop Losing Hours on{" "}
                <span className="relative">
                  <span className="relative z-10 bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                    Contract Paperwork
                  </span>
                  <span className="absolute bottom-1 left-0 right-0 h-3 bg-teal-200/40 -z-0 rounded" />
                </span>
              </h1>
            </AnimatedSection>

            {/* Sub */}
            <AnimatedSection delay={200}>
              <p className="mt-6 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                Pactly uses AI to parse, negotiate, and close your real estate contracts in a fraction of the time. Built by agents, for agents.
              </p>
            </AnimatedSection>

            {/* CTA Row */}
            <AnimatedSection delay={300}>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className="group w-full sm:w-auto px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-teal-600/20 hover:shadow-xl hover:shadow-teal-600/25 flex items-center justify-center gap-2"
                >
                  Start Your Free Trial
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#how-it-works"
                  className="group w-full sm:w-auto px-8 py-3.5 bg-slate-100 hover:bg-slate-200/70 text-slate-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  See How It Works
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-400 flex items-center justify-center gap-1.5">
                <Lock className="h-3 w-3" />
                No credit card required &middot; Free for 14 days
              </p>
            </AnimatedSection>
          </div>

          {/* ─── HERO PRODUCT MOCKUP ─── */}
          <AnimatedSection delay={500}>
            <div className="mt-16 sm:mt-20 relative max-w-5xl mx-auto">
              <div className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white shadow-2xl shadow-slate-900/8 overflow-hidden">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 bg-slate-50/80">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-slate-300" />
                    <div className="h-3 w-3 rounded-full bg-slate-300" />
                    <div className="h-3 w-3 rounded-full bg-slate-300" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="bg-white border border-slate-200 rounded-md px-4 py-1 text-xs text-slate-400 font-medium w-64 text-center">app.pactly.ai/deals</div>
                  </div>
                </div>
                {/* App preview */}
                <div className="p-6 sm:p-8 min-h-[280px] sm:min-h-[380px] flex flex-col">
                  {/* Fake sidebar + content */}
                  <div className="flex gap-6 flex-1">
                    {/* Sidebar */}
                    <div className="hidden sm:flex flex-col gap-3 w-48 shrink-0">
                      <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 rounded-lg border border-teal-200/60">
                        <div className="h-2 w-2 rounded-full bg-teal-500" />
                        <span className="text-xs font-semibold text-teal-700">Active Deals</span>
                        <span className="ml-auto text-xs bg-teal-600 text-white rounded-full px-1.5 py-0.5 leading-none">8</span>
                      </div>
                      {["Pending Review", "Shared Links", "Change Requests", "Audit Log"].map((item) => (
                        <div key={item} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 font-medium">
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          {item}
                        </div>
                      ))}
                    </div>
                    {/* Main content */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="h-4 w-32 bg-slate-200 rounded mb-1.5" />
                          <div className="h-3 w-48 bg-slate-100 rounded" />
                        </div>
                        <div className="bg-teal-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">+ New Deal</div>
                      </div>
                      {/* Deal cards */}
                      {[
                        { title: "742 Ocean Drive, Miami Beach", status: "AI Parsing Complete", color: "bg-emerald-500" },
                        { title: "1500 Brickell Ave, Unit 2204", status: "Awaiting Counterparty", color: "bg-amber-500" },
                        { title: "330 Clematis St, West Palm Beach", status: "Changes Requested", color: "bg-blue-500" },
                      ].map((deal, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200/80 hover:border-slate-300 bg-white transition-colors">
                          <div className={`h-2.5 w-2.5 rounded-full ${deal.color} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-700 truncate">{deal.title}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{deal.status}</div>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute -left-2 sm:-left-4 top-1/2 -translate-y-1/2 bg-white border border-slate-200 rounded-xl shadow-lg p-3 hidden lg:flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Contract Parsed</div>
                  <div className="text-[11px] text-slate-400">47 fields extracted</div>
                </div>
              </div>

              <div className="absolute -right-2 sm:-right-4 top-1/3 bg-white border border-slate-200 rounded-xl shadow-lg p-3 hidden lg:flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">AI Analysis</div>
                  <div className="text-[11px] text-slate-400">2 risks flagged</div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── SOCIAL PROOF STATS ─── */}
      <section className="border-y border-slate-200/60 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {STATS.map((stat, i) => (
              <AnimatedSection key={stat.label} delay={i * 100} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-slate-500 mt-1 font-medium">{stat.label}</div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-24 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16 sm:mb-20">
            <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <Zap className="h-3.5 w-3.5" />
              Features
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Everything You Need to Close
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
              Built for brokers, agents, and transaction coordinators who want to spend less time on paperwork and more time at the closing table.
            </p>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {FEATURES.map((f, i) => (
              <AnimatedSection key={f.title} delay={i * 80}>
                <div className="group relative h-full p-6 sm:p-7 rounded-2xl border border-slate-200/80 bg-white hover:border-teal-300/60 hover:shadow-lg hover:shadow-teal-600/5 transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <f.icon className="h-5 w-5 text-teal-600" />
                    </div>
                    <span className="text-[11px] font-semibold text-teal-600 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-full">
                      {f.tag}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-slate-800">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-24 sm:py-32 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16 sm:mb-20">
            <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <Play className="h-3.5 w-3.5" />
              How It Works
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Three Steps to a Closed Deal
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
              From upload to close, Pactly handles the heavy lifting so you can focus on your clients.
            </p>
          </AnimatedSection>

          <div className="grid lg:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
            {STEPS.map((s, i) => (
              <AnimatedSection key={s.title} delay={i * 150}>
                <div className="relative h-full bg-white rounded-2xl border border-slate-200/80 p-7 sm:p-8 hover:shadow-lg transition-shadow duration-300">
                  {/* Number */}
                  <div className="text-5xl font-black text-slate-100 absolute top-5 right-6 select-none">{s.num}</div>
                  <div className="relative">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white flex items-center justify-center mb-5 shadow-lg shadow-teal-600/20">
                      <s.icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-xl mb-3 text-slate-800">{s.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                  {/* Connector arrow (desktop) */}
                  {i < 2 && (
                    <div className="hidden lg:block absolute -right-5 top-1/2 -translate-y-1/2 z-10 text-slate-300">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  )}
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-24 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16 sm:mb-20">
            <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              Trusted by 500+ Teams
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Loved by Florida&apos;s Top Agents
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
              Hear from brokers, agents, and TCs who are closing deals faster with Pactly.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <AnimatedSection key={t.name} delay={i * 120}>
                <div className="h-full flex flex-col bg-slate-50 rounded-2xl border border-slate-200/80 p-7 hover:shadow-md transition-shadow">
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <blockquote className="text-sm text-slate-600 leading-relaxed flex-1">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <div className="mt-6 pt-5 border-t border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                        {t.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{t.name}</div>
                        <div className="text-xs text-slate-400">{t.role} &middot; {t.company}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-24 sm:py-32 bg-gradient-to-b from-slate-50 to-white relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <BadgeCheck className="h-3.5 w-3.5" />
              Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
              Start free for 14 days. Pick the plan that fits your team. Upgrade or cancel anytime.
            </p>

            {/* Toggle */}
            <div className="mt-8 inline-flex items-center bg-slate-100 rounded-full p-1.5 gap-1">
              <button
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${!annual ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => setAnnual(false)}
              >
                Monthly
              </button>
              <button
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${annual ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => setAnnual(true)}
              >
                Annual
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">-20%</span>
              </button>
            </div>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {PLANS.map((plan, i) => (
              <AnimatedSection key={plan.id} delay={i * 100}>
                <div className={`relative h-full flex flex-col rounded-2xl border p-6 sm:p-7 transition-all duration-300 ${
                  plan.popular
                    ? "border-teal-500 ring-2 ring-teal-500/20 bg-white shadow-lg shadow-teal-600/8"
                    : "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-md"
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">
                      Most Popular
                    </div>
                  )}

                  <div className="mb-5">
                    <h3 className="font-bold text-lg text-slate-800">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{plan.desc}</p>
                  </div>

                  <div className="mb-1">
                    {annual && (
                      <span className="text-sm text-slate-400 line-through mr-2">${plan.monthlyPrice}</span>
                    )}
                    <span className="text-4xl font-extrabold tracking-tight">${annual ? plan.annualPrice : plan.monthlyPrice}</span>
                    <span className="text-slate-400 text-sm font-medium">/mo</span>
                  </div>
                  {annual && (
                    <div className="text-xs text-emerald-600 font-semibold mb-4">
                      Save ${(plan.monthlyPrice - plan.annualPrice) * 12}/year
                    </div>
                  )}
                  {!annual && <div className="mb-4" />}

                  <div className="flex items-center gap-4 py-3 mb-4 border-y border-slate-100 text-sm text-slate-600">
                    <span className="font-semibold">{plan.deals} deals/mo</span>
                    <span className="h-3.5 w-px bg-slate-200" />
                    <span className="font-semibold">{plan.users === -1 ? "Unlimited" : plan.users} users</span>
                  </div>

                  <ul className="space-y-2.5 mb-7 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                        <CheckCircle2 className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`/signup?plan=${plan.id}`}
                    className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      plan.popular
                        ? "bg-teal-600 hover:bg-teal-700 text-white shadow-sm shadow-teal-600/20 hover:shadow-md"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    Start Free Trial
                  </Link>
                </div>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection className="text-center mt-8">
            <p className="text-sm text-slate-400 flex items-center justify-center gap-1.5">
              <Lock className="h-3 w-3" />
              All plans include a 14-day free trial &middot; No credit card required
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── BEFORE / AFTER ─── */}
      <section className="py-24 sm:py-32 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Before Pactly vs. After Pactly</h2>
            <p className="mt-4 text-lg text-slate-500">See the difference AI makes on every deal.</p>
          </AnimatedSection>

          <AnimatedSection>
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Before */}
              <div className="rounded-2xl border border-rose-200/60 bg-rose-50/30 p-7">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-rose-600 mb-5">
                  <Clock className="h-4 w-4" />
                  Without Pactly
                </div>
                <ul className="space-y-3">
                  {[
                    "Manually read 20+ page contracts",
                    "Email PDFs back and forth for changes",
                    "Track revisions in spreadsheets",
                    "No visibility on what counterparty changed",
                    "Compliance audit takes days to prepare",
                    "4-6 hours per contract negotiation",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <X className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {/* After */}
              <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/30 p-7">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 mb-5">
                  <Zap className="h-4 w-4" />
                  With Pactly
                </div>
                <ul className="space-y-3">
                  {[
                    "AI extracts every field in seconds",
                    "Negotiate in-app with a shareable link",
                    "Automatic version control with diffs",
                    "Real-time view of all counterparty feedback",
                    "Audit trail is always ready — one click export",
                    "Under 1 hour per contract negotiation",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-24 sm:py-32 bg-slate-50">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white text-slate-600 border border-slate-200 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              FAQ
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              Everything you need to know about Pactly. Can&apos;t find an answer? <a href="mailto:support@pactly.ai" className="text-teal-600 hover:underline font-medium">Reach out</a>.
            </p>
          </AnimatedSection>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <AnimatedSection key={i} delay={i * 60}>
                <div className="border border-slate-200/80 rounded-xl bg-white overflow-hidden transition-shadow hover:shadow-sm">
                  <button
                    className="w-full flex items-center justify-between px-6 py-5 text-left text-sm font-semibold text-slate-800"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    {faq.q}
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ml-4 ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-96" : "max-h-0"}`}>
                    <div className="px-6 pb-5 text-sm text-slate-500 leading-relaxed">{faq.a}</div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-900/20 via-transparent to-transparent" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection>
            <div className="inline-flex items-center gap-2 bg-white/10 text-teal-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6 backdrop-blur-sm border border-white/10">
              <Zap className="h-3.5 w-3.5" />
              Start in under 2 minutes
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
              Ready to Close Deals Faster?
            </h2>
            <p className="mt-5 text-lg text-slate-300 max-w-lg mx-auto leading-relaxed">
              Join 500+ Florida real estate teams saving hours on every transaction. Your next deal deserves Pactly.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="group w-full sm:w-auto px-8 py-4 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-400/30 flex items-center justify-center gap-2 text-lg"
              >
                Start Your Free Trial
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-400 flex items-center justify-center gap-1.5">
              <Lock className="h-3 w-3" />
              No credit card required &middot; Cancel anytime
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <img src="https://storage.googleapis.com/cluvi/Pactly.AI/logo_pactly_final.png" alt="Pactly" className="h-7 w-7 object-contain" />
                <span className="text-base font-bold text-white tracking-tight">Pactly</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                AI-powered contract management built for Florida real estate professionals. Parse, negotiate, and close faster.
              </p>
            </div>
            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2.5">
                {["Features", "Pricing", "How It Works", "FAQ"].map((item) => (
                  <li key={item}>
                    <a href={`#${item.toLowerCase().replace(/ /g, "-")}`} className="text-sm hover:text-slate-200 transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            {/* Company */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Company</h4>
              <ul className="space-y-2.5">
                <li><Link href="/login" className="text-sm hover:text-slate-200 transition-colors">Sign In</Link></li>
                <li><Link href="/signup" className="text-sm hover:text-slate-200 transition-colors">Get Started</Link></li>
                <li><a href="mailto:support@pactly.ai" className="text-sm hover:text-slate-200 transition-colors">Contact Support</a></li>
              </ul>
            </div>
            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Legal</h4>
              <ul className="space-y-2.5">
                <li><span className="text-sm">Privacy Policy</span></li>
                <li><span className="text-sm">Terms of Service</span></li>
                <li><span className="text-sm">Security</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} Pactly. All rights reserved.</p>
            <a
              href="https://stayirrelevant.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <span>Developed by</span>
              <span className="bg-slate-800 rounded-md px-2 py-1">
                <img src="https://storage.googleapis.com/cluvi/nuevo_irre-removebg-preview.png" alt="Irrelevant" className="h-4 object-contain" />
              </span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
