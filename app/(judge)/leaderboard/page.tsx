import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Star, Trophy } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getLeaderboard } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { ShortlistToggle } from "@/components/judge-actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const rows = await getLeaderboard();
  const shortlisted = rows.filter((r) => r.shortlisted).length;

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Trophy className="size-7 text-warning-ink" aria-hidden /> Leaderboard
          </h1>
          <p className="mt-1 text-fg-muted">Average of human scores only. AI estimates never rank teams.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="glass rounded-xl px-4 py-2 text-sm">
            <Star className="mr-1.5 inline size-4 text-warning-ink" aria-hidden />
            <span className="tabular font-mono">{shortlisted}/10</span> shortlisted
          </span>
          <a href="/api/leaderboard?format=csv" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Download aria-hidden /> CSV
          </a>
        </div>
      </header>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-glass-border text-left text-xs uppercase tracking-wider text-fg-subtle">
                <th scope="col" className="px-6 py-3 font-medium">#</th>
                <th scope="col" className="px-3 py-3 font-medium">Team</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Average</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Judges</th>
                <th scope="col" className="px-3 py-3 font-medium">Flags</th>
                <th scope="col" className="px-6 py-3 text-right font-medium">Shortlist</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {rows.map((r, i) => (
                <tr key={r.teamId} className={cn("transition-colors hover:bg-slate-50", r.shortlisted && "bg-success/[0.04]")}>
                  <td className="tabular px-6 py-4 font-mono text-fg-subtle">{r.average === null ? "—" : i + 1}</td>
                  <td className="px-3 py-4 font-medium">
                    <Link href={`/teams/${r.teamId}`} className="hover:underline">{r.name}</Link>
                  </td>
                  <td className="tabular px-3 py-4 text-right font-mono text-base">{r.average ?? <span className="text-fg-subtle">unscored</span>}</td>
                  <td className="tabular px-3 py-4 text-right font-mono text-fg-muted">{r.judges}</td>
                  <td className="px-3 py-4 text-xs">
                    {r.confirmedFlags > 0 && <span className="mr-2 text-danger-ink">{r.confirmedFlags} confirmed</span>}
                    {r.openFlags > 0 && <span className="text-warning-ink">{r.openFlags} open</span>}
                    {!r.confirmedFlags && !r.openFlags && <span className="text-fg-subtle">—</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {session.role === "organizer" ? (
                      <ShortlistToggle teamId={r.teamId} shortlisted={r.shortlisted} disabled={!r.shortlisted && shortlisted >= 10} />
                    ) : r.shortlisted ? (
                      <span className="text-success-ink">Shortlisted</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
