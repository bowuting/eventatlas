import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEvents } from "../services/api";
import type { EventItem } from "../types";

type Props = {
  organizerWallet?: string;
  onOpenEvent: (eventId: number) => void;
  onCreate?: () => void;
};

export function OrganizerEventsPage({ organizerWallet, onOpenEvent, onCreate }: Props) {
  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents
  });

  const wallet = organizerWallet?.toLowerCase();
  const filtered = useMemo(
    () => events.filter((event) => wallet && event.organizerWallet.toLowerCase() === wallet),
    [events, wallet]
  );

  if (!wallet) {
    return (
      <section className="card">
        <h2>活动管理</h2>
        <p style={{ marginTop: 10 }}>请先连接钱包，再管理你创建的活动。</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="section-head">
        <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
          {onCreate && (
            <button className="ghost-button" onClick={onCreate}>
              创建活动
            </button>
          )}
          <h2>活动管理</h2>
        </div>
        <button className="ghost-button" onClick={() => void refetch()}>
          刷新
        </button>
      </div>

      {isLoading && <p style={{ marginTop: 10 }}>加载中...</p>}
      {!isLoading && filtered.length === 0 && <p style={{ marginTop: 10 }}>你还没有创建活动</p>}

      <div className="event-grid">
        {filtered.map((event: EventItem) => (
          <article key={event.id} className="event-card">
            {event.coverUrl && <img src={event.coverUrl} alt={event.title} className="event-cover" />}
            <div className="event-card-content">
              <h3>{event.title}</h3>
              <p>{new Date(event.startAt).toLocaleString()}</p>
              <p>{event.address}</p>
              <p>
                票档 {event.ticketTypes.length} / 容量 {event.capacity}
              </p>
              <button onClick={() => onOpenEvent(event.id)}>查看详情</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
