import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Centra Path <onboarding@centrapath.app>"),
  OPENAI_API_KEY: z.string().optional(),
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),
  STORAGE_DIR: z.string().default("./storage"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
