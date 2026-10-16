"use client";

import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { next: _next, ...data } = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Sign in failed");
        return;
      }
      window.location.assign(next);
    } catch {
      setError("Network error — please retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} method="post" action="/api/auth/login" className="mt-6 space-y-5">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" required minLength={2} autoComplete="name" placeholder="Your full name" className="mt-2" />
      </div>
      <div>
        <Label htmlFor="passcode">Passcode</Label>
        <div className="relative mt-2">
          <Input id="passcode" name="passcode" type={show ? "text" : "password"} required autoComplete="current-password" className="pr-12" aria-invalid={!!error} aria-describedby="passcode-help login-error" />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide passcode" : "Show passcode"}
            className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-fg-muted hover:text-fg"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p id="passcode-help" className="mt-2 text-sm text-fg-subtle">The shared judge or organizer passcode from the event organizers — not your email or Google password.</p>
        <p id="login-error" role="alert" className="mt-2 min-h-5 text-sm text-danger">
          {error}
        </p>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
