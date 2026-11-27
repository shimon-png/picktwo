CREATE TABLE "pickbot_message" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"role" text NOT NULL,
	"kind" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answer" jsonb,
	"data" jsonb,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" double precision,
	"latency_ms" integer,
	"rating" "thumb",
	"rating_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pickbot_thread" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"classification" jsonb NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"battle_id" text,
	"pick_side" "side",
	"results_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "plus_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "pickbot_message" ADD CONSTRAINT "pickbot_message_thread_id_pickbot_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."pickbot_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickbot_thread" ADD CONSTRAINT "pickbot_thread_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickbot_thread" ADD CONSTRAINT "pickbot_thread_battle_id_battle_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battle"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pickbot_message_thread" ON "pickbot_message" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "pickbot_thread_user" ON "pickbot_thread" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "pickbot_thread_battle" ON "pickbot_thread" USING btree ("battle_id");