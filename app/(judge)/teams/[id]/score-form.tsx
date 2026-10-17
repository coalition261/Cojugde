"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, CircleAlert, EyeOff, LoaderCircle, Save, Sparkles, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { CRITERIA, computeGap, type Gap } from "@/lib/rubric";
import { cn } from "@/lib/utils";

type Props = {
  submissionId: number;
  initial: { id: number; perCriterion: Record<string, number>; notes: string | null; reason: string | null } | null;
  initialEstimate: Record<string, number> | null;
  hasEvidence: boolean;
};

export function ScoreForm({ submissionId, initial, initialEstimate, hasEvidence }: Props) {
  const [values, setValues] = useState<Record<string, number>>(
    () => initial?.perCriterion ?? Object.fromEntries(CRITERIA.map((c) => [c.key, Math.round(c.weight / 2)])),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [scoreId, setScoreId] = useState<number | null>(initial?.id ?? null);
  const [estimate, setEstimate] = useState<Record<string, number> | null>(initialEstimate);
  const [gap, setGap] = useState<Gap | null>(initial && initialEstimate ? computeGap(initial.perCriterion, initialEstimate) : null);
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [reasonSaved, setReasonSaved] = useState(!!initial?.reason);
  const [busy, setBusy] = useState<"score" | "reason" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(!!initial);

  const total = useMemo(() => Object.values(values).reduce((a, b) => a + b, 0), [values]);

  async function save() {
    setBusy("score");
    setError(null);
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId, perCriterion: values, notes: notes || undefined }),
      });
      const data = (await res.json()) as { error?: string; scoreId?: number; estimate?: Record<string, number> | null; gap?: Gap | null };
      if (!res.ok) throw new Error(data.error ?? "Could not save score");
      setScoreId(data.scoreId ?? null);
      setEstimate(data.estimate ?? null);
      setGap(data.gap ?? null);
      setSaved(true);
      setReasonSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save score");
    } finally {
      setBusy(null);
    }
  }

  async function saveReason() {
    if (!scoreId) return;
    setBusy("reason");
    setError(null);
    try {
      const res = await fetch(`/api/scores/${scoreId}/reason`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save reason");
      setReasonSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save reason");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="score-h" className="glass-strong rounded-2xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="score-h" className="flex items-center gap-2 font-semibold">
            <UserCheck className="size-4 text-primary-soft" aria-hidden /> Your score
          </h2>
          <p className="tabular font-mono text-2xl font-semibold">
            {total.toFixed(1).replace(/\.0$/, "")}
            <span className="text-sm text-fg-subtle"> / 100</span>
          </p>
        </div>

        <div className="space-y-5">
          {CRITERIA.map((c) => (
            <div key={c.key}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <Label htmlFor={`c-${c.key}`} className="text-sm">{c.label}</Label>
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={c.weight}
                    step={0.5}
                    value={values[c.key] ?? 0}
                    onChange={(e) => setValues((v) => ({ ...v, [c.key]: Math.min(c.weight, Math.max(0, Number(e.target.value) || 0)) }))}
                    aria-label={`${c.label} score`}
                    className="tabular h-9 w-16 rounded-lg border border-glass-border bg-slate-50 px-2 text-right font-mono text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="tabular w-8 font-mono text-xs text-fg-subtle">/{c.weight}</span>
                </span>
              </div>
              <input
                id={`c-${c.key}`}
                type="range"
                min={0}
                max={c.weight}
                step={0.5}
                value={values[c.key] ?? 0}
                onChange={(e) => setValues((v) => ({ ...v, [c.key]: Number(e.target.value) }))}
                className="h-2 w-full cursor-pointer accent-[var(--primary)]"
              />
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Label htmlFor="notes">Notes (private to judges)</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What stood out in the demo?" className="mt-2 min-h-20" />
        </div>

        {error && (
          <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-danger-ink">
            <CircleAlert className="size-4" aria-hidden /> {error}
          </p>
        )}

        <Button className="mt-6 w-full" size="lg" onClick={save} disabled={busy !== null}>
          {busy === "score" ? <LoaderCircle className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          {saved ? "Update score" : "Save score & reveal AI estimate"}
        </Button>
        {!saved && (
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-fg-subtle">
            <EyeOff className="size-3.5" aria-hidden /> The AI estimate is hidden by the server until you save.
          </p>
        )}
      </section>

      <AnimatePresence>
        {saved && (
          <motion.section
            aria-labelledby="reveal-h"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="glass rounded-2xl p-6"
          >
            <h2 id="reveal-h" className="mb-4 flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-accent-ink" aria-hidden /> AI estimate revealed
            </h2>
            {!estimate || !gap ? (
              <p className="text-sm text-fg-muted">
                {hasEvidence ? "No estimate is stored for this team." : "No AI evidence has been run for this team yet, so there is nothing to compare."} Your score is saved.
              </p>
            ) : (
              <>
                <div className="mb-5 grid grid-cols-3 gap-3 text-center">
                  <Figure label="You" value={total} icon={UserCheck} />
                  <Figure label="AI estimate" value={gap.aiTotal} icon={Bot} />
                  <Figure label="Gap" value={gap.totalGap} highlight={gap.totalGap >= 15} />
                </div>
                <ul className="space-y-3">
                  {gap.perCriterion.map((c) => {
                    const w = CRITERIA.find((x) => x.key === c.key)!.weight;
                    return (
                      <li key={c.key}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className={cn(c.big ? "font-medium text-warning-ink" : "text-fg-muted")}>
                            {CRITERIA.find((x) => x.key === c.key)!.label}
                            {c.big && " · big gap"}
                          </span>
                          <span className="tabular font-mono text-fg-subtle">
                            you {c.human} · AI {c.ai}
                          </span>
                        </div>
                        <div className="relative h-2 rounded-full bg-slate-100">
                          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(c.human / w) * 100}%` }} />
                          <div className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded bg-accent" style={{ left: `${(c.ai / w) * 100}%` }} aria-hidden />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-xs text-fg-subtle">Bar = your score · cyan tick = AI estimate. The leaderboard uses human scores only.</p>

                {gap.secondLook && (
                  <div className="mt-6 rounded-xl border border-warning/30 bg-warning/[0.07] p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-warning-ink">
                      <CircleAlert className="size-4" aria-hidden /> Second look: explain the gap in one line
                    </p>
                    <p className="mt-1 text-xs text-fg-muted">Keep or change your score. Your reason calibrates the AI for later teams.</p>
                    <Textarea
                      value={reason}
                      onChange={(e) => {
                        setReason(e.target.value);
                        setReasonSaved(false);
                      }}
                      aria-label="Reason for the gap"
                      placeholder="e.g. Live demo showed the approval flow working end to end; the AI missed it."
                      className="mt-3 min-h-20"
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-success-ink" role="status">{reasonSaved ? "Reason saved" : ""}</span>
                      <Button size="sm" onClick={saveReason} disabled={busy !== null || reason.trim().length < 5}>
                        {busy === "reason" && <LoaderCircle className="animate-spin" aria-hidden />} Save reason
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function Figure({ label, value, icon: Icon, highlight }: { label: string; value: number; icon?: typeof Bot; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl bg-slate-50 p-3", highlight && "ring-1 ring-warning/40")}>
      <p className={cn("tabular font-mono text-xl font-semibold", highlight && "text-warning-ink")}>{Math.round(value * 10) / 10}</p>
      <p className="flex items-center justify-center gap-1 text-xs text-fg-subtle">
        {Icon && <Icon className="size-3" aria-hidden />} {label}
      </p>
    </div>
  );
}
