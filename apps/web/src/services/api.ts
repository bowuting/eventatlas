import axios from "axios";
import type {
  EventItem,
  MyActivityItem,
  MyActivityStatus,
  OrderItem,
  OrganizerProfile,
  TicketType
} from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"
});

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

export async function fetchEvents() {
  const { data } = await api.get<{ items: EventItem[] }>("/events");
  return data.items;
}

export async function fetchEventById(eventId: number) {
  const { data } = await api.get<EventItem>(`/events/${eventId}`);
  return data;
}

export type PublishTicketInput = {
  name: string;
  priceWei: string;
  supply: number;
  saleStart: string;
  saleEnd: string;
  transferable: boolean;
};

export async function publishEvent(payload: {
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
  ticketTypes: PublishTicketInput[];
}) {
  const { data } = await api.post<{
    event: EventItem;
    ticketTypes: TicketType[];
    chain: {
      event: { txHash: string; blockNumber?: number } | null;
      eventChainError?: string;
      tickets: Array<{
        ticketTypeId: number;
        chain: { txHash: string; blockNumber?: number } | null;
        chainError?: string;
      }>;
    };
    warnings?: string[];
  }>("/organizer/events/publish", payload);
  return data;
}

export async function createEvent(payload: {
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
}) {
  const { data } = await api.post<{ event: EventItem }>("/organizer/events", payload);
  return data;
}

export async function createTicket(eventId: number, payload: {
  name: string;
  priceWei: string;
  supply: number;
  saleStart: string;
  saleEnd: string;
  transferable: boolean;
}) {
  const { data } = await api.post<{ ticket: TicketType }>(`/organizer/events/${eventId}/tickets`, payload);
  return data;
}

export async function createOrder(payload: {
  eventId: number;
  ticketTypeId: number;
  buyerWallet: string;
  amountWei: string;
  paymentToken: "AVAX" | "USDT" | "USDC";
}) {
  const { data } = await api.post<{ order: OrderItem }>("/orders", payload);
  return data.order;
}

export async function confirmOrder(orderId: number, txHash: string) {
  const { data } = await api.post<{ order: OrderItem }>("/orders/confirm", { orderId, txHash });
  return data.order;
}

export async function confirmOrderRefund(orderId: number, txHash: string) {
  const { data } = await api.post<{ order: OrderItem }>("/orders/refund/confirm", { orderId, txHash });
  return data.order;
}

export async function fetchConfirmedOrdersByEvent(eventId: number, buyerWallet: string) {
  const { data } = await api.get<{ items: OrderItem[] }>("/orders", {
    params: {
      eventId,
      buyerWallet
    }
  });
  return data.items;
}

export async function createCheckinCode(payload: { eventId: number; ttlSeconds: number }) {
  const { data } = await api.post<{ eventId: number; nonce: string; expiresAt: string }>("/checkin/code", payload);
  return data;
}

export async function submitCheckin(payload: { eventId: number; nonce: string; userWallet: string }) {
  const { data } = await api.post<{
    message: string;
    checkin: {
      id: number;
      status: "pending" | "confirmed" | "failed";
      attendanceTxHash?: string;
      attendanceTokenId?: string;
    };
    attendance: {
      txHash: string;
      tokenId: string;
    };
  }>("/checkin", payload);
  return data;
}

export async function validateCheckinCode(payload: { eventId: number; nonce: string }) {
  const { data } = await api.post<{
    valid: boolean;
    reason: "ok" | "not_found" | "used" | "expired";
    message: string;
    expiresAt?: string;
    usedAt?: string;
    serverTime: string;
  }>("/checkin/validate", payload);
  return data;
}

export async function submitReview(payload: {
  eventId: number;
  userWallet: string;
  rating: number;
  content: string;
  media: string[];
}) {
  const { data } = await api.post<{
    review: {
      id: number;
      eventId: number;
      userWallet: string;
      rating: number;
      content: string;
      onchainStatus: "pending" | "confirmed" | "failed";
      onchainTxHash?: string;
      createdAt: string;
    };
    chain: {
      txHash: string;
    };
  }>("/reviews", payload);
  return data;
}

export async function fetchEventReviews(eventId: number) {
  const { data } = await api.get<{ items: unknown[] }>(`/events/${eventId}/reviews`);
  return data.items;
}

export async function fetchMyActivities(wallet: string, status: MyActivityStatus | "all") {
  const { data } = await api.get<{ items: MyActivityItem[] }>(`/users/${wallet}/activities`, {
    params: { status }
  });
  return data.items;
}

export async function fetchOrganizerProfile(wallet: string) {
  const { data } = await api.get<{ profile: OrganizerProfile | null }>(`/organizer/profile/${wallet}`);
  return data.profile;
}

export async function saveOrganizerProfile(payload: {
  wallet: string;
  name: string;
  logoUrl: string;
}) {
  const { data } = await api.put<{ profile: OrganizerProfile }>("/organizer/profile", payload);
  return data.profile;
}

export async function uploadImage(file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  const { data } = await api.post<{ url: string }>("/uploads/image", {
    fileName: file.name,
    dataUrl
  });
  return data.url;
}
