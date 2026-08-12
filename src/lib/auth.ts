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
 * - CSRF is disabled: this is a mobile-only API (React Native does not send
 *   Origin headers like browsers do, so CSRF protection provides no benefit
 *   and blocks legitimate mobile requests).
 */
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  advanced: {
    // Mobile API — React Native clients don't send Origin headers so Better
    // Auth's CSRF check blocks every POST. Safe to disable on a non-browser API.
    disableCSRFCheck: true,
  },
  // Allow the Expo client's deep-link schemes through Better Auth's
  // origin checks. Include both the production scheme and common dev schemes.
  trustedOrigins: [
    env.BETTER_AUTH_URL,   // https://api.centrapath.app
    "centrapath://",       // production iOS/Android deep-link scheme
    "vibecode://",         // Vibecode-built app scheme
    "exp://",              // Expo Go (development)
  ],
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
