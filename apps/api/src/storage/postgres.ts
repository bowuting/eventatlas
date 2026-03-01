import { Pool } from "pg";
import { env } from "../config/env.js";
import type {
  CheckinItem,
  CheckinStatus,
  EventItem,
  OrganizerProfileItem,
  OrderRefundStatus,
  OrderItem,
  OrderStatus,
  ReviewItem,
  ReviewStatus,
  TicketTypeItem,
  UserActivityItem
} from "../types/domain.js";

const pool = new Pool({
  connectionString: env.DATABASE_URL
});

type EventRow = {
  id: string;
  organizer_wallet: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  address: string;
  lat: string | number;
  lng: string | number;
  start_at: Date | string;
  end_at: Date | string;
  capacity: number;
  refund_rule: string;
  cover_url: string | null;
  chain_status: "pending" | "synced" | "failed";
  chain_tx_hash: string | null;
  chain_error: string | null;
  chain_synced_at: Date | string | null;
  created_at: Date | string;
};

type TicketRow = {
  id: string;
  event_id: string;
  name: string;
  price_wei: string;
  supply: number;
  sale_start: Date | string;
  sale_end: Date | string;
  transferable: boolean;
  chain_status: "pending" | "synced" | "failed";
  chain_tx_hash: string | null;
  chain_error: string | null;
  chain_synced_at: Date | string | null;
  created_at: Date | string;
};

type OrderRow = {
  id: string;
  event_id: string;
  ticket_type_id: string;
  buyer_wallet: string;
  amount_wei: string;
  payment_token: "AVAX" | "USDT" | "USDC";
  tx_hash: string | null;
  token_id: string | null;
  status: OrderStatus;
  refund_status: OrderRefundStatus;
  refund_tx_hash: string | null;
  refund_error: string | null;
  refunded_at: Date | string | null;
  created_at: Date | string;
};

type CheckinNonceRow = {
  id: string;
  event_id: string;
  nonce: string;
  expires_at: Date | string;
  used_at: Date | string | null;
  created_at: Date | string;
};

type CheckinRow = {
  id: string;
  event_id: string;
  user_wallet: string;
  nonce: string;
  status: CheckinStatus;
  attendance_tx_hash: string | null;
  attendance_token_id: string | null;
  chain_error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ReviewRow = {
  id: string;
  event_id: string;
  user_wallet: string;
  rating: number;
  content: string;
  media: string[] | null;
  review_hash: string;
  onchain_status: ReviewStatus;
  onchain_tx_hash: string | null;
  onchain_error: string | null;
  onchain_submitted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type EventSettlementStatus = "pending" | "settled" | "failed" | "canceled";

type EventSettlementRow = {
  event_id: string;
  status: EventSettlementStatus;
  tx_hash: string | null;
  error: string | null;
  attempts: number;
  last_attempt_at: Date | string | null;
  settled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type OrganizerProfileRow = {
  wallet: string;
  name: string;
  logo_url: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type UserActivityRow = {
  event_id: string;
  title: string;
  category: string;
  cover_url: string | null;
  address: string;
  start_at: Date | string;
  end_at: Date | string;
  confirmed_order_count: string | number;
  total_amount_wei: string;
  checkin_status: CheckinStatus | null;
  review_status: ReviewStatus | null;
};

function asIso(value: Date | string) {
  return new Date(value).toISOString();
}

function mapEventRow(row: EventRow): EventItem {
  return {
    id: Number(row.id),
    organizerWallet: row.organizer_wallet,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: row.tags ?? [],
    address: row.address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    startAt: asIso(row.start_at),
    endAt: asIso(row.end_at),
    capacity: Number(row.capacity),
    refundRule: row.refund_rule,
    coverUrl: row.cover_url ?? undefined,
    chainStatus: row.chain_status,
    chainTxHash: row.chain_tx_hash ?? undefined,
    chainError: row.chain_error ?? undefined,
    chainSyncedAt: row.chain_synced_at ? asIso(row.chain_synced_at) : undefined,
    createdAt: asIso(row.created_at)
  };
}

function mapTicketRow(row: TicketRow): TicketTypeItem {
  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    name: row.name,
    priceWei: row.price_wei,
    supply: Number(row.supply),
    saleStart: asIso(row.sale_start),
    saleEnd: asIso(row.sale_end),
    transferable: row.transferable,
    chainStatus: row.chain_status,
    chainTxHash: row.chain_tx_hash ?? undefined,
    chainError: row.chain_error ?? undefined,
    chainSyncedAt: row.chain_synced_at ? asIso(row.chain_synced_at) : undefined,
    createdAt: asIso(row.created_at)
  };
}

function mapOrderRow(row: OrderRow): OrderItem {
  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    ticketTypeId: Number(row.ticket_type_id),
    buyerWallet: row.buyer_wallet,
    amountWei: row.amount_wei,
    paymentToken: row.payment_token,
    txHash: row.tx_hash ?? undefined,
    tokenId: row.token_id ?? undefined,
    status: row.status,
    refundStatus: row.refund_status,
    refundTxHash: row.refund_tx_hash ?? undefined,
    refundError: row.refund_error ?? undefined,
    refundedAt: row.refunded_at ? asIso(row.refunded_at) : undefined,
    createdAt: asIso(row.created_at)
  };
}

function mapCheckinRow(row: CheckinRow): CheckinItem {
  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    userWallet: row.user_wallet,
    nonce: row.nonce,
    status: row.status,
    attendanceTxHash: row.attendance_tx_hash ?? undefined,
    attendanceTokenId: row.attendance_token_id ?? undefined,
    chainError: row.chain_error ?? undefined,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at)
  };
}

