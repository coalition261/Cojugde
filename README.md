# CoJudge

**AI checks. Humans judge.** A judging assistant for submission-based competitions (built for Agentika 2.0).
CoJudge verifies each submission in seconds, emails teams when something breaks, drafts cited rubric evidence with an AI agent, and keeps every score, flag and shortlist decision with a human.

> This README is also the build log: it records what has been built, how it maps to the PRD, what you need to configure, and what has **not** been verified yet.

---

## 1. Status at a glance

| Area | PRD ID | Status |
|---|---|---|
| Submission intake (form, upsert by team name, `submitted_at`) | F1 | ✅ Built (PDF upload is P1, not built) |
| Verification engine (URL safety, deployment, Alternate Clouds, repo, code freeze, secrets, video, workflow JSON, LinkedIn, injection) | F2, F12 | ✅ Built, never throws, unit-tested |
| Pre-flight report `/r/[token]` | F3 | ✅ Built |
| Email alerts + uptime watch (cooldown, daily cap, state-change dedupe) | F4 | ✅ Built (Next.js side + n8n WF1/WF2) |
| AI evidence agent (Groq, Zod, retry + fallback, citation filter, clamp) | F5 | ✅ Built |
| Blind-first scoring (server-enforced), gap rule, second look | F6 | ✅ Built |
| Flags with Discord approval + dashboard Confirm/Dismiss, audit log | F7 | ✅ Built (n8n WF3) |
| Leaderboard (human scores only), shortlist top 10, CSV export | F8 | ✅ Built (CSV = P1 bonus) |
| MCP: `get_team_report`, `list_open_flags`, `get_leaderboard`, `compare_teams` | F9 | ✅ Built (n8n WF4) |
| Judge auth (passcode → signed httpOnly cookie, server-side checks) | F13 | ✅ Built |
| Calibration notes from second-look reasons → agent prompt | F10 | ✅ Built |
| Deadline reminder email | WF5 | ✅ Built |
| Feedback drafts + approval | F11 / WF6 | ❌ Not built (first item on the PRD cut list) |
| PDF upload with link extraction | F1 (P1) | ❌ Not built |

**Verified:** `npm run typecheck` ✅ · `npm test` (9 unit tests) ✅ · `npm run build` ✅ · home, submit pages rendered in a browser (desktop + 375 px mobile) ✅
**Verified locally on embedded Postgres (PGlite):** migrations, report page, organizer login, dashboard + flag queue, estimate withheld by `GET /api/teams/[id]` before scoring, score → reveal → second-look reason, human-only leaderboard, live submission against a real public GitHub repo (pre-flight 2.3 s), internal MCP endpoint (403 without key).
**Not verified yet (needs your credentials/infrastructure):** YouTube/Groq calls, n8n workflow import, Discord buttons, SMTP delivery, Alternate Clouds deploy.

---

## 2. Credentials you need

| # | Credential | Where to get it | Used for | Goes into |
|---|---|---|---|---|
| 1 | **PostgreSQL 17** connection string | Alternate Clouds Postgres template (set a strong `POSTGRES_PASSWORD`) | All data | `DATABASE_URL` |
| 2 | **Groq API key** | console.groq.com → API Keys | AI evidence agent | `GROQ_API_KEY` |
| 3 | **GitHub fine-grained token** (read-only, *Public repositories*) | github.com → Settings → Developer settings → Fine-grained tokens | Repo, commits, tree (5,000 req/h) | `GITHUB_TOKEN` |
| 4 | **YouTube Data API v3 key** | console.cloud.google.com → enable *YouTube Data API v3* → Credentials → API key | Video length + privacy | `YOUTUBE_API_KEY` |
| 5 | **Gmail app password** (account with 2-Step Verification) | myaccount.google.com → Security → App passwords | Sending emails from n8n (SMTP `smtp.gmail.com:465`) | n8n credential "Gmail SMTP" |
| 6 | **Discord bot token** + server ID + private `#organizers` channel ID | discord.com/developers → New application → Bot; invite with *Send Messages* + *Read Message History*, limited to #organizers | Flag Confirm/Dismiss | n8n credential "CoJudge Discord Bot" + WF3 node |
| 7 | **n8n owner account** | Create it immediately after the n8n deploy (prevents takeover) | n8n admin | — |
| 8 | Three random secrets you generate | `openssl rand -base64 48` (or any password generator) | `SESSION_SECRET`, `N8N_WEBHOOK_KEY`, `INTERNAL_KEY` | env + n8n credentials |
| 9 | MCP bearer token you generate | random string | Auth for MCP clients | n8n credential "CoJudge MCP Bearer" |
| 10 | Judge / organizer passcodes you choose | — | Login | `npm run set-passcode -- judge` / `-- organizer` (hidden prompt, writes only the hash to `.env`; add `--print` to get the hash for a hosted env) |

