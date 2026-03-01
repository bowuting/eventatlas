import "@nomicfoundation/hardhat-toolbox";
import { config as loadEnv } from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

loadEnv({ path: "../../.env" });

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const rpcUrl = process.env.AVAX_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc";
const normalizedPrivateKey =
  privateKey && /^0x[0-9a-fA-F]{64}$/.test(privateKey)
    ? privateKey
    : privateKey && /^[0-9a-fA-F]{64}$/.test(privateKey)
      ? `0x${privateKey}`
      : undefined;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    hardhat: {},
    fuji: {
      url: rpcUrl,
      chainId: 43113,
      accounts: normalizedPrivateKey ? [normalizedPrivateKey] : []
    }
  }
};

export default config;
