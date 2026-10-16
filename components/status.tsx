import { CircleCheck, CircleAlert, CircleX, Eye, Flag, ShieldCheck, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS = {
  pass: { label: "Pass", icon: CircleCheck, cls: "bg-success/12 text-success ring-success/25" },
  fail: { label: "Fail", icon: CircleX, cls: "bg-danger/12 text-danger ring-danger/25" },
  warn: { label: "Warning", icon: CircleAlert, cls: "bg-warning/12 text-warning ring-warning/25" },
  human_check: { label: "Human check", icon: Eye, cls: "bg-info/12 text-info ring-info/25" },
} as const;

/** Icon + text, so status never relies on color alone. */
export function StatusBadge({ status, className }: { status: keyof typeof STATUS | string; className?: string }) {
  const s = STATUS[status as keyof typeof STATUS] ?? STATUS.human_check;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1", s.cls, className)}>
      <Icon className="size-3.5" aria-hidden />
      {s.label}
    </span>
  );
}

const FLAG = {
  open: { label: "Open", icon: Flag, cls: "bg-warning/12 text-warning ring-warning/25" },
  confirmed: { label: "Confirmed", icon: ShieldX, cls: "bg-danger/12 text-danger ring-danger/25" },
  dismissed: { label: "Dismissed", icon: ShieldCheck, cls: "bg-white/5 text-fg-muted ring-white/10" },
} as const;

export function FlagBadge({ status }: { status: keyof typeof FLAG | string }) {
  const s = FLAG[status as keyof typeof FLAG] ?? FLAG.open;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1", s.cls)}>
      <Icon className="size-3.5" aria-hidden />
      {s.label}
    </span>
  );
}
