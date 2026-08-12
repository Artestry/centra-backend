import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./lib/auth.js";
import { handleError } from "./lib/errors.js";
import { env } from "./lib/env.js";
import { sessionMiddleware } from "./middleware/session.js";

import health from "./routes/health.js";
import profile from "./routes/profile.js";
import experience from "./routes/experience.js";
import education from "./routes/education.js";
import skills from "./routes/skills.js";
import documents from "./routes/documents.js";
import applications from "./routes/applications.js";
import reminders from "./routes/reminders.js";
import notifications from "./routes/notifications.js";
import analytics from "./routes/analytics.js";
import aiGuidance from "./routes/ai-guidance.js";
import webhooks from "./routes/webhooks.js";
import devices from "./routes/devices.js";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: env.BETTER_AUTH_URL,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Better Auth handler — mounted at /api/auth (no session middleware here).
// Use app.all with /* (not **) for compatibility with bun 1.2 in the container.
app.all("/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// Public routes (no auth required)
app.route("/api/health", health);

// Webhook endpoints don't use cookie-based session middleware
app.route("/api/webhooks", webhooks);

// Apply session middleware to all /api/* routes EXCEPT /api/auth/**
// In Hono, app.use() runs before matched route handlers for the same path,
// so we must explicitly skip the auth routes to let Better Auth handle them.
app.use("/api/*", async (c, next) => {
  if (c.req.path.startsWith("/api/auth")) return next();
  return sessionMiddleware(c, next);
});
app.route("/api/profile", profile);
app.route("/api/experience", experience);
app.route("/api/education", education);
app.route("/api/skills", skills);
app.route("/api/documents", documents);
app.route("/api/applications", applications);
app.route("/api/reminders", reminders);
app.route("/api/notifications", notifications);
app.route("/api/analytics", analytics);
app.route("/api/ai-guidance", aiGuidance);
app.route("/api/devices", devices);

// Global error handler
app.onError(handleError);

// 404 fallback
app.notFound((c) => {
  return c.json({ error: { message: "Route not found", code: "NOT_FOUND" } }, 404);
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.log(`Centra Path API running on port ${env.PORT}`);
