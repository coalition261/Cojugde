import { Octokit } from "@octokit/rest";
import { env } from "../env";
import { injectionResult, scanInjection, type InjectionHit } from "./injection";
import { riskyFiles, scanText, secretsResult, type SecretHit } from "./secrets";
import type { CheckResult, FlagDraft } from "./types";

const OWNER_RE = /^[A-Za-z0-9-]+$/;
const REPO_RE = /^[A-Za-z0-9._-]+$/;
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|json|ya?ml|toml|env|ini|cfg|conf|md|txt|sh|go|rs|java|rb|php|html|vue|svelte|dockerfile)$/i;
const MAX_SCAN_FILES = 40;
const MAX_SCAN_BYTES = 200 * 1024;

export type RepoRef = { owner: string; repo: string };

export function parseRepoUrl(raw: string): RepoRef | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return null;
  const [owner, repoRaw] = u.pathname.split("/").filter(Boolean);
  const repo = repoRaw?.replace(/\.git$/, "");
  if (!owner || !repo || !OWNER_RE.test(owner) || !REPO_RE.test(repo)) return null;
  return { owner, repo };
}

function octokit() {
  return new Octokit({
    auth: env.githubToken || undefined,
    userAgent: "CoJudge-Verifier/1.0",
    request: { timeout: 10_000 },
  });
}

/** Repository content handed to the evidence agent (paths + a few truncated files). */
export type RepoContext = {
  ref: RepoRef;
  defaultBranch: string;
  sha: string;
  tree: string[];
  files: { path: string; content: string }[];
};

export type GithubOutcome = { results: CheckResult[]; flags: FlagDraft[]; context: RepoContext | null };

async function rawFile(ref: RepoRef, sha: string, path: string): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: env.githubToken ? { authorization: `Bearer ${env.githubToken}` } : {},
    cache: "no-store",
  });
  if (!res.ok) return null;
  const text = await res.text();
  return text.length > MAX_SCAN_BYTES ? text.slice(0, MAX_SCAN_BYTES) : text;
}

/** Key files first: config/env files, then manifests, README and entry points. */
function pickScanFiles(tree: { path: string; size: number }[]): string[] {
  const score = (p: string) => {
    const lower = p.toLowerCase();
    if (/(^|\/)\.env/.test(lower) || /config|settings|secret|credential/.test(lower)) return 0;
    if (/(^|\/)(package\.json|requirements\.txt|dockerfile|readme\.md)$/.test(lower)) return 1;
    if (/(^|\/)(index|main|app|server)\.(t|j)sx?$|(^|\/)(main|app)\.py$/.test(lower)) return 2;
    if (lower.includes("node_modules") || lower.includes("dist/") || lower.endsWith(".lock")) return 9;
    return 5;
  };
  return tree
    .filter((f) => f.size <= MAX_SCAN_BYTES && (TEXT_EXT.test(f.path) || /(^|\/)(dockerfile|\.env[^/]*)$/i.test(f.path)))
    .filter((f) => !/package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$/.test(f.path))
    .sort((a, b) => score(a.path) - score(b.path))
    .slice(0, MAX_SCAN_FILES)
    .map((f) => f.path);
}

