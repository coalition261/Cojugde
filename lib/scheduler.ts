import { runDeadlineReminder, runUptimeSweep } from "./jobs";

/**
 * Built-in replacement for the n8n schedules (WF2 uptime watch, WF5 deadline reminder),
 * so alerts work with no n8n credentials. Runs inside the long-lived Next.js server.
 *
 * - Uptime sweep every UPTIME_SWEEP_MINUTES (default 10) until EVENT_ENDS_AT.
 * - Deadline reminder once at DEADLINE_REMINDER_AT (default 11:45 AM PKT, 17 Oct 2026),
 *   within a 60-minute window so a restart shortly after still sends it. The job itself
 *   never emails a team twice.
 *
 * Enabled in production; set SCHEDULER_ENABLED=false to turn it off (e.g. if n8n drives
 * these jobs instead), or SCHEDULER_ENABLED=true to run it in development.
 */
const g = globalThis as unknown as { __cojudgeScheduler?: boolean };

export function schedulerEnabled(): boolean {
  if (process.env.SCHEDULER_ENABLED === "false") return false;
  return process.env.NODE_ENV === "production" || process.env.SCHEDULER_ENABLED === "true";
}

export function reminderDue(now: Date, at: Date, windowMinutes = 60): boolean {
  return now.getTime() >= at.getTime() && now.getTime() < at.getTime() + windowMinutes * 60_000;
}

export function startScheduler() {
  if (g.__cojudgeScheduler || !schedulerEnabled() || !process.env.DATABASE_URL) return;
  g.__cojudgeScheduler = true;

  const sweepMs = Math.max(1, Number(process.env.UPTIME_SWEEP_MINUTES ?? 10)) * 60_000;
  const reminderAt = new Date(process.env.DEADLINE_REMINDER_AT ?? "2026-10-17T06:45:00Z");
  let sweeping = false;
  let reminded = false;

  const sweep = async () => {
    if (sweeping) return; // never overlap
    sweeping = true;
    try {
      const r = await runUptimeSweep();
      if (r.stopped) console.log(`[scheduler] uptime sweep skipped: ${r.reason}`);
      else console.log(`[scheduler] uptime sweep: checked ${r.checked}, changes ${r.changes.length}`);
    } catch (err) {
      console.warn("[scheduler] uptime sweep failed:", err instanceof Error ? err.message : err);
    } finally {
      sweeping = false;
    }
  };

  const reminder = async () => {
    if (reminded || !reminderDue(new Date(), reminderAt)) return;
    reminded = true;
    try {
      const r = await runDeadlineReminder();
      console.log(`[scheduler] deadline reminder: ${r.teams} team(s) with open issues, ${r.sent} emailed`);
    } catch (err) {
      reminded = false; // try again on the next tick
      console.warn("[scheduler] deadline reminder failed:", err instanceof Error ? err.message : err);
    }
  };

  setTimeout(sweep, 60_000).unref?.();
  setInterval(sweep, sweepMs).unref?.();
  setInterval(reminder, 60_000).unref?.();
  console.log(
    `[scheduler] started: uptime sweep every ${sweepMs / 60_000} min, deadline reminder at ${reminderAt.toISOString()}`,
  );
}
