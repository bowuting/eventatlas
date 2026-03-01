import { FormEvent, useEffect, useState } from "react";
import { parseEther } from "viem";
import { publishEvent, uploadImage } from "../services/api";

type Props = {
  connectedWallet?: string;
  onCreated: () => void;
};

type TicketDraft = {
  name: string;
  priceAvax: string;
  supply: string;
  saleStart: string;
  saleEnd: string;
  transferable: boolean;
};

function toDatetimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function createDefaultTicket(now: Date, eventStart: Date): TicketDraft {
  return {
    name: "General",
    priceAvax: "0.01",
    supply: "100",
    saleStart: toDatetimeLocalValue(new Date(now.getTime() - 60 * 60 * 1000)),
    saleEnd: toDatetimeLocalValue(eventStart),
    transferable: false
  };
}

export function OrganizerConsole({ connectedWallet, onCreated }: Props) {
  const now = new Date();
  const defaultStartAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const defaultEndAt = new Date(defaultStartAt.getTime() + 2 * 60 * 60 * 1000);

  const [organizerWallet, setOrganizerWallet] = useState(connectedWallet ?? "");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState(toDatetimeLocalValue(defaultStartAt));
  const [endAt, setEndAt] = useState(toDatetimeLocalValue(defaultEndAt));
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState("200");
  const [lat, setLat] = useState("0");
  const [lng, setLng] = useState("0");
  const [ticketTypes, setTicketTypes] = useState<TicketDraft[]>([
    createDefaultTicket(now, defaultStartAt)
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (connectedWallet && !organizerWallet) {
      setOrganizerWallet(connectedWallet);
    }
  }, [connectedWallet, organizerWallet]);

  function updateTicket(index: number, next: Partial<TicketDraft>) {
    setTicketTypes((prev) =>
      prev.map((ticket, idx) =>
        idx === index ? { ...ticket, ...next } : ticket
      )
    );
  }

  function addTicket() {
    setTicketTypes((prev) => [...prev, createDefaultTicket(new Date(), defaultStartAt)]);
  }

  function removeTicket(index: number) {
    setTicketTypes((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function onUploadCover(file?: File) {
    if (!file) {
      return;
    }

    setCoverUploading(true);
    setMessage("封面上传中...");

    try {
      const url = await uploadImage(file);
      setCoverUrl(url);
      setMessage("封面上传成功");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "封面上传失败");
    } finally {
      setCoverUploading(false);
    }
  }

  async function submitPublish(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("正在发布活动并同步票档...");

    try {
      if (ticketTypes.length === 0) {
        throw new Error("请至少添加一个票档");
      }

      const eventStart = new Date(startAt);
      const eventEnd = new Date(endAt);
      if (Number.isNaN(eventStart.getTime()) || Number.isNaN(eventEnd.getTime())) {
        throw new Error("请填写有效的开始/结束时间");
      }
      if (eventStart >= eventEnd) {
        throw new Error("结束时间必须晚于开始时间");
      }

      const result = await publishEvent({
        organizerWallet,
        title,
        description,
        category: "general",
        tags: ["general"],
        address,
        lat: Number(lat),
        lng: Number(lng),
        startAt: eventStart.toISOString(),
        endAt: eventEnd.toISOString(),
        capacity: Number(capacity),
        refundRule: "活动开始前24小时可退款",
        coverUrl: coverUrl || undefined,
        ticketTypes: ticketTypes.map((ticket) => ({
          ...(function validateTicket() {
            const saleStart = new Date(ticket.saleStart);
            const saleEnd = new Date(ticket.saleEnd);
            if (Number.isNaN(saleStart.getTime()) || Number.isNaN(saleEnd.getTime())) {
              throw new Error("请填写有效的开售/停售时间");
            }
            if (saleStart >= saleEnd) {
              throw new Error(`票档 ${ticket.name || "未命名"} 的停售时间必须晚于开售时间`);
            }
            return {
              saleStart: saleStart.toISOString(),
              saleEnd: saleEnd.toISOString()
            };
          })(),
          name: ticket.name,
          priceWei: parseEther(ticket.priceAvax).toString(),
          supply: Number(ticket.supply),
          transferable: ticket.transferable
        }))
      });

      const warningText = result.warnings && result.warnings.length > 0
        ? `；注意：${result.warnings.join(" / ")}`
        : "";
      setMessage(`活动发布成功（eventId=${result.event.id}，票档数=${result.ticketTypes.length}）${warningText}`);
      onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发布失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card creator-card">
      <div className="section-head">
        <h2>创建活动</h2>
        <p>一次提交：活动信息 + 多票档</p>
      </div>

      <form onSubmit={submitPublish} className="stack">
        <label className="field">
          <span>组织者钱包</span>
          <input
            placeholder="0x..."
            value={organizerWallet}
            onChange={(e) => setOrganizerWallet(e.target.value)}
            required
          />
        </label>

        <div className="row">
          <label className="field">
            <span>活动标题</span>
            <input
              placeholder="例如：Avalanche Builder Night"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>封面图片上传</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => void onUploadCover(e.target.files?.[0])}
              disabled={coverUploading}
            />
            {coverUrl && <p>已上传</p>}
          </label>
        </div>

        {coverUrl && (
          <div className="cover-preview-wrap">
            <img src={coverUrl} alt="封面预览" className="cover-preview" />
          </div>
        )}

        <label className="field">
          <span>活动描述</span>
          <textarea
            placeholder="填写活动亮点、议程、适合人群..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>

        <div className="row">
          <label className="field">
            <span>开始时间</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>结束时间</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span>活动地点</span>
            <input
              placeholder="城市 + 详细地址"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>人数限制</span>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span>纬度（可选）</span>
            <input value={lat} onChange={(e) => setLat(e.target.value)} />
          </label>
          <label className="field">
            <span>经度（可选）</span>
            <input value={lng} onChange={(e) => setLng(e.target.value)} />
          </label>
        </div>

        <div className="stack">
          <div className="section-head">
            <h3>门票档位</h3>
            <button type="button" className="ghost-button" onClick={addTicket}>
              + 添加票档
            </button>
          </div>

          {ticketTypes.map((ticket, index) => (
            <div key={`ticket-${index}`} className="ticket-editor">
              <div className="row">
                <label className="field">
                  <span>票档名称</span>
                  <input
                    placeholder="Early Bird / VIP"
                    value={ticket.name}
                    onChange={(e) => updateTicket(index, { name: e.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span>价格（AVAX）</span>
                  <input
                    type="number"
                    min="0"
                    step="0.000001"
                    value={ticket.priceAvax}
                    onChange={(e) => updateTicket(index, { priceAvax: e.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span>票量</span>
                  <input
                    type="number"
                    min={1}
                    value={ticket.supply}
                    onChange={(e) => updateTicket(index, { supply: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="row">
                <label className="field">
                  <span>开售时间</span>
                  <input
                    type="datetime-local"
                    value={ticket.saleStart}
                    onChange={(e) => updateTicket(index, { saleStart: e.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span>停售时间</span>
                  <input
                    type="datetime-local"
                    value={ticket.saleEnd}
                    onChange={(e) => updateTicket(index, { saleEnd: e.target.value })}
                    required
                  />
                </label>
                <label className="field checkbox-field">
                  <span>允许转让</span>
                  <input
                    type="checkbox"
                    checked={ticket.transferable}
                    onChange={(e) => updateTicket(index, { transferable: e.target.checked })}
                  />
                </label>
              </div>

              <div className="ticket-editor-actions">
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => removeTicket(index)}
                  disabled={ticketTypes.length === 1}
                >
                  删除票档
                </button>
              </div>
            </div>
          ))}
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? "发布中..." : "发布活动并创建票档"}
        </button>
      </form>

      <p className="status-line">{message}</p>
    </section>
  );
}
