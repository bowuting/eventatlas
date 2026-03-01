export type ChainSyncStatus = "pending" | "synced" | "failed";

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
  chainStatus: ChainSyncStatus;
  chainTxHash?: string;
  chainError?: string;
  chainSyncedAt?: string;
  createdAt: string;
};

export type TicketTypeItem = {
  id: number;
  eventId: number;
  name: string;
  priceWei: string;
  supply: number;
  saleStart: string;
  saleEnd: string;
  transferable: boolean;
  chainStatus: ChainSyncStatus;
  chainTxHash?: string;
  chainError?: string;
  chainSyncedAt?: string;
  createdAt: string;
};

export type OrderStatus = "pending" | "confirmed" | "failed";
export type CheckinStatus = "pending" | "confirmed" | "failed";
export type ReviewStatus = "pending" | "confirmed" | "failed";
export type PaymentToken = "AVAX" | "USDT" | "USDC";

export type OrderItem = {
  id: number;
  eventId: number;
  ticketTypeId: number;
  buyerWallet: string;
  amountWei: string;
  paymentToken: PaymentToken;
  txHash?: string;
  tokenId?: string;
  status: OrderStatus;
  createdAt: string;
};

export type CheckinItem = {
  id: number;
  eventId: number;
  userWallet: string;
  nonce: string;
  status: CheckinStatus;
  attendanceTxHash?: string;
  attendanceTokenId?: string;
  chainError?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewItem = {
  id: number;
  eventId: number;
  userWallet: string;
  rating: number;
  content: string;
  media: string[];
  reviewHash: string;
  onchainStatus: ReviewStatus;
  onchainTxHash?: string;
  onchainError?: string;
  onchainSubmittedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type MyActivityStatus = "to_attend" | "to_review" | "completed";

export type UserActivityItem = {
  eventId: number;
  title: string;
  category: string;
  coverUrl?: string;
  address: string;
  startAt: string;
  endAt: string;
  confirmedOrderCount: number;
  totalAmountWei: string;
  checkinStatus?: CheckinStatus;
  reviewStatus?: ReviewStatus;
  status: MyActivityStatus;
};

export type OrganizerProfileItem = {
  wallet: string;
  name: string;
  logoUrl: string;
  createdAt: string;
  updatedAt: string;
};
