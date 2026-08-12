import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";

const webhooks = new Hono();

// RevenueCat event types that affect subscription state
const REVENUECAT_ACTIVE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "BILLING_ISSUE_RESOLVED",
]);

const REVENUECAT_INACTIVE_EVENTS = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "SUBSCRIBER_ALIAS",
]);

interface RevenueCatEventPayload {
  event: {
    type: string;
    app_user_id: string;
    original_app_user_id?: string;
    expiration_at_ms?: number;
    purchased_at_ms?: number;
    product_id?: string;
  };
}

async function verifySignature(
  rawBody: string,
  signatureHeader: string | null
): Promise<void> {
  if (!env.REVENUECAT_WEBHOOK_SECRET) {
    if (env.NODE_ENV === "production") {
      throw new AppError(
        500,
        "RevenueCat webhook secret is not configured",
        "WEBHOOK_SECRET_MISSING"
      );
    }

    // In development, allow the webhook to run without a shared secret so the
    // local stack stays easy to exercise.
    console.warn(
      "[webhooks] REVENUECAT_WEBHOOK_SECRET not set; skipping signature verification in development"
    );
    return;
  }

  if (!signatureHeader) {
    throw new AppError(401, "Missing webhook signature", "MISSING_SIGNATURE");
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.REVENUECAT_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody)
  );

  const expectedSig = Buffer.from(signatureBuffer).toString("hex");

  if (expectedSig !== signatureHeader) {
    throw new AppError(401, "Invalid webhook signature", "INVALID_SIGNATURE");
  }
}

webhooks.post("/revenuecat", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("X-RevenueCat-Signature") ?? null;

  await verifySignature(rawBody, signature);

  let payload: RevenueCatEventPayload;
  try {
    payload = JSON.parse(rawBody) as RevenueCatEventPayload;
  } catch {
    throw new AppError(400, "Invalid JSON payload", "INVALID_PAYLOAD");
  }

  const { type, app_user_id, original_app_user_id, expiration_at_ms } =
    payload.event;

  // Find user by RevenueCat user ID stored in profile
  const revenueCatUserId = original_app_user_id ?? app_user_id;

  const profile = await prisma.profile.findFirst({
    where: { revenueCatUserId },
  });

  if (!profile) {
    // RevenueCat may send events before the profile is linked — acknowledge
    // but take no action.
    console.log(`[webhooks/revenuecat] No profile found for revenueCatUserId=${revenueCatUserId}`);
    return c.json({ received: true });
  }

  if (REVENUECAT_ACTIVE_EVENTS.has(type)) {
    const expiresAt = expiration_at_ms
      ? new Date(expiration_at_ms)
      : null;

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        subscriptionTier: "PRO",
        subscriptionExpiresAt: expiresAt,
        revenueCatUserId,
      },
    });
  } else if (REVENUECAT_INACTIVE_EVENTS.has(type)) {
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        subscriptionTier: "FREE",
        subscriptionExpiresAt: null,
      },
    });
  } else {
    console.log(`[webhooks/revenuecat] Unhandled event type: ${type}`);
  }

  return c.json({ received: true });
});

export default webhooks;
