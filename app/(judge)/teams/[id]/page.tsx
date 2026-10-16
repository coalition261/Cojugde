import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Bot, ExternalLink, FileCode, Flag, MessageCircleQuestionMark, TriangleAlert } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getTeamDetail } from "@/lib/data";
import { CRITERIA } from "@/lib/rubric";
import { Card } from "@/components/ui/card";
import { CheckRow } from "@/components/check-row";
import { FlagBadge } from "@/components/status";
import { FlagActions, RunEvidenceButton, VerifyToggle } from "@/components/judge-actions";
import { ScoreForm } from "./score-form";
import { formatPkt } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const t = await getTeamDetail(id, session.judgeId);
  if (!t) notFound();

  const sub = t.submission;
  const repoBase = sub?.repoUrl.replace(/\/$/, "");

  return (
    <>
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 rounded-lg text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> All teams
      </Link>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.team.name}</h1>
          <p className="mt-1 text-sm text-fg-muted">{sub ? `Submitted ${formatPkt(sub.submittedAt)} PKT` : "No submission yet"}</p>
        </div>
        {sub && (
          <div className="flex flex-wrap gap-2">
            {[
              ["Deployment", sub.deployUrl],
              ["Repository", sub.repoUrl],
              ["Video", sub.videoUrl],
            ].map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="glass inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm hover:bg-glass-strong">
                {label} <ExternalLink className="size-3.5 text-fg-subtle" aria-hidden />
              </a>
            ))}
          </div>
        )}
      </header>

      {!sub ? (
        <Card className="p-8 text-center text-fg-muted">This team hasn&apos;t submitted yet.</Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-6">
            {t.flags.length > 0 && (
              <Card className="overflow-hidden">
                <h2 className="flex items-center gap-2 border-b border-glass-border px-6 py-4 font-semibold">
                  <Flag className="size-4 text-warning" aria-hidden /> Flags
                </h2>
                <ul className="divide-y divide-glass-border">
                  {t.flags.map((f) => (
                    <li key={f.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FlagBadge status={f.status} />
                          <span className="font-mono text-xs text-fg-muted">{f.kind}</span>
                        </div>
                        <p className="mt-2 break-words text-sm">{f.detail}</p>
                        {f.decidedBy && <p className="mt-1 text-xs text-fg-subtle">Decided by {f.decidedBy} · {formatPkt(f.decidedAt)}</p>}
                      </div>
                      {f.status === "open" && session.role === "organizer" && <FlagActions flagId={f.id} />}
                    </li>
                  ))}
                </ul>
                <p className="border-t border-glass-border px-6 py-3 text-xs text-fg-subtle">Only confirmed flags count against a team.</p>
              </Card>
            )}

            <Card className="overflow-hidden">
              <h2 className="border-b border-glass-border px-6 py-4 font-semibold">Verification facts</h2>
              <ul className="divide-y divide-glass-border">
                {t.checks.map((c) => (
                  <CheckRow key={c.id} kind={c.kind} status={c.status} evidence={c.evidence} fixTip={c.fixTip}>
                    {c.status === "human_check" && <VerifyToggle checkId={c.id} verified={!!c.verifiedAt} by={c.verifiedBy} />}
                  </CheckRow>
                ))}
              </ul>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-glass-border px-6 py-4">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Bot className="size-4 text-accent" aria-hidden /> AI evidence
                </h2>
                {session.role === "organizer" && <RunEvidenceButton teamId={t.team.id} hasEvidence={!!t.evidence} />}
              </div>
              {!t.evidence ? (
                <p className="px-6 py-8 text-sm text-fg-muted">
                  No evidence yet. An organizer runs the agent after the deadline. Score from the facts and the demo meanwhile.
                </p>
              ) : (
                <div className="space-y-6 px-6 py-5">
                  <p className="text-xs text-fg-subtle">
                    Drafted by {t.evidence.model} · {formatPkt(t.evidence.createdAt)}. Claims are evidence, not scores. Citations not found in the repo were removed.
                  </p>
                  {t.evidence.redFlags.length > 0 && (
                    <div className="rounded-xl border border-danger/30 bg-danger/[0.07] p-4 text-sm">
                      <p className="flex items-center gap-2 font-medium text-danger">
                        <TriangleAlert className="size-4" aria-hidden /> Text addressed to AI or judges
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
                        {t.evidence.redFlags.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                  {CRITERIA.map((c) => {
                    const ce = t.evidence!.criteria.find((x) => x.key === c.key);
                    return (
                      <section key={c.key} aria-labelledby={`ev-${c.key}`}>
                        <h3 id={`ev-${c.key}`} className="mb-2 flex items-baseline justify-between text-sm font-semibold">
                          {c.label} <span className="tabular font-mono text-xs font-normal text-fg-subtle">weight {c.weight}</span>
                        </h3>
                        <ul className="space-y-1.5">
                          {(ce?.evidence ?? []).map((e, i) => (
                            <li key={i} className="flex gap-2 text-sm text-fg-muted">
                              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                              <span>
                                {e.claim}
                                {e.file && (
                                  <a
                                    href={`${repoBase}/blob/HEAD/${e.file}${e.line ? `#L${e.line}` : ""}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-accent hover:underline"
                                  >
                                    <FileCode className="size-3" aria-hidden />
                                    {e.file}
                                    {e.line ? `:${e.line}` : ""}
                                  </a>
                                )}
                              </span>
                            </li>
                          ))}
                          {!ce?.evidence.length && <li className="text-sm text-fg-subtle">No cited evidence.</li>}
                        </ul>
                        {!!ce?.risks.length && (
                          <p className="mt-2 text-xs text-warning">Risks: {ce.risks.join(" · ")}</p>
                        )}
                      </section>
                    );
                  })}
                  <section className="rounded-xl bg-white/[0.03] p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <MessageCircleQuestionMark className="size-4 text-accent" aria-hidden /> Ask during the demo
                    </h3>
                    <ol className="list-decimal space-y-1.5 pl-5 text-sm text-fg-muted">
                      {t.evidence.questions.map((q, i) => <li key={i}>{q}</li>)}
                    </ol>
                  </section>
                </div>
              )}
            </Card>
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            <ScoreForm
              submissionId={sub.id}
              hasEvidence={!!t.evidence}
              initial={t.myScore ? { id: t.myScore.id, perCriterion: t.myScore.perCriterion, notes: t.myScore.notes, reason: t.myScore.reason } : null}
              initialEstimate={t.estimate}
            />
          </div>
        </div>
      )}
    </>
  );
}
