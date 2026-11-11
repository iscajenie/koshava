CREATE TABLE "auth_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_attempts_key_idx" ON "auth_attempts" USING btree ("key","created_at");--> statement-breakpoint
ALTER TABLE "auth_attempts" ENABLE ROW LEVEL SECURITY;
