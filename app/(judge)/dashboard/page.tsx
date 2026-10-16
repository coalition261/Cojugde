import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronRight, Flag, Inbox, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getTeamsOverview } from "@/lib/data";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { FlagActions } from "@/components/judge-actions";
import { formatPkt } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Teams" };

async function openFlags() {
  return db()
    .select({ flag: schema.flags, team: schema.teams.name, teamId: schema.teams.id })
    .from(schema.flags)
    .innerJoin(schema.submissions, eq(schema.submissions.id, schema.flags.submissionId))
    .innerJoin(schema.teams, eq(schema.teams.id, schema.submissions.teamId))
    .where(eq(schema.flags.status, "open"));
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [teams, flags] = await Promise.all([getTeamsOverview(session.judgeId), openFlags()]);
  const scored = teams.filter((t) => t.scoredByMe).length;

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="mt-1 text-fg-muted">Read the facts and evidence, then score. AI estimates appear only after you save.</p>
        </div>
        <div className="flex gap-3">
          <Stat icon={Users} label="Scored by you" value={`${scored}/${teams.length}`} />
          <Stat icon={Flag} label="Open flags" value={String(flags.length)} tone={flags.length ? "text-warning" : undefined} />
        </div>
      </header>

      {session.role === "organizer" && flags.length > 0 && (
        <Card className="mb-8 overflow-hidden">
          <div className="flex items-center justify-between border-b border-glass-border px-6 py-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Flag className="size-4 text-warning" aria-hidden /> Flags awaiting your decision
            </h2>
            <span className="text-xs text-fg-subtle">Also posted to #organizers on Discord</span>
          </div>
          <ul className="divide-y divide-glass-border">
            {flags.map(({ flag, team, teamId }) => (
              <li key={flag.id} className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">
                    <Link href={`/teams/${teamId}`} className="hover:underline">{team}</Link>
                    <span className="ml-2 rounded-md bg-white/5 px-2 py-0.5 font-mono text-xs text-fg-muted">{flag.kind}</span>
                  </p>
                  <p className="mt-1 break-words text-sm text-fg-muted">{flag.detail}</p>
                  <p className="mt-1 text-xs text-fg-subtle">Opened {formatPkt(flag.createdAt)}</p>
                </div>
                <FlagActions flagId={flag.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {teams.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <Inbox className="size-10 text-fg-subtle" aria-hidden />
          <h2 className="mt-4 font-semibold">No submissions yet</h2>
          <p className="mt-1 max-w-sm text-sm text-fg-muted">Teams appear here as soon as they submit at <code className="font-mono">/submit</code>.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[1.6fr_1fr_1.4fr_0.8fr_0.9fr_24px] gap-4 border-b border-glass-border px-6 py-3 text-xs font-medium uppercase tracking-wider text-fg-subtle md:grid">
            <span>Team</span>
            <span>Completeness</span>
            <span>Checks</span>
            <span>Flags</span>
            <span>Your score</span>
            <span />
          </div>
          <ul className="divide-y divide-glass-border">
            {teams.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/teams/${t.id}`}
                  className="grid cursor-pointer gap-3 px-6 py-4 transition-colors duration-200 hover:bg-white/[0.03] md:grid-cols-[1.6fr_1fr_1.4fr_0.8fr_0.9fr_24px] md:items-center md:gap-4"
                >
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-fg-subtle">{t.submittedAt ? `Submitted ${formatPkt(t.submittedAt)}` : "Not submitted"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={t.completeness} aria-valuemin={0} aria-valuemax={100} aria-label="Completeness">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${t.completeness}%` }} />
                    </div>
                    <span className="tabular w-10 font-mono text-xs text-fg-muted">{t.completeness}%</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Pill n={t.counts.pass} label="pass" cls="text-success bg-success/10" />
                    <Pill n={t.counts.fail} label="fail" cls="text-danger bg-danger/10" />
                    <Pill n={t.counts.warn} label="warn" cls="text-warning bg-warning/10" />
                    <Pill n={t.counts.human_check} label="human" cls="text-info bg-info/10" />
                  </div>
                  <div className="text-sm">
                    {t.openFlags > 0 ? <span className="text-warning">{t.openFlags} open</span> : t.confirmedFlags > 0 ? <span className="text-danger">{t.confirmedFlags} confirmed</span> : <span className="text-fg-subtle">None</span>}
                  </div>
                  <div className="text-sm">
                    {t.scoredByMe ? <span className="text-success">Scored</span> : <span className="text-fg-muted">To score</span>}
                    <span className="block text-xs text-fg-subtle">{t.scoreCount} judge{t.scoreCount === 1 ? "" : "s"}</span>
                  </div>
                  <ChevronRight className="hidden size-4 text-fg-subtle md:block" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string; tone?: string }) {
  return (
    <Card className="flex items-center gap-3 px-4 py-3">
      <Icon className="size-4 text-fg-subtle" aria-hidden />
      <div>
        <p className={`tabular font-mono text-lg font-semibold leading-tight ${tone ?? ""}`}>{value}</p>
        <p className="text-xs text-fg-subtle">{label}</p>
      </div>
    </Card>
  );
}

function Pill({ n, label, cls }: { n: number; label: string; cls: string }) {
  if (!n) return null;
  return <span className={`tabular rounded-md px-2 py-0.5 font-mono ${cls}`}>{n} {label}</span>;
}
