import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { badRequest, serverError } from "../utils/response.js";

export const uploadsRouter = Router();

const uploadImageSchema = z.object({
  dataUrl: z.string().min(30),
  fileName: z.string().min(1).max(200).optional()
});

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const uploadDir = path.resolve(process.cwd(), "uploads");

const mimeToExt: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif"
};

uploadsRouter.post("/uploads/image", async (req, res) => {
  try {
    const parsed = uploadImageSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }

    const match = parsed.data.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      return badRequest(res, "invalid image dataUrl");
    }

    const mime = match[1].toLowerCase();
    const ext = mimeToExt[mime];
    if (!ext) {
      return badRequest(res, "unsupported image type, allow png/jpg/webp/gif");
    }

    const buffer = Buffer.from(match[2], "base64");
    if (buffer.byteLength === 0) {
      return badRequest(res, "empty image content");
    }
    if (buffer.byteLength > MAX_IMAGE_SIZE) {
      return badRequest(res, "image too large, max 5MB");
    }

    await mkdir(uploadDir, { recursive: true });
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);

    const origin = env.API_PUBLIC_BASE_URL ?? `${req.protocol}://${req.get("host")}`;
    const url = `${origin}/uploads/${filename}`;

    return res.status(201).json({
      fileName: parsed.data.fileName,
      mime,
      size: buffer.byteLength,
      url
    });
  } catch (error) {
    return serverError(res, error);
  }
});
