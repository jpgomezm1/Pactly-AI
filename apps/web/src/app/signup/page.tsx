"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  User,
  Mail,
  Lock,
  CreditCard,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";

const PLANS = [
  { id: "starter", name: "Starter", monthlyPrice: 99, annualPrice: 79, deals: 5, users: 3, icon: Shield },
  { id: "growth", name: "Growth", monthlyPrice: 249, annualPrice: 199, deals: 15, users: 10, popular: true, icon: TrendingUp },
  { id: "business", name: "Business", monthlyPrice: 499, annualPrice: 399, deals: 40, users: 30, icon: Building2 },
  { id: "enterprise", name: "Enterprise", monthlyPrice: 999, annualPrice: 799, deals: 100, users: -1, icon: Zap },
];

function SignupForm() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");
  const refToken = searchParams.get("token");
  const { register } = useAuth();

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [annual, setAnnual] = useState(false);

  // Step 3
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (planParam && PLANS.some((p) => p.id === planParam)) {
      setSelectedPlan(planParam);
    }
  }, [searchParams]);

  const plan = PLANS.find((p) => p.id === selectedPlan)!;
  const price = annual ? plan.annualPrice : plan.monthlyPrice;

  const canProceedStep1 = orgName.trim() && fullName.trim() && email.trim() && password.length >= 6;
  const canProceedStep3 = cardNumber.trim().length >= 12 && expiry.trim().length >= 4 && cvc.trim().length >= 3;

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await register({
        email,
        password,
        full_name: fullName,
        organization_name: orgName,
        plan: selectedPlan,
        billing_cycle: annual ? "annual" : "monthly",
        ref_token: refToken || undefined,
      });
    } catch (err: any) {
      setError(err.message || "Registration failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Illustration panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden">
        <img
          src="https://storage.googleapis.com/cluvi/Pactly.AI/back_image.png"
          alt="Real estate agent managing contracts"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/40 to-slate-900/80" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 h-full">
          {/* Top: Logo */}
          <div className="flex items-center gap-3">
            <img
              src="https://storage.googleapis.com/cluvi/Pactly.AI/logo_pactly_final.png"
              alt="Pactly"
              className="h-10 w-10 object-contain"
            />
            <span className="text-xl font-semibold text-white tracking-tight">Pactly</span>
          </div>

          {/* Center: Tagline */}
          <div>
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
              Close Deals,<br />Not Paperwork.
            </h1>
            <p className="text-slate-200 text-base max-w-md leading-relaxed">
              Join thousands of real estate professionals who use AI to manage contracts, track changes, and close faster.
            </p>

            {/* Trust signals */}
            <div className="mt-8 space-y-3">
              {[
                "Free 14-day trial, no commitment",
                "Set up your team in under 2 minutes",
                "AI-powered contract analysis from day one",
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-slate-200 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Social proof */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {["JG", "MS", "AK", "RL"].map((initials, i) => (
                <div
                  key={i}
                  className="h-8 w-8 rounded-full bg-teal-500/80 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white"
                >
                  {initials}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-white">500+</span> teams already on Pactly
            </p>
          </div>
        </div>
      </div>

      {/* Right: Form area */}
      <div className="flex-1 flex flex-col bg-muted/30">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          {/* Mobile logo */}
          <Link href="/" className="flex items-center gap-2 lg:invisible">
            <img
              src="https://storage.googleapis.com/cluvi/Pactly.AI/logo_pactly_final.png"
              alt="Pactly"
              className="h-8 w-8 object-contain"
            />
            <span className="text-lg font-semibold tracking-tight">Pactly</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-teal-600 hover:text-teal-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto w-full px-6 py-8 animate-fade-in">
            {/* Progress steps */}
            <div className="flex items-center gap-2 mb-8">
              {[
                { n: 1, label: "Account" },
                { n: 2, label: "Plan" },
                { n: 3, label: "Payment" },
              ].map(({ n, label }) => (
                <div key={n} className="flex items-center gap-2 flex-1">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 transition-colors ${
                      step > n
                        ? "bg-teal-600 text-white"
                        : step === n
                        ? "bg-teal-600 text-white shadow-md shadow-teal-600/30"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {step > n ? <CheckCircle2 className="h-4 w-4" /> : n}
                  </div>
                  <span
                    className={`text-sm font-medium hidden sm:block ${
                      step >= n ? "text-slate-900" : "text-slate-400"
                    }`}
                  >
                    {label}
                  </span>
                  {n < 3 && (
                    <div
                      className={`flex-1 h-px transition-colors ${
                        step > n ? "bg-teal-600" : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-700 text-sm p-3 rounded-lg border border-rose-200 mb-6 animate-shake">
                {error}
              </div>
            )}

            {/* Step 1: Account */}
            {step === 1 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
                <div>
                  <h2 className="text-xl font-bold">
                    {ref ? "You just reviewed a contract on Pactly. Now manage your own." : "Create your account"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {ref ? "Set up your organization to get started." : "Tell us about you and your organization."}
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Organization Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Sunshine Realty Group"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Jane Smith"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jane@sunshinerealty.com"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={!canProceedStep1}
                  onClick={() => {
                    setError("");
                    setStep(2);
                  }}
                >
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Step 2: Plan */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Choose your plan</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      You can change your plan anytime.
                    </p>
                  </div>
                  <div className="inline-flex items-center bg-slate-100 rounded-lg p-1">
                    <button
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        !annual ? "bg-white shadow text-slate-900" : "text-slate-600"
                      }`}
                      onClick={() => setAnnual(false)}
                    >
                      Monthly
                    </button>
                    <button
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        annual ? "bg-white shadow text-slate-900" : "text-slate-600"
                      }`}
                      onClick={() => setAnnual(true)}
                    >
                      Annual
                    </button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {PLANS.map((p) => {
                    const PlanIcon = p.icon;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPlan(p.id)}
                        className={`rounded-xl border p-5 text-left transition-all ${
                          selectedPlan === p.id
                            ? "border-teal-600 ring-2 ring-teal-600 bg-teal-50/50"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold flex items-center gap-2">
                            <PlanIcon className={`h-4 w-4 ${selectedPlan === p.id ? "text-teal-600" : "text-slate-400"}`} />
                            {p.name}
                          </span>
                          {p.popular && (
                            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                              Popular
                            </span>
                          )}
                        </div>
                        <div className="text-2xl font-bold">
                          ${annual ? p.annualPrice : p.monthlyPrice}
                          <span className="text-sm text-slate-500 font-normal">/mo</span>
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                          {p.deals} deals/mo &middot;{" "}
                          {p.users === -1 ? "Unlimited" : p.users} users
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setError("");
                      setStep(3);
                    }}
                  >
                    Continue <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
                  <div>
                    <h2 className="text-xl font-bold">Payment Details</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your card will be charged after the trial period.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Card Number</label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={cardNumber}
                          onChange={(e) =>
                            setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))
                          }
                          placeholder="4242 4242 4242 4242"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Expiry</label>
                        <Input
                          value={expiry}
                          onChange={(e) =>
                            setExpiry(e.target.value.replace(/[^\d/]/g, "").slice(0, 5))
                          }
                          placeholder="MM/YY"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">CVC</label>
                        <Input
                          value={cvc}
                          onChange={(e) =>
                            setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))
                          }
                          placeholder="123"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-semibold mb-3">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">
                        {plan.name} Plan ({annual ? "Annual" : "Monthly"})
                      </span>
                      <span className="font-medium">${price}/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Deals included</span>
                      <span>{plan.deals}/month</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Team members</span>
                      <span>
                        {plan.users === -1 ? "Unlimited" : `Up to ${plan.users}`}
                      </span>
                    </div>
                    <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-semibold">
                      <span>Total</span>
                      <span>
                        ${annual ? price * 12 : price}
                        {annual ? "/year" : "/mo"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!canProceedStep3 || loading}
                    onClick={handleSubmit}
                  >
                    {loading ? (
                      <>
                        <Spinner size="sm" /> Processing...
                      </>
                    ) : (
                      "Start Your Plan"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-white px-6 py-4 text-center">
          <a
            href="https://stayirrelevant.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Developed by</span>
            <span className="bg-slate-900 rounded-md px-2 py-1">
              <img
                src="https://storage.googleapis.com/cluvi/nuevo_irre-removebg-preview.png"
                alt="Irrelevant"
                className="h-4 object-contain"
              />
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
