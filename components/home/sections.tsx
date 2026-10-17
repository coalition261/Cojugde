"use client";

import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BellRing,
  Bot,
  CircleCheck,
  Clock,
  FileSearch,
  Flag,
  GitBranch,
  FolderGit,
  Globe,
  KeyRound,
  ListChecks,
  MessageSquareWarning,
  CirclePlay,
  Scale,
  ScanEye,
  Send,
  ShieldAlert,
  UserCheck,
  Workflow,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { TiltCard } from "./tilt-card";
import { cn } from "@/lib/utils";

const reveal = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] as const } }),
};

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <motion.div variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-accent-ink">{eyebrow}</p>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-4 text-lg text-fg-muted">{sub}</p>
    </motion.div>
  );
}

/* ---------- How it works ---------- */
const STEPS = [
  { icon: Send, title: "Submit", body: "Teams submit repo, deployment and video links. Resubmit as often as needed (5 runs/hour)." },
  { icon: ListChecks, title: "Pre-flight", body: "Deterministic checks run in parallel and a private report loads in seconds." },
  { icon: BellRing, title: "Alert", body: "Anything broken triggers an email with the evidence and a fix tip — within 2 minutes." },
  { icon: Bot, title: "Evidence", body: "An AI agent drafts rubric evidence with file citations and 3 questions to ask in the live demo." },
  { icon: Scale, title: "Blind scoring", body: "Judges score first. Only then is the AI estimate revealed — big gaps get a second look." },
  { icon: UserCheck, title: "Shortlist", body: "Organizers decide flags and mark the top 10 from human scores only." },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative scroll-mt-24 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="How it works" title="From submission to shortlist, without the busywork" sub="CoJudge takes the mechanical checks off judges' plates so the 2.5-hour review window goes to actual judgment." />
        <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.li key={s.title} custom={i} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}>
              <TiltCard className="h-full p-6">
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary-soft ring-1 ring-primary/30">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span className="tabular font-mono text-sm text-fg-subtle">0{i + 1}</span>
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.body}</p>
              </TiltCard>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Check rules (animated) — the real rules from lib/checks, no sample results ---------- */
const FEED = [
  { icon: Globe, label: "Deployment live", detail: "GET in 10 s, redirects off · 2xx/3xx passes · 502 → port tip", outcome: "fail" },
  { icon: FolderGit, label: "Repository accessible", detail: "GitHub API · private or missing → fail", outcome: "fail" },
  { icon: GitBranch, label: "Code freeze", detail: "Any commit after FREEZE_AT → organizer decides", outcome: "flag" },
  { icon: KeyRound, label: "Leaked secrets", detail: ".env, *.pem, credentials*.json · Groq/OpenAI/Google/GitHub/AWS keys", outcome: "flag" },
  { icon: CirclePlay, label: "Demo video", detail: "YouTube duration 120–180 s · private → fail", outcome: "warn" },
  { icon: Workflow, label: "Workflow JSON", detail: "Counts AI Agent, approval and MCP nodes as evidence", outcome: "warn" },
  { icon: ScanEye, label: "LinkedIn post", detail: "Never fetched — a judge ticks it off", outcome: "human_check" },
] as const;