function mapReviewRow(row: ReviewRow): ReviewItem {
  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    userWallet: row.user_wallet,
    rating: Number(row.rating),
    content: row.content,
    media: row.media ?? [],
    reviewHash: row.review_hash,
    onchainStatus: row.onchain_status,
    onchainTxHash: row.onchain_tx_hash ?? undefined,
    onchainError: row.onchain_error ?? undefined,
    onchainSubmittedAt: row.onchain_submitted_at ? asIso(row.onchain_submitted_at) : undefined,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at)
  };
}

function mapOrganizerProfileRow(row: OrganizerProfileRow): OrganizerProfileItem {
  return {
    wallet: row.wallet,
    name: row.name,
    logoUrl: row.logo_url,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at)
  };
}

function mapUserActivityRow(row: UserActivityRow): UserActivityItem {
  const checkinStatus = row.checkin_status ?? undefined;
  const reviewStatus = row.review_status ?? undefined;

  let status: UserActivityItem["status"] = "to_attend";
  if (checkinStatus === "confirmed") {
    status = reviewStatus ? "completed" : "to_review";
  }

  return {
    eventId: Number(row.event_id),
    title: row.title,
    category: row.category,
    coverUrl: row.cover_url ?? undefined,
    address: row.address,
    startAt: asIso(row.start_at),
    endAt: asIso(row.end_at),
    confirmedOrderCount: Number(row.confirmed_order_count),
    totalAmountWei: row.total_amount_wei,
    checkinStatus,
    reviewStatus,
    status
  };
}

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id BIGINT GENERATED BY DEFAULT AS IDENTITY (START WITH 1001) PRIMARY KEY,
      organizer_wallet TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      address TEXT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      capacity INTEGER NOT NULL,
      refund_rule TEXT NOT NULL,
      cover_url TEXT,
      chain_status TEXT NOT NULL DEFAULT 'pending',
      chain_tx_hash TEXT,
      chain_error TEXT,
      chain_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_types (
      id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price_wei TEXT NOT NULL,
      supply INTEGER NOT NULL,
      sale_start TIMESTAMPTZ NOT NULL,
      sale_end TIMESTAMPTZ NOT NULL,
      transferable BOOLEAN NOT NULL DEFAULT FALSE,
      chain_status TEXT NOT NULL DEFAULT 'pending',
      chain_tx_hash TEXT,
      chain_error TEXT,
      chain_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
      ticket_type_id BIGINT NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
      buyer_wallet TEXT NOT NULL,
      amount_wei TEXT NOT NULL,
      payment_token TEXT NOT NULL CHECK (payment_token IN ('AVAX', 'USDT', 'USDC')) DEFAULT 'AVAX',
      tx_hash TEXT,
      token_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
      refund_status TEXT NOT NULL CHECK (refund_status IN ('none', 'pending', 'confirmed', 'failed')) DEFAULT 'none',
      refund_tx_hash TEXT,
      refund_error TEXT,
      refunded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkin_nonces (
      id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      nonce TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkins (
      id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_wallet TEXT NOT NULL,
      nonce TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
      attendance_tx_hash TEXT,
      attendance_token_id TEXT,
      chain_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (event_id, user_wallet)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_wallet TEXT NOT NULL,
      rating SMALLINT NOT NULL,
      content TEXT NOT NULL,
      media TEXT[] NOT NULL DEFAULT '{}',
      review_hash TEXT NOT NULL,
      onchain_status TEXT NOT NULL CHECK (onchain_status IN ('pending', 'confirmed', 'failed')),
      onchain_tx_hash TEXT,
      onchain_error TEXT,
      onchain_submitted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (event_id, user_wallet)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizer_profiles (
      wallet TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_settlements (
      event_id BIGINT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'settled', 'failed', 'canceled')) DEFAULT 'pending',
      tx_hash TEXT,
      error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TIMESTAMPTZ,
      settled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_ticket_types_event_id ON ticket_types(event_id);");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_orders_buyer_wallet ON orders(buyer_wallet);");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_checkin_nonces_event_id ON checkin_nonces(event_id);");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_checkins_event_id ON checkins(event_id);");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_checkins_user_wallet ON checkins(user_wallet);");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_reviews_event_id ON reviews(event_id);");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_reviews_user_wallet ON reviews(user_wallet);");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_organizer_profiles_wallet ON organizer_profiles(wallet);");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_event_settlements_status ON event_settlements(status);");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_event_settlements_last_attempt_at ON event_settlements(last_attempt_at);");

  // Backward-compatible schema upgrades for existing databases.
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS chain_status TEXT NOT NULL DEFAULT 'pending';");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS chain_tx_hash TEXT;");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS chain_error TEXT;");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS chain_synced_at TIMESTAMPTZ;");

  await pool.query("ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS chain_status TEXT NOT NULL DEFAULT 'pending';");
  await pool.query("ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS chain_tx_hash TEXT;");
  await pool.query("ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS chain_error TEXT;");
  await pool.query("ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS chain_synced_at TIMESTAMPTZ;");
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_token TEXT;");
  await pool.query("UPDATE orders SET payment_token = 'AVAX' WHERE payment_token IS NULL;");
  await pool.query("ALTER TABLE orders ALTER COLUMN payment_token SET DEFAULT 'AVAX';");
  await pool.query("ALTER TABLE orders ALTER COLUMN payment_token SET NOT NULL;");
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status TEXT;");
  await pool.query("UPDATE orders SET refund_status = 'none' WHERE refund_status IS NULL;");
  await pool.query("ALTER TABLE orders ALTER COLUMN refund_status SET DEFAULT 'none';");
  await pool.query("ALTER TABLE orders ALTER COLUMN refund_status SET NOT NULL;");
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_tx_hash TEXT;");
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_error TEXT;");
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;");
}

