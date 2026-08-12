import type { Context, Next } from "hono";
import { auth } from "../lib/auth.js";

export async function optionalSessionMiddleware(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (session?.user) {
    c.set("user", session.user);
    c.set("session", session.session);
  }

  await next();
}
