import { CHECK_LABELS, type CheckKind } from "@/lib/checks/types";
import { StatusBadge } from "./status";
import { Lightbulb } from "lucide-react";

function EvidenceList({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!entries.length) return null;
  return (
    <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[max-content_1fr]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-fg-subtle">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</dt>
          <dd className="tabular break-words font-mono text-fg-muted">{formatValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatValue(v: unknown): string {
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === "object" && x ? Object.values(x as Record<string, unknown>).join(" · ") : String(x)))
      .join("\n");
  }
  if (typeof v === "object" && v) return JSON.stringify(v);
  return String(v);
}

export function CheckRow({ kind, status, evidence, fixTip, children }: { kind: string; status: string; evidence: Record<string, unknown>; fixTip?: string | null; children?: React.ReactNode }) {
  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium">{CHECK_LABELS[kind as CheckKind] ?? kind}</h3>
        <div className="flex items-center gap-2">
          {children}
          <StatusBadge status={status} />
        </div>
      </div>
      <EvidenceList evidence={evidence} />
      {fixTip && status !== "pass" && (
        <p className="mt-3 flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-fg">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden />
          <span>{fixTip}</span>
        </p>
      )}
    </li>
  );
}
