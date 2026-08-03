"use client";

import { FormEvent, useEffect, useState } from "react";
import type { PublicTrack } from "@/lib/serialize";

type Stats = {
  tracks: number;
  channels: number;
  playsWeek: number;
  broken: number;
  unpublished: number;
  topTracks: { id: string; title: string; playCount: number; artist: string | null }[];
};

export function AdminTracksPanel() {
  const [tracks, setTracks] = useState<PublicTrack[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<PublicTrack | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load(search = q) {
    const [tRes, sRes] = await Promise.all([
      fetch(`/api/admin/tracks?q=${encodeURIComponent(search)}`),
      fetch("/api/admin/stats"),
    ]);
    if (tRes.ok) {
      const data = (await tRes.json()) as { tracks: PublicTrack[] };
      setTracks(data.tracks);
    }
    if (sRes.ok) setStats((await sRes.json()) as Stats);
  }

  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load(q);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    const res = await fetch("/api/admin/tracks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        title: editing.title,
        artist: editing.artist,
        album: editing.album,
        genre: editing.genre,
        mood: editing.mood,
        language: editing.language,
        isRemix: editing.isRemix,
        isInstrumental: editing.isInstrumental,
        isPublished: editing.isPublished,
        isFeatured: editing.isFeatured,
        caption: editing.caption,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg("ذخیره نشد");
      return;
    }
    setMsg("آهنگ ذخیره شد");
    setEditing(null);
    await load();
  }

  async function toggleFeatured(track: PublicTrack, featured: boolean) {
    await fetch("/api/admin/tracks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: track.id, isFeatured: featured }),
    });
    await load();
  }

  async function togglePublished(track: PublicTrack, published: boolean) {
    await fetch("/api/admin/tracks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: track.id, isPublished: published }),
    });
    await load();
  }

  return (
    <>
      <section className="admin-card">
        <h2>آمار</h2>
        {stats ? (
          <div className="chip-row">
            <span className="chip">{stats.tracks} آهنگ</span>
            <span className="chip">{stats.channels} کانال</span>
            <span className="chip">{stats.playsWeek} پخش هفته</span>
            <span className="chip">{stats.broken} خراب/حذف‌شده</span>
            <span className="chip">{stats.unpublished} در انتظار انتشار</span>
          </div>
        ) : (
          <p className="admin-muted">در حال بارگذاری…</p>
        )}
        {stats?.topTracks?.length ? (
          <ul className="admin-list" style={{ marginTop: "1rem" }}>
            {stats.topTracks.map((t) => (
              <li key={t.id}>
                <div>
                  <strong>{t.title}</strong>
                  <div className="admin-muted">
                    {t.artist || "—"} · {t.playCount} پخش
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="admin-card">
        <h2>ویرایش آهنگ‌ها</h2>
        <form className="admin-form" onSubmit={onSearch}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی عنوان یا خواننده" />
          <button className="admin-btn" type="submit">بگرد</button>
        </form>
        {msg ? <p className="admin-muted">{msg}</p> : null}
        <ul className="admin-list">
          {tracks.map((t) => (
            <li key={t.id}>
              <div style={{ flex: 1 }}>
                <strong>{t.title}</strong>
                <div className="admin-muted">
                  {t.artist || "—"} · {t.channelTitle} · {t.playCount} پخش
                  {t.quality ? ` · ${t.quality}` : ""}
                  {t.mood ? ` · ${t.mood}` : ""}
                </div>
                <div className="admin-row-actions">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setEditing(t)}>
                    ویرایش
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={() => toggleFeatured(t, true)}
                  >
                    ویژه Hero
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={() => togglePublished(t, false)}
                  >
                    عدم انتشار
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {editing ? (
          <form className="admin-form" style={{ marginTop: "1rem" }} onSubmit={onSave}>
            <input
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="عنوان"
              required
            />
            <input
              value={editing.artist || ""}
              onChange={(e) => setEditing({ ...editing, artist: e.target.value || null })}
              placeholder="خواننده"
            />
            <input
              value={editing.album || ""}
              onChange={(e) => setEditing({ ...editing, album: e.target.value || null })}
              placeholder="آلبوم"
            />
            <input
              value={editing.genre || ""}
              onChange={(e) => setEditing({ ...editing, genre: e.target.value || null })}
              placeholder="سبک"
            />
            <select
              value={editing.mood || ""}
              onChange={(e) => setEditing({ ...editing, mood: e.target.value || null })}
            >
              <option value="">حال‌وهوا</option>
              <option value="happy">شاد</option>
              <option value="sad">غمگین</option>
              <option value="calm">آرام</option>
              <option value="energetic">انرژی‌دار</option>
            </select>
            <select
              value={editing.language || ""}
              onChange={(e) => setEditing({ ...editing, language: e.target.value || null })}
            >
              <option value="">زبان</option>
              <option value="fa">ایرانی</option>
              <option value="en">خارجی</option>
              <option value="other">دیگر</option>
            </select>
            <textarea
              value={editing.caption || ""}
              onChange={(e) => setEditing({ ...editing, caption: e.target.value || null })}
              placeholder="کپشن"
              rows={3}
              style={{ width: "100%", borderRadius: 10, padding: 10 }}
            />
            <label className="admin-muted">
              <input
                type="checkbox"
                checked={editing.isRemix}
                onChange={(e) => setEditing({ ...editing, isRemix: e.target.checked })}
              />{" "}
              ریمیکس
            </label>
            <label className="admin-muted">
              <input
                type="checkbox"
                checked={editing.isInstrumental}
                onChange={(e) => setEditing({ ...editing, isInstrumental: e.target.checked })}
              />{" "}
              بی‌کلام
            </label>
            <button className="admin-btn" type="submit" disabled={busy}>
              ذخیره تغییرات
            </button>
            <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setEditing(null)}>
              انصراف
            </button>
          </form>
        ) : null}
      </section>
    </>
  );
}
