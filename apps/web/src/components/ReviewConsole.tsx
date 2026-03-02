import { FormEvent, useMemo, useState } from "react";
import {
  REVIEW_AUTH_DEFAULT_VALIDITY_MS,
  buildReviewAuthorizationMessage
} from "@eventatlas/shared";
import { useSignMessage } from "wagmi";
import { fetchEventReviews, submitReview } from "../services/api";
import type { EventItem } from "../types";

type Props = {
  events: EventItem[];
  connectedWallet?: string;
};

type ReviewView = {
  id: number;
  userWallet: string;
  rating: number;
  content: string;
  onchainStatus: "pending" | "confirmed" | "failed";
  createdAt: string;
};

export function ReviewConsole({ events, connectedWallet }: Props) {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [wallet, setWallet] = useState(connectedWallet ?? "");
  const [rating, setRating] = useState("5");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [reviews, setReviews] = useState<ReviewView[]>([]);
  const { signMessageAsync } = useSignMessage();

  const selected = useMemo(
    () => events.find((item) => item.id === selectedEventId) ?? events[0],
    [events, selectedEventId]
  );

  async function loadReviews(eventId: number) {
    try {
      const items = await fetchEventReviews(eventId);
      setReviews(items as ReviewView[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载评价失败");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) {
      setMessage("请先创建并选择活动");
      return;
    }

    if (!connectedWallet) {
      setMessage("请先连接钱包后再评价");
      return;
    }

    const normalizedConnectedWallet = connectedWallet.toLowerCase();
    if (wallet.trim().toLowerCase() !== normalizedConnectedWallet) {
      setMessage("评价钱包必须与当前连接钱包一致");
      return;
    }

    setMessage("提交评价中（平台代付 gas 上链评分）...");

    try {
      const contentValue = content.trim();
      const nonce = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const issuedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + REVIEW_AUTH_DEFAULT_VALIDITY_MS).toISOString();
      const messageToSign = buildReviewAuthorizationMessage({
        eventId: selected.id,
        userWallet: normalizedConnectedWallet,
        rating: Number(rating),
        content: contentValue,
        media: [],
        nonce,
        issuedAt,
        expiresAt
      });
      const signature = await signMessageAsync({ message: messageToSign });

      const result = await submitReview({
        eventId: selected.id,
        userWallet: normalizedConnectedWallet,
        rating: Number(rating),
        content: contentValue,
        media: [],
        nonce,
        issuedAt,
        expiresAt,
        signature
      });

      setMessage(`评价提交成功，链上交易: ${result.chain.txHash}`);
      setContent("");
      await loadReviews(selected.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "评价提交失败");
    }
  }

  return (
    <section className="card">
      <h2>评价中心（评分上链）</h2>

      {events.length > 0 && (
        <select
          value={selected?.id ?? ""}
          onChange={(e) => {
            const next = Number(e.target.value);
            setSelectedEventId(next);
            void loadReviews(next);
          }}
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title} (#{event.id})
            </option>
          ))}
        </select>
      )}

      <form className="stack" style={{ marginTop: 12 }} onSubmit={onSubmit}>
        <input
          placeholder="用户钱包地址"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          required
        />
        <select value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="5">5 分</option>
          <option value="4">4 分</option>
          <option value="3">3 分</option>
          <option value="2">2 分</option>
          <option value="1">1 分</option>
        </select>
        <textarea
          placeholder="评价内容（链下保存）"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        <button type="submit" disabled={!selected}>提交评价</button>
      </form>

      <p>{message}</p>

      {selected && (
        <div className="stack" style={{ marginTop: 12 }}>
          <button onClick={() => void loadReviews(selected.id)}>刷新评价列表</button>
          {reviews.length === 0 && <p>暂无评价</p>}
          {reviews.map((review) => (
            <div key={review.id} className="card" style={{ padding: 10 }}>
              <p>用户: {review.userWallet}</p>
              <p>评分: {review.rating}</p>
              <p>状态: {review.onchainStatus}</p>
              <p>内容: {review.content}</p>
              <p>时间: {new Date(review.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
