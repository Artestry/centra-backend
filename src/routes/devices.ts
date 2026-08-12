import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

const devices = new Hono();

const registerDeviceSchema = z.object({
  token: z.string().min(10).max(500),
  platform: z.enum(["IOS", "ANDROID"]),
});

// POST /api/devices — register or refresh a device token
devices.post(
  "/",
  zValidator("json", registerDeviceSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const { token, platform } = c.req.valid("json");

    const deviceToken = await prisma.deviceToken.upsert({
      where: { token },
      create: {
        userId: user.id,
        token,
        platform,
        lastSeenAt: new Date(),
      },
      update: {
        userId: user.id,
        platform,
        lastSeenAt: new Date(),
      },
    });

    return c.json({ data: deviceToken }, 201);
  }
);

// DELETE /api/devices/:token — remove a device token
devices.delete("/:token", async (c) => {
  const user = c.get("user") as { id: string };
  const token = c.req.param("token");

  const existing = await prisma.deviceToken.findFirst({
    where: { token, userId: user.id },
  });

  if (!existing) {
    throw new AppError(404, "Device token not found", "NOT_FOUND");
  }

  await prisma.deviceToken.delete({ where: { token } });

  return c.json({ success: true });
});

export default devices;
