import { config as loadEnv } from "dotenv";
import { expand } from "dotenv-expand";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envCandidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../.env"),
  resolve(process.cwd(), "../../.env"),
];

for (const filePath of envCandidates) {
  if (existsSync(filePath)) {
    expand(loadEnv({ path: filePath, override: false }));
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Add it to your environment or .env (backend/.env or project-root .env)."
  );
}

const adapter = new PrismaPg({
  connectionString,
});

export const prisma = new PrismaClient({ adapter });