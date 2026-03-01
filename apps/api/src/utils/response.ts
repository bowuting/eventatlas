import type { Response } from "express";

export function badRequest(res: Response, message: string) {
  return res.status(400).json({ message });
}

export function serverError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "unknown error";
  return res.status(500).json({ message });
}