const TONE = {
  fail: "text-danger-ink bg-danger/12 ring-danger/25",
  flag: "text-warning-ink bg-warning/12 ring-warning/25",
  warn: "text-warning-ink bg-warning/12 ring-warning/25",
  human_check: "text-info-ink bg-info/12 ring-info/25",
} as const;
const TONE_LABEL = { fail: "Fail", flag: "Flag", warn: "Warning", human_check: "Human check" } as const;
export function ChecksShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setShown(FEED.length);
      return;
    }
    const t = setInterval(() => setShown((n) => (n >= FEED.length ? n : n + 1)), 420);
    return () => clearInterval(t);
  }, [inView, reduce]);

  return (
    <section id="checks" className="relative scroll-mt-24 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <motion.div variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-accent-ink">Verification engine</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Every check ends in a clear result — never a silent failure</h2>
          <p className="mt-4 text-lg text-fg-muted">
            Each check returns <em className="not-italic text-fg">pass</em>, <em className="not-italic text-fg">fail</em>,{" "}
            <em className="not-italic text-fg">warn</em> or <em className="not-italic text-fg">human check</em>, with evidence and a fix tip.
            What AI can&apos;t verify, it says so.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-fg-muted">
            {[
              [ShieldAlert, "SSRF-safe fetching: allowlisted hosts, no redirects, 10 s timeout, 1 MB cap"],
              [KeyRound, "Secrets are masked before storage — full keys never reach the LLM, Discord or email"],
              [MessageSquareWarning, "Prompt-injection scan catches text aimed at AI tools or judges"],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof ShieldAlert;
              return (
                <li key={i} className="flex gap-3">
                  <I className="mt-0.5 size-4 shrink-0 text-primary-soft" aria-hidden />
                  <span>{text as string}</span>
                </li>
              );
            })}
          </ul>
        </motion.div>

        <div ref={ref} className="glass-strong relative rounded-2xl p-2">
          <div className="flex items-center justify-between border-b border-glass-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <FileSearch className="size-4 text-accent-ink" aria-hidden />
              <span className="font-medium">What every pre-flight checks</span>
            </div>
            <span className="tabular flex items-center gap-1.5 font-mono text-xs text-fg-muted">
              <Clock className="size-3.5" aria-hidden /> runs in parallel
            </span>
          </div>
          <ul className="divide-y divide-glass-border" aria-live="polite">
            {FEED.map((f, i) => (
              <motion.li
                key={f.label}
                initial={false}
                animate={{ opacity: i < shown ? 1 : 0.25 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 px-4 py-3"
              >
                <f.icon className="size-4 shrink-0 text-fg-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{f.label}</p>
                  <p className="text-xs text-fg-subtle">{i < shown ? f.detail : "…"}</p>
                </div>
                {i < shown ? (
                  <motion.span title="Result when the rule is not met" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cn("rounded-full px-2.5 py-1 text-xs font-medium ring-1", TONE[f.outcome])}>
                    {TONE_LABEL[f.outcome]}
                  </motion.span>
                ) : (
                  <span className="h-6 w-16 animate-shimmer rounded-full bg-[linear-gradient(90deg,transparent,rgba(23,37,84,0.08),transparent)] bg-[length:200%_100%]" aria-hidden />
                )}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- Human in the loop ---------- */
const DECISIONS = [
  { decision: "Score", ai: "Drafts evidence and a hidden estimate", human: "Scores all 6 criteria first" },
  { decision: "Big score gap", ai: "Flags a second look", human: "Writes the reason; keeps or changes the score" },
  { decision: "Disqualification issue", ai: "Detects late commits, leaked keys, off-platform URLs", human: "Organizer confirms or dismisses on Discord" },
  { decision: "Factual alert", ai: "Emails the team automatically", human: "Not needed — low risk, time-critical" },
  { decision: "What AI can't verify", ai: "Marks it “human check”", human: "Judge ticks it off" },
  { decision: "Ranking & shortlist", ai: "Nothing", human: "Human scores only" },
];

export function HumanInTheLoop() {
  return (
    <section id="human" className="relative scroll-mt-24 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Human in the loop" title="AI may inform. Only a human may judge." sub="Every consequential decision — a score, a disqualification, a message on behalf of organizers — is made or approved by a person." />
        <div className="glass overflow-hidden rounded-2xl">
          <div className="hidden grid-cols-[1fr_1.3fr_1.3fr] gap-4 border-b border-glass-border px-6 py-4 text-xs font-medium uppercase tracking-wider text-fg-subtle md:grid">
            <span>Decision</span>
            <span className="flex items-center gap-2"><Bot className="size-4 text-accent-ink" aria-hidden /> AI does</span>
            <span className="flex items-center gap-2"><UserCheck className="size-4 text-primary-soft" aria-hidden /> Human does</span>
          </div>
          <ul className="divide-y divide-glass-border">
            {DECISIONS.map((d, i) => (
              <motion.li
                key={d.decision}
                custom={i}
                variants={reveal}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-40px" }}
                className="grid gap-2 px-6 py-5 transition-colors duration-200 hover:bg-slate-50 md:grid-cols-[1fr_1.3fr_1.3fr] md:gap-4"
              >
                <span className="font-medium">{d.decision}</span>
                <span className="text-sm text-fg-muted"><span className="font-medium text-accent-ink md:hidden">AI: </span>{d.ai}</span>
                <span className="text-sm text-fg"><span className="font-medium text-primary-soft md:hidden">Human: </span>{d.human}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- Metrics (count-up) ---------- */
function CountUp({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce || to === 0) {
      setV(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1200);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, to]);
  return (
    <span ref={ref} className="tabular">
      {prefix}
      {v}
      {suffix}
    </span>
  );
}

export function Metrics() {
  const items = [
    { value: 30, prefix: "<", suffix: " s", label: "Pre-flight report per submission" },
    { value: 2, prefix: "<", suffix: " min", label: "Alert email after detection" },
    { value: 100, suffix: "%", label: "Checks ending in a clear result" },
    { value: 0, label: "Disqualifications without an organizer" },
  ];
  return (
    <section className="py-16">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {items.map((m, i) => (
          <motion.div key={m.label} custom={i} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }} className="glass rounded-2xl p-6">
            <p className="font-mono text-4xl font-semibold text-gradient">
              <CountUp to={m.value} prefix={m.prefix} suffix={m.suffix} />
            </p>
            <p className="mt-2 text-sm text-fg-muted">{m.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Integrations ---------- */
export function Integrations() {
  const items = [
    { icon: Workflow, name: "n8n", body: "Emails, uptime schedule, Discord approvals and the MCP server." },
    { icon: Flag, name: "Discord", body: "Flags land in a private #organizers channel with Confirm / Dismiss." },
    { icon: Bot, name: "Groq", body: "gpt-oss-120b drafts evidence. Output is validated with Zod." },
    { icon: CircleCheck, name: "MCP", body: "Head judges ask “Which teams have unresolved flags?” from any AI assistant." },
  ];
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Automation" title="Wired into the tools organizers already use" sub="Next.js owns the data and the checks. n8n owns everything that waits, runs on a schedule, notifies or asks a human." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <motion.div key={it.name} custom={i} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <TiltCard className="h-full p-6">
                <it.icon className="mb-4 size-6 text-accent-ink" aria-hidden />
                <h3 className="font-semibold">{it.name}</h3>
                <p className="mt-2 text-sm text-fg-muted">{it.body}</p>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- CTA ---------- */
export function FinalCta() {
  return (
    <section className="px-4 py-24 sm:px-6">
      <motion.div
        variants={reveal}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="glass-strong relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12"
      >
        <div aria-hidden className="absolute -top-24 left-1/2 h-64 w-[640px] -translate-x-1/2 rounded-full bg-primary/30 blur-[100px]" />
        <h2 className="relative text-3xl font-bold tracking-tight sm:text-5xl">
          Fix it <span className="text-gradient">before</span> the deadline.
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-fg-muted">
          Run a pre-flight now. You&apos;ll get a private report in seconds and an email if anything breaks later.
        </p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/submit" className={buttonVariants({ size: "lg" })}>
            Submit your project <ArrowRight aria-hidden />
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "secondary", size: "lg" })}>
            I&apos;m a judge
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-glass-border py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-fg-subtle sm:flex-row sm:px-6">
        <p>© 2026 CoJudge · Built for Agentika 2.0 by @Coalition</p>
        <p>AI checks. Humans judge.</p>
      </div>
    </footer>
  );
}
