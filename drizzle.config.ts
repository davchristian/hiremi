import { defineConfig } from "drizzle-kit";
import "dotenv/config";

// `generate` only reads the schema and doesn't need a live connection, so we
// fall back to a placeholder; `migrate`/`push` will fail loudly without a
// real DATABASE_URL, which is the behavior we want.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder",
  },
  strict: true,
  verbose: true,
});
