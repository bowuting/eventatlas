import { Router } from "express";
import { z } from "zod";
import { getAuthWallet, requireWalletAuth } from "../middleware/walletAuth.js";
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

organizersRouter.put("/organizer/profile", requireWalletAuth, async (req, res) => {
  try {
    const authWallet = getAuthWallet(res);
    const parsed = upsertProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }
    if (parsed.data.wallet.toLowerCase() !== authWallet) {
      return res.status(403).json({ message: "wallet does not match authenticated wallet" });
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
