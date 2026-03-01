import path from "node:path";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { checkinRouter } from "./routes/checkin.js";
import { eventsRouter } from "./routes/events.js";
import { organizersRouter } from "./routes/organizers.js";
import { ordersRouter } from "./routes/orders.js";
import { reviewsRouter } from "./routes/reviews.js";
import { uploadsRouter } from "./routes/uploads.js";
import { usersRouter } from "./routes/users.js";
import { initDatabase } from "./storage/postgres.js";
import { startSettlementWorker } from "./workers/settlementWorker.js";

async function startServer() {
  await initDatabase();
  const stopSettlementWorker = startSettlementWorker();

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, chainId: env.AVAX_CHAIN_ID, network: "Avalanche", storage: "postgres" });
  });

  app.use(eventsRouter);
  app.use(organizersRouter);
  app.use(ordersRouter);
  app.use(checkinRouter);
  app.use(reviewsRouter);
  app.use(usersRouter);
  app.use(uploadsRouter);

  app.listen(env.API_PORT, () => {
    console.log(`EventAtlas API listening on :${env.API_PORT}`);
  });

  const shutdown = () => {
    stopSettlementWorker();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch((error) => {
  console.error("Failed to start API server:", error);
  process.exit(1);
});
