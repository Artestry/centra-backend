import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { buildDiscoverySections } from "../lib/application-discovery.js";

const applications = new Hono();

const APPLICATION_STATUSES = [
  "SAVED",
  "APPLIED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
] as const;

type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// Valid forward transitions only (backward to SAVED always allowed for correction)
const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  SAVED: ["APPLIED", "REJECTED", "WITHDRAWN"],
  APPLIED: ["INTERVIEW", "REJECTED", "WITHDRAWN"],
  INTERVIEW: ["OFFER", "REJECTED", "WITHDRAWN"],
  OFFER: ["REJECTED", "WITHDRAWN"],
  REJECTED: [],
  WITHDRAWN: [],
};

function isValidTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from].includes(to);
}

const createApplicationSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  locationType: z.enum(["REMOTE", "HYBRID", "ONSITE"]),
  salary: z.number().int().positive().optional(),
  jobUrl: z.string().url().optional(),
  jobDescription: z.string().max(10000).optional(),
  notes: z.string().max(5000).optional(),
  documentId: z.string().optional(),
  matchScore: z.number().int().min(0).max(100).optional(),
});

const patchApplicationSchema = z.object({
  company: z.string().min(1).max(200).optional(),
  role: z.string().min(1).max(200).optional(),
  locationType: z.enum(["REMOTE", "HYBRID", "ONSITE"]).optional(),
  salary: z.number().int().positive().optional(),
  jobUrl: z.string().url().optional(),
  jobDescription: z.string().max(10000).optional(),
  notes: z.string().max(5000).optional(),
  documentId: z.string().optional(),
  matchScore: z.number().int().min(0).max(100).optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
});

const createEventSchema = z.object({
  type: z.enum(["NOTE", "INTERVIEW_SCHEDULED", "DOCUMENT_ATTACHED"]),
  metadata: z.record(z.unknown()).default({}),
});

const queryApplicationsSchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  search: z.string().trim().min(1).optional(),
  locationType: z.enum(["REMOTE", "HYBRID", "ONSITE"]).optional(),
  minSalary: z.coerce.number().int().positive().optional(),
  sort: z.enum(["recent", "salary", "match"]).optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

applications.get("/discovery", async (c) => {
  const user = c.get("user") as { id: string };

  const items = await prisma.application.findMany({
    where: { userId: user.id, deletedAt: null },
    include: {
      events: {
        select: { createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({
    data: buildDiscoverySections(items),
  });
});

applications.get("/", async (c) => {
  const user = c.get("user") as { id: string };
  const parsed = queryApplicationsSchema.safeParse(c.req.query());
  if (!parsed.success) {
    throw new AppError(400, "Invalid application query", "INVALID_QUERY");
  }

  const { status, search, locationType, minSalary, sort, limit } = parsed.data;

  const where: Record<string, unknown> = { userId: user.id, deletedAt: null };
  if (status && APPLICATION_STATUSES.includes(status)) {
    where["status"] = status;
  }
  if (locationType) {
    where["locationType"] = locationType;
  }
  if (typeof minSalary === "number") {
    where["salary"] = { gte: minSalary };
  }
  if (search) {
    where["OR"] = [
      { company: { contains: search } },
      { role: { contains: search } },
      { jobDescription: { contains: search } },
      { notes: { contains: search } },
    ];
  }

  const orderBy =
    sort === "salary"
      ? [{ salary: "desc" as const }, { createdAt: "desc" as const }]
      : sort === "match"
      ? [{ matchScore: "desc" as const }, { createdAt: "desc" as const }]
      : [{ createdAt: "desc" as const }];

  const items = await prisma.application.findMany({
    where,
    orderBy,
    ...(limit ? { take: limit } : {}),
    include: { document: { select: { id: true, filename: true, type: true } } },
  });

  return c.json({ data: items });
});

applications.get("/:id", async (c) => {
  const user = c.get("user") as { id: string };
  const id = c.req.param("id");

  const app = await prisma.application.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      document: { select: { id: true, filename: true, type: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!app) {
    throw new AppError(404, "Application not found", "NOT_FOUND");
  }

  return c.json({ data: app });
});

applications.post(
  "/",
  zValidator("json", createApplicationSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const body = c.req.valid("json");

    if (body.documentId) {
      const doc = await prisma.document.findFirst({
        where: { id: body.documentId, userId: user.id, deletedAt: null },
      });
      if (!doc) {
        throw new AppError(404, "Document not found", "DOCUMENT_NOT_FOUND");
      }
    }

    const app = await prisma.application.create({
      data: { userId: user.id, ...body },
    });

    return c.json({ data: app }, 201);
  }
);

applications.patch(
  "/:id",
  zValidator("json", patchApplicationSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const existing = await prisma.application.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });

    if (!existing) {
      throw new AppError(404, "Application not found", "NOT_FOUND");
    }

    let statusEventType: string | null = null;

    if (body.status && body.status !== existing.status) {
      const from = existing.status as ApplicationStatus;
      const to = body.status;

      if (!isValidTransition(from, to)) {
        throw new AppError(
          422,
          `Cannot transition application from ${from} to ${to}`,
          "INVALID_STATUS_TRANSITION"
        );
      }
      statusEventType = "STATUS_CHANGE";
    }

    const [updated] = await prisma.$transaction([
      prisma.application.update({
        where: { id },
        data: body,
      }),
      ...(statusEventType
        ? [
            prisma.applicationEvent.create({
              data: {
                applicationId: id,
                type: "STATUS_CHANGE",
                metadata: JSON.stringify({
                  from: existing.status,
                  to: body.status,
                }),
              },
            }),
          ]
        : []),
    ]);

    return c.json({ data: updated });
  }
);

applications.delete("/:id", async (c) => {
  const user = c.get("user") as { id: string };
  const id = c.req.param("id");

  const existing = await prisma.application.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });

  if (!existing) {
    throw new AppError(404, "Application not found", "NOT_FOUND");
  }

  await prisma.application.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return c.json({ success: true });
});

applications.post(
  "/:id/events",
  zValidator("json", createEventSchema),
  async (c) => {
    const user = c.get("user") as { id: string };
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const app = await prisma.application.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });

    if (!app) {
      throw new AppError(404, "Application not found", "NOT_FOUND");
    }

    const event = await prisma.applicationEvent.create({
      data: {
        applicationId: id,
        type: body.type,
        metadata: JSON.stringify(body.metadata),
      },
    });

    return c.json({ data: event }, 201);
  }
);

applications.get("/:id/events", async (c) => {
  const user = c.get("user") as { id: string };
  const id = c.req.param("id");

  const app = await prisma.application.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: { id: true },
  });

  if (!app) {
    throw new AppError(404, "Application not found", "NOT_FOUND");
  }

  const events = await prisma.applicationEvent.findMany({
    where: { applicationId: id },
    orderBy: { createdAt: "asc" },
  });

  return c.json({ data: events });
});

export default applications;
