export const REVIEW_AUTH_MESSAGE_PREFIX = "EventAtlas Review Authorization";
export const REVIEW_AUTH_MAX_VALIDITY_MS = 15 * 60 * 1000;
export const REVIEW_AUTH_DEFAULT_VALIDITY_MS = 10 * 60 * 1000;

export type ReviewAuthorizationPayload = {
  eventId: number;
  userWallet: string;
  rating: number;
  content: string;
  media: string[];
  nonce: string;
  issuedAt: string;
  expiresAt: string;
};

export function buildReviewAuthorizationMessage(input: ReviewAuthorizationPayload) {
  const payload: ReviewAuthorizationPayload = {
    eventId: input.eventId,
    userWallet: input.userWallet.toLowerCase(),
    rating: input.rating,
    content: input.content.trim(),
    media: input.media,
    nonce: input.nonce,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt
  };

  return `${REVIEW_AUTH_MESSAGE_PREFIX}\n${JSON.stringify(payload)}`;
}
