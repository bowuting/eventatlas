import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEvents } from "../services/api";
import type { EventItem } from "../types";

type Props = {
  onOpenEvent: (eventId: number) => void;
};

export function EventsListPage({ onOpenEvent }: Props) {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("all");
  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents
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
