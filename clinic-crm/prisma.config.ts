// prisma.config.ts
import "dotenv/config";
import path from "path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: env("DIRECT_DATABASE_URL"), // direct (non-pooled) URL for migrations
  },
});