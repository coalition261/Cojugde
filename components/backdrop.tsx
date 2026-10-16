/** Ambient page background: soft aurora glows over a faint grid. Pure CSS, no JS. */
export function Backdrop({ intensity = "normal" }: { intensity?: "normal" | "soft" }) {
  const o = intensity === "soft" ? "opacity-60" : "opacity-100";
  return (
    <div aria-hidden className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${o}`}>
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-primary/12 blur-[140px]" />
      <div className="absolute right-[-10%] top-1/3 h-[420px] w-[520px] rounded-full bg-accent/6 blur-[140px]" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[420px] w-[520px] rounded-full bg-info/6 blur-[150px]" />
    </div>
  );
}
