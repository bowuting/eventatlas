import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { CheckinBoardPage } from "./components/CheckinBoardPage";
import { EventDetailPage } from "./components/EventDetailPage";
import { EventsListPage } from "./components/EventsListPage";
import { MyActivitiesPage } from "./components/MyActivitiesPage";
import { OrganizerEventsPage } from "./components/OrganizerEventsPage";
import { OrganizerConsole } from "./components/OrganizerConsole";
import { TopWalletControl } from "./components/TopWalletControl";
import "./styles.css";

type Route =
  | { name: "home" }
  | { name: "create" }
  | { name: "events" }
  | { name: "organizerEvents" }
  | { name: "checkinBoard"; eventId: number }
  | { name: "eventDetail"; eventId: number; checkinNonce?: string }
  | { name: "me" };

const targetChainId = Number(import.meta.env.VITE_AVAX_CHAIN_ID ?? 43113);
const targetChainLabel = targetChainId === 43113
  ? "Avalanche Fuji"
  : targetChainId === 43114
    ? "Avalanche Mainnet"
    : `Avalanche ${targetChainId}`;

function parseHashRoute(hash: string): Route {
  const checkinBoardMatch = hash.match(/^#\/checkin-board\/(\d+)$/);
  if (checkinBoardMatch) {
    return {
      name: "checkinBoard",
      eventId: Number(checkinBoardMatch[1])
    };
  }

  const detailMatch = hash.match(/^#\/events\/(\d+)(\?(.*))?$/);
  if (detailMatch) {
    const search = detailMatch[3] ?? "";
    const params = new URLSearchParams(search);
    const checkinNonce = params.get("checkin") ?? undefined;
    return {
      name: "eventDetail",
      eventId: Number(detailMatch[1]),
      checkinNonce
    };
  }

  if (hash === "#/create") {
    return { name: "create" };
  }
  if (hash === "#/events") {
    return { name: "events" };
  }
  if (hash === "#/organizer-events") {
    return { name: "organizerEvents" };
  }
  if (hash === "#/me") {
    return { name: "me" };
  }
  return { name: "home" };
}

export default function App() {
  const { address, isConnected } = useAccount();
  const [route, setRoute] = useState<Route>(parseHashRoute(window.location.hash));
  const [notice, setNotice] = useState("");

  useEffect(() => {
    function syncRouteFromHash() {
      setRoute(parseHashRoute(window.location.hash));
    }
    window.addEventListener("hashchange", syncRouteFromHash);
    return () => window.removeEventListener("hashchange", syncRouteFromHash);
  }, []);

  useEffect(() => {
    if (isConnected) {
      setNotice("");
    }
  }, [isConnected]);

  function navigate(
    path:
      | "/"
      | "/create"
      | "/events"
      | "/organizer-events"
      | "/me"
      | `/events/${number}`
      | `/checkin-board/${number}`
  ) {
    window.location.hash = `#${path}`;
    setRoute(parseHashRoute(window.location.hash));
  }

  function navigateCreate() {
    if (!isConnected) {
      setNotice("请先连接钱包，再进入活动创建");
      return;
    }
    setNotice("");
    navigate("/create");
  }

  function renderRoute() {
    if (route.name === "home") {
      return (
        <>
          <header className="hero card">
            <p className="eyebrow">Avalanche Event Infrastructure</p>
            <h1>EventAtlas</h1>
            <p>
              一个面向 AVAX 生态的活动基础设施平台：链上购票、到场验证、可信评价与行为驱动推荐。
            </p>
            <div className="hero-metrics">
              <span>Network: {targetChainLabel}</span>
              <span>Trust: Ticket + Attendance + Rating</span>
              <span>Role: Organizer / User</span>
              <span>钱包: {isConnected ? "已连接" : "未连接"}</span>
              {isConnected && address && <span>地址: {address.slice(0, 6)}...{address.slice(-4)}</span>}
            </div>
            <div className="landing-actions">
              <button onClick={() => navigate("/events")}>浏览活动列表</button>
              <button className="ghost-button" onClick={navigateCreate}>
                进入活动创建
              </button>
            </div>
            {notice && <p className="notice-line">{notice}</p>}
          </header>

          <section className="card landing-grid">
            <article className="landing-card">
              <h3>可信活动流程</h3>
              <p>发布活动、配置票档、链上售票与到场证明，形成可验证参与记录。</p>
            </article>
            <article className="landing-card">
              <h3>组织者效率</h3>
              <p>一次创建活动与多档门票，减少分步骤操作，提升运营效率。</p>
            </article>
            <article className="landing-card">
              <h3>用户资产沉淀</h3>
              <p>支持我的活动状态视图：待参加、待评价、已完成。</p>
            </article>
          </section>
        </>
      );
    }

    if (route.name === "create") {
      return (
        <>
          <header className="card page-head">
            <div>
              <p className="eyebrow">Organizer Console</p>
              <h2>活动创建</h2>
              <p>本页仅展示活动创建相关内容。</p>
            </div>
          </header>
          {!isConnected && (
            <section className="card">
              <p className="notice-line">请先连接钱包，然后再创建活动。</p>
            </section>
          )}
          {isConnected && <OrganizerConsole connectedWallet={address} onCreated={() => {}} />}
        </>
      );
    }

    if (route.name === "events") {
      return <EventsListPage onOpenEvent={(eventId) => navigate(`/events/${eventId}`)} />;
    }

    if (route.name === "organizerEvents") {
      return <OrganizerEventsPage organizerWallet={address} onOpenEvent={(eventId) => navigate(`/events/${eventId}`)} />;
    }

    if (route.name === "checkinBoard") {
      return <CheckinBoardPage eventId={route.eventId} />;
    }

    if (route.name === "eventDetail") {
      return <EventDetailPage eventId={route.eventId} checkinNonce={route.checkinNonce} />;
    }

    return (
      <>
        <MyActivitiesPage wallet={address} onOpenEvent={(eventId) => navigate(`/events/${eventId}`)} />
      </>
    );
  }

  return (
    <main className="layout">
      <header className="top-header">
        <nav className="card top-nav">
          <button
            className={route.name === "home" ? "tab-button active" : "tab-button"}
            onClick={() => {
              setNotice("");
              navigate("/");
            }}
          >
            首页
          </button>
          <button
            className={route.name === "events" ? "tab-button active" : "tab-button"}
            onClick={() => {
              setNotice("");
              navigate("/events");
            }}
          >
            活动列表
          </button>
          <button
            className={route.name === "organizerEvents" ? "tab-button active" : "tab-button"}
            onClick={() => {
              setNotice("");
              navigate("/organizer-events");
            }}
          >
            我组织的活动
          </button>
          <button
            className={route.name === "create" ? "tab-button active" : "tab-button"}
            onClick={navigateCreate}
          >
            创建活动
          </button>
          <button
            className={route.name === "me" ? "tab-button active" : "tab-button"}
            onClick={() => {
              setNotice("");
              navigate("/me");
            }}
          >
            我的活动
          </button>
        </nav>
        <TopWalletControl />
      </header>

      {route.name === "eventDetail" && (
        <button className="ghost-button back-button" onClick={() => navigate("/events")}>
          ← 返回活动列表
        </button>
      )}
      {route.name === "checkinBoard" && (
        <button className="ghost-button back-button" onClick={() => navigate(`/events/${route.eventId}`)}>
          ← 返回活动详情
        </button>
      )}

      {renderRoute()}
    </main>
  );
}
