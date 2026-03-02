import { verifyMessage, isAddress } from "ethers";
import { Router } from "express";
import { z } from "zod";
import { consumeAuthNonce, createAuthNonce } from "../storage/postgres.js";
import {
  buildWalletAuthMessage,
  createAuthToken,
  createWalletAuthChallenge
} from "../services/walletAuthService.js";
import { badRequest, serverError } from "../utils/response.js";

export const authRouter = Router();

const challengeSchema = z.object({
  wallet: z.string().min(1)
});

const verifySchema = z.object({
  wallet: z.string().min(1),
  nonce: z.string().min(8).max(128),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/)
});

authRouter.post("/auth/challenge", async (req, res) => {
  try {
    const parsed = challengeSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }

    const wallet = parsed.data.wallet.toLowerCase();
    if (!isAddress(wallet)) {
      return badRequest(res, "invalid wallet");
    }

    const challenge = createWalletAuthChallenge(wallet);
    await createAuthNonce({
      wallet,
      nonce: challenge.nonce,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt
    });

    return res.json(challenge);
  } catch (error) {
    return serverError(res, error);
  }
});

authRouter.post("/auth/verify", async (req, res) => {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }

    const wallet = parsed.data.wallet.toLowerCase();
    if (!isAddress(wallet)) {
      return badRequest(res, "invalid wallet");
    }

    const nonceRecord = await consumeAuthNonce(wallet, parsed.data.nonce);
    if (!nonceRecord) {
      return res.status(401).json({ message: "invalid or expired nonce" });
    }

    const message = buildWalletAuthMessage({
      wallet,
      nonce: nonceRecord.nonce,
      issuedAt: nonceRecord.issuedAt,
      expiresAt: nonceRecord.expiresAt
    });

    const recoveredWallet = verifyMessage(message, parsed.data.signature).toLowerCase();
    if (recoveredWallet !== wallet) {
      return res.status(401).json({ message: "signature does not match wallet" });
    }

    const auth = createAuthToken(wallet);
    return res.json({
      wallet,
      token: auth.token,
      expiresAt: auth.expiresAt
    });
  } catch (error) {
    return serverError(res, error);
  }
});
