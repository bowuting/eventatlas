import { FormEvent, useState } from "react";
import { createCheckinCode, submitCheckin } from "../services/api";

type Props = {
  connectedWallet?: string;
};

export function CheckinConsole({ connectedWallet }: Props) {
  const [eventIdForCode, setEventIdForCode] = useState("1001");
  const [ttlSeconds, setTtlSeconds] = useState("60");
  const [generatedNonce, setGeneratedNonce] = useState("");
  const [generatedExpireAt, setGeneratedExpireAt] = useState("");

  const [eventIdForCheckin, setEventIdForCheckin] = useState("1001");
  const [nonce, setNonce] = useState("");
  const [wallet, setWallet] = useState(connectedWallet ?? "");
  const [message, setMessage] = useState("");

  async function onGenerateCode(e: FormEvent) {
    e.preventDefault();
    setMessage("生成签到码中...");

    try {
      const result = await createCheckinCode({
        eventId: Number(eventIdForCode),
        ttlSeconds: Number(ttlSeconds)
      });

      setGeneratedNonce(result.nonce);
      setGeneratedExpireAt(result.expiresAt);
      setNonce(result.nonce);
      setEventIdForCheckin(String(result.eventId));
      setMessage("签到码已生成");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成签到码失败");
    }
  }

  async function onSubmitCheckin(e: FormEvent) {
    e.preventDefault();
    setMessage("提交签到中...");

    try {
      const result = await submitCheckin({
        eventId: Number(eventIdForCheckin),
        nonce,
        userWallet: wallet
      });

      setMessage(`签到成功，Attendance tx: ${result.attendance.txHash}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "签到失败");
    }
  }

  return (
    <section className="card">
      <h2>签到中心</h2>

      <form className="stack" onSubmit={onGenerateCode}>
        <h3>组织者生成签到码</h3>
        <input
          placeholder="活动 ID"
          value={eventIdForCode}
          onChange={(e) => setEventIdForCode(e.target.value)}
          required
        />
        <input
          placeholder="有效期秒数(30-120)"
          value={ttlSeconds}
          onChange={(e) => setTtlSeconds(e.target.value)}
          required
        />
        <button type="submit">生成动态签到码</button>
      </form>

      {generatedNonce && (
        <div className="stack" style={{ marginTop: 12 }}>
          <p>nonce: {generatedNonce}</p>
          <p>过期时间: {new Date(generatedExpireAt).toLocaleString()}</p>
        </div>
      )}

      <form className="stack" style={{ marginTop: 16 }} onSubmit={onSubmitCheckin}>
        <h3>用户签到</h3>
        <input
          placeholder="活动 ID"
          value={eventIdForCheckin}
          onChange={(e) => setEventIdForCheckin(e.target.value)}
          required
        />
        <input placeholder="nonce" value={nonce} onChange={(e) => setNonce(e.target.value)} required />
        <input
          placeholder="用户钱包地址"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          required
        />
        <button type="submit">提交签到并铸造 AttendanceProof</button>
      </form>

      <p>{message}</p>
    </section>
  );
}
