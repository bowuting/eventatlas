import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createCheckinCode, fetchEventById } from "../services/api";

type Props = {
  eventId: number;
};

const DEFAULT_TTL_SECONDS = 300;
const REFRESH_INTERVAL_MS = 300_000;

export function CheckinBoardPage({ eventId }: Props) {
  const [code, setCode] = useState<{ nonce: string; expiresAt: string } | null>(null);
  const [message, setMessage] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => fetchEventById(eventId)
  });

  const checkinLink = useMemo(() => {
    if (!code) {
      return "";
    }
    return `${window.location.origin}/#/events/${eventId}?checkin=${encodeURIComponent(code.nonce)}`;
  }, [code, eventId]);

  const secondsLeft = code
    ? Math.max(0, Math.floor((new Date(code.expiresAt).getTime() - nowMs) / 1000))
    : 0;

  async function refreshCode() {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    try {
      const result = await createCheckinCode({
        eventId,
        ttlSeconds: DEFAULT_TTL_SECONDS
      });
      setCode({
        nonce: result.nonce,
        expiresAt: result.expiresAt
      });
      setNowMs(Date.now());
      setMessage("二维码已更新");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新二维码失败");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshCode();
    const refreshTimer = window.setInterval(() => {
      void refreshCode();
    }, REFRESH_INTERVAL_MS);
    const clockTimer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [eventId]);

  return (
    <section className="card">
      <div className="section-head">
        <h2>签到二维码页</h2>
        <button className="ghost-button" type="button" onClick={() => void refreshCode()} disabled={refreshing}>
          {refreshing ? "更新中..." : "立即刷新二维码"}
        </button>
      </div>
      <p>{event ? `活动：${event.title}` : `活动 ID: ${eventId}`}</p>
      <p>二维码每 {Math.floor(REFRESH_INTERVAL_MS / 1000)} 秒自动更新一次。</p>

      {code && (
        <div className="qr-panel">
          <img
            className="qr-image"
            alt="checkin qrcode"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(checkinLink)}`}
          />
          <p>当前码剩余有效期：{secondsLeft}s</p>
          <p className="qr-link">{checkinLink}</p>
        </div>
      )}

      <p className="status-line">{message}</p>
    </section>
  );
}
