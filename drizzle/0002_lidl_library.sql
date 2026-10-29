CREATE TABLE "lidl_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"erp" text NOT NULL,
	"source_url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"width" integer,
	"height" integer,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lidl_library" (
	"erp" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"brand" text,
	"category" text,
	"gtins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"offers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fetched_at" timestamp with time zone,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "lidl_images" ADD CONSTRAINT "lidl_images_erp_lidl_library_erp_fk" FOREIGN KEY ("erp") REFERENCES "public"."lidl_library"("erp") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lidl_images_erp_source_idx" ON "lidl_images" USING btree ("erp","source_url");--> statement-breakpoint
CREATE INDEX "lidl_library_removed_idx" ON "lidl_library" USING btree ("removed_at");
--> statement-breakpoint

ALTER TABLE "lidl_library" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "lidl_images" ENABLE ROW LEVEL SECURITY;
