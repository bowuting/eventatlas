import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ticketPassAbi } from "@eventatlas/shared";
import { formatEther } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import {
  confirmOrder,
  createOrder,
  fetchEventById,
  fetchEventReviews,
  fetchMyActivities,
  submitCheckin,
  submitReview,
  validateCheckinCode
} from "../services/api";

type Props = {
  eventId: number;
  checkinNonce?: string;
};

type ReviewView = {
  id: number;
  userWallet: string;
  rating: number;
  content: string;
  onchainStatus: "pending" | "confirmed" | "failed";
  createdAt: string;
};

const ticketPassAddress = (import.meta.env.VITE_TICKET_PASS_ADDRESS ?? "") as `0x${string}`;
const targetChainId = Number(import.meta.env.VITE_AVAX_CHAIN_ID ?? 43113);

export function EventDetailPage({ eventId, checkinNonce }: Props) {
  const { address, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState("5");
  const [reviewContent, setReviewContent] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [checkinCodeStatus, setCheckinCodeStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

  const { data: event, isLoading, refetch } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => fetchEventById(eventId)
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["event-reviews", eventId],
    queryFn: () => fetchEventReviews(eventId),
    select: (items) => items as ReviewView[]
  });
  const normalizedAddress = address?.toLowerCase();
  const { data: myActivities = [], isLoading: isMyActivitiesLoading, refetch: refetchMyActivities } = useQuery({
    queryKey: ["my-activities", normalizedAddress, "all"],
    queryFn: () => fetchMyActivities(normalizedAddress!, "all"),
    enabled: Boolean(normalizedAddress)
  });
  const myActivity = myActivities.find((item) => item.eventId === eventId);
  const myReview = normalizedAddress
    ? reviews.find((item) => item.userWallet.toLowerCase() === normalizedAddress)
    : undefined;
  const isOrganizer = Boolean(
    normalizedAddress &&
    event &&
    event.organizerWallet.toLowerCase() === normalizedAddress
  );
  const viewerStage: "guest" | "loading" | "not_purchased" | "to_attend" | "to_review" | "completed" =
    !normalizedAddress
      ? "guest"
      : isMyActivitiesLoading
        ? "loading"
        : !myActivity
          ? "not_purchased"
          : myActivity.status;
  const activeCheckinNonce = checkinNonce;
  const checkinBoardLink = useMemo(
    () => `${window.location.origin}/#/checkin-board/${eventId}`,
    [eventId]
  );

  useEffect(() => {
    if (!checkinNonce) {
      setCheckinCodeStatus("idle");
      return;
    }

    let cancelled = false;
    setCheckinCodeStatus("checking");

    void (async () => {
      try {
        const result = await validateCheckinCode({
          eventId,
          nonce: checkinNonce
        });

        if (cancelled) {
          return;
        }

        if (result.valid) {
          setCheckinCodeStatus("valid");
          return;
        }

        setCheckinCodeStatus("invalid");
        setMessage("该签到码已失效，请重新扫描组织者二维码");
      } catch {
        if (cancelled) {
          return;
        }
        setCheckinCodeStatus("invalid");
        setMessage("该签到码校验失败，请重新扫描组织者二维码");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkinNonce, eventId]);

  async function buy(ticketTypeId: number, priceWei: string) {
    if (!event) {
      return;
    }

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
      const order = await createOrder({
        eventId: event.id,
        ticketTypeId,
        buyerWallet: address,
        amountWei: priceWei
      });

      setMessage("发起链上购票交易...");
      const hash = await writeContractAsync({
        account: address,
        address: ticketPassAddress,
        abi: ticketPassAbi,
        functionName: "buyTicket",
        args: [BigInt(event.id), BigInt(ticketTypeId)],
        value: BigInt(priceWei),
        chainId: targetChainId
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await confirmOrder(order.id, hash);

      setMessage(`购票成功，交易哈希: ${hash}`);
      await refetch();
      await refetchMyActivities();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "购票失败");
    }
  }

  async function submitMyReview() {
    if (!address) {
      setMessage("请先连接钱包");
      return;
    }

    if (!reviewContent.trim()) {
      setMessage("请填写评价内容");
      return;
    }

    setMessage("提交评价中...");
    try {
      const result = await submitReview({
        eventId,
        userWallet: address,
        rating: Number(rating),
        content: reviewContent.trim(),
        media: []
      });

      setMessage(`评价提交成功，链上交易: ${result.chain.txHash}`);
      setShowReviewForm(false);
      setReviewContent("");
      await refetch();
      await refetchMyActivities();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "评价提交失败");
    }
  }

  async function submitMyCheckin() {
    if (!event) {
      return;
    }
    if (!address) {
      setMessage("请先连接钱包");
      return;
    }
    if (!activeCheckinNonce || checkinCodeStatus !== "valid") {
      setMessage("未检测到有效签到码，请扫描组织者二维码");
      return;
    }

    setMessage("签到中...");
    try {
      const result = await submitCheckin({
        eventId: event.id,
        nonce: activeCheckinNonce,
        userWallet: address
      });
      setMessage(`签到成功，Attendance tx: ${result.attendance.txHash}`);
      await refetch();
      await refetchMyActivities();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "签到失败");
    }
  }

  async function copyCheckinBoardLink() {
    try {
      await navigator.clipboard.writeText(checkinBoardLink);
      setMessage("签到链接已复制");
    } catch {
      setMessage("复制失败，请手动复制链接");
    }
  }

  if (isLoading || !event) {
    return (
      <section className="card">
        <h2>活动详情</h2>
        <p>加载中...</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="detail-grid">
        <div className="stack">
          <h2>{event.title}</h2>
          {event.coverUrl && <img src={event.coverUrl} alt={event.title} className="detail-cover" />}
          <p>{event.description}</p>
          <p>时间：{new Date(event.startAt).toLocaleString()} - {new Date(event.endAt).toLocaleString()}</p>
          <p>地点：{event.address}</p>
          <p>容量：{event.capacity}</p>
        </div>

        <aside className="stack detail-side">
          <h3>我的状态</h3>

          {isOrganizer && (
            <div className="status-block">
              <p className="status-title">组织者操作</p>
              <p>生成签到链接后，打开该链接页面即可展示实时变动的签到二维码。</p>
              <p className="qr-link">{checkinBoardLink}</p>
              <div className="row">
                <button type="button" onClick={() => window.open(checkinBoardLink, "_blank", "noopener,noreferrer")}>
                  打开签到二维码页
                </button>
                <button type="button" className="ghost-button" onClick={() => void copyCheckinBoardLink()}>
                  复制签到链接
                </button>
              </div>
            </div>
          )}

          {!isOrganizer && viewerStage === "guest" && (
            <div className="status-block">
              <p>连接钱包后可识别你的活动状态。</p>
              <p>当前可直接浏览票档并购买。</p>
            </div>
          )}

          {!isOrganizer && viewerStage === "loading" && (
            <div className="status-block">
              <p>正在读取你的活动状态...</p>
            </div>
          )}
          {checkinCodeStatus === "invalid" && (
            <p className="notice-line">该签到码已失效，请重新扫描组织者二维码</p>
          )}

          {!isOrganizer && (viewerStage === "guest" || viewerStage === "not_purchased") && (
            <>
              <p className="status-title">未购买</p>
              {event.ticketTypes.length === 0 && <p>暂无票档</p>}
              {event.ticketTypes.map((ticket) => (
                <div key={ticket.id} className="ticket-row">
                  <span>{ticket.name}</span>
                  <span>{formatEther(BigInt(ticket.priceWei))} AVAX</span>
                  <button onClick={() => void buy(ticket.id, ticket.priceWei)}>立即购票</button>
                </div>
              ))}
            </>
          )}

          {!isOrganizer && viewerStage === "to_attend" && (
            <div className="status-block">
              <p className="status-title">待参加</p>
              <p>你已购买该活动门票，等待到场签到。</p>
              <p>已购票数：{myActivity?.confirmedOrderCount ?? 0}</p>
              {checkinCodeStatus === "checking" && <p>签到码校验中...</p>}
              {checkinCodeStatus === "valid" && activeCheckinNonce && (
                <button type="button" onClick={() => void submitMyCheckin()}>
                  签到
                </button>
              )}
              {checkinCodeStatus !== "valid" && (
                <p>请扫描组织者现场二维码后再签到。</p>
              )}
            </div>
          )}

          {!isOrganizer && viewerStage === "to_review" && (
            <div className="status-block">
              <p className="status-title">待评价</p>
              <p>你已签到，尚未评价该活动。</p>
              {!showReviewForm && (
                <button type="button" onClick={() => setShowReviewForm(true)}>
                  去评价
                </button>
              )}
              {showReviewForm && (
                <div className="stack" style={{ marginTop: 8 }}>
                  <select value={rating} onChange={(e) => setRating(e.target.value)}>
                    <option value="5">5 分</option>
                    <option value="4">4 分</option>
                    <option value="3">3 分</option>
                    <option value="2">2 分</option>
                    <option value="1">1 分</option>
                  </select>
                  <textarea
                    placeholder="请输入你的评价..."
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                  />
                  <button type="button" onClick={() => void submitMyReview()}>
                    提交评价
                  </button>
                </div>
              )}
            </div>
          )}

          {!isOrganizer && viewerStage === "completed" && (
            <div className="status-block">
              <p className="status-title">已完成</p>
              <p>你已参加并已评价该活动。</p>
              {myReview && (
                <div className="review-card">
                  <p>我的评分：{myReview.rating}</p>
                  <p>我的评价：{myReview.content}</p>
                  <p>状态：{myReview.onchainStatus}</p>
                </div>
              )}
            </div>
          )}

          <p className="status-line">{message}</p>
        </aside>
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        <h3>活动评价</h3>
        {reviews.length === 0 && <p>暂无评价</p>}
        {reviews.map((review) => (
          <article key={review.id} className="review-card">
            <p>用户：{review.userWallet}</p>
            <p>评分：{review.rating}</p>
            <p>状态：{review.onchainStatus}</p>
            <p>{review.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
