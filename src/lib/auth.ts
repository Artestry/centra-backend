import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { prisma } from "./prisma.js";
import { sendOtpEmail } from "./email.js";
import { env } from "./env.js";

/**
 * Better Auth instance for the Centra Path backend.
 *
 * - Persists users / sessions / accounts / verifications via the Prisma adapter
 *   into the SQLite database defined in prisma/schema.prisma.
 * - Uses the emailOTP plugin (6-digit codes, 10-minute expiry) to drive the
 *   sign-in flow. OTPs are delivered via Resend in production, and via stdout
 *   in development when RESEND_API_KEY is missing (see lib/email.ts).
 * - The expo plugin registers the trusted origins (URL schemes) and helpers
 *   needed for cookie/session handling on the React Native client. The mobile
 *   app uses scheme "centrapath" plus the Expo Go "exp://" scheme during dev.
 */
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  // Allow the Expo client's deep-link schemes through Better Auth's
  // origin checks. Add additional schemes here when you ship native builds.
  trustedOrigins:
    env.NODE_ENV === "development"
      ? ["centrapath://", "exp://"]
      : ["centrapath://"],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  plugins: [
    expo(),
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        await sendOtpEmail(email, otp);
      },
      otpLength: 6,
      expiresIn: 600, // 10 minutes
    }),
  ],
});

export type Auth = typeof auth;
