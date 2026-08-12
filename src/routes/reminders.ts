import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { proMiddleware } from "../middleware/pro.js";

const reminders = new Hono();

const createReminderSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  dueDate: z.coerce.date(),
  isAutomated: z.boolean().default(false),
  applicationId: z.string().optional(),
});

const patchReminderSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  dueDate: z.coerce.date().optional(),
  applicationId: z.string().optional(),
});

reminders.get("/", async (c) => {
  const user = c.get("user") as { id: string };

  const items = await prisma.reminder.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { dueDate: "asc" },
  });

  return c.json({ data: items });
});

reminders.get("/:id", async (c) => {
  const user = c.get("user") as { id: string };
  const id = c.req.param("id");

  const item = await prisma.reminder.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });

  if (!item) {
    throw new AppError(404, "Reminder not found", "NOT_FOUND");
  }

  return c.json({ data: item });
});

reminders.post(
  "/",
  zValidator("json", createReminderSchema),
  async (c, next) => {
    const body = c.req.valid("json");
    if (body.isAutomated) {
      // Pro-gate automated reminders
      return proMiddleware(c, next);
    }
    await next();
  },
  async (c) => {
    const user = c.get("user") as { id: string };
    const body = c.req.valid("json");

    if (body.applicationId) {
      const app = await prisma.application.findFirst({
        where: { id: body.applicationId, userId: user.id, deletedAt: null },
      });
      if (!app) {
        throw new AppError(404, "Application not found", "APP_NOT_FOUND");
      }
    }

    const item = await prisma.reminder.create({
      data: { userId: user.id, ...body },
    });

    return c.json({ data: item }, 201);
  }
);

reminders.patch(
  "/:id",
  zValidator("json", patchReminderSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const existing = await prisma.reminder.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });

    if (!existing) {
      throw new AppError(404, "Reminder not found", "NOT_FOUND");
    }

    const updated = await prisma.reminder.update({
      where: { id },
      data: body,
    });

    return c.json({ data: updated });
  }
);

reminders.post("/:id/complete", async (c) => {
  const user = c.get("user") as { id: string };
  const id = c.req.param("id");

  const existing = await prisma.reminder.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });

  if (!existing) {
    throw new AppError(404, "Reminder not found", "NOT_FOUND");
  }

  if (existing.completedAt) {
    throw new AppError(409, "Reminder is already completed", "ALREADY_COMPLETED");
  }

  const updated = await prisma.reminder.update({
    where: { id },
    data: { completedAt: new Date() },
  });

  return c.json({ data: updated });
});

reminders.delete("/:id", async (c) => {
  const user = c.get("user") as { id: string };
  const id = c.req.param("id");

  const existing = await prisma.reminder.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });

  if (!existing) {
    throw new AppError(404, "Reminder not found", "NOT_FOUND");
  }

  await prisma.reminder.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return c.json({ success: true });
});

export default reminders;
