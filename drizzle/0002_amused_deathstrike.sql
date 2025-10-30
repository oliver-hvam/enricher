CREATE TABLE "transformation_dependencies" (
	"transformation_id" uuid NOT NULL,
	"depends_on_column_id" uuid NOT NULL,
	CONSTRAINT "transformation_dependencies_transformation_id_depends_on_column_id_pk" PRIMARY KEY("transformation_id","depends_on_column_id")
);
--> statement-breakpoint
CREATE TABLE "transformations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"column_id" uuid NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "transformation_dependencies" ADD CONSTRAINT "transformation_dependencies_transformation_id_transformations_id_fk" FOREIGN KEY ("transformation_id") REFERENCES "public"."transformations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transformation_dependencies" ADD CONSTRAINT "transformation_dependencies_depends_on_column_id_dataset_columns_id_fk" FOREIGN KEY ("depends_on_column_id") REFERENCES "public"."dataset_columns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transformations" ADD CONSTRAINT "transformations_column_id_dataset_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."dataset_columns"("id") ON DELETE no action ON UPDATE no action;