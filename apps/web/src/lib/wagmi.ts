import { QueryClient } from "@tanstack/react-query";
import { avalanche, avalancheFuji } from "wagmi/chains";
import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

const walletConnectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
const configuredChainId = Number(import.meta.env.VITE_AVAX_CHAIN_ID ?? 43113);
const configuredRpcUrl = import.meta.env.VITE_AVAX_RPC_URL as string | undefined;

const connectors = walletConnectId
  ? [injected(), walletConnect({ projectId: walletConnectId })]
  : [injected()];

export const wagmiConfig = createConfig({
  chains: [avalancheFuji, avalanche],
  connectors,
  transports: {
    [avalancheFuji.id]: http(
      configuredChainId === avalancheFuji.id
        ? configuredRpcUrl ?? "https://api.avax-test.network/ext/bc/C/rpc"
        : "https://api.avax-test.network/ext/bc/C/rpc"
    ),
    [avalanche.id]: http(
      configuredChainId === avalanche.id
        ? configuredRpcUrl ?? "https://api.avax.network/ext/bc/C/rpc"
        : "https://api.avax.network/ext/bc/C/rpc"
    )
  }
});

export const queryClient = new QueryClient();
