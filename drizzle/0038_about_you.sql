CREATE TABLE "profile_answer" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"device_id" text,
	"question" text NOT NULL,
	"answer" text,
	"status" text NOT NULL,
	"via" text DEFAULT 'card' NOT NULL,
	"at_votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "relationship" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "housing" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "work_status" text;--> statement-breakpoint
ALTER TABLE "profile_answer" ADD CONSTRAINT "profile_answer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_answer_user" ON "profile_answer" USING btree ("user_id","question");--> statement-breakpoint
CREATE INDEX "profile_answer_device" ON "profile_answer" USING btree ("device_id","question");