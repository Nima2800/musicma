"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Heart,
  Pause,
  Play,
  Radio,
  RefreshCw,
  SkipBack,
  Trash2,
  X,
} from "lucide-react";
import { usePlayer } from "@/components/player/PlayerProvider";
import { EMPTY_LIBRARY, readLibrary } from "@/lib/library";
import type { PublicChannel } from "@/lib/serialize";
import type { PlayerTrack } from "@/types/player";

const PREFS_KEY = "musicma.radio.prefs.v1";
const FALLBACK = "/images/channel-fallback.png";

type Prefs = {
  channelIds: string[];
  likesOnly: boolean;
};

function subscribeLib(cb: () => void) {
  window.addEventListener("musicma-library", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("musicma-library", cb);
    window.removeEventListener("storage", cb);
  };
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { channelIds: [], likesOnly: false };
    return { channelIds: [], likesOnly: false, ...JSON.parse(raw) };
  } catch {
    return { channelIds: [], likesOnly: false };
  }
}

function savePrefs(p: Prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RadioStudio({ channels }: { channels: PublicChannel[] }) {
  const {
    current,
    queue,
    isPlaying,
    progress,
    duration,
    playTrack,
    toggle,
    next,
    removeFromQueue,
    reorderQueue,
    replaceQueue,
    setRadioMode,
    setExpanded,
    seek,
  } = usePlayer();

  const [prefs, setPrefs] = useState<Prefs>({ channelIds: [], likesOnly: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<{ unheardCount?: number } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const autoStarted = useRef(false);
  const refillLock = useRef(false);

  const libSnap = useSyncExternalStore(
    subscribeLib,
    () => JSON.stringify(readLibrary()),
    () => "",
  );
  // Fallback must match SSR output — never touch localStorage during hydration.
  const lib = useMemo(
    () => (libSnap ? (JSON.parse(libSnap) as ReturnType<typeof readLibrary>) : EMPTY_LIBRARY),
    [libSnap],
  );

  useEffect(() => {
    setPrefs(loadPrefs());
    setExpanded(false);
    setRadioMode(true);
    return () => {
      // leave radioMode on so continuous play keeps working after leaving
    };
  }, [setExpanded, setRadioMode]);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const heardIds = useMemo(() => lib.history.map((h) => h.track.id), [lib.history]);

  const fetchMix = useCallback(
    async (opts?: {
      append?: boolean;
      autoplay?: boolean;
      channelIds?: string[];
      likesOnly?: boolean;
      silent?: boolean;
    }) => {
      const channelIds = opts?.channelIds ?? prefs.channelIds;
      const likesOnly = opts?.likesOnly ?? prefs.likesOnly;
      if (!opts?.silent) {
        setLoading(true);
        setError("");
      }
      try {
        const res = await fetch("/api/radio/mix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelIds,
            likesOnly,
            likedIds: lib.likes,
            excludeIds: heardIds,
            limit: opts?.append ? 16 : 28,
          }),
        });
        const data = (await res.json()) as {
          tracks: PlayerTrack[];
          meta?: { unheardCount?: number; message?: string; reason?: string };
        };
        setMeta(data.meta || null);
        if (!data.tracks?.length) {
          if (!opts?.append) setError(data.meta?.message || "آهنگی برای رادیو پیدا نشد.");
          return [] as PlayerTrack[];
        }

        if (opts?.append) {
          const existing = new Set(queue.map((t) => t.id));
          if (current) existing.add(current.id);
          const extra = data.tracks.filter((t) => !existing.has(t.id));
          if (extra.length) replaceQueue([...queue, ...extra]);
          return extra;
        }

        const start = data.tracks[0];
        playTrack(start, data.tracks, { expand: false });
        setRadioMode(true);
        return data.tracks;
      } catch {
        if (!opts?.silent) setError("اتصال به رادیو برقرار نشد. دوباره تلاش کن.");
        return [] as PlayerTrack[];
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [
      prefs.channelIds,
      prefs.likesOnly,
      lib.likes,
      heardIds,
      current,
      queue,
      playTrack,
      replaceQueue,
      setRadioMode,
    ],
  );

  // Auto-start once on first visit if nothing is playing
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    if (!current) void fetchMix({ autoplay: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refill when queue is running low
  useEffect(() => {
    if (!current || !queue.length || refillLock.current) return;
    const idx = queue.findIndex((t) => t.id === current.id);
    const remaining = idx < 0 ? queue.length : queue.length - idx - 1;
    if (remaining > 3) return;
    refillLock.current = true;
    void fetchMix({ append: true, silent: true }).finally(() => {
      window.setTimeout(() => {
        refillLock.current = false;
      }, 2500);
    });
  }, [current, queue, fetchMix]);

  const total = duration || current?.duration || 0;
  const selectedCount = prefs.channelIds.length;

  function applyQueueForChannels(nextIds: string[], nextQueue: PlayerTrack[]) {
    replaceQueue(nextQueue);
    if (!current) {
      if (nextQueue[0]) playTrack(nextQueue[0], nextQueue, { expand: false });
      return;
    }
    const stillOk =
      nextIds.length === 0 ||
      !current.channelId ||
      nextIds.includes(current.channelId);
    if (!stillOk) {
      const pick = nextQueue.find((t) => t.id !== current.id) || nextQueue[0];
      if (pick) playTrack(pick, nextQueue, { expand: false });
    }
  }

  function toggleChannel(id: string) {
    const wasOn = prefs.channelIds.includes(id);
    const nextIds = wasOn
      ? prefs.channelIds.filter((x) => x !== id)
      : [...prefs.channelIds, id];
    setPrefs((p) => ({ ...p, channelIds: nextIds }));
    setError("");

    if (wasOn) {
      // Instant remove: drop that channel's tracks from the queue.
      if (nextIds.length === 0) {
        // Back to all channels — keep current queue, top up in background.
        void fetchMix({ append: true, channelIds: [], silent: true });
        return;
      }
      const kept = queue.filter((t) => t.channelId && nextIds.includes(t.channelId));
      applyQueueForChannels(nextIds, kept);
      if (kept.length < 6) {
        void fetchMix({ append: true, channelIds: nextIds, silent: true }).then((extra) => {
          if (!extra.length) return;
          const existing = new Set(kept.map((t) => t.id));
          const merged = [...kept, ...extra.filter((t) => !existing.has(t.id))];
          applyQueueForChannels(nextIds, merged);
        });
      }
      return;
    }

    // Instant add: keep matching tracks, pull fresh ones from this channel.
    const base =
      prefs.channelIds.length === 0
        ? queue.filter((t) => t.channelId === id || !t.channelId)
        : queue.filter(
            (t) => t.channelId && (nextIds.includes(t.channelId) || t.channelId === id),
          );
    // When going from "all" to first selected channel, narrow immediately.
    const narrowed =
      prefs.channelIds.length === 0
        ? queue.filter((t) => t.channelId === id)
        : base;
    applyQueueForChannels(nextIds, narrowed);
    void fetchMix({ append: true, channelIds: [id], silent: true }).then((extra) => {
      if (!extra.length) return;
      const existing = new Set(narrowed.map((t) => t.id));
      if (current) existing.add(current.id);
      const merged = [...narrowed, ...extra.filter((t) => !existing.has(t.id))];
      applyQueueForChannels(nextIds, merged);
    });
  }

  function toggleLikesOnly() {
    const next = !prefs.likesOnly;
    setPrefs((p) => ({ ...p, likesOnly: next }));
    void fetchMix({
      autoplay: true,
      likesOnly: next,
      channelIds: prefs.channelIds,
    });
  }

  function onDrop(toIndex: number) {
    if (dragIndex == null || dragIndex === toIndex) {
      setDragIndex(null);
      return;
    }
    reorderQueue(dragIndex, toIndex);
    setDragIndex(null);
  }

  return (
    <div className="radio-studio">
      <header className="radio-studio__head">
        <div className="radio-studio__title">
          <span className="radio-studio__live" aria-hidden>
            <span />
            On Air
          </span>
          <h1>
            <Radio size={22} aria-hidden />
            رادیو
          </h1>
          <p>
            میکسی تازه از آهنگ‌هایی که هنوز نشنیدی — کانال‌ها را انتخاب کن و بگذار پخش شود.
          </p>
        </div>
        <div className="radio-studio__actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            onClick={() => void fetchMix({ autoplay: true })}
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="spin" />
                در حال ساخت میکس…
              </>
            ) : current ? (
              <>
                <RefreshCw size={16} />
                میکس تازه
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                شروع رادیو
              </>
            )}
          </button>
          <button
            type="button"
            className={`radio-toggle ${prefs.likesOnly ? "is-on" : ""}`}
            onClick={toggleLikesOnly}
          >
            <Heart size={15} fill={prefs.likesOnly ? "currentColor" : "none"} />
            فقط لایک‌ها
          </button>
        </div>
      </header>

      <section className="radio-studio__channels" aria-label="انتخاب کانال">
        <div className="radio-studio__channels-head">
          <h2>کانال‌ها</h2>
          <span>
            {selectedCount === 0 ? "همه کانال‌ها" : `${selectedCount} کانال انتخاب‌شده`}
          </span>
          {selectedCount > 0 ? (
            <button
              type="button"
              className="section-link"
              onClick={() => setPrefs((p) => ({ ...p, channelIds: [] }))}
            >
              پاک کردن
            </button>
          ) : null}
        </div>
        <div className="radio-channel-row">
          {channels.map((ch) => {
            const on = prefs.channelIds.includes(ch.id);
            return (
              <button
                key={ch.id}
                type="button"
                className={`radio-channel-chip ${on ? "is-on" : ""}`}
                onClick={() => toggleChannel(ch.id)}
                aria-pressed={on}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ch.coverUrl || FALLBACK}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.src = FALLBACK;
                  }}
                />
                <span>{ch.title}</span>
              </button>
            );
          })}
        </div>
      </section>

      {error ? <p className="radio-studio__error">{error}</p> : null}
      {meta?.unheardCount != null && !error ? (
        <p className="radio-studio__hint">
          حدود {meta.unheardCount.toLocaleString("fa-IR")} آهنگ نشنیده در این فیلتر
        </p>
      ) : null}

      <div className="radio-studio__stage">
        {/* RTL: first column sits on the physical right → queue right, player left */}
        <aside className="radio-queue" aria-label="صف پخش رادیو">
          <div className="radio-queue__head">
            <h2>صف پخش</h2>
            <span>{queue.length} آهنگ</span>
          </div>
          {queue.length ? (
            <ul className="radio-queue__list scroll-soft">
              {queue.map((t, i) => {
                const active = t.id === current?.id;
                return (
                  <li
                    key={`${t.id}-${i}`}
                    className={`radio-queue__row ${active ? "is-active" : ""} ${dragIndex === i ? "is-dragging" : ""}`}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(i)}
                    onDragEnd={() => setDragIndex(null)}
                  >
                    <span className="radio-queue__grip" aria-hidden>
                      <GripVertical size={14} />
                    </span>
                    <button
                      type="button"
                      className="radio-queue__main"
                      onClick={() => playTrack(t, queue, { expand: false })}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={t.coverUrl || FALLBACK}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK;
                        }}
                      />
                      <span>
                        <strong>{t.title}</strong>
                        <small>{t.artist || t.channelTitle || "ناشناس"}</small>
                      </span>
                      {active && isPlaying ? <em>♪</em> : null}
                    </button>
                    <div className="radio-queue__ops">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="بالا"
                        disabled={i === 0}
                        onClick={() => reorderQueue(i, i - 1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="پایین"
                        disabled={i === queue.length - 1}
                        onClick={() => reorderQueue(i, i + 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="حذف از صف"
                        disabled={active}
                        onClick={() => removeFromQueue(t.id)}
                      >
                        {active ? <X size={14} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-state">صف خالی است. میکس را شروع کن.</p>
          )}
        </aside>

        <section className="radio-now" aria-label="در حال پخش">
          {current ? (
            <>
              <div className="radio-now__backdrop" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={current.coverUrl || FALLBACK} alt="" />
              </div>
              <span className="radio-now__live" aria-hidden>
                <span />
                ON AIR
              </span>
              <div className="radio-now__art-wrap">
                <div className="vinyl-disc radio-now__disc" data-playing={isPlaying ? "1" : "0"}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="radio-now__art"
                    src={current.coverUrl || FALLBACK}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK;
                    }}
                  />
                </div>
                <div className="radio-now__eq" aria-hidden data-playing={isPlaying ? "1" : "0"}>
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="radio-now__meta">
                <p className="radio-now__eyebrow">الان پخش می‌شود</p>
                <h2>{current.title}</h2>
                <p>{current.artist || current.channelTitle || "ناشناس"}</p>
              </div>
              <div className="radio-now__seek">
                <span>{formatTime(progress)}</span>
                <button
                  type="button"
                  className="radio-now__bar"
                  aria-label="جابه‌جایی در آهنگ"
                  style={{ ["--p" as string]: `${total > 0 ? (progress / total) * 100 : 0}%` }}
                  onClick={(e) => {
                    if (!total) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
                    const x = e.clientX - rect.left;
                    const ratio = rtl ? 1 - x / rect.width : x / rect.width;
                    seek(Math.max(0, Math.min(total, ratio * total)));
                  }}
                />
                <span>{formatTime(total)}</span>
              </div>
              <div className="radio-now__transport">
                <button type="button" className="player-dock__play player-dock__play--lg" onClick={toggle}>
                  {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
                </button>
                <button type="button" className="btn btn-ghost" onClick={next}>
                  <SkipBack size={16} />
                  بعدی
                </button>
              </div>
            </>
          ) : (
            <div className="radio-now__empty">
              <Radio size={36} />
              <h2>رادیو خاموش است</h2>
              <p>کانال‌ها را انتخاب کن و شروع رادیو را بزن.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
