import { FormEvent, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOrganizerProfile, saveOrganizerProfile, uploadImage } from "../services/api";

type Props = {
  isConnected: boolean;
  wallet?: string;
  onNavigateCreate: () => void;
  onNavigateEvents: () => void;
};

export function OrganizerPortalPage({ isConnected, wallet, onNavigateCreate, onNavigateEvents }: Props) {
  const queryClient = useQueryClient();
  const normalizedWallet = wallet?.toLowerCase();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["organizer-profile", normalizedWallet],
    queryFn: () => fetchOrganizerProfile(normalizedWallet!),
    enabled: Boolean(isConnected && normalizedWallet)
  });

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setName(profile?.name ?? "");
    setLogoUrl(profile?.logoUrl ?? "");
  }, [profile]);

  const needProfileGuide = isConnected && Boolean(normalizedWallet) && !isLoading && !(profile?.name && profile?.logoUrl);

  async function onUploadLogo(file?: File) {
    if (!file) {
      return;
    }

    setUploading(true);
    setMessage("正在上传 logo...");
    try {
      const url = await uploadImage(file);
      setLogoUrl(url);
      setMessage("logo 上传成功");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "logo 上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function onSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!normalizedWallet) {
      setMessage("请先连接钱包");
      return;
    }
    if (!name.trim()) {
      setMessage("请填写组织者名称");
      return;
    }
    if (!logoUrl) {
      setMessage("请先上传组织者 logo");
      return;
    }

    setSaving(true);
    setMessage("正在保存组织者资料...");
    try {
      const saved = await saveOrganizerProfile({
        wallet: normalizedWallet,
        name: name.trim(),
        logoUrl
      });
      queryClient.setQueryData(["organizer-profile", normalizedWallet], saved);
      setMessage("组织者资料已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2>我要组织活动</h2>

      {!isConnected && <p style={{ marginTop: 8 }}>创建活动前请先连接钱包。</p>}

      {needProfileGuide && (
        <form className="organizer-guide" onSubmit={(event) => void onSaveProfile(event)}>
          <p className="organizer-guide-title">先完善组织者资料（仅需一次）</p>
          <div className="row">
            <label className="field">
              <span>组织者名称</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：Avalanche China"
                maxLength={80}
                required
              />
            </label>
            <label className="field">
              <span>组织者 logo</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => void onUploadLogo(event.target.files?.[0])}
                disabled={uploading}
              />
            </label>
          </div>

          {logoUrl && (
            <div className="organizer-logo-preview-wrap">
              <img src={logoUrl} alt="组织者 logo" className="organizer-logo-preview" />
            </div>
          )}

          <div className="organizer-guide-actions">
            <button type="submit" disabled={saving || uploading}>
              {saving ? "保存中..." : "保存组织者资料"}
            </button>
          </div>
          {message && <p className="status-line">{message}</p>}
        </form>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={onNavigateCreate}>创建活动</button>
        <button className="ghost-button" onClick={onNavigateEvents}>
          活动管理
        </button>
      </div>
    </section>
  );
}
