import { Router } from "express";
import { z } from "zod";
import { getAuthWallet, requireWalletAuth } from "../middleware/walletAuth.js";
import {
  createEvent,
  createTicketType,
  getEventDetailWithTickets,
  getEventWithTickets,
  listEventsWithTickets,
  markEventChainFailed,
  markEventChainSynced,
  markTicketChainFailed,
  markTicketChainSynced
} from "../storage/postgres.js";
import { chainService } from "../services/chainService.js";
import { badRequest, serverError } from "../utils/response.js";

export const eventsRouter = Router();

const createEventSchema = z.object({
  organizerWallet: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  address: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  capacity: z.number().int().positive(),
  refundRule: z.string().min(1),
  coverUrl: z.string().url().optional()
});

const createTicketSchema = z.object({
  name: z.string().min(1),
  priceWei: z.string().regex(/^\d+$/),
  supply: z.number().int().positive(),
  saleStart: z.string().datetime(),
  saleEnd: z.string().datetime(),
  transferable: z.boolean().default(false)
});

const publishEventSchema = createEventSchema.extend({
  ticketTypes: z.array(createTicketSchema).min(1)
});

eventsRouter.get("/events", async (_req, res) => {
  try {
    const list = await listEventsWithTickets();
    return res.json({ items: list });
  } catch (error) {
    return serverError(res, error);
  }
});

eventsRouter.get("/events/:id", async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    const event = await getEventDetailWithTickets(eventId);

    if (!event) {
      return res.status(404).json({ message: "event not found" });
    }

    return res.json(event);
  } catch (error) {
    return serverError(res, error);
  }
});

eventsRouter.post("/organizer/events", requireWalletAuth, async (req, res) => {
  try {
    const authWallet = getAuthWallet(res);
    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }
    if (parsed.data.organizerWallet.toLowerCase() !== authWallet) {
      return res.status(403).json({ message: "organizerWallet does not match authenticated wallet" });
    }

    const item = await createEvent({
      ...parsed.data,
      organizerWallet: parsed.data.organizerWallet.toLowerCase()
    });

    try {
      const chain = await chainService.registerEvent(
        item.id,
        item.organizerWallet,
        item.startAt,
        item.endAt
      );
      const updatedEvent = (await markEventChainSynced(item.id, chain.txHash)) ?? item;
      return res.status(201).json({ event: updatedEvent, chain });
    } catch (error) {
      const chainError = error instanceof Error ? error.message : "unknown";
      const failedEvent = (await markEventChainFailed(item.id, chainError)) ?? item;
      return res.status(201).json({
        event: failedEvent,
        chain: null,
        warning: "event created in API, but chain register skipped/failed",
        chainError
      });
    }
  } catch (error) {
    return serverError(res, error);
  }
});

eventsRouter.post("/organizer/events/publish", requireWalletAuth, async (req, res) => {
  try {
    const authWallet = getAuthWallet(res);
    const parsed = publishEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }
    if (parsed.data.organizerWallet.toLowerCase() !== authWallet) {
      return res.status(403).json({ message: "organizerWallet does not match authenticated wallet" });
    }

    const event = await createEvent({
      ...parsed.data,
      organizerWallet: parsed.data.organizerWallet.toLowerCase()
    });

    let persistedEvent = event;
    let eventChain: { txHash: string; blockNumber?: number } | null = null;
    let eventChainError: string | undefined;

    try {
      eventChain = await chainService.registerEvent(
        event.id,
        event.organizerWallet,
        event.startAt,
        event.endAt
      );
      persistedEvent = (await markEventChainSynced(event.id, eventChain.txHash)) ?? event;
    } catch (error) {
      eventChainError = error instanceof Error ? error.message : "unknown";
      persistedEvent = (await markEventChainFailed(event.id, eventChainError)) ?? event;
    }

    const ticketResults: Array<{
      ticket: Awaited<ReturnType<typeof createTicketType>>;
      chain: { txHash: string; blockNumber?: number } | null;
      chainError?: string;
    }> = [];

    for (const ticketInput of parsed.data.ticketTypes) {
      const ticket = await createTicketType({
        eventId: event.id,
        ...ticketInput
      });

      if (!eventChain) {
        const chainError = "event register on-chain failed, skip ticket configure";
        const failedTicket = (await markTicketChainFailed(ticket.id, chainError)) ?? ticket;
        ticketResults.push({
          ticket: failedTicket,
          chain: null,
          chainError
        });
        continue;
      }

      try {
        const chain = await chainService.configureTicketType({
          eventId: event.id,
          ticketTypeId: ticket.id,
          priceWei: ticket.priceWei,
          supply: ticket.supply,
          saleStart: ticket.saleStart,
          saleEnd: ticket.saleEnd,
          transferable: ticket.transferable
        });

        const syncedTicket = (await markTicketChainSynced(ticket.id, chain.txHash)) ?? ticket;
        ticketResults.push({
          ticket: syncedTicket,
          chain
        });
      } catch (error) {
        const chainError = error instanceof Error ? error.message : "unknown";
        const failedTicket = (await markTicketChainFailed(ticket.id, chainError)) ?? ticket;
        ticketResults.push({
          ticket: failedTicket,
          chain: null,
          chainError
        });
      }
    }

    const warnings: string[] = [];
    if (eventChainError) {
      warnings.push("event created in API, but chain register skipped/failed");
    }
    if (ticketResults.some((item) => item.chainError)) {
      warnings.push("some ticket types created in API, but chain config skipped/failed");
    }

    return res.status(201).json({
      event: persistedEvent,
      ticketTypes: ticketResults.map((item) => item.ticket),
      chain: {
        event: eventChain,
        eventChainError,
        tickets: ticketResults.map((item) => ({
          ticketTypeId: item.ticket.id,
          chain: item.chain,
          chainError: item.chainError
        }))
      },
      warnings: warnings.length > 0 ? warnings : undefined
    });
  } catch (error) {
    return serverError(res, error);
  }
});

eventsRouter.post("/organizer/events/:id/tickets", requireWalletAuth, async (req, res) => {
  try {
    const authWallet = getAuthWallet(res);
    const eventId = Number(req.params.id);
    const event = await getEventWithTickets(eventId);

    if (!event) {
      return res.status(404).json({ message: "event not found" });
    }
    if (event.organizerWallet !== authWallet) {
      return res.status(403).json({ message: "only event organizer can configure tickets" });
    }

    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }

    const ticket = await createTicketType({
      eventId,
      ...parsed.data
    });

    try {
      const chain = await chainService.configureTicketType({
        eventId,
        ticketTypeId: ticket.id,
        priceWei: ticket.priceWei,
        supply: ticket.supply,
        saleStart: ticket.saleStart,
        saleEnd: ticket.saleEnd,
        transferable: ticket.transferable
      });

      const updatedTicket = (await markTicketChainSynced(ticket.id, chain.txHash)) ?? ticket;
      return res.status(201).json({ ticket: updatedTicket, chain });
    } catch (error) {
      const chainError = error instanceof Error ? error.message : "unknown";
      const failedTicket = (await markTicketChainFailed(ticket.id, chainError)) ?? ticket;
      return res.status(201).json({
        ticket: failedTicket,
        chain: null,
        warning: "ticket created in API, but chain config skipped/failed",
        chainError
      });
    }
  } catch (error) {
    return serverError(res, error);
  }
});
