import { Router } from "express";
import { isAddress } from "ethers";
import { z } from "zod";
import { getUserRecommendations } from "../services/recommendationService.js";
import {
  listAttendanceProofActivitiesByWallet,
  listUserActivities
} from "../storage/postgres.js";
import { badRequest, serverError } from "../utils/response.js";

export const usersRouter = Router();

const statusSchema = z.enum(["all", "to_attend", "to_review", "completed"]).default("all");
const recommendationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8)
});

usersRouter.get("/users/:wallet/activities", async (req, res) => {
  try {
    const wallet = req.params.wallet?.toLowerCase();
    if (!wallet) {
      return badRequest(res, "wallet is required");
    }

    const parsed = statusSchema.safeParse(req.query.status);
    if (!parsed.success) {
      return badRequest(res, "invalid status filter");
    }

    const status = parsed.data === "all" ? undefined : parsed.data;
    const items = await listUserActivities(wallet, status);

    return res.json({
      wallet,
      status: parsed.data,
      items
    });
  } catch (error) {
    return serverError(res, error);
  }
});

usersRouter.get("/users/:wallet/map", async (req, res) => {
  try {
    const wallet = req.params.wallet?.toLowerCase();
    if (!wallet || !isAddress(wallet)) {
      return badRequest(res, "invalid wallet");
    }

    const items = await listAttendanceProofActivitiesByWallet(wallet);
    return res.json({ wallet, items });
  } catch (error) {
    return serverError(res, error);
  }
});

usersRouter.get("/users/:wallet/timeline", async (req, res) => {
  try {
    const wallet = req.params.wallet?.toLowerCase();
    if (!wallet || !isAddress(wallet)) {
      return badRequest(res, "invalid wallet");
    }

    const items = await listAttendanceProofActivitiesByWallet(wallet);
    const sorted = [...items].sort((a, b) => {
      const endDiff = new Date(b.endAt).getTime() - new Date(a.endAt).getTime();
      if (endDiff !== 0) {
        return endDiff;
      }
      return b.eventId - a.eventId;
    });

    return res.json({ wallet, items: sorted });
  } catch (error) {
    return serverError(res, error);
  }
});

usersRouter.get("/users/:wallet/recommendations", async (req, res) => {
  try {
    const wallet = req.params.wallet?.toLowerCase();
    if (!wallet || !isAddress(wallet)) {
      return badRequest(res, "invalid wallet");
    }

    const parsed = recommendationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return badRequest(res, "invalid query");
    }

    const items = await getUserRecommendations(wallet, parsed.data.limit);
    return res.json({
      wallet,
      items
    });
  } catch (error) {
    return serverError(res, error);
  }
});
