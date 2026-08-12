import type { Context, Next } from "hono";
import { auth } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";

export async function sessionMiddleware(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    throw new AppError(401, "Authentication required", "UNAUTHORIZED");
  }

  c.set("user", session.user);
  c.set("session", session.session);

  await next();
}
