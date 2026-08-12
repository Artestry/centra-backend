import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

const experience = new Hono();

const workExperienceSchema = z.object({
  company: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  current: z.boolean().default(false),
  description: z.string().max(2000).optional(),
  achievements: z.array(z.string().max(500)).default([]),
});

const patchWorkExperienceSchema = workExperienceSchema.partial();

async function getProfileId(userId: string): Promise<string> {
  const prof = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!prof) {
    throw new AppError(404, "Profile not found. Create a profile first.", "PROFILE_NOT_FOUND");
  }
  return prof.id;
}

experience.get("/", async (c) => {
  const user = c.get("user") as { id: string };
  const profileId = await getProfileId(user.id);

  const items = await prisma.workExperience.findMany({
    where: { profileId },
    orderBy: { startDate: "desc" },
  });

  return c.json({ data: items });
});

experience.post(
  "/",
  zValidator("json", workExperienceSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const body = c.req.valid("json");
    const profileId = await getProfileId(user.id);

    const item = await prisma.workExperience.create({
      data: {
        profileId,
        company: body.company,
        title: body.title,
        startDate: body.startDate,
        endDate: body.endDate,
        current: body.current,
        description: body.description,
        achievements: JSON.stringify(body.achievements),
      },
    });

    return c.json({ data: item }, 201);
  }
);

experience.patch(
  "/:id",
  zValidator("json", patchWorkExperienceSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const profileId = await getProfileId(user.id);

    const existing = await prisma.workExperience.findFirst({
      where: { id, profileId },
    });

    if (!existing) {
      throw new AppError(404, "Work experience not found", "NOT_FOUND");
    }

    const updateData: Record<string, unknown> = { ...body };
    if (body.achievements !== undefined) {
      updateData["achievements"] = JSON.stringify(body.achievements);
    }

    const updated = await prisma.workExperience.update({
      where: { id },
      data: updateData,
    });

    return c.json({ data: updated });
  }
);

experience.delete("/:id", async (c) => {
  const user = c.get("user") as { id: string };
  const id = c.req.param("id");
  const profileId = await getProfileId(user.id);

  const existing = await prisma.workExperience.findFirst({
    where: { id, profileId },
  });

  if (!existing) {
    throw new AppError(404, "Work experience not found", "NOT_FOUND");
  }

  await prisma.workExperience.delete({ where: { id } });

  return c.json({ success: true });
});

export default experience;
