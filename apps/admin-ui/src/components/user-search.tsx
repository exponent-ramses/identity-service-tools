"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { searchUsers, listUsers } from "@/app/actions/users";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface UserRow {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string | null;
  accountEnabled: boolean;
  identities?: Array<{
    signInType: string;
    issuerAssignedId: string;
  }>;
}

export function UserSearch() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [nextLink, setNextLink] = useState<string | undefined>();
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setHasSearched(true);
      if (query.trim()) {
        const result = await searchUsers(query.trim());
        if (result.success && result.data) {
          setUsers(result.data.items as UserRow[]);
          setNextLink(result.data.nextLink);
        } else {
          setUsers([]);
          setNextLink(undefined);
        }
      } else {
        const result = await listUsers({ top: 25 });
        if (result.success && result.data) {
          setUsers(result.data.items as UserRow[]);
          setNextLink(result.data.nextLink);
        }
      }
    });
  }

  function loadMore() {
    if (!nextLink) return;
    startTransition(async () => {
      const result = await listUsers({ nextLink });
      if (result.success && result.data) {
        setUsers((prev) => [...prev, ...(result.data!.items as UserRow[])]);
        setNextLink(result.data.nextLink);
      }
    });
  }

  function getUsername(user: UserRow): string {
    const identity = user.identities?.find(
      (id) => id.signInType === "userName"
    );
    return identity?.issuerAssignedId ?? user.userPrincipalName;
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 max-w-lg">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <Input
            placeholder="Search by name, email, or username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10 bg-card border-border/60 focus-visible:border-primary/50 focus-visible:ring-primary/20"
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="h-10 px-5 font-medium"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Searching
            </span>
          ) : (
            "Search"
          )}
        </Button>
        {!hasSearched && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            className="h-10"
            onClick={() => {
              setQuery("");
              startTransition(async () => {
                setHasSearched(true);
                const result = await listUsers({ top: 25 });
                if (result.success && result.data) {
                  setUsers(result.data.items as UserRow[]);
                  setNextLink(result.data.nextLink);
                }
              });
            }}
          >
            List All
          </Button>
        )}
      </form>

      {/* Loading skeleton */}
      {isPending && !hasSearched && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="p-4 border-b border-border/40">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="divide-y divide-border/40">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state — before any search */}
      {!hasSearched && !isPending && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/30 py-16 px-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card mb-4">
            <svg className="h-6 w-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Search for users
          </h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
            Enter a name, email, or username above to find users, or click
            &quot;List All&quot; to browse.
          </p>
        </div>
      )}

      {/* Results */}
      {hasSearched && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-xl border border-border/60 bg-card overflow-hidden">
          {/* Results header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-foreground">
                Results
              </h3>
              <Badge variant="secondary" className="font-mono text-xs">
                {users.length}
              </Badge>
            </div>
            {isPending && hasSearched && (
              <svg className="h-4 w-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
          </div>

          {/* Empty results */}
          {users.length === 0 && !isPending ? (
            <div className="flex flex-col items-center py-12 px-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">
                No users found
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search term or check the spelling.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-5">
                      User
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Username
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Email
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user, index) => (
                    <TableRow
                      key={user.id}
                      className="group border-border/40 hover:bg-accent/40 cursor-pointer transition-colors"
                    >
                      <TableCell className="pl-5">
                        <Link
                          href={`/users/${user.id}`}
                          className="flex items-center gap-3"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                            <span className="text-xs font-semibold text-primary">
                              {user.displayName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </span>
                          </div>
                          <span className="font-medium text-sm">
                            {user.displayName}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {getUsername(user)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {user.mail ?? (
                            <span className="italic text-muted-foreground/50">
                              none
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`status-dot ${
                              user.accountEnabled
                                ? "status-dot-active"
                                : "status-dot-disabled"
                            }`}
                          />
                          <span className="text-xs font-medium">
                            {user.accountEnabled ? "Active" : "Disabled"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/users/${user.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                          >
                            View
                            <svg className="ml-1 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Load more */}
              {nextLink && (
                <div className="flex justify-center border-t border-border/40 py-4">
                  <Button
                    variant="ghost"
                    onClick={loadMore}
                    disabled={isPending}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {isPending ? (
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Loading
                      </span>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