> Never commit real keys. `.env` is git-ignored; use `.env.example` as the template.

## 3. Environment variables

### Next.js service (`cojudge`)

| Variable | Required | Example / notes |
|---|---|---|
| `DATABASE_URL` | ✅ | `postgres://user:pass@host:5432/cojudge` |
| `DATABASE_SSL` | – | `true` if your Postgres needs TLS |
| `APP_URL` | ✅ | `https://cojudge-app.alternatefutures.ai` (used in email links) |
| `GROQ_API_KEY` | ✅ | `gsk_…` |
| `GROQ_EVIDENCE_MODEL` / `GROQ_FALLBACK_MODEL` | – | default `openai/gpt-oss-120b` / `openai/gpt-oss-20b` |
| `GROQ_TPM_LIMIT` / `GROQ_MAX_COMPLETION_TOKENS` | – | default `8000` / `2200`. The evidence prompt is trimmed to fit your Groq tier's tokens-per-minute limit (free tier = 8,000). Raise `GROQ_TPM_LIMIT` on a paid tier to send more of the repo. |
| `GITHUB_TOKEN` | ✅ (works at 60 req/h without) | fine-grained, read-only |
| `YOUTUBE_API_KEY` | ✅ (else video = human check) | |
| `N8N_BASE_URL` | ✅ | `https://cojudge-flow-app.alternatefutures.ai` |
| `N8N_WEBHOOK_KEY` | ✅ | sent as `x-cojudge-key` to n8n webhooks |
| `INTERNAL_KEY` | ✅ | n8n sends it as `x-internal-key` to `/api/internal/*` |
| `SESSION_SECRET` | ✅ | ≥ 32 chars; signs the judge cookie (HS256, jose) |
| `JUDGE_PASSCODE_HASH` | ✅ | set with `npm run set-passcode -- judge` |
| `ORGANIZER_PASSCODE_HASH` | ✅ | organizer role (confirm flags, run evidence, shortlist) |
| `FREEZE_AT` | ✅ | `2026-10-17T07:45:00Z` (12:45 PM PKT) |
| `EVENT_ENDS_AT` | ✅ | `2026-10-17T13:00:00Z` (uptime watch stops) |
| `DEPLOY_HOST_PATTERN` | – | defaults to `^[a-z0-9-]+-app\.alternatefutures\.ai$` |

### n8n service (`cojudge-flow`)

| Variable | Value |
|---|---|
| `WEBHOOK_URL` | `https://cojudge-flow-app.alternatefutures.ai` (exact, or Discord approval links break) |
| `N8N_ENCRYPTION_KEY` | 32 random characters, **never change it** |
| `GENERIC_TIMEZONE` | `Asia/Karachi` |

### n8n credentials to create (names must match the workflow JSON)

| Credential name | Type | Value |
|---|---|---|
| `CoJudge Webhook Key` | Header Auth | Name `x-cojudge-key`, Value = `N8N_WEBHOOK_KEY` |
| `CoJudge Internal Key` | Header Auth | Name `x-internal-key`, Value = `INTERNAL_KEY` |
| `Gmail SMTP` | SMTP | host `smtp.gmail.com`, port 465, SSL on, user = Gmail, password = app password |
| `CoJudge Discord Bot` | Discord Bot API | bot token |
| `CoJudge MCP Bearer` | Bearer Auth | your MCP token |

---

## 4. Run locally

