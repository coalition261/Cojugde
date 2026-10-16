import { maskSecret } from "../utils";
import type { CheckResult, FlagDraft } from "./types";

export const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "Groq API key", re: /gsk_[A-Za-z0-9]{20,}/g },
  { name: "OpenAI-style key", re: /sk-[A-Za-z0-9_-]{20,}/g },
  { name: "Google API key", re: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "GitHub token", re: /ghp_[A-Za-z0-9]{36}/g },
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/g },
];

const RISKY_FILE = [/(^|\/)\.env(\.[^/]*)?$/, /\.pem$/i, /(^|\/)credentials[^/]*\.json$/i];
const ALLOWED_ENV_EXAMPLES = /(^|\/)\.env\.(example|sample|template)$/i;

export function riskyFiles(paths: string[]): string[] {
  return paths.filter((p) => !ALLOWED_ENV_EXAMPLES.test(p) && RISKY_FILE.some((re) => re.test(p)));
}

export type SecretHit = { type: string; masked: string; file: string; line: number };

/** Returns only masked values with file:line. The raw key never leaves this function. */
export function scanText(file: string, text: string): SecretHit[] {
  const hits: SecretHit[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const { name, re } of SECRET_PATTERNS) {
      re.lastIndex = 0;
      for (const m of line.matchAll(re)) {
        hits.push({ type: name, masked: maskSecret(m[0]), file, line: i + 1 });
      }
    }
  });
  return hits;
}

/** Replace any secret-looking value with its masked form (used before LLM calls). */
export function redactSecrets(text: string): string {
  let out = text;
  for (const { re } of SECRET_PATTERNS) out = out.replace(re, (m) => maskSecret(m));
  return out;
}

export function secretsResult(files: string[], hits: SecretHit[], scanned: number): { result: CheckResult; flags: FlagDraft[] } {
  if (files.length === 0 && hits.length === 0) {
    return { result: { kind: "secrets", status: "pass", evidence: { scannedFiles: scanned } }, flags: [] };
  }
  const detail = [
    ...files.map((f) => `Sensitive file committed: ${f}`),
    ...hits.map((h) => `${h.type} ${h.masked} at ${h.file}:${h.line}`),
  ].join("; ");
  return {
    result: {
      kind: "secrets",
      status: "fail",
      evidence: { scannedFiles: scanned, files, hits },
      fixTip: "Rotate this key now, remove it from the repo, and load it from an environment variable instead.",
    },
    flags: [{ kind: "leaked_secret", detail }],
  };
}
