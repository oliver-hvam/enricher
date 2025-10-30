import { TransformationConfig } from "@/lib/types/transformation";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm/relations";

export const datasets = pgTable("datasets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const datasetColumns = pgTable(
  "dataset_columns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dataset_id: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    position: integer("position").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown> | null>()
      .default(null),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique().on(t.dataset_id, t.position),
    unique().on(t.dataset_id, t.name),
  ]
);

export const datasetRows = pgTable(
  "dataset_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    row: jsonb("row").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_dataset_rows_dataset_id").on(t.datasetId)]
);

export const transformations = pgTable("transformations", {
  id: uuid("id").primaryKey(),
  columnId: uuid("column_id")
    .references(() => datasetColumns.id)
    .notNull(),
  config: jsonb("config").$type<TransformationConfig>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transformationDependencies = pgTable(
  "transformation_dependencies",
  {
    transformationId: uuid("transformation_id")
      .references(() => transformations.id)
      .notNull(),
    dependsOnColumnId: uuid("depends_on_column_id")
      .references(() => datasetColumns.id)
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.transformationId, t.dependsOnColumnId] })]
);

// One-to-many relation: Transformation has many dependencies
export const transformationRelations = relations(
  transformations,
  ({ many }) => ({
    dependencies: many(transformationDependencies),
  })
);

// One-to-many relation: Columns have many transformations
export const datasetColumnRelations = relations(datasetColumns, ({ many }) => ({
  transformations: many(transformations),
}));
