CREATE TABLE "experiment_assignment" (
	"experiment" text NOT NULL,
	"unit_id" text NOT NULL,
	"arm" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experiment_assignment_experiment_unit_id_pk" PRIMARY KEY("experiment","unit_id")
);
--> statement-breakpoint
CREATE INDEX "experiment_assignment_created" ON "experiment_assignment" USING btree ("experiment","created_at");