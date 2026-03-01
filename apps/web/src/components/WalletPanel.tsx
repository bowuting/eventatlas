import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletPanel() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isConnected) {
    return (
      <section className="card">
        <h2>钱包连接</h2>
        <div className="row">
          {connectors.map((connector) => (
            <button key={connector.uid} onClick={() => connect({ connector })} disabled={isPending}>
              连接 {connector.name}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>钱包状态</h2>
      <p>地址：{address}</p>
      <p>网络：{chain?.name} ({chain?.id})</p>
      <button onClick={() => disconnect()}>断开</button>
    </section>
  );
}
