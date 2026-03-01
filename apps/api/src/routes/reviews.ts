import { keccak256, toUtf8Bytes } from "ethers";
import { Router } from "express";
import { z } from "zod";
import { chainService } from "../services/chainService.js";
import {
  createReviewPending,
  getEventWithTickets,
  getReviewByEventAndUser,
  listReviewsByEvent,
  markReviewConfirmed,
  markReviewFailed
} from "../storage/postgres.js";
import { badRequest, serverError } from "../utils/response.js";

export const reviewsRouter = Router();

const createReviewSchema = z.object({
  eventId: z.number().int().positive(),
  userWallet: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  content: z.string().min(1).max(2000),
  media: z.array(z.string().url()).default([])
});

reviewsRouter.get("/events/:id/reviews", async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    if (!Number.isFinite(eventId) || eventId <= 0) {
      return badRequest(res, "invalid event id");
    }

    const items = await listReviewsByEvent(eventId);
    return res.json({ items });
  } catch (error) {
    return serverError(res, error);
  }
});

reviewsRouter.post("/reviews", async (req, res) => {
  try {
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }

    const event = await getEventWithTickets(parsed.data.eventId);
    if (!event) {
      return res.status(404).json({ message: "event not found" });
    }

    const userWallet = parsed.data.userWallet.toLowerCase();

    const existing = await getReviewByEventAndUser(parsed.data.eventId, userWallet);
    if (existing) {
      return res.status(409).json({ message: "review already exists", review: existing });
    }

    const hasAttendance = await chainService.hasAttendanceProof(parsed.data.eventId, userWallet);
    if (!hasAttendance) {
      return res.status(403).json({ message: "attendance proof required" });
    }

    const alreadyRatedOnChain = await chainService.hasRated(parsed.data.eventId, userWallet);
    if (alreadyRatedOnChain) {
      return res.status(409).json({ message: "rating already anchored on chain" });
    }

    const content = parsed.data.content.trim();
    const media = parsed.data.media;
    const reviewHashPayload = JSON.stringify({
      eventId: parsed.data.eventId,
      userWallet,
      rating: parsed.data.rating,
      content,
      media
    });
    const reviewHash = keccak256(toUtf8Bytes(reviewHashPayload));

    const pending = await createReviewPending({
      eventId: parsed.data.eventId,
      userWallet,
      rating: parsed.data.rating,
      content,
      media,
      reviewHash
    });

    try {
      const chain = await chainService.submitRating(
        parsed.data.eventId,
        userWallet,
        parsed.data.rating,
        reviewHash
      );

      const confirmed = await markReviewConfirmed(pending.id, chain.txHash);
      return res.status(201).json({
        review: confirmed,
        chain
      });
    } catch (error) {
      const chainError = error instanceof Error ? error.message : "submit rating failed";
      const failed = await markReviewFailed(pending.id, chainError);

      return res.status(400).json({
        message: chainError,
        review: failed
      });
    }
  } catch (error: unknown) {
    const maybePgError = error as { code?: string };
    if (maybePgError?.code === "23505") {
      return res.status(409).json({ message: "review already exists" });
    }
    return serverError(res, error);
  }
});
