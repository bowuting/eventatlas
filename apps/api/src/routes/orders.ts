import { Router } from "express";
import { z } from "zod";
import { chainService } from "../services/chainService.js";
import {
  createOrder,
  getEventWithTickets,
  getOrderById,
  getTicketType,
  markOrderConfirmed,
  markOrderFailed
} from "../storage/postgres.js";
import { badRequest, serverError } from "../utils/response.js";

export const ordersRouter = Router();

const createOrderSchema = z.object({
  eventId: z.number().int().positive(),
  ticketTypeId: z.number().int().positive(),
  buyerWallet: z.string().min(1),
  amountWei: z.string().regex(/^\d+$/)
});

const confirmOrderSchema = z.object({
  orderId: z.number().int().positive(),
  txHash: z.string().min(10)
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

    if (ticket.priceWei !== parsed.data.amountWei) {
      return badRequest(res, "amountWei does not match ticket price");
    }

    const order = await createOrder({
      ...parsed.data,
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
