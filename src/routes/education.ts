import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

const education = new Hono();

const educationSchema = z.object({
  institution: z.string().min(1).max(200),
  degree: z.string().min(1).max(200),
  field: z.string().min(1).max(200),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  gpa: z.number().min(0).max(5).optional(),
});

const patchEducationSchema = educationSchema.partial();

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

education.get("/", async (c) => {
  const user = c.get("user") as { id: string };
  const profileId = await getProfileId(user.id);

  const items = await prisma.education.findMany({
    where: { profileId },
    orderBy: { startDate: "desc" },
  });

  return c.json({ data: items });
});

education.post(
  "/",
  zValidator("json", educationSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const body = c.req.valid("json");
    const profileId = await getProfileId(user.id);

    const item = await prisma.education.create({
      data: { profileId, ...body },
    });

    return c.json({ data: item }, 201);
  }
);

education.patch(
  "/:id",
  zValidator("json", patchEducationSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const profileId = await getProfileId(user.id);

    const existing = await prisma.education.findFirst({
      where: { id, profileId },
    });

    if (!existing) {
      throw new AppError(404, "Education record not found", "NOT_FOUND");
    }

    const updated = await prisma.education.update({
      where: { id },
      data: body,
    });

    return c.json({ data: updated });
  }
);

education.delete("/:id", async (c) => {
  const user = c.get("user") as { id: string };
  const id = c.req.param("id");
  const profileId = await getProfileId(user.id);

  const existing = await prisma.education.findFirst({
    where: { id, profileId },
  });

  if (!existing) {
    throw new AppError(404, "Education record not found", "NOT_FOUND");
  }

  await prisma.education.delete({ where: { id } });

  return c.json({ success: true });
});

export default education;
