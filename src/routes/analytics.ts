import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const analytics = new Hono();

const createEventSchema = z.object({
  eventName: z.string().min(1).max(100),
  metadata: z.record(z.unknown()).optional(),
});

analytics.post(
  "/events",
  zValidator("json", createEventSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const body = c.req.valid("json");

    const event = await prisma.analyticsEvent.create({
      data: {
        userId: user.id,
        eventName: body.eventName,
        metadata: body.metadata ? JSON.stringify(body.metadata) : undefined,
      },
    });

    return c.json({ data: event }, 201);
  }
);

analytics.get("/summary", async (c) => {
  const user = c.get("user") as { id: string };

  const events = await prisma.analyticsEvent.groupBy({
    by: ["eventName"],
    where: { userId: user.id },
    _count: { eventName: true },
    orderBy: { _count: { eventName: "desc" } },
  });

  const summary = events.map((e) => ({
    eventName: e.eventName,
    count: e._count.eventName,
  }));

  return c.json({ data: summary });
});

export default analytics;
