"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PlayerTrack, RepeatMode } from "@/types/player";

type PlayerContextValue = {
  current: PlayerTrack | null;
  queue: PlayerTrack[];
  isPlaying: boolean;
  isBuffering: boolean;
  progress: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  expanded: boolean;
  queueOpen: boolean;
  radioMode: boolean;
  sleepEndsAt: number | null;
  playTrack: (
    track: PlayerTrack,
    queue?: PlayerTrack[],
    opts?: { expand?: boolean },
  ) => void;
  addToQueue: (track: PlayerTrack) => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  replaceQueue: (tracks: PlayerTrack[]) => void;
  setRadioMode: (on: boolean) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setExpanded: (v: boolean) => void;
  setQueueOpen: (v: boolean) => void;
  toggleRadioMode: () => void;
  setSleepTimer: (minutes: number | null) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);
const STORAGE_KEY = "musicma.player.v1";

function pickNext(
  queue: PlayerTrack[],
  currentId: string,
  shuffle: boolean,
  repeatMode: RepeatMode,
) {
  if (!queue.length) return undefined;
  const idx = queue.findIndex((t) => t.id === currentId);
  if (shuffle) {
    if (queue.length === 1) return repeatMode === "off" ? undefined : queue[0];
    let nextIdx = idx;
    while (nextIdx === idx) nextIdx = Math.floor(Math.random() * queue.length);
    return queue[nextIdx];
  }
  if (idx >= 0 && idx < queue.length - 1) return queue[idx + 1];
  if (repeatMode === "all") return queue[0];
  return undefined;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<PlayerTrack | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [expanded, setExpanded] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [radioMode, setRadioMode] = useState(false);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const shuffleRef = useRef(isShuffle);
  const repeatRef = useRef(repeatMode);
  const radioRef = useRef(radioMode);
  const currentRef = useRef(current);
  const queueRef = useRef(queue);
  const restoredRef = useRef(false);
  const playTrackRef = useRef<
    (track: PlayerTrack, queue?: PlayerTrack[], opts?: { expand?: boolean }) => void
  >(() => undefined);

  useEffect(() => {
    shuffleRef.current = isShuffle;
    repeatRef.current = repeatMode;
    radioRef.current = radioMode;
    currentRef.current = current;
    queueRef.current = queue;
  }, [isShuffle, repeatMode, radioMode, current, queue]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        current?: PlayerTrack | null;
        queue?: PlayerTrack[];
        progress?: number;
        volume?: number;
        isShuffle?: boolean;
        repeatMode?: RepeatMode;
      };
      if (data.queue) setQueue(data.queue);
      if (data.current) setCurrent(data.current);
      if (typeof data.volume === "number") setVolumeState(data.volume);
      if (typeof data.isShuffle === "boolean") setIsShuffle(data.isShuffle);
      if (data.repeatMode) setRepeatMode(data.repeatMode);
      if (typeof data.progress === "number") setProgress(data.progress);
      restoredRef.current = true;
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          current,
          queue,
          progress,
          volume,
          isShuffle,
          repeatMode,
        }),
      );
    } catch {
      // ignore
    }
  }, [current, queue, progress, volume, isShuffle, repeatMode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.preload = "metadata";
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.volume = volume;

    const onTime = () => setProgress(audio.currentTime || 0);
    const onMeta = () => setDuration(audio.duration || 0);
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => setIsBuffering(false);
    const onEnded = () => {
      if (repeatRef.current === "one" && audioRef.current) {
        audioRef.current.currentTime = 0;
        void audioRef.current.play().catch(() => undefined);
        return;
      }
      const cur = currentRef.current;
      if (!cur) return;
      const nextTrack = pickNext(
        queueRef.current,
        cur.id,
        shuffleRef.current,
        repeatRef.current,
      );
      if (nextTrack) {
        playTrackRef.current(nextTrack, undefined, { expand: false });
        return;
      }
      if (!radioRef.current) return;
      let prefs: { channelIds?: string[]; likesOnly?: boolean } = {};
      let likedIds: string[] = [];
      let excludeIds: string[] = queueRef.current.map((t) => t.id);
      try {
        prefs = JSON.parse(localStorage.getItem("musicma.radio.prefs.v1") || "{}");
        const lib = JSON.parse(localStorage.getItem("musicma.library.v1") || "{}") as {
          likes?: string[];
          history?: { track: { id: string } }[];
        };
        likedIds = lib.likes || [];
        excludeIds = [
          ...excludeIds,
          ...(lib.history || []).map((h) => h.track.id),
        ];
      } catch {
        // ignore
      }
      void fetch("/api/radio/mix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelIds: prefs.channelIds || [],
          likesOnly: Boolean(prefs.likesOnly),
          likedIds,
          excludeIds,
          limit: 12,
        }),
      })
        .then((r) => r.json())
        .then((data: { tracks?: PlayerTrack[] }) => {
          const pick = data.tracks?.[0];
          if (!pick) return;
          const q = [...queueRef.current, ...(data.tracks || [])];
          playTrackRef.current(pick, q, { expand: false });
        })
        .catch(() => undefined);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    if (restoredRef.current && currentRef.current) {
      audio.src = `/api/stream/${currentRef.current.id}`;
      audio.currentTime = progress;
    }

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const playTrack = useCallback(
    (track: PlayerTrack, nextQueue?: PlayerTrack[], opts?: { expand?: boolean }) => {
      // Always update UI first so mobile never feels like "nothing happened".
      if (nextQueue) setQueue(nextQueue);
      const firstPlay = !currentRef.current;
      setCurrent(track);
      setIsBuffering(true);
      setProgress(0);
      setIsPlaying(true);
      const desktop =
        typeof window !== "undefined" && window.matchMedia("(min-width: 1100px)").matches;
      // Mobile: keep the bottom dock visible.
      if (!desktop) setExpanded(false);
      else if (opts?.expand !== undefined) setExpanded(opts.expand);
      else if (firstPlay) setExpanded(true);
      setQueueOpen(false);

      const audio = audioRef.current;
      if (!audio) {
        setIsPlaying(false);
        setIsBuffering(false);
        return;
      }

      const url = `/api/stream/${track.id}`;
      // Setting src + play() in the same user-gesture tick is required on iOS.
      // Do NOT call audio.load() — it cancels the play() gesture on mobile.
      if (!audio.src.endsWith(track.id) && !audio.src.includes(`/stream/${track.id}`)) {
        audio.src = url;
      }

      const attempt = () =>
        audio
          .play()
          .then(() => {
            setIsPlaying(true);
            setIsBuffering(false);
          })
          .catch(() => {
            // Retry once when enough data is buffered (common on mobile networks).
            const retry = () => {
              void audio.play().then(() => {
                setIsPlaying(true);
                setIsBuffering(false);
              }).catch(() => {
                setIsPlaying(false);
                setIsBuffering(false);
              });
              audio.removeEventListener("canplay", retry);
            };
            audio.addEventListener("canplay", retry, { once: true });
          });

      attempt();

      void fetch("/api/play-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id }),
      }).catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    playTrackRef.current = playTrack;
  }, [playTrack]);

  const toggleRadioMode = useCallback(() => setRadioMode((v) => !v), []);
  const setRadioModeOn = useCallback((on: boolean) => setRadioMode(on), []);

  const setSleepTimer = useCallback((minutes: number | null) => {
    if (minutes == null || minutes <= 0) {
      setSleepEndsAt(null);
      return;
    }
    setSleepEndsAt(Date.now() + minutes * 60_000);
  }, []);

  useEffect(() => {
    if (!sleepEndsAt) return;
    const tick = () => {
      if (Date.now() >= sleepEndsAt) {
        audioRef.current?.pause();
        setSleepEndsAt(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sleepEndsAt]);

  const addToQueue = useCallback((track: PlayerTrack) => {
    setQueue((q) => (q.some((t) => t.id === track.id) ? q : [...q, track]));
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    setQueue((q) => q.filter((t) => t.id !== trackId));
  }, []);

  const clearQueue = useCallback(() => setQueue([]), []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((q) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= q.length ||
        toIndex >= q.length ||
        fromIndex === toIndex
      ) {
        return q;
      }
      const next = [...q];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  }, []);

  const replaceQueue = useCallback((tracks: PlayerTrack[]) => {
    setQueue(tracks);
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) {
      if (!audio.src) audio.src = `/api/stream/${current.id}`;
      void audio.play().catch(() => undefined);
    } else audio.pause();
  }, [current]);

  const next = useCallback(() => {
    if (!current) return;
    const nextTrack = pickNext(queue, current.id, isShuffle, repeatMode === "off" ? "all" : repeatMode);
    if (nextTrack) playTrack(nextTrack);
  }, [current, queue, isShuffle, repeatMode, playTrack]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const idx = queue.findIndex((t) => t.id === current.id);
    const prevTrack = queue[idx - 1];
    if (prevTrack) playTrack(prevTrack);
  }, [current, queue, playTrack]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setProgress(time);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.min(1, Math.max(0, v)));
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => setIsMuted((m) => !m), []);
  const toggleShuffle = useCallback(() => setIsShuffle((v) => !v), []);
  const cycleRepeat = useCallback(() => {
    setRepeatMode((m) => (m === "off" ? "all" : m === "all" ? "one" : "off"));
  }, []);

  // Media Session API
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist || current.channelTitle || "Musicma",
      album: current.album || current.channelTitle || "Musicma",
      artwork: current.coverUrl
        ? [
            { src: current.coverUrl, sizes: "512x512", type: "image/jpeg" },
            { src: current.coverUrl, sizes: "256x256", type: "image/jpeg" },
          ]
        : [],
    });
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    navigator.mediaSession.setActionHandler("play", () => toggle());
    navigator.mediaSession.setActionHandler("pause", () => toggle());
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") seek(details.seekTime);
    });
    try {
      navigator.mediaSession.setPositionState({
        duration: duration || 0,
        playbackRate: 1,
        position: Math.min(progress, duration || 0),
      });
    } catch {
      // some browsers reject invalid states
    }
  }, [current, isPlaying, duration, progress, toggle, prev, next, seek]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.code === "ArrowRight") {
        seek(Math.min((duration || 0), progress + 5));
      } else if (e.code === "ArrowLeft") {
        seek(Math.max(0, progress - 5));
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        setVolume(volume + 0.05);
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        setVolume(volume - 0.05);
      } else if (e.key === "n" || e.key === "N") {
        next();
      } else if (e.key === "p" || e.key === "P") {
        prev();
      } else if (e.key === "m" || e.key === "M") {
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seek, progress, duration, setVolume, volume, next, prev, toggleMute]);

  return (
    <PlayerContext.Provider
      value={{
        current,
        queue,
        isPlaying,
        isBuffering,
        progress,
        duration,
        volume,
        isMuted,
        isShuffle,
        repeatMode,
        expanded,
        queueOpen,
        radioMode,
        sleepEndsAt,
        playTrack,
        addToQueue,
        removeFromQueue,
        clearQueue,
        reorderQueue,
        replaceQueue,
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
        toggleRadioMode,
        setRadioMode: setRadioModeOn,
        setSleepTimer,
      }}
    >
      {/* Never use `hidden`/`display:none` — iOS refuses to play those elements. */}
      <audio
        ref={audioRef}
        className="player-audio"
        playsInline
        preload="auto"
        controls={false}
      />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
