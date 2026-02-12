"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createUser } from "@/app/actions/users";
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

export default function CreateUserPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    password: "",
    email: "",
    mobilePhone: "",
    companyName: "",
    jobTitle: "",
    department: "",
    forceChangePassword: true,
  });

  const [copied, setCopied] = useState(false);

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

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

    update("password", password);
    setCopied(false);
  }, []);

  function copyPassword() {
    if (!form.password) return;
    navigator.clipboard.writeText(form.password).then(() => {
      setCopied(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (
      !form.displayName.trim() ||
      !form.username.trim() ||
      !form.password.trim()
    ) {
      toast.error("Display name, username, and password are required.");
      return;
    }

    startTransition(async () => {
      const input = {
        displayName: form.displayName.trim(),
        username: form.username.trim(),
        password: form.password,
        email: form.email.trim() || undefined,
        mobilePhone: form.mobilePhone.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        department: form.department.trim() || undefined,
        forceChangePassword: form.forceChangePassword,
      };

      const result = await createUser(input);
      if (result.success && result.data) {
        toast.success(`User "${form.displayName}" created successfully`);
        router.push(`/users/${result.data.id}`);
      } else {
        toast.error(`Failed to create user: ${result.error?.message}`);
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create User</h1>
          <p className="text-sm text-muted-foreground">
            Provision a new local account in Entra External ID.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">User Details</CardTitle>
          <CardDescription className="text-xs">
            Required fields are marked with an asterisk. The user receives a
            temporary password and must change it on first sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Identity fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="displayName"
                label="Display Name"
                required
                value={form.displayName}
                onChange={(v) => update("displayName", v)}
                placeholder="John Smith"
              />
              <FormField
                id="username"
                label="Username"
                required
                value={form.username}
                onChange={(v) => update("username", v)}
                placeholder="jsmith"
                mono
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium">
                Temporary Password <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="password"
                    type="text"
                    value={form.password}
                    onChange={(e) => {
                      update("password", e.target.value);
                      setCopied(false);
                    }}
                    placeholder="Enter or generate a temporary password"
                    className="pr-20 bg-input/50 border-border/60 font-mono text-sm"
                    required
                  />
                  {form.password && (
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
                id="forceChange"
                checked={form.forceChangePassword}
                onCheckedChange={(checked) =>
                  update("forceChangePassword", checked === true)
                }
              />
              <Label htmlFor="forceChange" className="text-xs font-normal">
                Require password change on first sign-in
              </Label>
            </div>

            {/* Separator */}
            <div className="border-t border-border/40" />

            {/* Contact fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="email"
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => update("email", v)}
                placeholder="jsmith@company.com"
                hint="Leave blank for users without email."
              />
              <FormField
                id="mobilePhone"
                label="Mobile Phone"
                value={form.mobilePhone}
                onChange={(v) => update("mobilePhone", v)}
                placeholder="+1 555-123-4567"
              />
            </div>

            {/* Organization fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                id="companyName"
                label="Company"
                value={form.companyName}
                onChange={(v) => update("companyName", v)}
                placeholder="Acme Corp"
              />
              <FormField
                id="jobTitle"
                label="Job Title"
                value={form.jobTitle}
                onChange={(v) => update("jobTitle", v)}
                placeholder="Software Engineer"
              />
              <FormField
                id="department"
                label="Department"
                value={form.department}
                onChange={(v) => update("department", v)}
                placeholder="Engineering"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-border/40">
              <Button
                type="submit"
                disabled={isPending}
                className="font-medium"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  "Create User"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/users")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function FormField({
  id,
  label,
  required,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  mono,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={`bg-input/50 border-border/60 ${mono ? "font-mono text-sm" : ""}`}
      />
      {hint && (
        <p className="text-xs text-muted-foreground/70">{hint}</p>
      )}
    </div>
  );
}
