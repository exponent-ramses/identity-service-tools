"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  listAuthMethods,
  deletePhoneMethod,
  deleteEmailMethod,
} from "@/app/actions/mfa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthMethod {
  id: string;
  methodType: string;
  detail?: string;
}

const methodConfig: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  phone: {
    label: "Phone",
    color: "bg-chart-1/10 text-chart-1 border-chart-1/20",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
  },
  email: {
    label: "Email",
    color: "bg-chart-2/10 text-chart-2 border-chart-2/20",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  microsoftAuthenticator: {
    label: "Authenticator App",
    color: "bg-chart-3/10 text-chart-3 border-chart-3/20",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  softwareOath: {
    label: "TOTP Token",
    color: "bg-chart-5/10 text-chart-5 border-chart-5/20",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  fido2: {
    label: "Security Key",
    color: "bg-chart-4/10 text-chart-4 border-chart-4/20",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
  },
  temporaryAccessPass: {
    label: "Temporary Access Pass",
    color: "bg-warning/10 text-warning border-warning/20",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
};

const defaultMethodConfig = {
  label: "Unknown",
  color: "bg-muted text-muted-foreground border-border",
  icon: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

export function MfaDetails({ userId }: { userId: string }) {
  const router = useRouter();
  const [methods, setMethods] = useState<AuthMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listAuthMethods(userId).then((result) => {
      if (result.success && result.data) {
        setMethods(result.data);
      }
      setLoading(false);
    });
  }, [userId]);

  function handleDelete(method: AuthMethod) {
    startTransition(async () => {
      let result;
      if (method.methodType === "phone") {
        result = await deletePhoneMethod(userId, method.id);
      } else if (method.methodType === "email") {
        result = await deleteEmailMethod(userId, method.id);
      } else {
        toast.error(
          `Cannot delete ${method.methodType} methods individually from this UI`
        );
        return;
      }

      if (result.success) {
        toast.success(`Removed ${method.methodType} method`);
        setMethods((prev) => prev.filter((m) => m.id !== method.id));
        router.refresh();
      } else {
        toast.error(`Failed: ${result.error?.message}`);
      }
    });
  }

  if (loading) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold">
            Authentication Methods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/40">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const nonPasswordMethods = methods.filter(
    (m) => m.methodType !== "password"
  );

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <CardTitle className="text-sm font-semibold">
            Authentication Methods
          </CardTitle>
          {nonPasswordMethods.length > 0 && (
            <Badge variant="secondary" className="font-mono text-xs ml-auto">
              {nonPasswordMethods.length}
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Registered MFA and authentication methods for this user.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {nonPasswordMethods.length === 0 ? (
          <div className="flex flex-col items-center py-8 rounded-lg border border-dashed border-border/60 bg-muted/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">
              No MFA methods registered
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              The user will be prompted to set up MFA on their next sign-in.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {nonPasswordMethods.map((method) => {
              const config =
                methodConfig[method.methodType] ?? defaultMethodConfig;
              const canDelete =
                method.methodType === "phone" ||
                method.methodType === "email";

              return (
                <div
                  key={method.id}
                  className="flex items-center gap-3 rounded-lg border border-border/40 bg-accent/20 p-3 transition-colors hover:bg-accent/40"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${config.color}`}
                  >
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{config.label}</p>
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      {method.detail || "No details available"}
                    </p>
                  </div>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleDelete(method)}
                      className="text-xs text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <svg className="mr-1 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Remove
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
