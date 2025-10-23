import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const lists = pgTable("lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const listColumns = pgTable("list_columns", {
  id: uuid("id").defaultRandom().primaryKey(),
  listId: uuid("list_id")
    .notNull()
    .references(() => lists.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  position: integer("position").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>().default(null),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const listRows = pgTable("list_rows", {
  id: uuid("id").defaultRandom().primaryKey(),
  listId: uuid("list_id")
    .notNull()
    .references(() => lists.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const listCells = pgTable(
  "list_cells",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rowId: uuid("row_id")
      .notNull()
      .references(() => listRows.id, { onDelete: "cascade" }),
    columnId: uuid("column_id")
      .notNull()
      .references(() => listColumns.id, { onDelete: "cascade" }),
    rawValue: text("raw_value"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    rowColumnUnique: uniqueIndex("list_cells_row_column_idx").on(
      table.rowId,
      table.columnId
    ),
  })
);

export const listsRelations = relations(lists, ({ many }) => ({
  columns: many(listColumns),
  rows: many(listRows),
}));

export const listColumnsRelations = relations(listColumns, ({ one, many }) => ({
  list: one(lists, {
    fields: [listColumns.listId],
    references: [lists.id],
  }),
  cells: many(listCells),
}));

export const listRowsRelations = relations(listRows, ({ one, many }) => ({
  list: one(lists, {
    fields: [listRows.listId],
    references: [lists.id],
  }),
  cells: many(listCells),
}));

export const listCellsRelations = relations(listCells, ({ one }) => ({
  row: one(listRows, {
    fields: [listCells.rowId],
    references: [listRows.id],
  }),
  column: one(listColumns, {
    fields: [listCells.columnId],
    references: [listColumns.id],
  }),
}));
