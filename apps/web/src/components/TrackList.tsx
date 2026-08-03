"use client";

import { Heart, ListPlus, Play } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerProvider";
import { readLibrary, toggleLike, toggleSave } from "@/lib/library";
import type { PlayerTrack } from "@/types/player";
import { useSyncExternalStore } from "react";

const FALLBACK = "/images/channel-fallback.png";

function formatDuration(sec: number | null) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function subscribe(cb: () => void) {
  window.addEventListener("musicma-library", cb);
  return () => window.removeEventListener("musicma-library", cb);
}

export function TrackList({
  tracks,
  compact = false,
}: {
  tracks: PlayerTrack[];
  compact?: boolean;
}) {
  const { playTrack, current, isPlaying, addToQueue } = usePlayer();
  const likesKey = useSyncExternalStore(
    subscribe,
    () => readLibrary().likes.join(","),
    () => "",
  );

  if (!tracks.length) {
    return <p className="empty-state">هنوز آهنگی اینجا نیست.</p>;
  }

  return (
    <ul className={`track-list ${compact ? "track-list--compact" : ""}`}>
      {tracks.map((track, index) => {
        const active = current?.id === track.id;
        const liked = likesKey.split(",").includes(track.id);
        return (
          <li key={track.id}>
            <div className={`track-row ${active ? "track-row--active" : ""}`}>
              <button
                type="button"
                className="track-row__main"
                onClick={(e) => {
                  e.preventDefault();
                  playTrack(track, tracks);
                }}
              >
                <span className="track-row__index">
                  {active && isPlaying ? "♪" : String(index + 1).padStart(2, "0")}
                </span>
                <span className="track-row__cover">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={track.coverUrl || FALLBACK}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK;
                    }}
                  />
                </span>
                <span className="track-row__text">
                  <span className="track-row__title">{track.title}</span>
                  <span className="track-row__artist">
                    {track.artist || track.channelTitle || "ناشناس"}
                    {typeof track.playCount === "number" && track.playCount > 0
                      ? ` · ${track.playCount.toLocaleString("fa-IR")} پخش`
                      : ""}
                  </span>
                </span>
                <span className="track-row__duration">{formatDuration(track.duration)}</span>
                <span className="track-row__play" aria-hidden>
                  <Play size={12} fill="currentColor" />
                </span>
              </button>
              <div className="track-row__actions">
                <button
                  type="button"
                  className={`icon-btn ${liked ? "is-on" : ""}`}
                  aria-label="لایک"
                  onClick={() => toggleLike(track.id)}
                >
                  <Heart size={15} fill={liked ? "currentColor" : "none"} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="افزودن به صف"
                  onClick={() => addToQueue(track)}
                >
                  <ListPlus size={15} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="ذخیره برای بعد"
                  title="ذخیره برای بعد"
                  onClick={() => toggleSave(track.id)}
                >
                  +
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
