import { notFound } from "next/navigation";
import Link from "next/link";
import { getUser, getUserGroups } from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserActions } from "@/components/user-actions";
import { MfaDetails } from "@/components/mfa-details";
import { SignInLogs } from "@/components/sign-in-logs";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [userResult, groupsResult] = await Promise.all([
    getUser(id),
    getUserGroups(id),
  ]);

  if (!userResult.success || !userResult.data) {
    notFound();
  }

  const user = userResult.data;
  const groups = groupsResult.success ? groupsResult.data ?? [] : [];

  const username =
    user.identities?.find((id) => id.signInType === "userName")
      ?.issuerAssignedId ?? user.userPrincipalName;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <span className="text-lg font-bold text-primary">
              {user.displayName
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {user.displayName}
              </h1>
              <div className="flex items-center gap-2">
                <span
                  className={`status-dot ${
                    user.accountEnabled
                      ? "status-dot-active"
                      : "status-dot-disabled"
                  }`}
                />
                <Badge
                  variant={user.accountEnabled ? "default" : "destructive"}
                  className="text-xs"
                >
                  {user.accountEnabled ? "Active" : "Disabled"}
                </Badge>
              </div>
            </div>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {username}
            </p>
          </div>
        </div>
        <Link href="/users">
          <Button variant="outline" size="sm" className="gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </Button>
        </Link>
      </div>

      {/* Profile Card */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <CardTitle className="text-sm font-semibold">
              Profile Information
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileField label="Entra Object ID" value={user.id} mono />
            <ProfileField label="Username" value={username} mono />
            <ProfileField
              label="Email"
              value={user.mail}
              fallback="No email (shadow account)"
            />
            <ProfileField label="Phone" value={user.mobilePhone} />
            <ProfileField label="Company" value={user.companyName} />
            <ProfileField label="Job Title" value={user.jobTitle} />
            <ProfileField label="Department" value={user.department} />
            <ProfileField
              label="Created"
              value={new Date(user.createdDateTime).toLocaleDateString(
                "en-US",
                { year: "numeric", month: "short", day: "numeric" }
              )}
            />
            <ProfileField
              label="Last Sign-in"
              value={
                user.signInActivity?.lastSignInDateTime
                  ? new Date(
                      user.signInActivity.lastSignInDateTime
                    ).toLocaleString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : null
              }
              fallback="Never signed in"
            />
          </div>

          {/* Groups */}
          {groups.length > 0 && (
            <div className="mt-6 pt-5 border-t border-border/40">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Group Memberships
              </p>
              <div className="flex flex-wrap gap-2">
                {groups.map((g: { id: string; displayName: string }) => (
                  <Badge
                    key={g.id}
                    variant="outline"
                    className="font-mono text-xs bg-accent/30"
                  >
                    {g.displayName}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabbed Actions */}
      <Tabs defaultValue="actions">
        <TabsList className="bg-muted/50 border border-border/60">
          <TabsTrigger value="actions" className="text-xs font-medium gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Actions
          </TabsTrigger>
          <TabsTrigger value="mfa" className="text-xs font-medium gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            MFA Methods
          </TabsTrigger>
          <TabsTrigger value="sign-ins" className="text-xs font-medium gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Sign-in Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="mt-6">
          <UserActions
            userId={user.id}
            accountEnabled={user.accountEnabled}
            displayName={user.displayName}
          />
        </TabsContent>

        <TabsContent value="mfa" className="mt-6">
          <MfaDetails userId={user.id} />
        </TabsContent>

        <TabsContent value="sign-ins" className="mt-6">
          <SignInLogs userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileField({
  label,
  value,
  fallback = "\u2014",
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  fallback?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1.5 text-sm ${
          mono ? "font-mono text-xs" : ""
        } ${!value ? "text-muted-foreground/50 italic" : ""}`}
      >
        {value || fallback}
      </dd>
    </div>
  );
}
