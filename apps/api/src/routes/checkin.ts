import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { chainService } from "../services/chainService.js";
import {
  createCheckinNonce,
  getCheckinNonceStatus,
  getCheckinByEventAndUser,
  getEventWithTickets,
  invalidateActiveCheckinNonces,
  markCheckinConfirmed,
  markCheckinFailed,
  upsertCheckinPending,
  consumeCheckinNonce
} from "../storage/postgres.js";
import { badRequest, serverError } from "../utils/response.js";

export const checkinRouter = Router();

const createCodeSchema = z.object({
  eventId: z.number().int().positive(),
  ttlSeconds: z.number().int().min(30).max(120).default(60)
});

const submitCheckinSchema = z.object({
  eventId: z.number().int().positive(),
  nonce: z.string().min(8),
  userWallet: z.string().min(1)
});

const validateCheckinSchema = z.object({
  eventId: z.number().int().positive(),
  nonce: z.string().min(8)
});

checkinRouter.post("/checkin/code", async (req, res) => {
  try {
    const parsed = createCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }

    const event = await getEventWithTickets(parsed.data.eventId);
    if (!event) {
      return res.status(404).json({ message: "event not found" });
    }

    // Keep only one active checkin nonce per event to prevent old QR reuse.
    await invalidateActiveCheckinNonces(parsed.data.eventId);

    const nonce = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + parsed.data.ttlSeconds * 1000).toISOString();

    const code = await createCheckinNonce({
      eventId: parsed.data.eventId,
      nonce,
      expiresAt
    });

    return res.status(201).json({
      eventId: parsed.data.eventId,
      nonce: code.nonce,
      expiresAt: code.expiresAt,
      ttlSeconds: parsed.data.ttlSeconds
    });
  } catch (error) {
    return serverError(res, error);
  }
});

checkinRouter.post("/checkin/validate", async (req, res) => {
  try {
    const parsed = validateCheckinSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }

    const nonce = await getCheckinNonceStatus(parsed.data.eventId, parsed.data.nonce);
    if (!nonce) {
      return res.json({
        valid: false,
        reason: "not_found",
        message: "invalid checkin nonce",
        serverTime: new Date().toISOString()
      });
    }

    if (nonce.usedAt) {
      return res.json({
        valid: false,
        reason: "used",
        message: "checkin nonce already used",
        serverTime: new Date().toISOString(),
        expiresAt: nonce.expiresAt,
        usedAt: nonce.usedAt
      });
    }

    if (new Date(nonce.expiresAt).getTime() < Date.now()) {
      return res.json({
        valid: false,
        reason: "expired",
        message: "checkin nonce expired",
        serverTime: new Date().toISOString(),
        expiresAt: nonce.expiresAt
      });
    }

    return res.json({
      valid: true,
      reason: "ok",
      message: "checkin nonce valid",
      serverTime: new Date().toISOString(),
      expiresAt: nonce.expiresAt
    });
  } catch (error) {
    return serverError(res, error);
  }
});

checkinRouter.post("/checkin", async (req, res) => {
  try {
    const parsed = submitCheckinSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }

    const event = await getEventWithTickets(parsed.data.eventId);
    if (!event) {
      return res.status(404).json({ message: "event not found" });
    }

    const userWallet = parsed.data.userWallet.toLowerCase();

    const existingCheckin = await getCheckinByEventAndUser(parsed.data.eventId, userWallet);
    if (existingCheckin?.status === "confirmed") {
      return res.status(409).json({ message: "already checked in", checkin: existingCheckin });
    }

    const hasTicket = await chainService.hasValidTicket(parsed.data.eventId, userWallet);
    if (!hasTicket) {
      return res.status(403).json({ message: "user does not hold a valid ticket" });
    }

    const hasAttendance = await chainService.hasAttendanceProof(parsed.data.eventId, userWallet);
    if (hasAttendance) {
      return res.status(409).json({ message: "attendance proof already minted for this event" });
    }

    const nonce = await consumeCheckinNonce(parsed.data.eventId, parsed.data.nonce);
    if (!nonce) {
      return res.status(400).json({ message: "invalid or expired checkin nonce" });
    }

    const checkin = await upsertCheckinPending(parsed.data.eventId, userWallet, parsed.data.nonce);

    try {
      const minted = await chainService.mintAttendance(parsed.data.eventId, userWallet);
      const confirmed = await markCheckinConfirmed(checkin.id, minted.txHash, minted.tokenId);

      return res.status(201).json({
        message: "checkin success",
        checkin: confirmed,
        attendance: minted
      });
    } catch (error) {
      const chainError = error instanceof Error ? error.message : "attendance mint failed";
      const failed = await markCheckinFailed(checkin.id, chainError);
      return res.status(400).json({
        message: chainError,
        checkin: failed
      });
    }
  } catch (error) {
    return serverError(res, error);
  }
});
