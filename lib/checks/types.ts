export type CheckStatus = "pass" | "fail" | "warn" | "human_check";

export type CheckKind =
  | "url_safety"
  | "deployment_live"
  | "on_alternate_clouds"
  | "repo_accessible"
  | "code_freeze"
  | "secrets"
  | "video"
  | "workflow_json"
  | "linkedin"
  | "injection";

export type CheckResult = {
  kind: CheckKind;
  status: CheckStatus;
  evidence: Record<string, unknown>;
  fixTip?: string;
};

/** A rule issue that only an organizer may confirm. */
export type FlagDraft = { kind: string; detail: string };

export const CHECK_LABELS: Record<CheckKind, string> = {
  url_safety: "Deployment URL safety",
  deployment_live: "Deployment live",
  on_alternate_clouds: "Hosted on Alternate Clouds",
  repo_accessible: "Repository accessible",
  code_freeze: "Code freeze",
  secrets: "Leaked secrets",
  video: "Demo video",
  workflow_json: "Workflow JSON",
  linkedin: "LinkedIn post and reshare",
  injection: "Prompt-injection scan",
};

/** Wraps a check so it can never throw: failures become human_check. */
export async function safely(
  kind: CheckKind,
  fn: () => Promise<CheckResult | CheckResult[]>,
): Promise<CheckResult[]> {
  try {
    const r = await fn();
    return Array.isArray(r) ? r : [r];
  } catch (err) {
    return [
      {
        kind,
        status: "human_check",
        evidence: { error: err instanceof Error ? err.message.slice(0, 300) : "unknown error" },
        fixTip: "CoJudge could not verify this automatically; a judge will check it by hand.",
      },
    ];
  }
}
