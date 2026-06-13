"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [error, setError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [forgotError, setForgotError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginForm) {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleForgotPassword() {
    if (!forgotEmail) {
      setForgotError("Please enter your email address.");
      return;
    }
    setForgotStatus("sending");
    setForgotError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setForgotError(error.message);
      setForgotStatus("idle");
      return;
    }
    setForgotStatus("sent");
  }

  if (showForgot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <Building2 className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>
              {forgotStatus === "sent"
                ? "Check your email for the reset link."
                : "Enter your email to receive a password reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {forgotStatus === "sent" ? (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700 text-center">
                Reset email sent to <strong>{forgotEmail}</strong>.<br />
                Check your inbox and follow the link.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@company.com"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleForgotPassword(); }}
                  />
                </div>
                {forgotError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {forgotError}
                  </div>
                )}
                <Button
                  className="w-full"
                  disabled={forgotStatus === "sending"}
                  onClick={handleForgotPassword}
                >
                  {forgotStatus === "sending" ? "Sending…" : "Send Reset Link"}
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => { setShowForgot(false); setForgotStatus("idle"); setForgotEmail(""); setForgotError(null); }}
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">CompanyOS</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            {(urlError || error) && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {urlError ?? error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