No Postgres installed? `npm run db:local` starts an embedded Postgres (PGlite) on port 5433 with data in `./.pgdata` — keep it running in its own terminal and use
`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable`. (Local dev only; production uses the Alternate Clouds Postgres template.) Set `DATABASE_POOL_MAX=4` with it; if you ever see `Connection terminated unexpectedly`, stop and restart `npm run db:local`.

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL and SESSION_SECRET at minimum
npm run db:migrate            # applies drizzle/0000_init.sql
npm run dev                   # http://localhost:3000
```

The database starts empty — there is no mock or seed data. Teams appear when they submit at `/submit`. Judges sign in with any name plus the passcode behind `JUDGE_PASSCODE_HASH` (judge) or `ORGANIZER_PASSCODE_HASH` (organizer); the account is created on first login.

Set your passcodes (typed hidden, never shown or saved in plain text):

```bash
npm run set-passcode -- judge
npm run set-passcode -- organizer
```

Other scripts: `npm test` · `npm run typecheck` · `npm run build` · `npm run db:generate` (after schema changes).

## 5. Deploy on Alternate Clouds (PRD order)

1. **PostgreSQL template** — strong `POSTGRES_PASSWORD`; link to the Next.js service so `DATABASE_URL` is passed in. Avoid redeploying it.
2. **n8n template**, service name `cojudge-flow` — set the n8n variables above, then create the owner account straight away.
3. **Next.js from GitHub**, service name `cojudge`, **PORT 3000** (a mismatch shows 502). Set all variables first → **Rebuild** → **Deploy**. The `Dockerfile` builds the `output: 'standalone'` image.
4. **Migrations** from your laptop: `DATABASE_URL=… npm run db:migrate`.
5. **n8n**: Workflows → Import from file → each JSON in [`/n8n`](n8n). In every HTTP node, replace `https://cojudge-app.alternatefutures.ai` if your app URL differs; in WF1/WF2/WF5 set your Gmail in *From*; in WF3 set the Discord server + `#organizers` channel IDs. Attach the credentials, then **activate** every workflow (the MCP server returns no tools while inactive). Re-export JSON into `/n8n` after each change.

## 6. Using the MCP server

WF4 exposes `https://cojudge-flow-app.alternatefutures.ai/mcp/cojudge` (exact path shown in the MCP Server Trigger node). Example for Claude Code:

```bash
claude mcp add --transport http cojudge https://cojudge-flow-app.alternatefutures.ai/mcp/cojudge --header "Authorization: Bearer <MCP token>"
```

Then ask: *"Which teams have unresolved flags?"* — tools are read-only and never return AI estimates or contact emails.

---

## 7. Architecture

```
Teams / Judges ──► Next.js (UI + API + check engine) ──► PostgreSQL (Drizzle)
                        │  ▲
     webhooks (x-cojudge-key)   /api/internal/* (x-internal-key)
                        ▼  │
                       n8n ──► SMTP email · Discord #organizers · MCP clients
```

- **Next.js** owns data and all check logic. **n8n** owns everything that waits, runs on a schedule, notifies or asks a human.
- Teams and judges only talk to Next.js. Only n8n sends emails, waits for Discord approvals or answers MCP clients.

### Folder map

```
app/
  page.tsx                         Animated home page (3D hero, sections)
  (public)/submit/                 Submission form
  (public)/r/[token]/              Private pre-flight report
  (judge)/login/                   Passcode login
  (judge)/dashboard/               Team list + organizer flag queue
  (judge)/teams/[id]/              Facts, evidence, blind score form, reveal, second look
  (judge)/leaderboard/             Human-only averages, shortlist, CSV
  api/submissions                  POST: upsert, rate-limit, cache, run checks, flags, alert
  api/submissions/[token]/report   GET report JSON
  api/auth/login|logout            Session cookie
  api/teams, api/teams/[id]        Judge data (estimate withheld until scored)
  api/teams/[id]/evidence          Organizer: run AI agent
  api/teams/[id]/shortlist         Organizer: top-10 toggle
  api/scores, api/scores/[id]/reason   Save score → estimate + gap; second-look reason
  api/flags/[id]                   Organizer Confirm/Dismiss from dashboard
  api/checks/[id]/verify           Judge ticks off a human_check
  api/leaderboard                  Human averages (?format=csv)
  api/internal/uptime-sweep        n8n WF2
  api/internal/flag-decision       n8n WF3
  api/internal/notifications       n8n logs email delivery
  api/internal/deadline-reminder   n8n WF5
  api/internal/mcp/[tool]          n8n WF4 tools
lib/checks/*                       url (SSRF guard), deployment, github, secrets, video, injection
lib/ai/evidence.ts                 Groq agent, Zod schema, sanitize, post-process
lib/alerts.ts                      Email bodies, cooldown/cap/dedupe, flag opening
lib/db/schema.ts                   11 tables (Drizzle)  ·  drizzle/ = SQL migrations
lib/auth.ts, lib/session.ts        Cookie session (jose), role + internal-key guards
middleware.ts                      Redirects unauthenticated judge pages to /login
n8n/                               WF1–WF5 workflow exports
tests/checks.test.ts               Unit tests for checks, gap rule, auth, post-processing
```

