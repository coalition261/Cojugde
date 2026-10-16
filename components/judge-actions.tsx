"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, LoaderCircle, ShieldCheck, ShieldX, Star, X } from "lucide-react";
import { Button } from "./ui/button";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      start(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** Organizer Confirm / Dismiss (mirrors the Discord buttons). */
export function FlagActions({ flagId }: { flagId: number }) {
  const { busy, error, run } = useAction();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {confirming ? (
          <>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => run(() => post(`/api/flags/${flagId}`, { decision: "confirmed" }))}>
              {busy ? <LoaderCircle className="animate-spin" /> : <ShieldX />} Yes, confirm
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirming(true)}>
              <ShieldX /> Confirm
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => post(`/api/flags/${flagId}`, { decision: "dismissed" }))}>
              {busy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Dismiss
            </Button>
          </>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function RunEvidenceButton({ teamId, hasEvidence }: { teamId: number; hasEvidence: boolean }) {
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => post(`/api/teams/${teamId}/evidence`, {}))}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Bot />}
        {busy ? "Drafting evidence…" : hasEvidence ? "Re-run AI evidence" : "Run AI evidence"}
      </Button>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function VerifyToggle({ checkId, verified, by }: { checkId: number; verified: boolean; by?: string | null }) {
  const { busy, error, run } = useAction();
  return (
    <span className="flex items-center gap-2">
      {verified && by && <span className="text-xs text-fg-subtle">by {by}</span>}
      <Button
        size="sm"
        variant={verified ? "success" : "secondary"}
        disabled={busy}
        aria-pressed={verified}
        onClick={() => run(() => post(`/api/checks/${checkId}/verify`, { verified: !verified }))}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : verified ? <Check /> : null}
        {verified ? "Verified" : "Tick off"}
      </Button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}

export function ShortlistToggle({ teamId, shortlisted, disabled }: { teamId: number; shortlisted: boolean; disabled?: boolean }) {
  const { busy, error, run } = useAction();
  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={shortlisted ? "success" : "secondary"}
        disabled={busy || disabled}
        aria-pressed={shortlisted}
        onClick={() => run(() => post(`/api/teams/${teamId}/shortlist`, { shortlisted: !shortlisted }))}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : shortlisted ? <Star className="fill-current" /> : <Star />}
        {shortlisted ? "Shortlisted" : "Shortlist"}
        {shortlisted && <X className="opacity-60" aria-label="remove" />}
      </Button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
