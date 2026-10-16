import { env } from "../env";
import { checkDeployment } from "./deployment";
import { checkGithub, checkWorkflow, type RepoContext } from "./github";
import { safely, type CheckResult, type FlagDraft } from "./types";
import { checkVideo } from "./video";

export type SubmissionInput = {
  repoUrl: string;
  deployUrl: string;
  videoUrl: string;
  workflowUrl?: string | null;
};

export type RunOutcome = {
  results: CheckResult[];
  flags: FlagDraft[];
  deployLive: boolean | null;
  repo: RepoContext | null;
  durationMs: number;
};

/** Runs every verification check in parallel. Never throws. */
export async function runChecks(input: SubmissionInput): Promise<RunOutcome> {
  const started = Date.now();
  const flags: FlagDraft[] = [];
  const state: { deployLive: boolean | null; repo: RepoContext | null } = { deployLive: null, repo: null };

  const [deploy, gh, video] = await Promise.all([
    safely("deployment_live", async () => {
      const d = await checkDeployment(input.deployUrl);
      flags.push(...d.flags);
      state.deployLive = d.live;
      return d.results;
    }),
    safely("repo_accessible", async () => {
      const g = await checkGithub(input.repoUrl, env.freezeAt);
      flags.push(...g.flags);
      state.repo = g.context;
      return g.results;
    }),
    safely("video", () => checkVideo(input.videoUrl)),
  ]);
  const { deployLive, repo } = state;
  const workflow = await safely("workflow_json", () => checkWorkflow(input.workflowUrl, repo));

  const linkedin: CheckResult = {
    kind: "linkedin",
    status: "human_check",
    evidence: { reason: "LinkedIn is never fetched; AI-writing detectors are unreliable." },
    fixTip: "A judge ticks this off after looking at your post and reshare.",
  };

  return {
    results: [...deploy, ...gh, ...video, ...workflow, linkedin],
    flags,
    deployLive,
    repo,
    durationMs: Date.now() - started,
  };
}

export * from "./types";
