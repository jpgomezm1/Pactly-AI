"use client";

import { useState } from "react";
import { FileText, MessageSquare, Share2, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { usersApi } from "@/lib/api";

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
  userName: string;
  userRole: string;
}

const steps = [
  {
    title: "Welcome to Pactly",
    subtitle: "AI-powered contract negotiation for modern real estate teams",
    content: (role: string) => (
      <div className="space-y-4">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center mx-auto">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <p className="text-sm text-muted-foreground text-center max-w-sm mx-auto">
          {role === "admin"
            ? "As an Admin, you can create deals, assign team members, and manage your organization."
            : "As an Agent, you can view assigned deals, create change requests, and collaborate on negotiations."}
        </p>
      </div>
    ),
  },
  {
    title: "Key Features",
    subtitle: "Here's what you can do with Pactly",
    content: () => (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <div className="h-9 w-9 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-medium">Deals & Contracts</p>
            <p className="text-xs text-muted-foreground">Upload, paste, or AI-generate contracts. Track every version automatically.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-medium">AI Analysis</p>
            <p className="text-xs text-muted-foreground">Submit change requests and get instant AI-powered risk assessment and recommendations.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
            <Share2 className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium">Share Links</p>
            <p className="text-xs text-muted-foreground">Share contracts with counterparties via secure links. Collect feedback without accounts.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "You're all set!",
    subtitle: "Create your first deal",
    content: () => (
      <div className="space-y-4 text-center">
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Create your first deal to start managing contracts with AI-powered analysis and secure sharing.
        </p>
      </div>
    ),
  },
];

export function OnboardingWizard({ open, onComplete, userName, userRole }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const currentStep = steps[step];
  const isLast = step === steps.length - 1;

  const handleNext = async () => {
    if (isLast) {
      try {
        await usersApi.completeOnboarding();
      } catch {}
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <div className="space-y-6 py-2">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-8 bg-teal-500" : i < step ? "w-4 bg-teal-300" : "w-4 bg-slate-200"
                }`}
              />
            ))}
          </div>

          {/* Greeting on first step */}
          {step === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Hi <span className="font-medium text-foreground">{userName}</span>!
            </p>
          )}

          {/* Title */}
          <div className="text-center">
            <h2 className="text-lg font-bold tracking-tight">{currentStep.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{currentStep.subtitle}</p>
          </div>

          {/* Content */}
          {currentStep.content(userRole)}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : (
              <div />
            )}
            <Button onClick={handleNext} className="gap-1.5">
              {isLast ? "Get Started" : "Next"}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
