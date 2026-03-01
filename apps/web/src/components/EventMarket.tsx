import { useMemo, useState } from "react";
import axios from "axios";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { ticketPassAbi } from "@eventatlas/shared";
import { confirmOrder, createOrder } from "../services/api";
import type { EventItem } from "../types";

const ticketPassAddress = (import.meta.env.VITE_TICKET_PASS_ADDRESS ?? "") as `0x${string}`;
const targetChainId = Number(import.meta.env.VITE_AVAX_CHAIN_ID ?? 43113);

function formatUsd6(value: string) {
  const amount = BigInt(value);
  const intPart = amount / 1_000_000n;
  const frac = (amount % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `$${intPart.toString()}.${frac}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) {
      return message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function EventMarket({ events, reload }: { events: EventItem[]; reload: () => void }) {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const { address, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();

  const selected = useMemo(
    () => events.find((item) => item.id === selectedEventId) ?? events[0],
    [events, selectedEventId]
  );

  async function buy(eventId: number, ticketTypeId: number) {
    if (!address) {
      setMessage("请先连接钱包");
      return;
    }

    if (!ticketPassAddress) {
      setMessage("未配置 VITE_TICKET_PASS_ADDRESS");
      return;
    }

    if (!chain || chain.id !== targetChainId) {
      try {
        setMessage(`正在请求切换网络到 ${targetChainId}...`);
        await switchChainAsync({ chainId: targetChainId });
      } catch {
        setMessage(`请切换到 Avalanche 网络 ${targetChainId}（当前: ${chain?.id ?? "unknown"}）`);
        return;
      }
    }

    if (!publicClient) {
      setMessage("链上客户端未就绪，请稍后重试");
      return;
    }

    setMessage("创建订单中...");

    try {
      const quote = await publicClient.readContract({
        address: ticketPassAddress,
        abi: ticketPassAbi,
        functionName: "quoteNativePriceWei",
        args: [BigInt(eventId), BigInt(ticketTypeId)]
      });
      const expectedWei = quote as bigint;
      const maxPaymentWei = (expectedWei * 101n) / 100n;

      const order = await createOrder({
        eventId,
        ticketTypeId,
        buyerWallet: address,
        amountWei: expectedWei.toString(),
        paymentToken: "AVAX"
      });

      setMessage("发起链上购票交易...");
      const hash = await writeContractAsync({
        account: address,
        address: ticketPassAddress,
        abi: ticketPassAbi,
        functionName: "buyTicketWithNative",
        args: [BigInt(eventId), BigInt(ticketTypeId), maxPaymentWei],
        value: maxPaymentWei,
        chainId: targetChainId
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("购票交易失败（已回滚）");
      }

      setMessage("链上成功，确认订单中...");
      await confirmOrder(order.id, hash);
      setMessage(`购票成功，交易哈希: ${hash}`);
      reload();
    } catch (error) {
      setMessage(getErrorMessage(error, "购票失败"));
    }
  }

  return (
    <section className="card">
      <h2>活动市场（C 端）</h2>

      <select
        value={selected?.id ?? ""}
        onChange={(e) => setSelectedEventId(Number(e.target.value))}
      >
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.title} (#{event.id})
          </option>
        ))}
      </select>

      {!selected && <p>暂无活动</p>}

      {selected && (
        <div className="stack" style={{ marginTop: 12 }}>
          <p><strong>{selected.title}</strong></p>
          <p>{selected.description}</p>
          <p>{selected.address}</p>
          <p>{new Date(selected.startAt).toLocaleString()}</p>

          {selected.ticketTypes.length === 0 && <p>该活动暂无票种</p>}
          {selected.ticketTypes.map((ticket) => (
            <div key={ticket.id} className="ticket-row">
              <span>{ticket.name}</span>
              <span>{formatUsd6(ticket.priceWei)}</span>
              <button onClick={() => buy(selected.id, ticket.id)}>购买</button>
            </div>
          ))}
        </div>
      )}

      <p>{message}</p>
    </section>
  );
}
