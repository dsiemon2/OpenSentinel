CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"token_count" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"filename" text,
	"mime_type" text,
	"file_size" integer,
	"source" text,
	"source_url" text,
	"metadata" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"chunk_count" integer DEFAULT 0,
	"total_tokens" integer DEFAULT 0,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "graph_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb,
	"description" text,
	"attributes" jsonb DEFAULT '{}'::jsonb,
	"importance" integer DEFAULT 50,
	"mention_count" integer DEFAULT 1,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"target_entity_id" uuid NOT NULL,
	"type" text NOT NULL,
	"strength" integer DEFAULT 50,
	"bidirectional" boolean DEFAULT false,
	"context" text,
	"attributes" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_timeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"description" text NOT NULL,
	"performed_by" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_number" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"user_id" uuid,
	"assigned_to" uuid,
	"source" text NOT NULL,
	"source_data" jsonb,
	"impact_assessment" text,
	"containment_actions" jsonb,
	"resolution_notes" text,
	"related_incidents" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"investigated_at" timestamp,
	"contained_at" timestamp,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	CONSTRAINT "security_incidents_incident_number_unique" UNIQUE("incident_number")
);
--> statement-breakpoint
CREATE TABLE "two_factor_auth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"secret_encrypted" text NOT NULL,
	"recovery_codes" jsonb NOT NULL,
	"enabled_at" timestamp NOT NULL,
	"last_verified_at" timestamp,
	"key_version" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "two_factor_auth_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "sequence_number" integer;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "entry_hash" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "previous_hash" text;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "provenance" text;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "encrypted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "encrypted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_entities" ADD CONSTRAINT "graph_entities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_relationships" ADD CONSTRAINT "graph_relationships_source_entity_id_graph_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."graph_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_relationships" ADD CONSTRAINT "graph_relationships_target_entity_id_graph_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."graph_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_timeline" ADD CONSTRAINT "incident_timeline_incident_id_security_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."security_incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_timeline" ADD CONSTRAINT "incident_timeline_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor_auth" ADD CONSTRAINT "two_factor_auth_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_chunks_document_idx" ON "document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "documents_user_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "graph_entities_user_idx" ON "graph_entities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "graph_entities_type_idx" ON "graph_entities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "graph_entities_name_idx" ON "graph_entities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "graph_rel_source_idx" ON "graph_relationships" USING btree ("source_entity_id");--> statement-breakpoint
CREATE INDEX "graph_rel_target_idx" ON "graph_relationships" USING btree ("target_entity_id");--> statement-breakpoint
CREATE INDEX "graph_rel_type_idx" ON "graph_relationships" USING btree ("type");--> statement-breakpoint
CREATE INDEX "incident_timeline_incident_idx" ON "incident_timeline" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "security_incidents_status_idx" ON "security_incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "security_incidents_severity_idx" ON "security_incidents" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "security_incidents_created_idx" ON "security_incidents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "two_factor_auth_user_idx" ON "two_factor_auth" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_sequence_idx" ON "audit_logs" USING btree ("sequence_number");