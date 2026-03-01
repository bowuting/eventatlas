import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ path: "../../.env" });
loadEnv();

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  API_PORT: z.coerce.number().default(4000),
  API_PUBLIC_BASE_URL: z.string().url().optional(),
  AVAX_RPC_URL: z.string().url().default("https://api.avax-test.network/ext/bc/C/rpc"),
  AVAX_CHAIN_ID: z.coerce.number().default(43113),
  SETTLEMENT_WORKER_ENABLED: z.coerce.boolean().default(true),
  SETTLEMENT_WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  SETTLEMENT_WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(20),
  DEPLOYER_PRIVATE_KEY: z.string().optional(),
  TICKET_PASS_ADDRESS: z.string().optional(),
  ATTENDANCE_PROOF_ADDRESS: z.string().optional(),
  REVIEW_ANCHOR_ADDRESS: z.string().optional(),
  DATABASE_URL: z.string().min(1)
});

export const env = schema.parse(process.env);
