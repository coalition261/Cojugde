import { checkDeployUrl, safeFetch, type SafeFetchResult } from "./url";
import type { CheckResult, FlagDraft } from "./types";

export type DeploymentOutcome = { results: CheckResult[]; flags: FlagDraft[]; live: boolean | null };

export function interpretFetch(r: SafeFetchResult): CheckResult {
  if (r.kind === "timeout") {
    return {
      kind: "deployment_live",
      status: "fail",
      evidence: { result: "timeout", durationMs: r.durationMs },
      fixTip: "Not reachable within 10 s. Check the deployment is running and the lease is active.",
    };
  }
  if (r.kind === "error") {
    return {
      kind: "deployment_live",
      status: "fail",
      evidence: { result: "network error", message: r.message, durationMs: r.durationMs },
      fixTip: "Not reachable. Check the URL and that the deployment has finished placing.",
    };
  }
  const { status, durationMs } = r;
  if (status >= 200 && status < 400) {
    return { kind: "deployment_live", status: "pass", evidence: { statusCode: status, durationMs } };
  }
  if (status === 502) {
    return {
      kind: "deployment_live",
      status: "fail",
      evidence: { statusCode: status, durationMs },
      fixTip: "Port mismatch: make PORT in the Source tab match your app (troubleshooting guide, section 01).",
    };
  }
  return {
    kind: "deployment_live",
    status: "fail",
    evidence: { statusCode: status, durationMs },
    fixTip: `The app answered HTTP ${status}. Make sure the root path (/) serves your app.`,
  };
}

export async function checkDeployment(rawUrl: string): Promise<DeploymentOutcome> {
  const verdict = checkDeployUrl(rawUrl);
  if (!verdict.ok) {
    return {
      live: null,
      results: [
        {
          kind: "url_safety",
          status: "human_check",
          evidence: { url: rawUrl, reason: verdict.reason },
          fixTip: "Submit the https://<service>-app.alternatefutures.ai URL from your Alternate Clouds dashboard.",
        },
        {
          kind: "on_alternate_clouds",
          status: "fail",
          evidence: { url: rawUrl, reason: verdict.reason },
          fixTip: "Projects must be deployed on Alternate Clouds. An organizer will review this.",
        },
      ],
      flags: [{ kind: "not_on_alternate_clouds", detail: `Deployment URL is not on Alternate Clouds: ${verdict.reason}` }],
    };
  }
  const fetched = await safeFetch(verdict.url);
  const live = interpretFetch(fetched);
  return {
    live: live.status === "pass",
    results: [
      { kind: "url_safety", status: "pass", evidence: { host: verdict.url.hostname } },
      { kind: "on_alternate_clouds", status: "pass", evidence: { host: verdict.url.hostname } },
      live,
    ],
    flags: [],
  };
}
