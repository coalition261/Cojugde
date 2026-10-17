import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, RefreshCw } from "lucide-react";
import { getReportByToken } from "@/lib/data";
import { CheckRow } from "@/components/check-row";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatPkt } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pre-flight report", robots: { index: false, follow: false } };

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await getReportByToken(token);
  if (!report) notFound();

  const counts = report.checks.reduce<Record<string, number>>((m, c) => ({ ...m, [c.status]: (m[c.status] ?? 0) + 1 }), {});
  const failing = (counts.fail ?? 0) + (counts.warn ?? 0);

  return (
    <>
      <header className="mb-8">
        <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-accent-ink">Pre-flight report</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{report.team}</h1>
        <p className="mt-2 text-fg-muted">
          Submitted {formatPkt(report.submittedAt)} PKT · this is a private link — don&apos;t share it publicly.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["pass", "Passed", "text-success-ink"],
          ["fail", "Failed", "text-danger-ink"],
          ["warn", "Warnings", "text-warning-ink"],
          ["human_check", "Human checks", "text-info-ink"],
        ].map(([k, label, cls]) => (
          <Card key={k} className="p-4">
            <p className={`tabular font-mono text-2xl font-semibold ${cls}`}>{counts[k!] ?? 0}</p>
            <p className="text-xs text-fg-muted">{label}</p>
          </Card>
        ))}
      </div>

      <div
        role="status"
        className={`mb-6 rounded-2xl border p-4 text-sm ${failing ? "border-warning/30 bg-warning/10 text-warning-ink" : "border-success/30 bg-success/10 text-success-ink"}`}
      >
        {failing
          ? `${counts.fail ?? 0} failing and ${counts.warn ?? 0} warning check(s). Fix them and resubmit — you've also been emailed the details.`
          : "All automated checks passed. Human checks are ticked off by judges."}
      </div>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-glass-border">
          {report.checks.map((c) => (
            <CheckRow key={c.id} kind={c.kind} status={c.status} evidence={c.evidence} fixTip={c.fixTip} />
          ))}
        </ul>
      </Card>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/submit" className={buttonVariants({ size: "lg" })}>
          <RefreshCw aria-hidden /> Fix and resubmit
        </Link>
        <a href={report.links.deploy} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary", size: "lg" })}>
          Open deployment <ExternalLink aria-hidden />
        </a>
      </div>
    </>
  );
}
