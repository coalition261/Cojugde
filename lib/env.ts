/** Server-side configuration. Read lazily so builds don't need secrets. */
export const env = {
  get groqKey() {
    return process.env.GROQ_API_KEY ?? "";
  },
  get githubToken() {
    return process.env.GITHUB_TOKEN ?? "";
  },
  get youtubeKey() {
    return process.env.YOUTUBE_API_KEY ?? "";
  },
  get n8nBaseUrl() {
    return (process.env.N8N_BASE_URL ?? "").replace(/\/$/, "");
  },
  get n8nWebhookKey() {
    return process.env.N8N_WEBHOOK_KEY ?? "";
  },
  get internalKey() {
    return process.env.INTERNAL_KEY ?? "";
  },
  get sessionSecret() {
    return process.env.SESSION_SECRET ?? "";
  },
  get appUrl() {
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get freezeAt() {
    return new Date(process.env.FREEZE_AT ?? "2026-10-17T07:45:00Z");
  },
  get eventEndsAt() {
    return new Date(process.env.EVENT_ENDS_AT ?? "2026-10-17T13:00:00Z");
  },
  /** Regex the deployment hostname must match (Alternate Clouds). */
  get deployHostPattern() {
    return new RegExp(process.env.DEPLOY_HOST_PATTERN ?? "^[a-z0-9-]+-app\\.alternatefutures\\.ai$");
  },
};