export async function checkGithub(rawRepoUrl: string, freezeAt: Date): Promise<GithubOutcome> {
  const ref = parseRepoUrl(rawRepoUrl);
  if (!ref) {
    return {
      context: null,
      flags: [],
      results: [
        {
          kind: "repo_accessible",
          status: "fail",
          evidence: { url: rawRepoUrl, reason: "Not a github.com/<owner>/<repo> URL" },
          fixTip: "Submit the public GitHub URL, e.g. https://github.com/your-team/your-repo.",
        },
      ],
    };
  }

  const gh = octokit();
  let defaultBranch: string;
  try {
    const { data } = await gh.repos.get(ref);
    defaultBranch = data.default_branch;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404 || status === 403) {
      return {
        context: null,
        flags: [],
        results: [
          {
            kind: "repo_accessible",
            status: "fail",
            evidence: { repo: `${ref.owner}/${ref.repo}`, statusCode: status },
            fixTip: "Private or missing: make the repository public (Settings → General → Danger Zone → Change visibility).",
          },
        ],
      };
    }
    throw err;
  }

  const results: CheckResult[] = [
    { kind: "repo_accessible", status: "pass", evidence: { repo: `${ref.owner}/${ref.repo}`, defaultBranch } },
  ];
  const flags: FlagDraft[] = [];

  // Code freeze: any commit after FREEZE_AT becomes a flag for the organizer.
  try {
    const { data: late } = await gh.repos.listCommits({ ...ref, since: freezeAt.toISOString(), per_page: 20 });
    if (late.length === 0) {
      results.push({ kind: "code_freeze", status: "pass", evidence: { since: freezeAt.toISOString(), commits: 0 } });
    } else {
      const commits = late.map((c) => ({
        sha: c.sha.slice(0, 7),
        message: (c.commit.message.split("\n")[0] ?? "").slice(0, 120),
        at: c.commit.committer?.date ?? c.commit.author?.date ?? null,
      }));
      results.push({
        kind: "code_freeze",
        status: "warn",
        evidence: { since: freezeAt.toISOString(), commits },
        fixTip: "Commits after the code freeze were found. An organizer will decide whether they count.",
      });
      flags.push({
        kind: "code_freeze",
        detail: `${commits.length} commit(s) after freeze: ${commits.map((c) => `${c.sha} "${c.message}"`).join("; ")}`,
      });
    }
  } catch (err) {
    results.push({
      kind: "code_freeze",
      status: "human_check",
      evidence: { error: err instanceof Error ? err.message : "unknown" },
    });
  }

  // Tree, secrets and injection scans.
  const { data: branch } = await gh.repos.getBranch({ ...ref, branch: defaultBranch });
  const sha = branch.commit.sha;
  const { data: treeData } = await gh.git.getTree({ ...ref, tree_sha: sha, recursive: "true" });
  const blobs = treeData.tree
    .filter((t) => t.type === "blob" && t.path)
    .map((t) => ({ path: t.path as string, size: t.size ?? 0 }));
  const tree = blobs.map((b) => b.path);

  const toScan = pickScanFiles(blobs);
  const files: { path: string; content: string }[] = [];
  await Promise.all(
    toScan.map(async (path) => {
      const content = await rawFile(ref, sha, path).catch(() => null);
      if (content !== null) files.push({ path, content });
    }),
  );

  const secretHits: SecretHit[] = files.flatMap((f) => scanText(f.path, f.content));
  const sec = secretsResult(riskyFiles(tree), secretHits, files.length);
  results.push(sec.result);
  flags.push(...sec.flags);

  const injFiles = files.filter((f) => /readme|\.md$|index\.html$/i.test(f.path) || toScan.slice(0, 8).includes(f.path));
  const injHits: InjectionHit[] = injFiles.flatMap((f) => scanInjection(f.path, f.content));
  const inj = injectionResult(injHits, injFiles.map((f) => f.path));
  results.push(inj.result);
  flags.push(...inj.flags);

  return { results, flags, context: { ref, defaultBranch, sha, tree, files } };
}

/** Optional workflow JSON: only from the team's repo tree or raw.githubusercontent.com. */
export async function checkWorkflow(workflowUrl: string | null | undefined, ctx: RepoContext | null): Promise<CheckResult> {
  let json: string | null = null;
  let source = "";
  if (workflowUrl) {
    let u: URL;
    try {
      u = new URL(workflowUrl);
    } catch {
      return { kind: "workflow_json", status: "warn", evidence: { reason: "Invalid URL" }, fixTip: "Link the workflow JSON in your GitHub repo." };
    }
    if (u.protocol !== "https:") {
      return { kind: "workflow_json", status: "warn", evidence: { reason: "Only https URLs are read" } };
    }
    if (u.hostname === "github.com") {
      const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
      if (m) u = new URL(`https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`);
    }
    if (u.hostname !== "raw.githubusercontent.com") {
      return {
        kind: "workflow_json",
        status: "human_check",
        evidence: { url: workflowUrl, reason: "Only GitHub-hosted workflow JSON is read" },
        fixTip: "Commit the exported n8n workflow JSON to your repo and link it.",
      };
    }
    const res = await fetch(u, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (res.ok) json = (await res.text()).slice(0, 1024 * 1024);
    source = u.pathname;
  } else if (ctx) {
    const candidate = ctx.files.find((f) => f.path.endsWith(".json") && f.content.includes('"nodes"'));
    if (candidate) {
      json = candidate.content;
      source = candidate.path;
    }
  }
  if (!json) {
    return { kind: "workflow_json", status: "human_check", evidence: { reason: "No workflow JSON found (optional)" } };
  }
  try {
    const wf = JSON.parse(json) as { nodes?: { type?: string; parameters?: Record<string, unknown> }[] };
    const nodes = wf.nodes ?? [];
    const types = nodes.map((n) => n.type ?? "");
    const count = (pred: (t: string, n: (typeof nodes)[number]) => boolean) => nodes.filter((n, i) => pred(types[i] ?? "", n)).length;
    const evidence = {
      source,
      totalNodes: nodes.length,
      aiAgentNodes: count((t) => /langchain\.agent|openAi|lmChat|groq/i.test(t)),
      approvalNodes: count((t, n) => /\.wait$/.test(t) || n.parameters?.operation === "sendAndWait"),
      mcpNodes: count((t) => /mcp/i.test(t)),
    };
    return { kind: "workflow_json", status: "pass", evidence };
  } catch {
    return { kind: "workflow_json", status: "warn", evidence: { source, reason: "File is not valid JSON" } };
  }
}
