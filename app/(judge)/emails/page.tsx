import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { CircleCheck, CircleX, Clock, Mail, PauseCircle } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { smtpConfigured } from "@/lib/mailer";
import { Card } from "@/components/ui/card";
import { formatPkt } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sent emails" };

const TYPE_LABEL: Record<string, string> = {
  submission_received: "Submission received",
  check_failed: "Check failed",
  deploy_down: "Deployment down",
  deploy_recovered: "Deployment back up",
  deadline_reminder: "Deadline reminder",
};

function statusView(status: string) {
  if (status === "sent") return { label: "Sent", icon: CircleCheck, cls: "text-success bg-success/10 ring-success/25" };
  if (status === "queued") return { label: "Queued in n8n", icon: Clock, cls: "text-info bg-info/10 ring-info/25" };
  if (status.startsWith("suppressed")) {
    const why = status.split(":")[1] === "cooldown" ? "30-min cooldown" : status.split(":")[1] === "daily cap" ? "daily limit (10)" : "held back";
    return { label: `Held back · ${why}`, icon: PauseCircle, cls: "text-warning bg-warning/10 ring-warning/25" };
  }
  return { label: "Failed", icon: CircleX, cls: "text-danger bg-danger/10 ring-danger/25" };
}

export default async function EmailsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "organizer") {
    return <Card className="p-8 text-center text-fg-muted">Only organizers can see the email log.</Card>;
  }

  const rows = await db()
    .select({ n: schema.notifications, team: schema.teams.name })
    .from(schema.notifications)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.notifications.teamId))
    .orderBy(desc(schema.notifications.sentAt))
    .limit(300);

  const sent = rows.filter((r) => r.n.status === "sent").length;
  const failed = rows.filter((r) => !["sent", "queued"].includes(r.n.status) && !r.n.status.startsWith("suppressed")).length;
  const held = rows.filter((r) => r.n.status.startsWith("suppressed")).length;

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Mail className="size-7 text-accent" aria-hidden /> Sent emails
          </h1>
          <p className="mt-1 text-fg-muted">
            Every automatic email to teams, newest first. Sending via {smtpConfigured() ? "Gmail (direct), with n8n as fallback" : "n8n only — SMTP is not configured"}.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          {[
            ["Sent", sent, "text-success"],
            ["Failed", failed, "text-danger"],
            ["Held back", held, "text-warning"],
          ].map(([label, n, cls]) => (
            <Card key={label as string} className="px-4 py-3">
              <p className={`tabular font-mono text-lg font-semibold leading-tight ${cls}`}>{n}</p>
              <p className="text-xs text-fg-subtle">{label}</p>
            </Card>
          ))}
        </div>
      </header>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <Mail className="size-10 text-fg-subtle" aria-hidden />
          <h2 className="mt-4 font-semibold">No emails yet</h2>
          <p className="mt-1 max-w-sm text-sm text-fg-muted">Teams get a confirmation when they submit, and an alert when a check fails or their deployment goes down.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-glass-border text-left text-xs uppercase tracking-wider text-fg-subtle">
                  <th scope="col" className="px-6 py-3 font-medium">When (PKT)</th>
                  <th scope="col" className="px-3 py-3 font-medium">Team</th>
                  <th scope="col" className="px-3 py-3 font-medium">Type</th>
                  <th scope="col" className="px-3 py-3 font-medium">Subject</th>
                  <th scope="col" className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {rows.map(({ n, team }) => {
                  const s = statusView(n.status);
                  return (
                    <tr key={n.id} className="align-top transition-colors hover:bg-white/[0.02]">
                      <td className="tabular whitespace-nowrap px-6 py-3 font-mono text-xs text-fg-muted">{formatPkt(n.sentAt)}</td>
                      <td className="px-3 py-3 font-medium">{team}</td>
                      <td className="px-3 py-3 text-fg-muted">{TYPE_LABEL[n.type] ?? n.type}</td>
                      <td className="px-3 py-3 text-fg-muted">{n.subject}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${s.cls}`} title={n.status}>
                          <s.icon className="size-3.5" aria-hidden /> {s.label}
                        </span>
                        <span className="ml-2 font-mono text-xs text-fg-subtle">{n.channel}</span>
                        {s.label === "Failed" && <p className="mt-1 max-w-xs break-words text-xs text-danger/80">{n.status.replace(/^failed:\s*/, "")}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
