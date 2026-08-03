"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ExternalLink,
  Heart,
  ListMusic,
  Moon,
  Pause,
  Play,
  Radio,
  Repeat,
  Repeat1,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Waveform } from "@/components/Waveform";
import { pushHistory, readLibrary, toggleLike } from "@/lib/library";
import { usePlayer } from "./PlayerProvider";

const FALLBACK_ART = "/images/channel-fallback.png";

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function subscribeLibrary(cb: () => void) {
  window.addEventListener("musicma-library", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("musicma-library", cb);
    window.removeEventListener("storage", cb);
  };
}

function Cover({
  src,
  className,
  alt = "",
}: {
  src?: string | null;
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src || FALLBACK_ART}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.currentTarget.src = FALLBACK_ART;
      }}
    />
  );
}

export function StickyPlayer() {
  const {
    current,
    queue,
    isPlaying,
    progress,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    expanded,
    queueOpen,
    playTrack,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    setExpanded,
    setQueueOpen,
    removeFromQueue,
    radioMode,
    sleepEndsAt,
    toggleRadioMode,
    setSleepTimer,
  } = usePlayer();

  const likes = useSyncExternalStore(
    subscribeLibrary,
    () => readLibrary().likes.join(","),
    () => "",
  );
  const liked = current ? likes.split(",").includes(current.id) : false;
  const [toast, setToast] = useState("");
  const [sleepOpen, setSleepOpen] = useState(false);

  useEffect(() => {
    if (!current) return;
    pushHistory(current, progress);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!current || progress < 3 || Math.floor(progress) % 5 !== 0) return;
    pushHistory(current, progress);
  }, [progress, current]);

  const art = current?.coverUrl || FALLBACK_ART;
  const total = duration || current?.duration || 0;
  const sleepLeftMin =
    sleepEndsAt != null ? Math.max(0, Math.ceil((sleepEndsAt - Date.now()) / 60_000)) : null;

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1800);
  }

  async function shareCurrent(fromSecond = false) {
    if (!current) return;
    const url = new URL(window.location.origin);
    url.searchParams.set("play", current.id);
    if (fromSecond) url.searchParams.set("at", String(Math.floor(progress)));
    const text = `${current.title} — ${current.artist || current.channelTitle || "Musicma"}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: current.title, text, url: url.toString() });
      } else {
        await navigator.clipboard.writeText(url.toString());
        showToast(fromSecond ? "لینک از همین ثانیه کپی شد" : "لینک آهنگ کپی شد");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url.toString());
        showToast("لینک کپی شد");
      } catch {
        showToast("اشتراک‌گذاری ممکن نشد");
      }
    }
  }

  const remaining = useMemo(() => {
    if (!current || !queue.length) return [];
    const idx = queue.findIndex((t) => t.id === current.id);
    if (idx < 0) return queue.filter((t) => t.id !== current.id);
    return [...queue.slice(idx + 1), ...queue.slice(0, idx)];
  }, [current, queue]);

  if (!current) return null;

  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;

  const playerBody = (
    <div className="now-playing__player">
      <Cover src={art} className="now-playing__art" />
      <div className="now-playing__meta">
        <h2>{current.title}</h2>
        <p>{current.artist || current.channelTitle || "ناشناس"}</p>
      </div>
      <Waveform
        peaks={current.waveformPeaks}
        progress={progress}
        duration={total}
        onSeek={seek}
      />
      <div className="now-playing__times">
        <span>{formatTime(progress)}</span>
        <span>{formatTime(total)}</span>
      </div>
      <div className="now-playing__transport">
        <button type="button" className={`icon-btn ${isShuffle ? "is-on" : ""}`} onClick={toggleShuffle} aria-label="تصادفی">
          <Shuffle size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={prev} aria-label="قبلی">
          <SkipForward size={22} />
        </button>
        <button type="button" className="player-dock__play player-dock__play--lg" onClick={toggle} aria-label={isPlaying ? "توقف" : "پخش"}>
          {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>
        <button type="button" className="icon-btn" onClick={next} aria-label="بعدی">
          <SkipBack size={22} />
        </button>
        <button type="button" className={`icon-btn ${repeatMode !== "off" ? "is-on" : ""}`} onClick={cycleRepeat} aria-label="تکرار">
          <RepeatIcon size={18} />
        </button>
      </div>
      <div className="now-playing__extras">
        <button
          type="button"
          className={`chip-btn ${radioMode ? "is-on" : ""}`}
          onClick={() => {
            toggleRadioMode();
            showToast(!radioMode ? "رادیو روشن شد" : "رادیو خاموش شد");
          }}
        >
          <Radio size={14} />
          رادیو
        </button>
        <button type="button" className={`chip-btn ${sleepEndsAt ? "is-on" : ""}`} onClick={() => setSleepOpen((v) => !v)}>
          <Moon size={14} />
          {sleepLeftMin != null ? `${sleepLeftMin}د` : "تایمر خواب"}
        </button>
        <button type="button" className="chip-btn" onClick={() => void shareCurrent(false)}>
          <Share2 size={14} />
          اشتراک
        </button>
        <button type="button" className="chip-btn" onClick={() => void shareCurrent(true)}>
          <Share2 size={14} />
          از این ثانیه
        </button>
      </div>
      {sleepOpen ? (
        <div className="sleep-timer-menu">
          {[15, 30, 45, 60].map((m) => (
            <button
              key={m}
              type="button"
              className="chip-btn"
              onClick={() => {
                setSleepTimer(m);
                setSleepOpen(false);
                showToast(`توقف بعد از ${m} دقیقه`);
              }}
            >
              {m} دقیقه
            </button>
          ))}
          <button
            type="button"
            className="chip-btn"
            onClick={() => {
              setSleepTimer(null);
              setSleepOpen(false);
              showToast("تایمر خاموش شد");
            }}
          >
            خاموش
          </button>
        </div>
      ) : null}
      {(current.playCount != null || current.likeCount != null) && (
        <p className="now-playing__stats">
          {current.playCount != null ? `${current.playCount.toLocaleString("fa-IR")} پخش` : null}
          {current.playCount != null && current.likeCount != null ? " · " : null}
          {current.likeCount != null ? `${current.likeCount.toLocaleString("fa-IR")} لایک` : null}
        </p>
      )}
      {current.telegramPostUrl ? (
        <a className="section-link now-playing__tg" href={current.telegramPostUrl} target="_blank" rel="noreferrer">
          مشاهده پست اصلی در تلگرام <ExternalLink size={14} />
        </a>
      ) : null}
      {current.caption ? <p className="now-playing__caption">{current.caption}</p> : null}
    </div>
  );

  const queuePanel = (
    <aside className="now-playing__side">
      <div className="now-playing__queue-head">
        <h3>صف پخش</h3>
        <span>{queue.length} آهنگ</span>
      </div>
      <ul className="now-playing__queue-list">
        {queue.map((t, i) => {
          const active = t.id === current.id;
          return (
            <li key={`${t.id}-${i}`}>
              <button
                type="button"
                className={`now-playing__queue-row ${active ? "is-active" : ""}`}
                onClick={() => playTrack(t, queue)}
              >
                <Cover src={t.coverUrl} className="now-playing__queue-cover" />
                <span className="now-playing__queue-meta">
                  <span className="now-playing__queue-title">{t.title}</span>
                  <span className="now-playing__queue-artist">
                    {t.artist || t.channelTitle || "ناشناس"}
                  </span>
                </span>
                <span className="now-playing__queue-duration">
                  {active && isPlaying ? "♪" : formatTime(t.duration || 0)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );

  return (
    <>
      <div className="player-dock" data-expanded={expanded ? "true" : "false"}>
        <div className="player-dock__shell">
          <div className="player-dock__inner">
            <button
              type="button"
              className="player-dock__meta"
              onClick={() => setExpanded(true)}
            >
              <Cover src={art} className="player-dock__cover" />
              <span>
                <strong>{current.title}</strong>
                <small>{current.artist || current.channelTitle || "ناشناس"}</small>
              </span>
            </button>

            <div className="player-dock__controls">
              <button type="button" className={`icon-btn ${isShuffle ? "is-on" : ""}`} onClick={toggleShuffle} aria-label="تصادفی">
                <Shuffle size={16} />
              </button>
              <button type="button" className="icon-btn" onClick={prev} aria-label="قبلی">
                <SkipForward size={18} />
              </button>
              <button type="button" className="player-dock__play" onClick={toggle} aria-label={isPlaying ? "توقف" : "پخش"}>
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>
              <button type="button" className="icon-btn" onClick={next} aria-label="بعدی">
                <SkipBack size={18} />
              </button>
              <button
                type="button"
                className={`icon-btn ${repeatMode !== "off" ? "is-on" : ""}`}
                onClick={cycleRepeat}
                aria-label="تکرار"
              >
                <RepeatIcon size={16} />
              </button>
            </div>

            <div className="player-dock__end">
              <button type="button" className="icon-btn" onClick={toggleMute} aria-label="صدا">
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                className="player-dock__volume"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="بلندی صدا"
              />
              <button
                type="button"
                className={`icon-btn ${liked ? "is-on" : ""}`}
                onClick={() => {
                  const on = toggleLike(current.id);
                  setToast(on ? "به علاقه‌مندی‌ها اضافه شد" : "از علاقه‌مندی‌ها حذف شد");
                  setTimeout(() => setToast(""), 1600);
                }}
                aria-label="لایک"
              >
                <Heart size={16} fill={liked ? "currentColor" : "none"} />
              </button>
              <button type="button" className="icon-btn" onClick={() => setQueueOpen(!queueOpen)} aria-label="صف پخش">
                <ListMusic size={16} />
              </button>
            </div>
          </div>

          <div className="player-dock__progress">
            <span>{formatTime(progress)}</span>
            <input
              type="range"
              min={0}
              max={total || 0}
              step={0.1}
              value={progress}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="نوار زمان"
              style={
                {
                  "--seek": `${total > 0 ? (progress / total) * 100 : 0}%`,
                } as CSSProperties
              }
            />
            <span>{formatTime(total)}</span>
          </div>
        </div>
      </div>

      {queueOpen && !expanded ? (
        <aside className="queue-drawer" aria-label="صف پخش">
          <div className="queue-drawer__head">
            <h3>صف پخش</h3>
            <button type="button" className="icon-btn" onClick={() => setQueueOpen(false)} aria-label="بستن">
              <X size={16} />
            </button>
          </div>
          <ul>
            {queue.map((t, i) => (
              <li key={`${t.id}-${i}`}>
                <button type="button" className="queue-drawer__row" onClick={() => playTrack(t, queue)}>
                  <Cover src={t.coverUrl} className="queue-drawer__cover" />
                  <span>
                    <strong>{t.title}</strong>
                    <small>{t.artist || t.channelTitle}</small>
                  </span>
                </button>
                <button type="button" className="icon-btn" onClick={() => removeFromQueue(t.id)} aria-label="حذف از صف">
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      <AnimatePresence>
        {expanded ? (
          <motion.div
            className="now-playing"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 28 }}
            transition={{ duration: 0.28 }}
          >
            <div className="now-playing__backdrop" aria-hidden>
              <Cover src={art} className="now-playing__backdrop-img" />
              <div className="now-playing__backdrop-veil" />
            </div>

            <header className="now-playing__top">
              <button
                type="button"
                className="now-playing__close"
                onClick={() => setExpanded(false)}
                aria-label="بستن پخش‌کننده"
              >
                <ChevronDown size={20} />
                <span>بستن</span>
              </button>
              <div className="now-playing__eyebrow">در حال پخش</div>
              <span className="now-playing__top-spacer" />
            </header>

            <div className="now-playing__layout">
              {/* RTL: first column sits on the right → player right, queue left */}
              {playerBody}
              {queuePanel}
            </div>

            {remaining.length ? (
              <p className="now-playing__next-hint">
                بعدی: {remaining[0]?.title}
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
