import { env } from "../env";

export type UrlVerdict = { ok: true; url: URL } | { ok: false; reason: string };

/**
 * SSRF guard: HTTPS only, no credentials, no explicit port, and the hostname
 * must match the Alternate Clouds pattern. Anything else is never fetched.
 */
export function checkDeployUrl(raw: string): UrlVerdict {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "Not a valid URL" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "Only https:// URLs are allowed" };
  if (url.username || url.password) return { ok: false, reason: "URL must not contain a username or password" };
  if (url.port) return { ok: false, reason: "URL must not specify a port" };
  if (!env.deployHostPattern.test(url.hostname)) {
    return { ok: false, reason: `Host ${url.hostname} is not an Alternate Clouds app URL` };
  }
  return { ok: true, url };
}

export const MAX_BODY_BYTES = 1024 * 1024;
export const FETCH_TIMEOUT_MS = 10_000;

export type SafeFetchResult =
  | { kind: "response"; status: number; durationMs: number; bytes: number; location?: string | null }
  | { kind: "timeout"; durationMs: number }
  | { kind: "error"; durationMs: number; message: string };

/** GET with redirects off, 10 s timeout and a 1 MB body cap. Call only on allowlisted URLs. */
export async function safeFetch(url: URL): Promise<SafeFetchResult> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "user-agent": "CoJudge-Verifier/1.0" },
      cache: "no-store",
    });
    let bytes = 0;
    if (res.body) {
      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes >= MAX_BODY_BYTES) {
          await reader.cancel();
          break;
        }
      }
    }
    return {
      kind: "response",
      status: res.status,
      durationMs: Date.now() - started,
      bytes,
      location: res.headers.get("location"),
    };
  } catch (err) {
    const durationMs = Date.now() - started;
    if (ctrl.signal.aborted) return { kind: "timeout", durationMs };
    return { kind: "error", durationMs, message: err instanceof Error ? err.message : "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}
