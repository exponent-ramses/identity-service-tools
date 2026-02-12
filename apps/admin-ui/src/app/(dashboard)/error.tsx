"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20 mb-6">
        <svg
          className="h-7 w-7 text-destructive"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h2 className="text-xl font-bold tracking-tight mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-1">
        An unexpected error occurred while loading this page. This could be a
        temporary issue with the Entra Graph API or a network problem.
      </p>
      {error.message && (
        <p className="font-mono text-xs text-destructive/70 text-center max-w-md mb-6 px-3 py-2 rounded-md bg-destructive/5 border border-destructive/10">
          {error.message}
        </p>
      )}
      <div className="flex gap-3">
        <Button onClick={reset} className="font-medium">
          <svg
            className="mr-1.5 h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Try again
        </Button>
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/users")}
        >
          Back to Users
        </Button>
      </div>
    </div>
  );
}
