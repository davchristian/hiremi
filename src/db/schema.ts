import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const stageEnum = pgEnum("stage", [
  "wishlist",
  "applied",
  "interview",
  "offer",
  "rejected",
]);

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // references auth.users(id) from Supabase
  company: text("company").notNull(),
  role: text("role").notNull(),
  stage: stageEnum("stage").notNull().default("wishlist"),
  appliedDate: timestamp("applied_date", { mode: "date" }),
  link: text("link"),
  notes: text("notes").default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