export async function listEventsWithTickets() {
  const eventResult = await pool.query<EventRow>(
    `SELECT * FROM events ORDER BY start_at DESC, id DESC`
  );

  const ticketResult = await pool.query<TicketRow>(
    `SELECT * FROM ticket_types ORDER BY event_id DESC, id ASC`
  );

  const ticketsByEventId = new Map<number, TicketTypeItem[]>();
  for (const row of ticketResult.rows) {
    const item = mapTicketRow(row);
    const list = ticketsByEventId.get(item.eventId) ?? [];
    list.push(item);
    ticketsByEventId.set(item.eventId, list);
  }

  return eventResult.rows.map((row) => {
    const event = mapEventRow(row);
    return {
      ...event,
      ticketTypes: ticketsByEventId.get(event.id) ?? []
    };
  });
}

export async function getEventWithTickets(eventId: number) {
  const eventResult = await pool.query<EventRow>(
    `SELECT * FROM events WHERE id = $1`,
    [eventId]
  );

  if (eventResult.rowCount === 0) {
    return null;
  }

  const ticketResult = await pool.query<TicketRow>(
    `SELECT * FROM ticket_types WHERE event_id = $1 ORDER BY id ASC`,
    [eventId]
  );

  return {
    ...mapEventRow(eventResult.rows[0]),
    ticketTypes: ticketResult.rows.map(mapTicketRow)
  };
}

