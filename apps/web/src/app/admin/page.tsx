"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminTracksPanel } from "@/components/AdminTracksPanel";

type AdminChannel = {
  id: string;
  title: string;
  username: string | null;
  telegramId: string;
  slug: string;
  trackCount?: number;
  lastIndexedAt: string | null;
  isActive?: boolean;
  isValidated?: boolean;
  autoSync?: boolean;
  lastMessageId?: string;
};

type TelegramStatus = {
  configured?: boolean;
  connected?: boolean;
  authorized?: boolean;
  me?: { id: number; username?: string | null; phone?: string | null } | null;
  pendingLogin?: boolean;
};

type ValidatedChannel = {
  title: string;
  username: string | null;
  telegramId: string;
  coverUrl?: string | null;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [channels, setChannels] = useState<AdminChannel[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [apiHashMasked, setApiHashMasked] = useState("");
  const [hasApiHash, setHasApiHash] = useState(false);
  const [tgStatus, setTgStatus] = useState<TelegramStatus | null>(null);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [twoFA, setTwoFA] = useState("");
  const [needPassword, setNeedPassword] = useState(false);

  const [channelQuery, setChannelQuery] = useState("");
  const [validated, setValidated] = useState<ValidatedChannel | null>(null);
  const [fetchLimit, setFetchLimit] = useState(10);
  const [limits, setLimits] = useState<Record<string, number>>({});

  async function refresh() {
    const me = await fetch("/api/admin/me");
    const meJson = (await me.json()) as { ok: boolean };
    setAuthed(meJson.ok);
    if (!meJson.ok) return;

    const [chRes, tgRes] = await Promise.all([
      fetch("/api/admin/channels"),
      fetch("/api/admin/telegram/settings"),
    ]);

    if (chRes.ok) {
      const data = (await chRes.json()) as { channels: AdminChannel[] };
      setChannels(data.channels);
      setLimits((prev) => {
        const next = { ...prev };
        for (const ch of data.channels) {
          if (next[ch.id] == null) next[ch.id] = 50;
        }
        return next;
      });
    }

    if (tgRes.ok) {
      const data = (await tgRes.json()) as {
        apiId: string;
        apiHashMasked: string;
        hasApiHash: boolean;
        telegram: TelegramStatus;
      };
      setApiId(data.apiId || "");
      setApiHashMasked(data.apiHashMasked || "");
      setHasApiHash(data.hasApiHash);
      setTgStatus(data.telegram || null);
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("رمز اشتباه است.");
      return;
    }
    setPassword("");
    await refresh();
  }

  async function onSaveTelegram(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    const res = await fetch("/api/admin/telegram/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiId,
        ...(apiHash ? { apiHash } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || data.detail || "ذخیره تنظیمات تلگرام نشد.");
      return;
    }
    setApiHash("");
    setInfo(
      data.telegram?.authorized
        ? "تنظیمات ذخیره شد و اکانت وصل است."
        : "تنظیمات ذخیره شد. حالا با شماره وارد شو.",
    );
    await refresh();
  }

  async function onSendCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    const res = await fetch("/api/admin/telegram/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.detail || data.error || "ارسال کد انجام نشد.");
      return;
    }
    setInfo("کد به تلگرام/SMS ارسال شد.");
  }

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    const res = await fetch("/api/admin/telegram/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        code,
        ...(twoFA ? { password: twoFA } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.needPassword) {
      setNeedPassword(true);
      setInfo("این اکانت 2FA دارد. رمز دو مرحله‌ای را وارد کن.");
      return;
    }
    if (!res.ok || !data.ok) {
      setError(data.detail || data.error || "ورود انجام نشد.");
      return;
    }
    setCode("");
    setTwoFA("");
    setNeedPassword(false);
    setInfo("ورود تلگرام موفق بود. از این به بعد سینک خودکار کار می‌کند.");
    await refresh();
  }

  async function onValidateChannel(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setValidated(null);
    setBusy(true);
    const res = await fetch("/api/admin/channels/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: channelQuery }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.detail || data.error || "اعتبارسنجی کانال ناموفق بود.");
      return;
    }
    setValidated({
      title: data.title,
      username: data.username ?? null,
      telegramId: String(data.telegramId),
      coverUrl: data.coverUrl ?? null,
    });
    setInfo(`کانال معتبر است: ${data.title}`);
  }

  async function onAddValidated(e: FormEvent) {
    e.preventDefault();
    if (!validated) return;
    setError("");
    setInfo("");
    setBusy(true);

    const saveRes = await fetch("/api/admin/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: validated.title,
        username: validated.username,
        telegramId: validated.telegramId,
        coverUrl: validated.coverUrl || null,
        isValidated: true,
        autoSync: true,
      }),
    });
    const saved = await saveRes.json().catch(() => ({}));
    if (!saveRes.ok) {
      setBusy(false);
      setError(saved.error || "ذخیره کانال نشد.");
      return;
    }

    const channelId = saved.channel?.id as string | undefined;
    const indexRes = await fetch("/api/admin/reindex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId,
        limit: fetchLimit,
        mode: "latest",
      }),
    });
    const indexData = await indexRes.json().catch(() => ({}));
    setBusy(false);

    if (!indexRes.ok) {
      setError(indexData.detail || indexData.error || "کانال ذخیره شد ولی ایندکس اولیه شکست خورد.");
      await refresh();
      return;
    }

    setInfo(`کانال اضافه شد و ${indexData.indexed ?? 0} آهنگ آخر ایندکس شد. سینک خودکار روشن است.`);
    setChannelQuery("");
    setValidated(null);
    await refresh();
  }

  async function onFetchLatest(channelId: string) {
    setBusy(true);
    setError("");
    setInfo("");
    const limit = limits[channelId] || 50;
    const res = await fetch("/api/admin/reindex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, limit, mode: "latest" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.detail || data.error || "ایندکس انجام نشد.");
      return;
    }
    setInfo(`${data.indexed ?? 0} آهنگ از این کانال گرفته شد.`);
    await refresh();
  }

  async function onToggleAutoSync(channel: AdminChannel) {
    setBusy(true);
    await fetch("/api/admin/channels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: channel.id, autoSync: !channel.autoSync }),
    });
    setBusy(false);
    await refresh();
  }

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setChannels([]);
  }

  if (!authed) {
    return (
      <main className="admin-panel">
        <section className="admin-card">
          <h2>ورود مدیریت</h2>
          <form className="admin-form" onSubmit={onLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="رمز ادمین"
              autoComplete="current-password"
            />
            <button className="admin-btn" type="submit" disabled={busy}>
              ورود
            </button>
            {error ? <p className="admin-error">{error}</p> : null}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <header className="page-head" style={{ marginBottom: 0 }}>
          <h1 className="page-title">پنل مدیریت</h1>
          <p className="page-lede">اتصال تلگرام، کانال‌ها و ایندکس</p>
        </header>
        <button className="admin-btn admin-btn--ghost" type="button" onClick={onLogout}>
          خروج
        </button>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}
      {info ? <p className="admin-muted">{info}</p> : null}

      <section className="admin-card">
        <h2>اتصال تلگرام</h2>
        <p className="admin-muted" style={{ marginTop: "-0.4rem" }}>
          وضعیت:{" "}
          {tgStatus?.authorized
            ? `وصل · ${tgStatus.me?.username || tgStatus.me?.phone || tgStatus.me?.id}`
            : tgStatus?.configured
              ? "API ذخیره شده — ورود اکانت لازم است"
              : "هنوز تنظیم نشده"}
        </p>
        <form className="admin-form" onSubmit={onSaveTelegram}>
          <input
            value={apiId}
            onChange={(e) => setApiId(e.target.value)}
            placeholder="API ID"
            required
          />
          <input
            value={apiHash}
            onChange={(e) => setApiHash(e.target.value)}
            placeholder={hasApiHash ? `API Hash (فعلی: ${apiHashMasked})` : "API Hash"}
            type="password"
            autoComplete="off"
          />
          <button className="admin-btn" type="submit" disabled={busy}>
            ذخیره API
          </button>
        </form>

        {!tgStatus?.authorized ? (
          <div className="admin-form" style={{ marginTop: "1.25rem" }}>
            <form className="admin-form" onSubmit={onSendCode}>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="شماره با کد کشور مثل +98912..."
                required
              />
              <button className="admin-btn" type="submit" disabled={busy || !tgStatus?.configured}>
                ارسال کد ورود
              </button>
            </form>
            <form className="admin-form" onSubmit={onSignIn}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="کد تلگرام"
                required
              />
              {needPassword ? (
                <input
                  value={twoFA}
                  onChange={(e) => setTwoFA(e.target.value)}
                  placeholder="رمز دو مرحله‌ای"
                  type="password"
                />
              ) : null}
              <button className="admin-btn" type="submit" disabled={busy}>
                تایید ورود
              </button>
            </form>
          </div>
        ) : null}
      </section>

      <section className="admin-card">
        <h2>افزودن کانال</h2>
        <p className="admin-muted" style={{ marginTop: "-0.4rem" }}>
          یوزرنیم، لینک t.me یا آیدی را بزن تا اعتبارسنجی شود. برای بار اول فقط چند آهنگ آخر گرفته می‌شود؛
          بعدش خودکار پست‌های جدید می‌آید.
        </p>
        <form className="admin-form" onSubmit={onValidateChannel}>
          <input
            value={channelQuery}
            onChange={(e) => setChannelQuery(e.target.value)}
            placeholder="@channel یا https://t.me/channel"
            required
          />
          <button className="admin-btn" type="submit" disabled={busy || !tgStatus?.authorized}>
            اعتبارسنجی کانال
          </button>
        </form>

        {validated ? (
          <form className="admin-form" style={{ marginTop: "1rem" }} onSubmit={onAddValidated}>
            <p className="admin-muted">
              <strong>{validated.title}</strong>
              {validated.username ? ` · @${validated.username}` : ""} · id {validated.telegramId}
            </p>
            <label className="admin-muted" htmlFor="fetch-limit">
              چند آهنگ آخر برای بار اول؟
            </label>
            <input
              id="fetch-limit"
              type="number"
              min={1}
              max={500}
              value={fetchLimit}
              onChange={(e) => setFetchLimit(Number(e.target.value) || 10)}
            />
            <button className="admin-btn" type="submit" disabled={busy}>
              ذخیره و گرفتن آهنگ‌ها
            </button>
          </form>
        ) : null}
      </section>

      <section className="admin-card">
        <h2>کانال‌ها</h2>
        <ul className="admin-list">
          {channels.map((ch) => (
            <li key={ch.id} style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "220px" }}>
                <strong>{ch.title}</strong>
                <div className="admin-muted">
                  {ch.username ? `@${ch.username}` : ch.telegramId} · {ch.trackCount ?? 0} ترک · cursor{" "}
                  {ch.lastMessageId ?? "0"}
                  {ch.isValidated ? " · معتبر" : " · بدون اعتبارسنجی"}
                  {ch.autoSync ? " · سینک خودکار روشن" : " · سینک خودکار خاموش"}
                </div>
                <div className="admin-row-actions">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={limits[ch.id] ?? 50}
                    onChange={(e) =>
                      setLimits((prev) => ({
                        ...prev,
                        [ch.id]: Number(e.target.value) || 50,
                      }))
                    }
                    aria-label="تعداد آهنگ"
                  />
                  <button
                    className="admin-btn"
                    type="button"
                    disabled={busy}
                    onClick={() => onFetchLatest(ch.id)}
                  >
                    بگیر آخرین‌ها
                  </button>
                  <button
                    className="admin-btn admin-btn--ghost"
                    type="button"
                    disabled={busy}
                    onClick={() => onToggleAutoSync(ch)}
                  >
                    {ch.autoSync ? "خاموش کردن خودکار" : "روشن کردن خودکار"}
                  </button>
                </div>
              </div>
            </li>
          ))}
          {!channels.length ? <li className="admin-muted">کانالی نیست.</li> : null}
        </ul>
      </section>

      <AdminTracksPanel />
    </main>
  );
}
