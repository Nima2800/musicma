"use client";

import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import { TrackList } from "@/components/TrackList";
import {
  addToPlaylist,
  createPlaylist,
  EMPTY_LIBRARY,
  readLibrary,
  type PlaylistLocal,
} from "@/lib/library";

function subscribe(cb: () => void) {
  window.addEventListener("musicma-library", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("musicma-library", cb);
    window.removeEventListener("storage", cb);
  };
}

export default function LibraryPage() {
  const snap = useSyncExternalStore(subscribe, () => JSON.stringify(readLibrary()), () => "");
  // Fallback must match SSR output — never touch localStorage during hydration.
  const lib = useMemo(
    () => (snap ? (JSON.parse(snap) as ReturnType<typeof readLibrary>) : EMPTY_LIBRARY),
    [snap],
  );
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const likedTracks = lib.history
    .filter((h) => lib.likes.includes(h.track.id))
    .map((h) => h.track);
  const savedTracks = lib.history
    .filter((h) => lib.saves.includes(h.track.id))
    .map((h) => h.track);
  const recent = lib.history.map((h) => h.track);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createPlaylist(name.trim(), isPublic);
    setName("");
  }

  function sharePlaylist(pl: PlaylistLocal) {
    const url = `${window.location.origin}/library?playlist=${pl.id}`;
    void navigator.clipboard?.writeText(url);
    alert(pl.isPublic ? "لینک کپی شد" : "پلی‌لیست خصوصی است؛ لینک محلی کپی شد");
  }

  return (
    <main>
      <header className="page-head">
        <h1 className="page-title">کتابخانه من</h1>
        <p className="page-lede">علاقه‌مندی‌ها، ذخیره‌ها، تاریخچه و پلی‌لیست‌ها (ذخیره روی مرورگر)</p>
      </header>

      <section className="section-block">
        <div className="section-head">
          <h2 className="section-title">پلی‌لیست جدید</h2>
        </div>
        <form className="admin-form" onSubmit={onCreate}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="نام پلی‌لیست"
          />
          <label className="admin-muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            عمومی
          </label>
          <button type="submit" className="admin-btn">بساز</button>
        </form>
        <ul className="admin-list">
          {lib.playlists.map((pl) => (
            <li key={pl.id}>
              <div>
                <strong>{pl.name}</strong>
                <div className="admin-muted">
                  {pl.trackIds.length} آهنگ · {pl.isPublic ? "عمومی" : "خصوصی"}
                </div>
                <div className="admin-row-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={() => {
                      const last = lib.history[0]?.track.id;
                      if (last) addToPlaylist(pl.id, last);
                    }}
                  >
                    آخرین آهنگ را اضافه کن
                  </button>
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => sharePlaylist(pl)}>
                    اشتراک‌گذاری
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="section-block">
        <div className="section-head"><h2 className="section-title">علاقه‌مندی‌ها</h2></div>
        <TrackList tracks={likedTracks} />
      </section>
      <section className="section-block">
        <div className="section-head"><h2 className="section-title">ذخیره برای بعد</h2></div>
        <TrackList tracks={savedTracks} />
      </section>
      <section className="section-block">
        <div className="section-head"><h2 className="section-title">تاریخچه پخش</h2></div>
        <TrackList tracks={recent} />
      </section>
    </main>
  );
}
