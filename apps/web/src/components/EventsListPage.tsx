import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEvents, fetchRecommendations } from "../services/api";
import type { EventItem } from "../types";

type Props = {
  wallet?: string;
  onOpenEvent: (eventId: number) => void;
};

export function EventsListPage({ wallet, onOpenEvent }: Props) {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("all");
  const normalizedWallet = wallet?.toLowerCase();
  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents
  });
  const { data: recommendations = [], isLoading: recommendationLoading } = useQuery({
    queryKey: ["recommendations", normalizedWallet],
    queryFn: () => fetchRecommendations(normalizedWallet!, 8),
    enabled: Boolean(normalizedWallet)
  });

  const categories = useMemo(() => {
    const set = new Set(events.map((event) => event.category));
    return ["all", ...Array.from(set)];
  }, [events]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    return events.filter((event) => {
      if (category !== "all" && event.category !== category) {
        return false;
      }
      if (!kw) {
        return true;
      }
      const target = `${event.title} ${event.description} ${event.address}`.toLowerCase();
      return target.includes(kw);
    });
  }, [events, keyword, category]);

  const recommendedEvents = useMemo(() => {
    if (!normalizedWallet || recommendations.length === 0 || events.length === 0) {
      return [];
    }

    const eventMap = new Map(events.map((event) => [event.id, event]));
    return recommendations
      .map((item) => {
        const event = eventMap.get(item.eventId);
        if (!event) {
          return null;
        }
        return {
          event,
          score: item.score,
          reasons: item.reasons
        };
      })
      .filter((item): item is { event: EventItem; score: number; reasons: string[] } => Boolean(item));
  }, [events, normalizedWallet, recommendations]);

  return (
    <section className="card">
      <div className="section-head">
        <h2>活动广场</h2>
        <button className="ghost-button" onClick={() => void refetch()}>
          刷新
        </button>
      </div>

      <div className="row">
        <label className="field">
          <span>关键词搜索</span>
          <input
            placeholder="活动名 / 描述 / 地点"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>
        <label className="field">
          <span>分类筛选</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "全部分类" : item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {normalizedWallet && (
        <section className="recommendation-panel">
          <div className="section-head">
            <div>
              <h3>为你推荐</h3>
              <p>基于 Attendance Proof 历史行为</p>
            </div>
          </div>
          {recommendationLoading && <p>推荐计算中...</p>}
          {!recommendationLoading && recommendedEvents.length === 0 && (
            <p>暂无推荐结果，先参加并签到一次活动后会更精准。</p>
          )}
          <div className="event-grid">
            {recommendedEvents.map(({ event, score, reasons }) => (
              <article key={`rec-${event.id}`} className="event-card">
                {event.coverUrl && <img src={event.coverUrl} alt={event.title} className="event-cover" />}
                <div className="event-card-content">
                  <h3>{event.title}</h3>
                  <p>{new Date(event.startAt).toLocaleString()}</p>
                  <p>{event.address}</p>
                  <p className="recommend-score">匹配度 {score.toFixed(1)}</p>
                  <div className="recommend-reasons">
                    {reasons.map((reason) => (
                      <span key={reason} className="recommend-reason-pill">
                        {reason}
                      </span>
                    ))}
                  </div>
                  <button onClick={() => onOpenEvent(event.id)}>查看详情</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {isLoading && <p style={{ marginTop: 10 }}>加载中...</p>}
      {!isLoading && filtered.length === 0 && <p style={{ marginTop: 10 }}>没有匹配活动</p>}

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