export async function createEvent(input: {
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
}) {
  const result = await pool.query<EventRow>(
    `
      INSERT INTO events (
        organizer_wallet, title, description, category, tags,
        address, lat, lng, start_at, end_at,
        capacity, refund_rule, cover_url
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13
      )
      RETURNING *
    `,
    [
      input.organizerWallet,
      input.title,
      input.description,
      input.category,
      input.tags,
      input.address,
      input.lat,
      input.lng,
      input.startAt,
      input.endAt,
      input.capacity,
      input.refundRule,
      input.coverUrl ?? null
    ]
  );

  return mapEventRow(result.rows[0]);
}

export async function createTicketType(input: {
  eventId: number;
  name: string;
  priceWei: string;
  supply: number;
  saleStart: string;
  saleEnd: string;
  transferable: boolean;
}) {
  const result = await pool.query<TicketRow>(
    `
      INSERT INTO ticket_types (
        event_id, name, price_wei, supply,
        sale_start, sale_end, transferable
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7
      )
      RETURNING *
    `,
    [
      input.eventId,
      input.name,
      input.priceWei,
      input.supply,
      input.saleStart,
      input.saleEnd,
      input.transferable
    ]
  );

  return mapTicketRow(result.rows[0]);
}

export async function markEventChainSynced(eventId: number, txHash: string) {
  const result = await pool.query<EventRow>(
    `
      UPDATE events
      SET
        chain_status = 'synced',
        chain_tx_hash = $2,
        chain_error = NULL,
        chain_synced_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [eventId, txHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapEventRow(result.rows[0]);
}

export async function markEventChainFailed(eventId: number, chainError: string) {
  const result = await pool.query<EventRow>(
    `
      UPDATE events
      SET
        chain_status = 'failed',
        chain_error = $2
      WHERE id = $1
      RETURNING *
    `,
    [eventId, chainError]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapEventRow(result.rows[0]);
}

export async function markTicketChainSynced(ticketTypeId: number, txHash: string) {
  const result = await pool.query<TicketRow>(
    `
      UPDATE ticket_types
      SET
        chain_status = 'synced',
        chain_tx_hash = $2,
        chain_error = NULL,
        chain_synced_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [ticketTypeId, txHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapTicketRow(result.rows[0]);
}

export async function markTicketChainFailed(ticketTypeId: number, chainError: string) {
  const result = await pool.query<TicketRow>(
    `
      UPDATE ticket_types
      SET
        chain_status = 'failed',
        chain_error = $2
      WHERE id = $1
      RETURNING *
    `,
    [ticketTypeId, chainError]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapTicketRow(result.rows[0]);
}

export async function getTicketType(eventId: number, ticketTypeId: number) {
  const result = await pool.query<TicketRow>(
    `SELECT * FROM ticket_types WHERE id = $1 AND event_id = $2`,
    [ticketTypeId, eventId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapTicketRow(result.rows[0]);
}

export async function createOrder(input: {
  eventId: number;
  ticketTypeId: number;
  buyerWallet: string;
  amountWei: string;
  paymentToken: "AVAX" | "USDT" | "USDC";
}) {
  const result = await pool.query<OrderRow>(
    `
      INSERT INTO orders (
        event_id, ticket_type_id, buyer_wallet, amount_wei, payment_token, status
      ) VALUES (
        $1, $2, $3, $4, $5, 'pending'
      )
      RETURNING *
    `,
    [input.eventId, input.ticketTypeId, input.buyerWallet, input.amountWei, input.paymentToken]
  );

  return mapOrderRow(result.rows[0]);
}

export async function getOrderById(orderId: number) {
  const result = await pool.query<OrderRow>(
    `SELECT * FROM orders WHERE id = $1`,
    [orderId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapOrderRow(result.rows[0]);
}

export async function listConfirmedOrdersByBuyerAndEvent(eventId: number, buyerWallet: string) {
  const result = await pool.query<OrderRow>(
    `
      SELECT *
      FROM orders
      WHERE event_id = $1
        AND buyer_wallet = $2
        AND status = 'confirmed'
        AND token_id IS NOT NULL
      ORDER BY id DESC
    `,
    [eventId, buyerWallet]
  );

  return result.rows.map(mapOrderRow);
}

export async function markOrderRefundPending(orderId: number) {
  const result = await pool.query<OrderRow>(
    `
      UPDATE orders
      SET
        refund_status = 'pending',
        refund_error = NULL
      WHERE id = $1
      RETURNING *
    `,
    [orderId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapOrderRow(result.rows[0]);
}

export async function markOrderRefundConfirmed(orderId: number, refundTxHash: string) {
  const result = await pool.query<OrderRow>(
    `
      UPDATE orders
      SET
        refund_status = 'confirmed',
        refund_tx_hash = $2,
        refund_error = NULL,
        refunded_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [orderId, refundTxHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapOrderRow(result.rows[0]);
}

export async function markOrderRefundFailed(orderId: number, refundTxHash: string, refundError: string) {
  const result = await pool.query<OrderRow>(
    `
      UPDATE orders
      SET
        refund_status = 'failed',
        refund_tx_hash = $2,
        refund_error = $3
      WHERE id = $1
      RETURNING *
    `,
    [orderId, refundTxHash, refundError]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapOrderRow(result.rows[0]);
}

export async function markOrderConfirmed(orderId: number, txHash: string, tokenId: string) {
  const result = await pool.query<OrderRow>(
    `
      UPDATE orders
      SET status = 'confirmed', tx_hash = $2, token_id = $3
      WHERE id = $1
      RETURNING *
    `,
    [orderId, txHash, tokenId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapOrderRow(result.rows[0]);
}

export async function markOrderFailed(orderId: number, txHash: string) {
  const result = await pool.query<OrderRow>(
    `
      UPDATE orders
      SET status = 'failed', tx_hash = $2
      WHERE id = $1
      RETURNING *
    `,
    [orderId, txHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapOrderRow(result.rows[0]);
}

export async function createCheckinNonce(input: {
  eventId: number;
  nonce: string;
  expiresAt: string;
}) {
  const result = await pool.query<CheckinNonceRow>(
    `
      INSERT INTO checkin_nonces (event_id, nonce, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [input.eventId, input.nonce, input.expiresAt]
  );

  const row = result.rows[0];
  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    nonce: row.nonce,
    expiresAt: asIso(row.expires_at),
    usedAt: row.used_at ? asIso(row.used_at) : undefined,
    createdAt: asIso(row.created_at)
  };
}

export async function consumeCheckinNonce(eventId: number, nonce: string) {
  const result = await pool.query<CheckinNonceRow>(
    `
      UPDATE checkin_nonces
      SET used_at = NOW()
      WHERE event_id = $1
        AND nonce = $2
        AND used_at IS NULL
        AND expires_at >= NOW()
      RETURNING *
    `,
    [eventId, nonce]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    nonce: row.nonce,
    expiresAt: asIso(row.expires_at),
    usedAt: row.used_at ? asIso(row.used_at) : undefined,
    createdAt: asIso(row.created_at)
  };
}

export async function getCheckinNonceStatus(eventId: number, nonce: string) {
  const result = await pool.query<CheckinNonceRow>(
    `
      SELECT * FROM checkin_nonces
      WHERE event_id = $1 AND nonce = $2
      LIMIT 1
    `,
    [eventId, nonce]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    nonce: row.nonce,
    expiresAt: asIso(row.expires_at),
    usedAt: row.used_at ? asIso(row.used_at) : undefined,
    createdAt: asIso(row.created_at)
  };
}

export async function invalidateActiveCheckinNonces(eventId: number) {
  await pool.query(
    `
      UPDATE checkin_nonces
      SET used_at = NOW()
      WHERE event_id = $1
        AND used_at IS NULL
    `,
    [eventId]
  );
}

export async function getCheckinByEventAndUser(eventId: number, userWallet: string) {
  const result = await pool.query<CheckinRow>(
    `SELECT * FROM checkins WHERE event_id = $1 AND user_wallet = $2`,
    [eventId, userWallet]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapCheckinRow(result.rows[0]);
}

export async function upsertCheckinPending(eventId: number, userWallet: string, nonce: string) {
  const result = await pool.query<CheckinRow>(
    `
      INSERT INTO checkins (
        event_id, user_wallet, nonce, status
      ) VALUES (
        $1, $2, $3, 'pending'
      )
      ON CONFLICT (event_id, user_wallet)
      DO UPDATE SET
        nonce = EXCLUDED.nonce,
        status = 'pending',
        chain_error = NULL,
        updated_at = NOW()
      RETURNING *
    `,
    [eventId, userWallet, nonce]
  );

  return mapCheckinRow(result.rows[0]);
}

export async function markCheckinConfirmed(checkinId: number, txHash: string, tokenId: string) {
  const result = await pool.query<CheckinRow>(
    `
      UPDATE checkins
      SET
        status = 'confirmed',
        attendance_tx_hash = $2,
        attendance_token_id = $3,
        chain_error = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [checkinId, txHash, tokenId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapCheckinRow(result.rows[0]);
}

export async function markCheckinFailed(checkinId: number, chainError: string) {
  const result = await pool.query<CheckinRow>(
    `
      UPDATE checkins
      SET
        status = 'failed',
        chain_error = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [checkinId, chainError]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapCheckinRow(result.rows[0]);
}

export async function getReviewByEventAndUser(eventId: number, userWallet: string) {
  const result = await pool.query<ReviewRow>(
    `SELECT * FROM reviews WHERE event_id = $1 AND user_wallet = $2`,
    [eventId, userWallet]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapReviewRow(result.rows[0]);
}

export async function listReviewsByEvent(eventId: number) {
  const result = await pool.query<ReviewRow>(
    `SELECT * FROM reviews WHERE event_id = $1 ORDER BY created_at DESC, id DESC`,
    [eventId]
  );

  return result.rows.map(mapReviewRow);
}

export async function createReviewPending(input: {
  eventId: number;
  userWallet: string;
  rating: number;
  content: string;
  media: string[];
  reviewHash: string;
}) {
  const result = await pool.query<ReviewRow>(
    `
      INSERT INTO reviews (
        event_id, user_wallet, rating, content, media,
        review_hash, onchain_status
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, 'pending'
      )
      RETURNING *
    `,
    [
      input.eventId,
      input.userWallet,
      input.rating,
      input.content,
      input.media,
      input.reviewHash
    ]
  );

  return mapReviewRow(result.rows[0]);
}

export async function markReviewConfirmed(reviewId: number, txHash: string) {
  const result = await pool.query<ReviewRow>(
    `
      UPDATE reviews
      SET
        onchain_status = 'confirmed',
        onchain_tx_hash = $2,
        onchain_error = NULL,
        onchain_submitted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [reviewId, txHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapReviewRow(result.rows[0]);
}

export async function markReviewFailed(reviewId: number, onchainError: string) {
  const result = await pool.query<ReviewRow>(
    `
      UPDATE reviews
      SET
        onchain_status = 'failed',
        onchain_error = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [reviewId, onchainError]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapReviewRow(result.rows[0]);
}

export async function listUserActivities(
  userWallet: string,
  status?: UserActivityItem["status"]
) {
  const result = await pool.query<UserActivityRow>(
    `
      WITH user_orders AS (
        SELECT
          o.event_id,
          COUNT(*)::BIGINT AS confirmed_order_count,
          COALESCE(SUM((o.amount_wei)::NUMERIC), 0)::TEXT AS total_amount_wei
        FROM orders o
        WHERE o.buyer_wallet = $1
          AND o.status = 'confirmed'
          AND COALESCE(o.refund_status, 'none') <> 'confirmed'
        GROUP BY o.event_id
      )
      SELECT
        e.id AS event_id,
        e.title,
        e.category,
        e.cover_url,
        e.address,
        e.start_at,
        e.end_at,
        uo.confirmed_order_count,
        uo.total_amount_wei,
        c.status AS checkin_status,
        r.onchain_status AS review_status
      FROM user_orders uo
      JOIN events e ON e.id = uo.event_id
      LEFT JOIN checkins c
        ON c.event_id = e.id
        AND c.user_wallet = $1
      LEFT JOIN reviews r
        ON r.event_id = e.id
        AND r.user_wallet = $1
      ORDER BY e.start_at DESC, e.id DESC
    `,
    [userWallet]
  );

  const mapped = result.rows.map(mapUserActivityRow);
  if (!status) {
    return mapped;
  }

  return mapped.filter((item) => item.status === status);
}

export async function getOrganizerProfile(wallet: string) {
  const result = await pool.query<OrganizerProfileRow>(
    `SELECT * FROM organizer_profiles WHERE wallet = $1`,
    [wallet]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapOrganizerProfileRow(result.rows[0]);
}

export async function upsertOrganizerProfile(input: {
  wallet: string;
  name: string;
  logoUrl: string;
}) {
  const result = await pool.query<OrganizerProfileRow>(
    `
      INSERT INTO organizer_profiles (wallet, name, logo_url)
      VALUES ($1, $2, $3)
      ON CONFLICT (wallet)
      DO UPDATE SET
        name = EXCLUDED.name,
        logo_url = EXCLUDED.logo_url,
        updated_at = NOW()
      RETURNING *
    `,
    [input.wallet, input.name, input.logoUrl]
  );

  return mapOrganizerProfileRow(result.rows[0]);
}

export async function listEventsReadyForSettlement(limit = 20) {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const result = await pool.query<{ id: string }>(
    `
      SELECT e.id
      FROM events e
      LEFT JOIN event_settlements s ON s.event_id = e.id
      WHERE e.chain_status = 'synced'
        AND e.end_at <= NOW()
        AND (
          s.event_id IS NULL
          OR s.status IN ('pending', 'failed')
        )
        AND (
          s.last_attempt_at IS NULL
          OR s.last_attempt_at <= NOW() - INTERVAL '1 minute'
        )
      ORDER BY e.end_at ASC, e.id ASC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows.map((row) => Number(row.id));
}

export async function markEventSettlementSettled(eventId: number, txHash?: string) {
  await pool.query<EventSettlementRow>(
    `
      INSERT INTO event_settlements (
        event_id, status, tx_hash, error, attempts, last_attempt_at, settled_at
      ) VALUES (
        $1, 'settled', $2, NULL, 1, NOW(), NOW()
      )
      ON CONFLICT (event_id)
      DO UPDATE SET
        status = 'settled',
        tx_hash = COALESCE(EXCLUDED.tx_hash, event_settlements.tx_hash),
        error = NULL,
        attempts = event_settlements.attempts + 1,
        last_attempt_at = NOW(),
        settled_at = COALESCE(event_settlements.settled_at, NOW()),
        updated_at = NOW()
    `,
    [eventId, txHash ?? null]
  );
}

export async function markEventSettlementCanceled(eventId: number, error?: string) {
  await pool.query<EventSettlementRow>(
    `
      INSERT INTO event_settlements (
        event_id, status, tx_hash, error, attempts, last_attempt_at, settled_at
      ) VALUES (
        $1, 'canceled', NULL, $2, 1, NOW(), NULL
      )
      ON CONFLICT (event_id)
      DO UPDATE SET
        status = 'canceled',
        error = $2,
        attempts = event_settlements.attempts + 1,
        last_attempt_at = NOW(),
        updated_at = NOW()
    `,
    [eventId, error ?? null]
  );
}

export async function markEventSettlementFailed(eventId: number, error: string) {
  await pool.query<EventSettlementRow>(
    `
      INSERT INTO event_settlements (
        event_id, status, tx_hash, error, attempts, last_attempt_at, settled_at
      ) VALUES (
        $1, 'failed', NULL, $2, 1, NOW(), NULL
      )
      ON CONFLICT (event_id)
      DO UPDATE SET
        status = 'failed',
        error = $2,
        attempts = event_settlements.attempts + 1,
        last_attempt_at = NOW(),
        updated_at = NOW()
    `,
    [eventId, error]
  );
}

export async function closeDatabase() {
  await pool.end();
}
