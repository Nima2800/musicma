"use client";

import { useMemo, useSyncExternalStore } from "react";
import { TrackList } from "@/components/TrackList";
import { usePlayer } from "@/components/player/PlayerProvider";
import { EMPTY_LIBRARY, readLibrary } from "@/lib/library";
import type { PlayerTrack } from "@/types/player";
import type { PublicTrack } from "@/lib/serialize";
import { toPlayerTrack } from "@/lib/serialize";

function subscribe(cb: () => void) {
  window.addEventListener("musicma-library", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("musicma-library", cb);
    window.removeEventListener("storage", cb);
  };
}

function useLibrary() {
  const snap = useSyncExternalStore(subscribe, () => JSON.stringify(readLibrary()), () => "");
  // Fallback must match SSR output — never touch localStorage during hydration.
  return useMemo(
    () => (snap ? (JSON.parse(snap) as ReturnType<typeof readLibrary>) : EMPTY_LIBRARY),
    [snap],
  );
}

export function HeroPlay({ track, queue }: { track: PlayerTrack; queue: PlayerTrack[] }) {
  const { playTrack } = usePlayer();
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => playTrack(track, queue.length ? queue : [track])}
    >
      پخش ویژه
    </button>
  );
}

export function ContinueListening() {
  const lib = useLibrary();
  const cont = lib.history.find((h) => (lib.continueAt[h.track.id] || 0) > 5)?.track;
  if (!cont) return null;
  return (
    <section className="section-block">
      <div className="section-head">
        <h2 className="section-title">ادامه شنیدن</h2>
      </div>
      <TrackList tracks={[cont]} />
    </section>
  );
}

export function RecentlyPlayed() {
  const lib = useLibrary();
  const recent = lib.history.slice(0, 8).map((h) => h.track);
  if (!recent.length) return null;
  return (
    <section className="section-block">
      <div className="section-head">
        <h2 className="section-title">اخیراً پخش‌شده</h2>
      </div>
      <TrackList tracks={recent} />
    </section>
  );
}

/** @deprecated use ContinueListening + RecentlyPlayed */
export function ContinueAndRecent() {
  return (
    <>
      <ContinueListening />
      <RecentlyPlayed />
    </>
  );
}

export function ForYouFallback({ tracks }: { tracks: PublicTrack[] }) {
  const lib = useLibrary();
  const likedIds = new Set(lib.likes);
  const preferredMoods = new Set(
    lib.history.map((h) => h.track.mood).filter(Boolean) as string[],
  );
  const scored = tracks
    .map((t) => {
      let score = t.playCount;
      if (likedIds.has(t.id)) score += 50;
      if (t.mood && preferredMoods.has(t.mood)) score += 20;
      return { t, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t)
    .slice(0, 12);

  if (!scored.length) return null;
  return (
    <section className="section-block">
      <div className="section-head">
        <h2 className="section-title">پیشنهاد برای شما</h2>
      </div>
      <TrackList tracks={scored.map(toPlayerTrack)} />
    </section>
  );
}
