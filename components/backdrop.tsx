/** Ambient page background: very soft navy/gold washes over a faint grid on white. Pure CSS, no JS. */
export function Backdrop({ intensity = "normal" }: { intensity?: "normal" | "soft" }) {
  const o = intensity === "soft" ? "opacity-70" : "opacity-100";
  return (
    <div aria-hidden className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg ${o}`}>
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_15%,transparent_65%)]" />
      <div className="absolute -top-48 left-1/2 h-[560px] w-[960px] -translate-x-1/2 rounded-full bg-surface-tint blur-[120px]" />
      <div className="absolute right-[-10%] top-1/3 h-[420px] w-[520px] rounded-full bg-accent-soft/25 blur-[140px]" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[420px] w-[520px] rounded-full bg-[#e9eef8] blur-[150px]" />
    </div>
  );
}
