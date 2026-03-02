export type TicketType = {
  id: number;
  eventId: number;
  name: string;
  priceWei: string;
  supply: number;
  saleStart: string;
  saleEnd: string;
  transferable: boolean;
  chainStatus: "pending" | "synced" | "failed";
  chainTxHash?: string;
  chainError?: string;
  chainSyncedAt?: string;
};

export type EventItem = {
  id: number;
  organizerWallet: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  address: string;
  lat: number;
  lng: number;
  startAt: string;
  endAt: string;
  capacity: number;
  refundRule: string;
  coverUrl?: string;
  chainStatus: "pending" | "synced" | "failed";
  chainTxHash?: string;
  chainError?: string;
  chainSyncedAt?: string;
  createdAt: string;
  ticketTypes: TicketType[];
  organizer?: {
    wallet: string;
    name?: string;
    logoUrl?: string;
  };
  organizerHistoryRatings?: Array<{
    eventId: number;
    title: string;
    startAt: string;
    endAt: string;
    averageRating?: number;
    reviewCount: number;
  }>;
};

export type OrderItem = {
  id: number;
  eventId: number;
  ticketTypeId: number;
  buyerWallet: string;
  amountWei: string;
  paymentToken: "AVAX" | "USDT" | "USDC";
  txHash?: string;
  tokenId?: string;
  status: "pending" | "confirmed" | "failed";
  refundStatus: "none" | "pending" | "confirmed" | "failed";
  refundTxHash?: string;
  refundError?: string;
  refundedAt?: string;
  createdAt: string;
};

export type MyActivityStatus = "to_attend" | "to_review" | "completed";

export type MyActivityItem = {
  eventId: number;
  title: string;
  category: string;
  coverUrl?: string;
  address: string;
  startAt: string;
  endAt: string;
  confirmedOrderCount: number;
  totalAmountWei: string;
  checkinStatus?: "pending" | "confirmed" | "failed";
  reviewStatus?: "pending" | "confirmed" | "failed";
  status: MyActivityStatus;
};

export type AttendanceProofActivity = {
  eventId: number;
  title: string;
  category: string;
  coverUrl?: string;
  address: string;
  lat: number;
  lng: number;
  startAt: string;
  endAt: string;
};

export type RecommendationItem = {
  eventId: number;
  score: number;
  reasons: string[];
};

export type OrganizerProfile = {
  wallet: string;
  name: string;
  logoUrl: string;
  createdAt: string;
  updatedAt: string;
};
