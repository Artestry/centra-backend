import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

const notifications = new Hono();

const readSchema = z.object({
  ids: z.array(z.string()).min(1).optional(),
});

notifications.get("/", async (c) => {
  const user = c.get("user") as { id: string };
  const unreadOnly = c.req.query("unreadOnly") === "true";

  const items = await prisma.notification.findMany({
    where: {
      userId: user.id,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return c.json({ data: items });
});

// PATCH /notifications/read — mark specific or all notifications as read
notifications.patch(
  "/read",
  zValidator("json", readSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const body = c.req.valid("json");

    const where: Record<string, unknown> = {
      userId: user.id,
      readAt: null,
    };

    if (body.ids && body.ids.length > 0) {
      where["id"] = { in: body.ids };
    }

    await prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });

    return c.json({ success: true });
  }
);

export default notifications;
