import { Router } from "express";
import { z } from "zod";
import { chainService } from "../services/chainService.js";
import {
  createOrder,
  getEventWithTickets,
  getOrderById,
  getTicketType,
  listConfirmedOrdersByBuyerAndEvent,
  markOrderConfirmed,
  markOrderRefundConfirmed,
  markOrderRefundFailed,
  markOrderRefundPending,
  markOrderFailed
} from "../storage/postgres.js";
import { badRequest, serverError } from "../utils/response.js";

export const ordersRouter = Router();

const createOrderSchema = z.object({
  eventId: z.number().int().positive(),
  ticketTypeId: z.number().int().positive(),
  buyerWallet: z.string().min(1),
  amountWei: z.string().regex(/^\d+$/),
  paymentToken: z.enum(["AVAX", "USDT", "USDC"]).default("AVAX")
});

const confirmOrderSchema = z.object({
  orderId: z.number().int().positive(),
  txHash: z.string().min(10)
});
const confirmRefundSchema = z.object({
  orderId: z.number().int().positive(),
  txHash: z.string().min(10)
});

const listOrdersQuerySchema = z.object({
  eventId: z.coerce.number().int().positive(),
  buyerWallet: z.string().min(1)
});

ordersRouter.get("/orders", async (req, res) => {
  try {
    const parsed = listOrdersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }

    const items = await listConfirmedOrdersByBuyerAndEvent(
      parsed.data.eventId,
      parsed.data.buyerWallet.toLowerCase()
    );
    return res.json({ items });
  } catch (error) {
    return serverError(res, error);
  }
});

ordersRouter.post("/orders", async (req, res) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }

    const event = await getEventWithTickets(parsed.data.eventId);
    if (!event) {
      return res.status(404).json({ message: "event not found" });
    }

    const ticket = await getTicketType(parsed.data.eventId, parsed.data.ticketTypeId);
    if (!ticket) {
      return res.status(404).json({ message: "ticket type not found" });
    }

    if (parsed.data.amountWei === "0") {
      return badRequest(res, "amountWei must be greater than zero");
    }

    const normalizedAmountWei = parsed.data.paymentToken === "AVAX"
      ? parsed.data.amountWei
      : ticket.priceWei;

    const order = await createOrder({
      ...parsed.data,
      amountWei: normalizedAmountWei,
      buyerWallet: parsed.data.buyerWallet.toLowerCase()
    });

    return res.status(201).json({ order });
  } catch (error) {
    return serverError(res, error);
  }
});

ordersRouter.post("/orders/confirm", async (req, res) => {
  try {
    const parsed = confirmOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }

    const order = await getOrderById(parsed.data.orderId);
    if (!order) {
      return res.status(404).json({ message: "order not found" });
    }

    try {
      const minted = await chainService.parseTicketMintFromTx(parsed.data.txHash);

      if (
        minted.user !== order.buyerWallet ||
        minted.eventId !== String(order.eventId) ||
        minted.ticketTypeId !== String(order.ticketTypeId)
      ) {
        return res.status(400).json({ message: "tx does not match the order" });
      }

      const updated = await markOrderConfirmed(order.id, parsed.data.txHash, minted.tokenId);
      return res.json({ order: updated, minted });
    } catch (error) {
      const failed = await markOrderFailed(order.id, parsed.data.txHash);
      return res.status(400).json({
        message: error instanceof Error ? error.message : "order confirm failed",
        order: failed
      });
    }
  } catch (error) {
    return serverError(res, error);
  }
});

ordersRouter.post("/orders/refund/confirm", async (req, res) => {
  try {
    const parsed = confirmRefundSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }

    const order = await getOrderById(parsed.data.orderId);
    if (!order) {
      return res.status(404).json({ message: "order not found" });
    }
    if (order.status !== "confirmed") {
      return res.status(400).json({ message: "order is not confirmed" });
    }
    if (!order.tokenId) {
      return res.status(400).json({ message: "order tokenId is missing" });
    }

    await markOrderRefundPending(order.id);

    try {
      const refunded = await chainService.parseTicketRefundFromTx(parsed.data.txHash);
      if (
        refunded.user !== order.buyerWallet ||
        refunded.eventId !== String(order.eventId) ||
        refunded.ticketTypeId !== String(order.ticketTypeId) ||
        refunded.tokenId !== String(order.tokenId)
      ) {
        const failed = await markOrderRefundFailed(order.id, parsed.data.txHash, "tx does not match the order");
        return res.status(400).json({ message: "tx does not match the order", order: failed });
      }

      const updated = await markOrderRefundConfirmed(order.id, parsed.data.txHash);
      return res.json({ order: updated, refunded });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "refund confirm failed";
      const failed = await markOrderRefundFailed(order.id, parsed.data.txHash, reason);
      return res.status(400).json({
        message: reason,
        order: failed
      });
    }
  } catch (error) {
    return serverError(res, error);
  }
});
