import { mkdir, unlink, access } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { env } from "./env.js";
import { AppError } from "./errors.js";

function getStorageRoot(): string {
  return resolve(env.STORAGE_DIR);
}

export function getFilePath(storagePath: string): string {
  return join(getStorageRoot(), storagePath);
}

export async function saveFile(
  userId: string,
  fileId: string,
  originalFilename: string,
  data: Uint8Array | ArrayBuffer
): Promise<string> {
  const ext = extname(originalFilename) || "";
  const relativePath = join(userId, `${fileId}${ext}`);
  const absolutePath = join(getStorageRoot(), relativePath);
  const dir = join(getStorageRoot(), userId);

  await mkdir(dir, { recursive: true });

  const buffer = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  await Bun.write(absolutePath, buffer);

  return relativePath;
}

export async function deleteFile(storagePath: string): Promise<void> {
  const absolutePath = getFilePath(storagePath);
  try {
    await access(absolutePath);
    await unlink(absolutePath);
  } catch {
    // File already gone — treat as success
  }
}

export function validateFileType(mimeType: string): boolean {
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];
  return allowed.includes(mimeType);
}

export async function parseDocument(
  storagePath: string,
  mimeType: string
): Promise<string | null> {
  // TODO: Integrate a document parser (e.g., pdf-parse) to extract text from
  // resumes and cover letters stored at storagePath.
  console.log(`TODO: parse document at ${storagePath} (${mimeType})`);
  return null;
}
