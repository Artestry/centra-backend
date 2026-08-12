import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

const skills = new Hono();

const skillSchema = z.object({
  name: z.string().min(1).max(100),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
  category: z.enum(["TECHNICAL", "SOFT", "LANGUAGE", "TOOL"]),
  yearsExperience: z.number().int().min(0).max(50).default(0),
});

const patchSkillSchema = skillSchema.partial();

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

skills.get("/", async (c) => {
  const user = c.get("user") as { id: string };
  const profileId = await getProfileId(user.id);

  const items = await prisma.skill.findMany({
    where: { profileId },
    orderBy: { name: "asc" },
  });

  return c.json({ data: items });
});

skills.post(
  "/",
  zValidator("json", skillSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const body = c.req.valid("json");
    const profileId = await getProfileId(user.id);

    const item = await prisma.skill.create({
      data: { profileId, ...body },
    });

    return c.json({ data: item }, 201);
  }
);

skills.patch(
  "/:id",
  zValidator("json", patchSkillSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const profileId = await getProfileId(user.id);

    const existing = await prisma.skill.findFirst({
      where: { id, profileId },
    });

    if (!existing) {
      throw new AppError(404, "Skill not found", "NOT_FOUND");
    }

    const updated = await prisma.skill.update({
      where: { id },
      data: body,
    });

    return c.json({ data: updated });
  }
);

skills.delete("/:id", async (c) => {
  const user = c.get("user") as { id: string };
  const id = c.req.param("id");
  const profileId = await getProfileId(user.id);

  const existing = await prisma.skill.findFirst({
    where: { id, profileId },
  });

  if (!existing) {
    throw new AppError(404, "Skill not found", "NOT_FOUND");
  }

  await prisma.skill.delete({ where: { id } });

  return c.json({ success: true });
});

export default skills;
