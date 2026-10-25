"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/redirect";
import { Button } from "@/components/hig/button";
import { Field, TextField } from "@/components/hig/fields";
import { Notice } from "@/components/hig/layout";
import { ActivityIndicator } from "@/components/hig/status";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    const supabase = createClient();

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setStatus("idle");
        return;
      }
      router.push(safeRedirectPath(searchParams.get("redirect")));
      router.refresh();
    } else {
      const { error, data } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setStatus("idle");
        return;
      }
      if (data.session) {
        router.push("/feed");
        router.refresh();
      } else {
        setConfirmSent(true);
        setStatus("idle");
      }
    }
  }

  if (confirmSent) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-title text-text">Check your email</h1>
        <p className="text-callout text-text-muted">
          We sent a confirmation link to {email}. Open it to finish creating your account.
        </p>
      </div>
    );
  }

  const signingIn = mode === "sign-in";

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5" noValidate={false}>
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-title text-text">{signingIn ? "Sign in to Hiremi" : "Create your account"}</h1>
        <p className="text-callout text-text-muted">
          {signingIn ? "Find internships you can take, and track every application." : "It takes a few seconds."}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Field label="Email" htmlFor="email">
          <TextField
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          helper={
            signingIn ? (
              <Link href="/forgot-password" className="text-tint hover:underline">
                Forgot password?
              </Link>
            ) : (
              "At least 6 characters."
            )
          }
        >
          <TextField
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={signingIn ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
      </div>

      {error && (
        <Notice tone="error" title={signingIn ? "Couldn't sign in" : "Couldn't create your account"}>
          {error}
        </Notice>
      )}

      <Button variant="accent" size="lg" type="submit" disabled={status === "loading"} icon={status === "loading" ? <ActivityIndicator size={15} /> : undefined}>
        {status === "loading" ? (signingIn ? "Signing in" : "Creating account") : signingIn ? "Sign in" : "Create account"}
      </Button>

      <p className="text-center text-callout text-text-muted">
        {signingIn ? "New here? " : "Already have an account? "}
        <Link href={signingIn ? "/sign-up" : "/sign-in"} className="font-medium text-tint hover:underline">
          {signingIn ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </form>
  );
}
