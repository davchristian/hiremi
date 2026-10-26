"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/hig/button";
import { Field, TextField } from "@/components/hig/fields";
import { Notice } from "@/components/hig/layout";
import { ActivityIndicator } from "@/components/hig/status";

function BackToSignIn() {
  return (
    <p className="text-center text-callout text-text-muted">
      <Link href="/sign-in" className="font-medium text-tint hover:underline">
        Back to sign in
      </Link>
    </p>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setStatus("idle");
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-title text-text">Check your email</h1>
        <p className="text-callout text-text-muted">
          If {email} has an account, we sent it a link to choose a new password.
        </p>
        <BackToSignIn />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-title text-text">Reset your password</h1>
        <p className="text-callout text-text-muted">We&apos;ll email you a link to choose a new one.</p>
      </div>

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

      {error && (
        <Notice tone="error" title="Couldn't send the link">
          {error}
        </Notice>
      )}

      <Button variant="accent" size="lg" type="submit" disabled={status === "loading"} icon={status === "loading" ? <ActivityIndicator size={15} /> : undefined}>
        {status === "loading" ? "Sending" : "Send link"}
      </Button>

      <BackToSignIn />
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<"checking" | "ready" | "missing">("checking");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The browser client exchanges the ?code= from the email link while it initializes.
    createClient()
      .auth.getSession()
      .then(({ data }) => setSession(data.session ? "ready" : "missing"));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    router.push("/feed");
    router.refresh();
  }

  if (session === "checking") {
    return <ActivityIndicator size={20} />;
  }

  if (session === "missing") {
    return (
      <div className="flex w-full flex-col gap-5">
        <Notice tone="error" title="This link has expired">
          Reset links work once and expire after an hour.{" "}
          <Link href="/forgot-password" className="font-medium text-tint hover:underline">
            Send a new one
          </Link>
          .
        </Notice>
        <BackToSignIn />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-title text-text">Choose a new password</h1>
      </div>

      <Field label="New password" htmlFor="password" helper="At least 6 characters.">
        <TextField
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      {error && (
        <Notice tone="error" title="Couldn't update your password">
          {error}
        </Notice>
      )}

      <Button variant="accent" size="lg" type="submit" disabled={status === "loading"} icon={status === "loading" ? <ActivityIndicator size={15} /> : undefined}>
        {status === "loading" ? "Saving" : "Save password"}
      </Button>
    </form>
  );
}
