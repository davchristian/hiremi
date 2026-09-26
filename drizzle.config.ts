import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"], quiet: true });

function sessionPoolerUrl(url: string | undefined): string {
  return url ? url.replace(/:6543\//, ":5432/") : "postgres://placeholder";
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: sessionPoolerUrl(process.env.DATABASE_URL),
  },
  strict: true,
  verbose: true,
});
