import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMyActivities,
  fetchMyAttendanceMap,
  fetchMyAttendanceTimeline
} from "../services/api";
import type {
  AttendanceProofActivity,
  MyActivityItem,
  MyActivityStatus
} from "../types";

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
  const [view, setView] = useState<"status" | "map" | "timeline">("status");
  const [status, setStatus] = useState<"all" | MyActivityStatus>("all");
  const [cityAggregate, setCityAggregate] = useState(true);

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["my-activities", wallet, status],
    queryFn: () => fetchMyActivities(wallet!, status),
    enabled: Boolean(wallet && view === "status")
  });
  const { data: mapItems = [], isLoading: isMapLoading, refetch: refetchMap } = useQuery({
    queryKey: ["my-attendance-map", wallet],
    queryFn: () => fetchMyAttendanceMap(wallet!),
    enabled: Boolean(wallet && view === "map")
  });
  const { data: timelineItems = [], isLoading: isTimelineLoading, refetch: refetchTimeline } = useQuery({
    queryKey: ["my-attendance-timeline", wallet],
    queryFn: () => fetchMyAttendanceTimeline(wallet!),
    enabled: Boolean(wallet && view === "timeline")
  });

  function extractCityLabel(address: string) {
    const normalized = address.trim();
    if (!normalized) {
      return "未知城市";
    }
    const token = normalized.split(/[,\uFF0C/|·-]/)[0]?.trim();
    return token || normalized;
  }

  function projectLatToY(lat: number) {
    const safe = Math.max(-85, Math.min(85, Number.isFinite(lat) ? lat : 0));
    return ((85 - safe) / 170) * 100;
  }

  function projectLngToX(lng: number) {
    const safe = Math.max(-180, Math.min(180, Number.isFinite(lng) ? lng : 0));
    return ((safe + 180) / 360) * 100;
  }

  const mapPoints = cityAggregate
    ? Array.from(
      mapItems.reduce((acc, item) => {
        const key = extractCityLabel(item.address);
        const existing = acc.get(key);
        if (!existing) {
          acc.set(key, {
            key,
            label: key,
            count: 1,
            latSum: item.lat,
            lngSum: item.lng,
            events: [item]
          });
          return acc;
        }
        existing.count += 1;
        existing.latSum += item.lat;
        existing.lngSum += item.lng;
        existing.events.push(item);
        return acc;
      }, new Map<string, {
        key: string;
        label: string;
        count: number;
        latSum: number;
        lngSum: number;
        events: AttendanceProofActivity[];
      }>())
    ).map(([, entry]) => ({
      key: entry.key,
      label: entry.label,
      count: entry.count,
      lat: entry.latSum / entry.count,
      lng: entry.lngSum / entry.count,
      events: entry.events
    }))
    : mapItems.map((item) => ({
      key: `${item.eventId}`,
      label: item.title,
      count: 1,
      lat: item.lat,
      lng: item.lng,
      events: [item]
    }));

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
        {view === "status" && (
          <button className="ghost-button" onClick={() => void refetch()}>
            刷新
          </button>
        )}
        {view === "map" && (
          <button className="ghost-button" onClick={() => void refetchMap()}>
            刷新
          </button>
        )}
        {view === "timeline" && (
          <button className="ghost-button" onClick={() => void refetchTimeline()}>
            刷新
          </button>
        )}
      </div>

      <div className="filter-tabs">
        <button
          type="button"
          className={view === "status" ? "tab-button active" : "tab-button"}
          onClick={() => setView("status")}
        >
          状态
        </button>
        <button
          type="button"
          className={view === "map" ? "tab-button active" : "tab-button"}
          onClick={() => setView("map")}
        >
          地图
        </button>
        <button
          type="button"
          className={view === "timeline" ? "tab-button active" : "tab-button"}
          onClick={() => setView("timeline")}
        >
          时间线
        </button>
      </div>

      {view === "status" && (
        <>
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
        </>
      )}

      {view === "map" && (
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="inline-option">
            <input
              type="checkbox"
              checked={cityAggregate}
              onChange={(e) => setCityAggregate(e.target.checked)}
            />
            <span>按城市聚合</span>
          </label>

          {isMapLoading && <p>加载中...</p>}
          {!isMapLoading && mapItems.length === 0 && <p>暂无链上 Attendance 记录。</p>}
          {!isMapLoading && mapItems.length > 0 && (
            <>
              <div className="attendance-map-board">
                {mapPoints.map((point) => (
                  <button
                    key={point.key}
                    type="button"
                    className="map-point"
                    style={{
                      left: `${projectLngToX(point.lng)}%`,
                      top: `${projectLatToY(point.lat)}%`
                    }}
                    title={`${point.label} · ${point.count} 场`}
                  >
                    <span>{point.count}</span>
                  </button>
                ))}
              </div>
              <div className="stack">
                {mapPoints
                  .sort((a, b) => b.count - a.count)
                  .map((point) => (
                    <article key={`${point.key}-legend`} className="history-rating-card">
                      <p>{point.label}</p>
                      <p>参与活动：{point.count} 场</p>
                      {!cityAggregate && point.events[0] && (
                        <p>时间：{new Date(point.events[0].startAt).toLocaleString()}</p>
                      )}
                    </article>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {view === "timeline" && (
        <div className="stack" style={{ marginTop: 12 }}>
          {isTimelineLoading && <p>加载中...</p>}
          {!isTimelineLoading && timelineItems.length === 0 && <p>暂无链上 Attendance 记录。</p>}
          {!isTimelineLoading && timelineItems.length > 0 && (
            <div className="timeline-list">
              {timelineItems.map((item) => (
                <article key={item.eventId} className="timeline-card">
                  <p className="status-title">{item.title}</p>
                  <p>{new Date(item.startAt).toLocaleString()} - {new Date(item.endAt).toLocaleString()}</p>
                  <p>{item.address}</p>
                  <button className="ghost-button" onClick={() => onOpenEvent(item.eventId)}>
                    查看活动详情
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
