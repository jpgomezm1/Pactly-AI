"use client";


interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left: Brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="auth-grid-pattern absolute inset-0" />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <img src="https://storage.googleapis.com/cluvi/Pactly.AI/logo_pactly_final.png" alt="Pactly" className="h-10 w-10 object-contain" />
            <span className="text-xl font-semibold text-white tracking-tight">Pactly</span>
          </div>

          {/* Tagline */}
          <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
            Smart Contracts,<br />Sealed Faster.
          </h1>
          <p className="text-slate-300 text-base max-w-md leading-relaxed">
            AI-powered contract negotiation for modern real estate teams. Parse, analyze, negotiate, and close faster.
          </p>

          {/* Feature highlights */}
          <div className="mt-12 space-y-4">
            {[
              "Instant contract field extraction",
              "AI-driven change request analysis",
              "Automated version generation & diff tracking",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-300 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute -top-20 -left-20 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      {/* Right: Form area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-muted/30">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img src="https://storage.googleapis.com/cluvi/Pactly.AI/logo_pactly_final.png" alt="Pactly" className="h-10 w-10 object-contain" />
            <span className="text-xl font-semibold text-foreground tracking-tight">Pactly</span>
          </div>
          {children}
        </div>
        <a
          href="https://stayirrelevant.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Developed by</span>
          <span className="bg-slate-900 rounded-md px-2 py-1">
            <img src="https://storage.googleapis.com/cluvi/nuevo_irre-removebg-preview.png" alt="Irrelevant" className="h-4 object-contain" />
          </span>
        </a>
      </div>
    </div>
  );
}
