CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_a" text NOT NULL,
	"user_b" text NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "direct_message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "dm_policy" text DEFAULT 'EVERYONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "show_in_vote_matches" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user_a_user_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user_b_user_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message" ADD CONSTRAINT "direct_message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message" ADD CONSTRAINT "direct_message_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_pair" ON "conversation" USING btree ("user_a","user_b");--> statement-breakpoint
CREATE INDEX "conversation_a" ON "conversation" USING btree ("user_a","last_message_at");--> statement-breakpoint
CREATE INDEX "conversation_b" ON "conversation" USING btree ("user_b","last_message_at");--> statement-breakpoint
CREATE INDEX "dm_conversation_created" ON "direct_message" USING btree ("conversation_id","created_at");