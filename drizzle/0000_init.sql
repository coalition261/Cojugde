CREATE TYPE "public"."check_status" AS ENUM('pass', 'fail', 'warn', 'human_check');--> statement-breakpoint
CREATE TYPE "public"."deploy_status" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('open', 'confirmed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."judge_role" AS ENUM('judge', 'organizer');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"meta" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calibration_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"criterion" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"kind" text NOT NULL,
	"status" "check_status" NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fix_tip" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_by" text,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deploy_state" (
	"submission_id" integer PRIMARY KEY NOT NULL,
	"status" "deploy_status" DEFAULT 'up' NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"last_change_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"criteria" jsonb NOT NULL,
	"questions" jsonb NOT NULL,
	"red_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimate" jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"kind" text NOT NULL,
	"detail" text NOT NULL,
	"status" "flag_status" DEFAULT 'open' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judges" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"passcode_hash" text NOT NULL,
	"role" "judge_role" DEFAULT 'judge' NOT NULL,
	CONSTRAINT "judges_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"type" text NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"issue_key" text,
	"subject" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"judge_id" integer NOT NULL,
	"per_criterion" jsonb NOT NULL,
	"total" real NOT NULL,
	"notes" text,
	"second_look" boolean DEFAULT false NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"repo_url" text NOT NULL,
	"deploy_url" text NOT NULL,
	"video_url" text NOT NULL,
	"workflow_url" text,
	"description" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"report_token" text NOT NULL,
	CONSTRAINT "submissions_report_token_unique" UNIQUE("report_token")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_email" text NOT NULL,
	"shortlisted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deploy_state" ADD CONSTRAINT "deploy_state_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_judge_id_judges_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_action_target_idx" ON "audit_log" USING btree ("action","target");--> statement-breakpoint
CREATE INDEX "checks_submission_idx" ON "checks" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "flags_submission_idx" ON "flags" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "notifications_team_idx" ON "notifications" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_submission_judge_idx" ON "scores" USING btree ("submission_id","judge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_team_idx" ON "submissions" USING btree ("team_id");