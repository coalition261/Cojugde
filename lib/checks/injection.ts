import type { CheckResult, FlagDraft } from "./types";

const PHRASES: { label: string; re: RegExp }[] = [
  { label: '"ignore previous"', re: /ignore (all )?(the )?previous/i },
  { label: '"you are an AI"', re: /you are an? (ai|language model|llm)/i },
  { label: '"give this team"', re: /give (this|our) team/i },
  { label: "instructions to judges", re: /\b(judges?|evaluators?)\b.{0,40}\b(must|should) (score|rate|award)/i },
  { label: "score demand", re: /(score|rate) (this|us) (10|100|full marks|maximum)/i },
];
const HTML_COMMENT = /<!--([\s\S]*?)-->/g;
const ZERO_WIDTH = /[​-‍⁠﻿]/g;

export type InjectionHit = { file: string; line: number; reason: string; excerpt: string };

export function scanInjection(file: string, text: string): InjectionHit[] {
  const hits: InjectionHit[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const p of PHRASES) {
      if (p.re.test(line)) hits.push({ file, line: i + 1, reason: p.label, excerpt: line.trim().slice(0, 120) });
    }
    if (ZERO_WIDTH.test(line)) hits.push({ file, line: i + 1, reason: "zero-width characters", excerpt: "(hidden characters)" });
    ZERO_WIDTH.lastIndex = 0;
  });
  for (const m of text.matchAll(HTML_COMMENT)) {
    const body = (m[1] ?? "").trim();
    // Only HTML comments that address an AI or a judge count; badges/lint comments are fine.
    if (/\b(ai|llm|model|judge|assistant|score|ignore)\b/i.test(body)) {
      const line = text.slice(0, m.index ?? 0).split("\n").length;
      hits.push({ file, line, reason: "hidden HTML comment", excerpt: body.slice(0, 120) });
    }
  }
  return hits;
}

export function injectionResult(hits: InjectionHit[], scanned: string[]): { result: CheckResult; flags: FlagDraft[] } {
  if (hits.length === 0) {
    return { result: { kind: "injection", status: "pass", evidence: { scanned } }, flags: [] };
  }
  return {
    result: {
      kind: "injection",
      status: "warn",
      evidence: { scanned, hits: hits.slice(0, 10) },
      fixTip: "Remove text addressed to AI tools or judges. It does not affect ranking, and organizers review it.",
    },
    flags: [
      {
        kind: "manipulation_attempt",
        detail: hits
          .slice(0, 5)
          .map((h) => `${h.reason} at ${h.file}:${h.line}`)
          .join("; "),
      },
    ],
  };
}
