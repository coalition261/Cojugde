import { env } from "./env";

export const N8N_PATHS = {
  checkFailed: "cojudge-check-failed",
  flagOpened: "cojudge-flag-opened",
  feedback: "cojudge-feedback",
} as const;

/**
 * Next.js → n8n webhook call with Header Auth. Fire-and-forget friendly:
 * resolves to false instead of throwing, so a down n8n never breaks a submission.
 */
export async function callN8n(path: string, body: unknown): Promise<boolean> {
  if (!env.n8nBaseUrl || !env.n8nWebhookKey) {
    console.warn(`[n8n] not configured, skipped ${path}`);
    return false;
  }
  try {
    const res = await fetch(`${env.n8nBaseUrl}/webhook/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cojudge-key": env.n8nWebhookKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) console.warn(`[n8n] ${path} → ${res.status}`);
    return res.ok;
  } catch (err) {
    console.warn(`[n8n] ${path} failed`, err instanceof Error ? err.message : err);
    return false;
  }
}
