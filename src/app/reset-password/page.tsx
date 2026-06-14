"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2 } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const isInviteFlow = !!inviteToken;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Load company name for welcome message on invite flow
  useEffect(() => {
    if (!isInviteFlow) return;
    const supabase = createClient();
    supabase
      .from("company_settings")
      .select("company_name")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.company_name) setCompanyName(data.company_name);
      });
  }, [isInviteFlow]);

  async function handleReset() {
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setStatus("loading");
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setStatus("idle");
      return;
    }

    // Mark invitation as accepted if this is an invite flow
    if (inviteToken) {
      await fetch("/api/auth/invite", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken }),
      });
    }

    // Audit log
    fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "password_changed",
        module: "authentication",
      }),
    }).catch(() => {});

    setStatus("done");
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  const title = isInviteFlow
    ? companyName
      ? `Welcome to ${companyName}!`
      : "Welcome!"
    : "Set New Password";

  const description = isInviteFlow
    ? "Create a password to activate your account."
    : "Choose a new password for your account.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>
            {status === "done" ? "Password set! Redirecting to your dashboard…" : description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "done" ? (
            <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700 text-center">
              {isInviteFlow
                ? "Account activated successfully! Taking you to the dashboard."
                : "Your password has been updated successfully."}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleReset(); }}
                />
              </div>
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button
                className="w-full"
                disabled={status === "loading"}
                onClick={handleReset}
              >
                {status === "loading"
                  ? "Setting up…"
                  : isInviteFlow
                    ? "Activate Account"
                    : "Update Password"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
