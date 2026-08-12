import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";

const health = new Hono();

health.get("/", async (c) => {
  let dbStatus: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "error";
  }

  return c.json({
    status: dbStatus === "ok" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
    },
  });
});

export default health;
