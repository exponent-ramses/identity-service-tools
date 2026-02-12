"use client";

import { useEffect, useState } from "react";
import { getUserSignInLogs } from "@/app/actions/sign-in-logs";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface SignInLogEntry {
  id: string;
  createdDateTime: string;
  appDisplayName: string;
  ipAddress: string;
  clientAppUsed: string;
  status: {
    errorCode: number;
    failureReason: string | null;
  };
  location?: {
    city: string | null;
    state: string | null;
    countryOrRegion: string | null;
  };
}

export function SignInLogs({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<SignInLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUserSignInLogs(userId, { top: 20, daysBack: 7 }).then((result) => {
      if (result.success && result.data) {
        setLogs(result.data.items as SignInLogEntry[]);
      } else {
        setError(result.error?.message ?? "Failed to load sign-in logs");
      }
      setLoading(false);
    });
  }, [userId]);

  function formatDate(iso: string) {
    const date = new Date(iso);
    return {
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }

  function formatLocation(loc?: {
    city: string | null;
    state: string | null;
    countryOrRegion: string | null;
  }) {
    if (!loc) return null;
    const parts = [loc.city, loc.state, loc.countryOrRegion].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  }

  if (loading) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold">
            Sign-in Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-32 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <CardTitle className="text-sm font-semibold">
            Sign-in Activity
          </CardTitle>
          {logs.length > 0 && (
            <Badge variant="secondary" className="font-mono text-xs ml-auto">
              {logs.length} events
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Last 7 days of sign-in attempts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex flex-col items-center py-8 rounded-lg border border-dashed border-destructive/30 bg-destructive/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 mb-3">
              <svg className="h-5 w-5 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-sm font-medium text-destructive">
              Failed to load sign-in logs
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center py-8 rounded-lg border border-dashed border-border/60 bg-muted/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">
              No recent activity
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              No sign-in attempts in the last 7 days.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Time
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Application
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    IP Address
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Location
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const { date, time } = formatDate(log.createdDateTime);
                  const location = formatLocation(log.location);
                  const isSuccess = log.status.errorCode === 0;

                  return (
                    <TableRow
                      key={log.id}
                      className="border-border/40 hover:bg-accent/30"
                    >
                      <TableCell className="py-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">{date}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {time}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`status-dot ${
                              isSuccess
                                ? "status-dot-active"
                                : "status-dot-disabled"
                            }`}
                            style={{ animation: "none" }}
                          />
                          {isSuccess ? (
                            <span className="text-xs font-medium text-success">
                              Success
                            </span>
                          ) : (
                            <span
                              className="text-xs font-medium text-destructive cursor-help"
                              title={log.status.failureReason ?? "Unknown error"}
                            >
                              Error {log.status.errorCode}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">
                          {log.appDisplayName || (
                            <span className="text-muted-foreground/50 italic">
                              unknown
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.ipAddress || "\u2014"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {location || "\u2014"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
