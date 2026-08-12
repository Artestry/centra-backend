import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { saveFile, deleteFile, validateFileType, parseDocument } from "../lib/storage.js";

const documents = new Hono();

const DOCUMENT_TYPES = ["RESUME", "COVER_LETTER", "OTHER"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

documents.get("/", async (c) => {
  const user = c.get("user") as { id: string };

  const items = await prisma.document.findMany({
    where: { userId: user.id, isActive: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: items });
});

documents.get("/:id", async (c) => {
  const user = c.get("user") as { id: string };
  const id = c.req.param("id");

  const doc = await prisma.document.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });

  if (!doc) {
    throw new AppError(404, "Document not found", "NOT_FOUND");
  }

  return c.json({ data: doc });
});

documents.post("/", async (c) => {
  const user = c.get("user") as { id: string };

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    throw new AppError(400, "Expected multipart/form-data", "INVALID_CONTENT_TYPE");
  }

  const file = formData.get("file") as File | null;
  const typeRaw = formData.get("type") as string | null;
  const parentDocumentId = formData.get("parentDocumentId") as string | null;

  if (!file) {
    throw new AppError(400, "Missing required field: file", "MISSING_FIELD");
  }
  if (!typeRaw || !DOCUMENT_TYPES.includes(typeRaw as (typeof DOCUMENT_TYPES)[number])) {
    throw new AppError(400, `Field 'type' must be one of: ${DOCUMENT_TYPES.join(", ")}`, "INVALID_TYPE");
  }

  const docType = typeRaw as (typeof DOCUMENT_TYPES)[number];

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError(413, "File exceeds the 10 MB limit", "FILE_TOO_LARGE");
  }

  if (!validateFileType(file.type)) {
    throw new AppError(
      415,
      "Unsupported file type. Allowed: PDF, DOC, DOCX, TXT",
      "UNSUPPORTED_FILE_TYPE"
    );
  }

  if (parentDocumentId) {
    const parent = await prisma.document.findFirst({
      where: { id: parentDocumentId, userId: user.id },
    });
    if (!parent) {
      throw new AppError(404, "Parent document not found", "PARENT_NOT_FOUND");
    }
  }

  const fileId = crypto.randomUUID().replace(/-/g, "");
  const buffer = await file.arrayBuffer();
  const storagePath = await saveFile(user.id, fileId, file.name, buffer);

  const doc = await prisma.document.create({
    data: {
      id: fileId,
      userId: user.id,
      filename: file.name,
      type: docType,
      mimeType: file.type,
      sizeBytes: file.size,
      storagePath,
      parentDocumentId: parentDocumentId ?? undefined,
    },
  });

  // Fire-and-forget parse — does not block response
  parseDocument(storagePath, file.type)
    .then(async (parsedContent) => {
      if (parsedContent) {
        await prisma.document.update({
          where: { id: doc.id },
          data: { parsedContent },
        });
      }
    })
    .catch((err: unknown) => {
      console.error("Document parsing failed:", err);
    });

  return c.json({ data: doc }, 201);
});

documents.delete("/:id", async (c) => {
  const user = c.get("user") as { id: string };
  const id = c.req.param("id");

  const doc = await prisma.document.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });

  if (!doc) {
    throw new AppError(404, "Document not found", "NOT_FOUND");
  }

  await prisma.document.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  // Best-effort physical file removal
  deleteFile(doc.storagePath).catch((err: unknown) => {
    console.error("Failed to delete file from storage:", err);
  });

  return c.json({ success: true });
});

export default documents;
