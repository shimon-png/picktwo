CREATE TABLE "zip_income" (
	"zip" text PRIMARY KEY NOT NULL,
	"median_income" integer,
	"renter_pct" double precision,
	"year" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "ip_country" text;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "ip_region" text;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "ip_city" text;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "ip_zip" text;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "browser" text;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "in_app" text;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "screen" text;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "tier" text;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "seen_at" timestamp with time zone;