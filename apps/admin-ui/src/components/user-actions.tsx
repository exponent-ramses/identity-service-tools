"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  resetPassword,
  disableUser,
  enableUser,
  deactivateUser,
  reactivateUser,
  deleteUser,
} from "@/app/actions/users";
import { resetAllMfaMethods } from "@/app/actions/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserActionsProps {
  userId: string;
  accountEnabled: boolean;
  displayName: string;
}

export function UserActions({
  userId,
  accountEnabled,
  displayName,
}: UserActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newPassword, setNewPassword] = useState("");
  const [forceChange, setForceChange] = useState(true);
  const [copied, setCopied] = useState(false);

  const generatePassword = useCallback(() => {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghjkmnpqrstuvwxyz";
    const digits = "23456789";
    const special = "!@#$%&*?";

    const getRandomChar = (chars: string) =>
      chars[Math.floor(Math.random() * chars.length)];

    const required = [
      getRandomChar(upper),
      getRandomChar(lower),
      getRandomChar(digits),
      getRandomChar(special),
    ];

    const all = upper + lower + digits + special;
    const remaining = Array.from({ length: 12 }, () => getRandomChar(all));

    const password = [...required, ...remaining]
      .sort(() => Math.random() - 0.5)
      .join("");

    setNewPassword(password);
    setCopied(false);
  }, []);

  function copyPassword() {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword).then(() => {
      setCopied(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleResetPassword() {
    if (!newPassword.trim()) {
      toast.error("Please enter a new password");
      return;
    }
    startTransition(async () => {
      const result = await resetPassword(userId, newPassword, forceChange);
      if (result.success) {
        toast.success("Password reset successfully");
        setNewPassword("");
        setCopied(false);
      } else {
        toast.error(`Failed to reset password: ${result.error?.message}`);
      }
    });
  }

  function handleToggleAccount() {
    startTransition(async () => {
      const result = accountEnabled
        ? await disableUser(userId)
        : await enableUser(userId);
      if (result.success) {
        toast.success(
          accountEnabled ? "Account disabled" : "Account enabled"
        );
        router.refresh();
      } else {
        toast.error(`Failed: ${result.error?.message}`);
      }
    });
  }

  function handleResetMfa() {
    startTransition(async () => {
      const result = await resetAllMfaMethods(userId);
      if (result.success) {
        const data = result.data;
        if (data && data.failed.length > 0) {
          toast.warning(
            `MFA partially reset: ${data.deleted.length} removed, ${data.failed.length} failed`
          );
        } else {
          toast.success(
            `MFA reset complete: ${data?.deleted.length ?? 0} methods removed`
          );
        }
        router.refresh();
      } else {
        toast.error(`Failed to reset MFA: ${result.error?.message}`);
      }
    });
  }

  function handleDeactivate() {
    startTransition(async () => {
      const result = await deactivateUser(userId);
      if (result.success) {
        toast.success(
          "User deactivated (disabled + moved to deactivated group)"
        );
        router.refresh();
      } else {
        toast.error(`Failed to deactivate: ${result.error?.message}`);
      }
    });
  }

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateUser(userId);
      if (result.success) {
        toast.success("User reactivated");
        router.refresh();
      } else {
        toast.error(`Failed to reactivate: ${result.error?.message}`);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteUser(userId);
      if (result.success) {
        toast.success("User deleted (moved to recycle bin for 30 days)");
        router.push("/users");
      } else {
        toast.error(`Failed to delete: ${result.error?.message}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Password Reset */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">
                Reset Password
              </CardTitle>
              <CardDescription className="text-xs">
                Set a temporary password. The user will be required to change it
                on next sign-in by default.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-xs font-medium">
              New Password
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-sm">
                <Input
                  id="new-password"
                  type="text"
                  placeholder="Enter or generate a temporary password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setCopied(false);
                  }}
                  className="pr-20 bg-input/50 border-border/60 font-mono text-sm"
                />
                {newPassword && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={copyPassword}
                  >
                    {copied ? (
                      <span className="flex items-center gap-1 text-success">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copied
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy
                      </span>
                    )}
                  </Button>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={generatePassword}
                className="shrink-0"
              >
                <svg className="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/70">
              Must meet Entra complexity requirements (8+ chars, mixed case,
              number, special character).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="force-change"
              checked={forceChange}
              onCheckedChange={(checked) => setForceChange(checked === true)}
            />
            <Label htmlFor="force-change" className="text-xs font-normal">
              Force password change on next sign-in
            </Label>
          </div>
          <Button
            onClick={handleResetPassword}
            disabled={isPending || !newPassword.trim()}
            size="sm"
            className="font-medium"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Resetting...
              </span>
            ) : (
              "Reset Password"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* MFA Reset */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">
                MFA Management
              </CardTitle>
              <CardDescription className="text-xs">
                Remove all registered MFA methods. Use when a user gets a new
                phone or needs to re-register authentication.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isPending}>
                Reset All MFA Methods
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Reset MFA for {displayName}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all registered authentication methods (phone,
                  email, authenticator app) except their password. The user will
                  need to re-register MFA on their next sign-in.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetMfa}>
                  Reset MFA
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Account Status — Quick Toggle */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${accountEnabled ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20"}`}>
              <svg className={`h-4 w-4 ${accountEnabled ? "text-success" : "text-destructive"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {accountEnabled ? (
                  <>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </>
                ) : (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </>
                )}
              </svg>
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">
                Quick Disable / Enable
              </CardTitle>
              <CardDescription className="text-xs">
                {accountEnabled
                  ? "Temporarily block sign-in. Use this for quick, reversible access suspension."
                  : "Re-enable sign-in access. The user will be able to authenticate again immediately."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              variant={accountEnabled ? "outline" : "default"}
              size="sm"
              onClick={handleToggleAccount}
              disabled={isPending}
            >
              {accountEnabled ? "Disable Account" : "Enable Account"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {accountEnabled
                ? "Sets accountEnabled = false. Does not move to deactivated group."
                : "Sets accountEnabled = true."}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Separator */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-destructive/20" />
        </div>
        <div className="relative flex justify-start">
          <span className="bg-background pr-3 text-xs font-semibold uppercase tracking-wider text-destructive/70">
            Danger Zone
          </span>
        </div>
      </div>

      {/* Deactivate / Delete */}
      <Card className="border-destructive/30 bg-card/80">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 border border-destructive/20">
              <svg className="h-4 w-4 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-destructive">
                Destructive Actions
              </CardTitle>
              <CardDescription className="text-xs">
                Deactivation disables the account and revokes all access via
                Conditional Access policy. Deletion is recoverable for 30 days
                only.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {accountEnabled ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <svg className="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                  Deactivate User
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Deactivate {displayName}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will disable their account and move them to the
                    Deactivated Users group, revoking all access via Conditional
                    Access policy. This can be reversed with the Reactivate
                    action.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeactivate}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Deactivate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReactivate}
              disabled={isPending}
              className="border-success/30 text-success hover:bg-success/10 hover:text-success"
            >
              <svg className="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Reactivate User
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={isPending}
                className="hover:glow-destructive"
              >
                <svg className="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                Delete User
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {displayName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the user account. It will be recoverable from
                  the Entra recycle bin for 30 days, after which it is
                  permanently gone. Prefer Deactivate for most workflows.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
