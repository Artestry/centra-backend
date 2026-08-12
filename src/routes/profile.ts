import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const profile = new Hono();

const patchProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).optional(),
  location: z.string().max(200).optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  portfolioUrl: z.string().url().optional().or(z.literal("")),
  headline: z.string().max(200).optional(),
  summary: z.string().max(2000).optional(),
  profilePhotoUrl: z.string().url().optional().or(z.literal("")),
  openToWork: z.boolean().optional(),
  preferredJobTypes: z.array(z.string().min(1).max(100)).max(8).optional(),
  preferredWorkModes: z.array(z.string().min(1).max(100)).max(6).optional(),
  salaryMin: z.number().int().min(0).max(1_000_000).nullable().optional(),
  salaryMax: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

profile.get("/", async (c) => {
  const user = c.get("user") as { id: string };

  const existingProfile = await prisma.profile.findUnique({
    where: { userId: user.id },
    include: {
      workExperiences: { orderBy: { startDate: "desc" } },
      educations: { orderBy: { startDate: "desc" } },
      skills: { orderBy: { name: "asc" } },
    },
  });

  if (existingProfile) {
    return c.json({ data: existingProfile });
  }

  const newProfile = await prisma.profile.create({
    data: { userId: user.id },
    include: {
      workExperiences: true,
      educations: true,
      skills: true,
    },
  });

  return c.json({ data: newProfile }, 201);
});

profile.patch(
  "/",
  zValidator("json", patchProfileSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const body = c.req.valid("json");
    const serializedBody = {
      ...body,
      preferredJobTypes:
        body.preferredJobTypes !== undefined
          ? JSON.stringify(body.preferredJobTypes)
          : undefined,
      preferredWorkModes:
        body.preferredWorkModes !== undefined
          ? JSON.stringify(body.preferredWorkModes)
          : undefined,
    };

    const updated = await prisma.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...serializedBody },
      update: serializedBody,
    });

    return c.json({ data: updated });
  }
);

export default profile;
