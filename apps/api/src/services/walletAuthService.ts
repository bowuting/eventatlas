import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isAddress } from "ethers";
import { env } from "../config/env.js";

const AUTH_MESSAGE_PREFIX = "EventAtlas Wallet Login";

type WalletAuthMessageInput = {
  wallet: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
};

type AuthTokenPayload = {
  wallet: string;
  iat: number;
  exp: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signJwtPart(unsignedToken: string) {
  return createHmac("sha256", env.AUTH_JWT_SECRET)
    .update(unsignedToken)
    .digest("base64url");
}

export function buildWalletAuthMessage(input: WalletAuthMessageInput) {
  const payload = {
    wallet: input.wallet.toLowerCase(),
    nonce: input.nonce,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt
  };
  return `${AUTH_MESSAGE_PREFIX}\n${JSON.stringify(payload)}`;
}

export function createWalletAuthChallenge(wallet: string) {
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + env.AUTH_CHALLENGE_TTL_SECONDS * 1000).toISOString();
  const message = buildWalletAuthMessage({
    wallet,
    nonce,
    issuedAt,
    expiresAt
  });

  return {
    wallet: wallet.toLowerCase(),
    nonce,
    issuedAt,
    expiresAt,
    message
  };
}

export function createAuthToken(wallet: string) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: AuthTokenPayload = {
    wallet: wallet.toLowerCase(),
    iat: nowSeconds,
    exp: nowSeconds + env.AUTH_JWT_EXPIRES_SECONDS
  };
  const header = { alg: "HS256", typ: "JWT" };
  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerEncoded}.${payloadEncoded}`;
  const signature = signJwtPart(unsignedToken);

  return {
    token: `${unsignedToken}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString()
  };
}

export function verifyAuthToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [headerEncoded, payloadEncoded, signature] = parts;
  const unsignedToken = `${headerEncoded}.${payloadEncoded}`;
  const expectedSignature = signJwtPart(unsignedToken);

  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");
  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as Partial<AuthTokenPayload>;
    if (typeof payload.wallet !== "string" || !isAddress(payload.wallet)) {
      return null;
    }
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload.wallet.toLowerCase();
  } catch {
    return null;
  }
}
