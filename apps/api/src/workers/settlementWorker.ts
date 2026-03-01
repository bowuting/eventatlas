import { env } from "../config/env.js";
import { chainService } from "../services/chainService.js";
import {
  listEventsReadyForSettlement,
  markEventSettlementCanceled,
  markEventSettlementFailed,
  markEventSettlementSettled
} from "../storage/postgres.js";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown";
}

async function runSettlementBatch() {
  const eventIds = await listEventsReadyForSettlement(env.SETTLEMENT_WORKER_BATCH_SIZE);
  if (eventIds.length === 0) {
    return;
  }

  for (const eventId of eventIds) {
    try {
      const canceled = await chainService.isEventCanceled(eventId);
      if (canceled) {
        await markEventSettlementCanceled(eventId, "event canceled on-chain");
        continue;
      }

      const settled = await chainService.isEventSettled(eventId);
      if (settled) {
        await markEventSettlementSettled(eventId);
        continue;
      }

      const result = await chainService.settleEvent(eventId);
      await markEventSettlementSettled(eventId, result.txHash);
      console.log(`[settlement-worker] settled event=${eventId} tx=${result.txHash}`);
    } catch (error) {
      const message = errorMessage(error);
      await markEventSettlementFailed(eventId, message);
      console.error(`[settlement-worker] failed event=${eventId}: ${message}`);
    }
  }
}

export function startSettlementWorker() {
  if (!env.SETTLEMENT_WORKER_ENABLED) {
    console.log("[settlement-worker] disabled");
    return () => {};
  }

  let timer: NodeJS.Timeout | null = null;
  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      await runSettlementBatch();
    } finally {
      running = false;
    }
  };

  void tick();
  timer = setInterval(() => {
    void tick();
  }, env.SETTLEMENT_WORKER_INTERVAL_MS);

  console.log(
    `[settlement-worker] started interval=${env.SETTLEMENT_WORKER_INTERVAL_MS}ms batch=${env.SETTLEMENT_WORKER_BATCH_SIZE}`
  );

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
      console.log("[settlement-worker] stopped");
    }
  };
}
