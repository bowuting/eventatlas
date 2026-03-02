import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../services/walletAuthService.js";

export function requireWalletAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({ message: "wallet auth required" });
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ message: "wallet auth required" });
  }

  const wallet = verifyAuthToken(token);
  if (!wallet) {
    return res.status(401).json({ message: "invalid or expired auth token" });
  }

  res.locals.authWallet = wallet;
  next();
}

export function getAuthWallet(res: Response) {
  return String(res.locals.authWallet ?? "").toLowerCase();
}
