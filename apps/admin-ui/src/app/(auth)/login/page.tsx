"use client";

import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ExponentHRLogo, ExponentHRMark } from "@/components/exponenthr-logo";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 gradient-mesh" />

      {/* Radial fade at edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--background)_80%)]" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Logo / brand mark */}
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card/80 backdrop-blur-sm glow-primary">
              <ExponentHRMark className="h-7 w-7" />
            </div>
            {/* Full wordmark — dark variant for dark bg, light variant for light bg */}
            <div className="mb-1">
              <ExponentHRLogo variant="dark" className="hidden dark:block w-52" />
              <ExponentHRLogo variant="light" className="block dark:hidden w-52" />
            </div>
            <p className="mt-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Identity Administration
            </p>
          </div>

          {/* Sign-in card */}
          <div className="rounded-xl border border-border bg-card/60 p-8 backdrop-blur-sm">
            <div className="mb-6 text-center">
              <h2 className="text-sm font-semibold text-foreground">
                Support Agent Sign-in
              </h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Authenticate with your Microsoft work account to access Entra
                External ID management tools.
              </p>
            </div>

            <Button
              className="w-full h-11 gap-3 font-medium transition-all hover:glow-primary"
              onClick={() =>
                signIn.social({
                  provider: "microsoft",
                  callbackURL: "/users",
                })
              }
            >
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 21 21"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              Sign in with Microsoft
            </Button>

            <div className="mt-6 flex items-center gap-2 justify-center">
              <div className="h-px flex-1 bg-border" />
              <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                Secured by Entra ID
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>

          {/* Footer hint */}
          <p className="mt-6 text-center text-xs text-muted-foreground/60">
            Access restricted to authorized support personnel.
          </p>
        </div>
      </div>
    </div>
  );
}