### Data model

The PRD's 11 tables, plus a few columns the features needed: `teams.shortlisted`, `submissions.description`, `checks.verified_by/verified_at` (human-check ticks), `evidence.red_flags`, `scores.notes`, `flags.created_at`, `notifications.issue_key/subject`, `judges.role`, `audit_log.meta`.

## 8. How the key rules are enforced

- **Blind-first scoring** — `getTeamDetail()` only includes `estimate` when a `scores` row exists for *this* judge; the evidence API never returns it. The UI reveals it only from the `POST /api/scores` response.
- **Gap rule** — total gap ≥ 15, or any criterion gap ≥ 40 % of its weight → `second_look` + one-line reason (saved as calibration notes for later prompts).
- **Flags** — every flag starts `open`; only an organizer (Discord via n8n, or dashboard) changes it; `decided_by`/`decided_at` + `audit_log`.
- **Alerts** — factual alerts go out automatically; only checks that *newly* moved to `fail` are emailed; 30-min cooldown per team for check-failed emails; max 10 per team per day; every email is a `notifications` row. "Down" = 2 consecutive failures.
- **SSRF** — deployment URLs must be https, no credentials/port, host matches the allowlist; fetch uses `redirect: manual`, 10 s timeout, 1 MB cap. Anything else is never fetched (→ human check).
- **Secrets** — regex scan runs before any LLM call; only masked value + file:line is stored; LLM input is passed through `redactSecrets` + email/phone scrubbing.
- **Prompt injection** — submission content is wrapped in `<untrusted_submission>`, the agent has no tools, citations not in the repo tree are dropped, estimates are clamped and never rank teams.
- **Abuse** — 5 pre-flight runs per team per hour; identical resubmissions within 10 min reuse cached results; the LLM only runs on organizer click.

## 9. Design system

Generated with the **ui-ux-pro-max** skill (`--design-system`, glassmorphism, Inter, motion 6/density 6) and adapted to a professional dark palette:

| Token | Value | Use |
|---|---|---|
| `--bg` | `#080c16` | Deep navy page background |
| `--primary` / `--primary-soft` | `#2f5fc4` / `#7fa2e3` | Muted steel blue — buttons / text and icons on dark |
| `--accent` | `#4fb3aa` | Soft teal — highlights, AI elements |
| `--success / --warning / --danger / --info` | `#45b383 / #d9a441 / #e07070 / #8aa4cf` | pass / warn / fail / human check (always with icon + label) |
| Glass | `glass`, `glass-strong` utilities | Frosted surfaces, 18–24 px blur, 1 px white/9 % border |

- **3D**: `components/home/hero-scene.tsx` — React Three Fiber glass icosahedron core (steel blue, dimmed glow) with three orbit rings of "submissions" (colored by check state), pointer parallax, sparkles and a local Lightformer environment (no external HDR download).
- **21st.dev**: the floating glass pills in the hero are adapted from the 21st.dev *Modern hero section* (HeroGeometric) component, retuned to the CoJudge palette.
- **Motion**: framer-motion fade-ups, staggered reveals, live check-feed animation, count-up metrics, 3D tilt cards; all respect `prefers-reduced-motion` (the 3D scene freezes).
- **Accessibility**: skip link, visible focus rings, labelled inputs with helper/error text, `role="alert"` errors, 44 px+ touch targets, status never conveyed by color alone.

## 10. Data

CoJudge ships with **no mock or demo data**. Every team, check, flag, score and email in the app comes from a real submission or a real judge action. (The unit tests in `tests/` use small inline inputs such as a fake key string to prove the secret scanner masks it; they never touch the database.)

The PRD's demo plan calls for 7 synthetic teams — if you want that for the live demo, submit them through `/submit` with real repos and deployments you control.

## 11. Known gaps / next steps

- Run the full flow against a real Postgres (not possible in the build environment — no database was available).
- Import the n8n JSON and confirm node versions match n8n 2.6.3 (node `typeVersion`s were written by hand; if a node shows a warning, re-select its operation and reattach credentials).
- F11 feedback drafts (WF6) and PDF link extraction are not built.
- `get_team_report` matches team names case-insensitively; names containing `%` or `_` act as SQL wildcards.
