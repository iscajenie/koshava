CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Closed to the Supabase Data API like every other table (see 0001_enable_rls.sql): it holds the bot token.
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
