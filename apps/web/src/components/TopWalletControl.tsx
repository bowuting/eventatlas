import { useAccount, useConnect, useDisconnect } from "wagmi";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function TopWalletControl() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isConnected) {
    return (
      <div className="card wallet-dock">
        <p className="wallet-label">钱包未连接</p>
        <div className="wallet-actions">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              className="ghost-button"
              onClick={() => connect({ connector })}
              disabled={isPending}
            >
              连接 {connector.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card wallet-dock">
      <p className="wallet-label">钱包已连接</p>
      <div className="wallet-chip">
        <span>{shortAddress(address ?? "")}</span>
        <span className="wallet-chain">{chain?.id ?? "-"}</span>
      </div>
      <button type="button" className="ghost-button" onClick={() => disconnect()}>
        断开
      </button>
    </div>
  );
}
