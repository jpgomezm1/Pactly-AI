"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Palette, Building2, Save, Lock, Upload, Check } from "lucide-react";
import { settingsApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const presetColors = [
  "#14B8A6", "#2563EB", "#0891B2", "#059669",
  "#D97706", "#DC2626", "#7C3AED", "#DB2777",
];

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isStarter = user?.plan === "starter";

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  const [color, setColor] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (settings && color === null) setColor(settings.primary_color);
    if (settings && companyName === null) setCompanyName(settings.company_name);
    if (settings && logoUrl === null) setLogoUrl(settings.logo_url || "");
  }, [settings]);

  const displayColor = color ?? settings?.primary_color ?? "#14B8A6";
  const displayName = companyName ?? settings?.company_name ?? "";
  const displayLogo = logoUrl ?? settings?.logo_url ?? "";

  const hasChanges =
    (color !== null && color !== settings?.primary_color) ||
    (companyName !== null && companyName !== settings?.company_name) ||
    (logoUrl !== null && logoUrl !== (settings?.logo_url || ""));

  const updateMutation = useMutation({
    mutationFn: (data: { primary_color?: string; company_name?: string; logo_url?: string }) =>
      settingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Settings saved", variant: "success" });
    },
    onError: (err: Error) =>
      toast({ title: "Save failed", description: err.message, variant: "error" }),
  });

  const handleSave = () => {
    const data: { primary_color?: string; company_name?: string; logo_url?: string } = {};
    if (color !== null) data.primary_color = color;
    if (companyName !== null) data.company_name = companyName;
    if (logoUrl !== null) data.logo_url = logoUrl;
    updateMutation.mutate(data);
  };

  if (user?.role !== "admin") {
    return (
      <EmptyState
        icon={Building2}
        title="Access restricted"
        description="Only administrators can manage company settings."
        className="py-24"
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organization Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Customize your brand appearance across contracts and exports</p>
        </div>
      </div>

      {isStarter && (
        <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <Lock className="h-4 w-4 shrink-0" />
          <span>Branding customization (logo and color) is available on Growth plan and above. Company name can still be edited.</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Logo Card */}
        <Card className={`relative overflow-hidden hover:shadow-md transition-shadow ${isStarter ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="absolute top-0 right-0 opacity-[0.04] pointer-events-none">
            <Link2 className="h-32 w-32 -mt-4 -mr-4" />
          </div>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              Company Logo
              {isStarter && <Lock className="h-3 w-3 text-amber-500" />}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Upload your company logo for contracts and exports</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex flex-col items-center justify-center h-36 rounded-lg border-2 border-dashed border-border bg-muted/30 cursor-pointer hover:border-primary/40 hover:bg-muted/50 transition-colors group"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/png,image/jpeg,image/svg+xml";
                input.click();
              }}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
            >
              {displayLogo ? (
                <img
                  src={displayLogo}
                  alt="Company logo"
                  className="max-h-24 w-auto object-contain"
                />
              ) : (
                <div className="text-center">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Drop your logo here or click to browse</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG, or SVG</p>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Or paste a URL</label>
              <Input
                value={displayLogo}
                onChange={(e) => !isStarter && setLogoUrl(e.target.value)}
                placeholder="https://storage.googleapis.com/your-bucket/logo.png"
                disabled={isStarter}
              />
            </div>
            <p className="text-xs text-muted-foreground">Recommended height: 64px.</p>
          </CardContent>
        </Card>

        {/* Brand Color Card */}
        <Card className={`relative overflow-hidden hover:shadow-md transition-shadow ${isStarter ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="absolute top-0 right-0 opacity-[0.04] pointer-events-none">
            <Palette className="h-32 w-32 -mt-4 -mr-4" />
          </div>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              Brand Color
              {isStarter && <Lock className="h-3 w-3 text-amber-500" />}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Choose the primary color for your brand identity</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preview bar */}
            <div className="rounded-lg overflow-hidden border border-border/50 shadow-sm">
              <div className="h-14 flex items-center px-5 gap-3" style={{ backgroundColor: displayColor }}>
                <span className="text-white font-semibold text-sm">{displayName || "Your Company"}</span>
                <div className="ml-auto flex items-center gap-2">
                  <Button size="sm" className="h-7 bg-white/20 hover:bg-white/30 text-white border-0 text-xs">
                    Sample Button
                  </Button>
                </div>
              </div>
            </div>

            {/* Presets */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Presets</p>
              <div className="flex gap-2 flex-wrap">
                {presetColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => !isStarter && setColor(c)}
                    className="h-9 w-9 rounded-lg border-2 transition-all hover:scale-110 flex items-center justify-center"
                    style={{
                      backgroundColor: c,
                      borderColor: displayColor === c ? "white" : "transparent",
                      boxShadow: displayColor === c ? `0 0 0 2px ${c}` : "none",
                    }}
                  >
                    {displayColor === c && <Check className="h-4 w-4 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom */}
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={displayColor}
                onChange={(e) => !isStarter && setColor(e.target.value)}
                className="h-9 w-9 rounded-lg cursor-pointer border border-border p-0.5"
                disabled={isStarter}
              />
              <Input
                value={displayColor}
                onChange={(e) => !isStarter && setColor(e.target.value)}
                className="w-28 font-mono text-sm h-9"
                placeholder="#14B8A6"
                disabled={isStarter}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Company Name */}
      <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
        <div className="absolute top-0 right-0 opacity-[0.04] pointer-events-none">
          <Building2 className="h-32 w-32 -mt-4 -mr-4" />
        </div>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Organization Name
          </CardTitle>
          <p className="text-xs text-muted-foreground">The name displayed in PDF headers and exported documents</p>
        </CardHeader>
        <CardContent>
          <Input
            value={displayName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="max-w-sm"
            placeholder="Your organization name"
          />
          <p className="text-xs text-muted-foreground mt-2">Appears in the PDF header and exported documents.</p>
        </CardContent>
      </Card>

      {/* Sticky Save Bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-40 animate-slide-up">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-medium text-muted-foreground">You have unsaved changes</span>
            </div>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <><Spinner size="sm" /> Saving...</>
              ) : (
                <><Save className="h-4 w-4" /> Save Changes</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
