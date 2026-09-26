"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        router.push("/board");
        router.refresh();
      } else {
        setConfirmSent(true);
        setStatus("idle");
      }
    }
  }

  if (confirmSent) {
    return (
      <div className="font-mono text-sm">
        <p className="text-text">
          <span className="text-offer">✓</span> check {email} to confirm your account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="font-mono text-sm text-text-muted">
        <span className="text-applied">$</span> {mode === "sign-in" ? "sign in" : "sign up"}
      </h1>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" className="font-mono text-xs font-normal text-text-muted">
          email
        </Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-panel-alt font-mono text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password" className="font-mono text-xs font-normal text-text-muted">
          password
        </Label>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-panel-alt font-mono text-sm"
        />
      </div>

      {error && (
        <p className="rounded border border-rejected/40 bg-rejected/10 px-3 py-2 font-mono text-xs text-rejected">
          {error}
        </p>
      )}

      <Button type="submit" disabled={status === "loading"} className="mt-1 font-mono text-sm">
        {status === "loading" ? "working..." : mode === "sign-in" ? "sign in" : "create account"}
      </Button>

      <p className="text-center font-mono text-xs text-text-muted">
        {mode === "sign-in" ? (
          <>
            no account?{" "}
            <Link href="/sign-up" className="text-applied hover:underline">
              sign up
            </Link>
          </>
        ) : (
          <>
            have an account?{" "}
            <Link href="/sign-in" className="text-applied hover:underline">
              sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
