import { Router } from "express";
import { z } from "zod";
import { getOrganizerProfile, upsertOrganizerProfile } from "../storage/postgres.js";
import { badRequest, serverError } from "../utils/response.js";

export const organizersRouter = Router();

const walletSchema = z.string().trim().min(1);

const upsertProfileSchema = z.object({
  wallet: walletSchema,
  name: z.string().trim().min(1).max(80),
  logoUrl: z.string().url()
});

organizersRouter.get("/organizer/profile/:wallet", async (req, res) => {
  try {
    const parsedWallet = walletSchema.safeParse(req.params.wallet);
    if (!parsedWallet.success) {
      return badRequest(res, "wallet is required");
    }

    const wallet = parsedWallet.data.toLowerCase();
    const profile = await getOrganizerProfile(wallet);
    return res.json({ profile });
  } catch (error) {
    return serverError(res, error);
  }
});

organizersRouter.put("/organizer/profile", async (req, res) => {
  try {
    const parsed = upsertProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }

    const profile = await upsertOrganizerProfile({
      wallet: parsed.data.wallet.toLowerCase(),
      name: parsed.data.name,
      logoUrl: parsed.data.logoUrl
    });

    return res.status(201).json({ profile });
  } catch (error) {
    return serverError(res, error);
  }
});
