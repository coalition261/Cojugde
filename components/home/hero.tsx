"use client";

import Link from "next/link";
import { useRef } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HeroScene = dynamic(() => import("./hero-scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center" aria-hidden>
      <div className="size-40 animate-pulse rounded-full bg-primary/20 blur-2xl" />
    </div>
  ),
});

/** Floating glass pill — adapted from the 21st.dev "Modern hero section" (HeroGeometric). */
function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-white/[0.08]",
}: {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: -150, rotate: rotate - 15 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{ duration: 2.4, delay, ease: [0.23, 0.86, 0.39, 0.96], opacity: { duration: 1.2 } }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, 15, 0] }}
        transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        style={{ width, height }}
        className="relative"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full bg-gradient-to-r to-transparent",
            gradient,
            "border border-[#e2e8f0]/70",
            "shadow-[0_8px_32px_0_rgba(23,37,84,0.04)]",
            "after:absolute after:inset-0 after:rounded-full after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.6),transparent_70%)]",
          )}
        />
      </motion.div>
    </motion.div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: 0.25 + i * 0.12, ease: [0.25, 0.4, 0.25, 1] as const },
  }),
};

export function Hero() {
  const reduce = useReducedMotion() ?? false;
  // The orb's canvas ignores clicks (pointer-events: none) so it never blocks the buttons;
  // pointer movement for its parallax is read from the whole hero section instead.
  const sectionRef = useRef<HTMLElement>(null);
  return (
    <section ref={sectionRef} className="relative isolate overflow-hidden pt-32 pb-16 sm:pt-36 lg:min-h-[92dvh] lg:pb-24">
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <ElegantShape delay={0.3} width={600} height={140} rotate={12} gradient="from-[#dbe4f5]/70" className="left-[-12%] top-[18%] md:left-[-6%]" />
        <ElegantShape delay={0.5} width={480} height={118} rotate={-15} gradient="from-accent-soft/40" className="right-[-8%] top-[72%]" />
        <ElegantShape delay={0.4} width={300} height={78} rotate={-8} gradient="from-[#e9eef8]/80" className="bottom-[6%] left-[6%]" />
        <ElegantShape delay={0.6} width={200} height={58} rotate={20} gradient="from-[#dbe4f5]/60" className="right-[18%] top-[12%]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
        {/* Animated orb, centred behind the heading and description. */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
          className="pointer-events-none absolute left-1/2 top-[-80px] z-0 aspect-square w-[min(540px,118vw)] -translate-x-1/2 opacity-40 [mask-image:radial-gradient(circle_at_center,black_52%,transparent_70%)] sm:top-[-130px] sm:w-[640px] sm:opacity-45 lg:top-[-175px] lg:w-[720px] lg:opacity-50"
        >
          <div className="absolute inset-[14%] rounded-full bg-[#dbe4f5]/70 blur-[90px]" />
          <HeroScene still={reduce} eventSource={sectionRef} />
        </motion.div>
        {/* Soft white wash keeps the text crisp over the orb. */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-10px] z-[1] h-[380px] w-[min(780px,100%)] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(255,255,255,0.82),rgba(255,255,255,0.5)_60%,transparent)] sm:top-[0px] sm:h-[420px]" />

        <div className="relative z-10">
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="mb-7 inline-flex items-center gap-2 rounded-full border border-glass-border bg-white/90 px-3.5 py-1.5 text-sm font-medium text-primary shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <Sparkles className="size-4 text-accent" aria-hidden />
            Human + AI: Better Together
          </motion.div>

          <motion.h1 custom={1} variants={fadeUp} initial="hidden" animate="visible" className="text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            <span className="text-[#172554]">AI checks.</span>
            <br />
            <span className="text-[#1e40af]">Humans judge.</span>
          </motion.h1>

          <motion.p custom={2} variants={fadeUp} initial="hidden" animate="visible" className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#475569]">
            CoJudge verifies every hackathon submission in under 30 seconds, emails teams the moment something breaks,
            and hands judges cited evidence — while every score, flag and shortlist stays in human hands.
          </motion.p>

          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/submit" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
              Run pre-flight check <ArrowRight aria-hidden />
            </Link>
            <Link href="/login" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full sm:w-auto")}>
              <ShieldCheck aria-hidden /> Open judge dashboard
            </Link>
          </motion.div>

          <motion.dl custom={4} variants={fadeUp} initial="hidden" animate="visible" className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-4">
            {[
              ["< 30 s", "pre-flight report"],
              ["< 2 min", "alert email"],
              ["0", "AI scores shown first"],
            ].map(([k, v], i) => (
              <div key={v} className={cn("px-2", i > 0 && "border-l border-glass-border")}>
                <dt className="sr-only">{v}</dt>
                <dd className="tabular font-mono text-xl font-semibold text-fg">{k}</dd>
                <dd className="text-xs text-fg-subtle">{v}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* Status chips: floated around the orb on large screens, a tidy row below the CTAs on smaller ones. */}
        <div className="relative z-20 mt-10 flex flex-wrap justify-center gap-3 lg:pointer-events-none lg:absolute lg:inset-0 lg:mt-0 lg:block">
          <FloatingChip className="lg:absolute lg:left-0 lg:top-[14%]" delay={1.1} tone="success" title="Deployment live" sub="2xx/3xx within 10 s" />
          <FloatingChip className="lg:absolute lg:right-0 lg:top-[34%]" delay={1.35} tone="warning" title="Demo video" sub="2–3 min rule" />
          <FloatingChip className="lg:absolute lg:left-[3%] lg:top-[58%]" delay={1.6} tone="danger" title="Leaked keys" sub="masked → organizer flag" />
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent" />
    </section>
  );
}

function FloatingChip({ className, delay, tone, title, sub }: { className: string; delay: number; tone: "success" | "warning" | "danger"; title: string; sub: string }) {
  const dot = { success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-[#e5e7eb] bg-white px-3.5 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_24px_-14px_rgba(23,37,84,0.2)]",
        className,
      )}
    >
      <span className="relative flex size-2.5">
        <span className={cn("absolute inline-flex size-full animate-pulse-ring rounded-full", dot)} />
        <span className={cn("relative inline-flex size-2.5 rounded-full", dot)} />
      </span>
      <span>
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="tabular block font-mono text-xs text-fg-muted">{sub}</span>
      </span>
    </motion.div>
  );
}