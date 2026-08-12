import type { Context, Next } from "hono";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export async function proMiddleware(c: Context, next: Next) {
  const user = c.get("user") as { id: string } | undefined;

  if (!user) {
    throw new AppError(401, "Authentication required", "UNAUTHORIZED");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { subscriptionTier: true, subscriptionExpiresAt: true },
  });

  if (!profile || profile.subscriptionTier !== "PRO") {
    throw new AppError(
      402,
      "This feature requires a Centra Path Pro subscription",
      "PRO_REQUIRED"
    );
  }

  if (
    profile.subscriptionExpiresAt &&
    profile.subscriptionExpiresAt < new Date()
  ) {
    throw new AppError(
      402,
      "Your Centra Path Pro subscription has expired",
      "SUBSCRIPTION_EXPIRED"
    );
  }

  await next();
}
