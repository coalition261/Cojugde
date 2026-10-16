import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const checkStatus = pgEnum("check_status", ["pass", "fail", "warn", "human_check"]);
export const deployStatus = pgEnum("deploy_status", ["up", "down"]);
export const flagStatus = pgEnum("flag_status", ["open", "confirmed", "dismissed"]);
export const judgeRole = pgEnum("judge_role", ["judge", "organizer"]);

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  contactEmail: text("contact_email").notNull(),
  shortlisted: boolean("shortlisted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    repoUrl: text("repo_url").notNull(),
    deployUrl: text("deploy_url").notNull(),
    videoUrl: text("video_url").notNull(),
    workflowUrl: text("workflow_url"),
    description: text("description"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reportToken: text("report_token").notNull().unique(),
  },
  (t) => [uniqueIndex("submissions_team_idx").on(t.teamId)],
);

export const checks = pgTable(
  "checks",
  {
    id: serial("id").primaryKey(),
    submissionId: integer("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    status: checkStatus("status").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    fixTip: text("fix_tip"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    // A judge ticks off human_check items (LinkedIn post, Drive video, ...)
    verifiedBy: text("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [index("checks_submission_idx").on(t.submissionId)],
);

export const deployState = pgTable("deploy_state", {
  submissionId: integer("submission_id")
    .primaryKey()
    .references(() => submissions.id, { onDelete: "cascade" }),
  status: deployStatus("status").notNull().default("up"),
  failCount: integer("fail_count").notNull().default(0),
  lastChangeAt: timestamp("last_change_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CriterionEvidence = {
  key: string;
  evidence: { claim: string; file?: string; line?: number }[];
  risks: string[];
};
export type EstimateMap = Record<string, number>;

export const evidence = pgTable("evidence", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  criteria: jsonb("criteria").$type<CriterionEvidence[]>().notNull(),
  questions: jsonb("questions").$type<string[]>().notNull(),
  redFlags: jsonb("red_flags").$type<string[]>().notNull().default([]),
  // Stored separately and never returned before the judge's own score.
  estimate: jsonb("estimate").$type<EstimateMap>().notNull(),
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scores = pgTable(
  "scores",
  {
    id: serial("id").primaryKey(),
    submissionId: integer("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    judgeId: integer("judge_id")
      .notNull()
      .references(() => judges.id, { onDelete: "cascade" }),
    perCriterion: jsonb("per_criterion").$type<Record<string, number>>().notNull(),
    total: real("total").notNull(),
    notes: text("notes"),
    secondLook: boolean("second_look").notNull().default(false),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("scores_submission_judge_idx").on(t.submissionId, t.judgeId)],
);

export const flags = pgTable(
  "flags",
  {
    id: serial("id").primaryKey(),
    submissionId: integer("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    detail: text("detail").notNull(),
    status: flagStatus("status").notNull().default("open"),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("flags_submission_idx").on(t.submissionId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    channel: text("channel").notNull().default("email"),
    status: text("status").notNull().default("queued"),
    // Dedupe key: one email per issue per state change.
    issueKey: text("issue_key"),
    subject: text("subject"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_team_idx").on(t.teamId)],
);

export const calibrationNotes = pgTable("calibration_notes", {
  id: serial("id").primaryKey(),
  criterion: text("criterion").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const judges = pgTable("judges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  passcodeHash: text("passcode_hash").notNull(),
  role: judgeRole("role").notNull().default("judge"),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    target: text("target").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_action_target_idx").on(t.action, t.target)],
);

export type Team = typeof teams.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Check = typeof checks.$inferSelect;
export type Flag = typeof flags.$inferSelect;
export type Score = typeof scores.$inferSelect;
export type Evidence = typeof evidence.$inferSelect;
export type Judge = typeof judges.$inferSelect;
