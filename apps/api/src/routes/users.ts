import { Router } from "express";
import { z } from "zod";
import { listUserActivities } from "../storage/postgres.js";
import { badRequest, serverError } from "../utils/response.js";

export const usersRouter = Router();

const statusSchema = z.enum(["all", "to_attend", "to_review", "completed"]).default("all");

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
