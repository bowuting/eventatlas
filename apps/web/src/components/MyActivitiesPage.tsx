import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMyActivities } from "../services/api";
import type { MyActivityItem, MyActivityStatus } from "../types";

type Props = {
  wallet?: string;
  onOpenEvent: (eventId: number) => void;
};

const filterOptions: Array<{ value: "all" | MyActivityStatus; label: string }> = [
  { value: "all", label: "全部" },
  { value: "to_attend", label: "待参加" },
  { value: "to_review", label: "待评价" },
  { value: "completed", label: "已完成" }
];

const statusLabel: Record<MyActivityStatus, string> = {
  to_attend: "待参加",
  to_review: "待评价",
  completed: "已完成"
};

export function MyActivitiesPage({ wallet, onOpenEvent }: Props) {
  const [status, setStatus] = useState<"all" | MyActivityStatus>("all");

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["my-activities", wallet, status],
    queryFn: () => fetchMyActivities(wallet!, status),
    enabled: Boolean(wallet)
  });

  if (!wallet) {
    return (
      <section className="card">
        <h2>我参加的</h2>
        <p>请先连接钱包，再查看你参加的活动状态。</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="section-head">
        <h2>我参加的</h2>
        <button className="ghost-button" onClick={() => void refetch()}>
          刷新
        </button>
      </div>

      <div className="filter-tabs">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === status ? "tab-button active" : "tab-button"}
            onClick={() => setStatus(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading && <p style={{ marginTop: 10 }}>加载中...</p>}
      {!isLoading && items.length === 0 && <p style={{ marginTop: 10 }}>暂无活动记录</p>}

      <div className="stack" style={{ marginTop: 12 }}>
        {items.map((item: MyActivityItem) => (
          <article key={item.eventId} className="my-activity-card">
            <div className="stack">
              <h3>{item.title}</h3>
              <p>{new Date(item.startAt).toLocaleString()}</p>
              <p>{item.address}</p>
              <p>已购 {item.confirmedOrderCount} 张</p>
            </div>
            <div className="activity-meta">
              <span className="status-pill">{statusLabel[item.status]}</span>
              <button className="ghost-button" onClick={() => onOpenEvent(item.eventId)}>
                查看活动详情
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
