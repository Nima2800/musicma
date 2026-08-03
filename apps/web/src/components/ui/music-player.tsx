"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipForward, SkipBack, Shuffle, Repeat } from "lucide-react";

const formatTime = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds) || !Number.isFinite(timeInSeconds)) return "00:00";
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export interface MusicPlayerProps {
  albumArt: string;
  songTitle: string;
  artistName: string;
  /** Used only in uncontrolled mode */
  audioSrc?: string;
  /** Controlled playback (Musicma player context) */
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  isShuffle?: boolean;
  isRepeat?: boolean;
  isBuffering?: boolean;
  onPlayPause?: () => void;
  onSeek?: (time: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
  onToggleShuffle?: () => void;
  onToggleRepeat?: () => void;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  albumArt,
  songTitle,
  artistName,
  audioSrc,
  isPlaying: controlledPlaying,
  currentTime: controlledTime,
  duration: controlledDuration,
  isShuffle = false,
  isRepeat = false,
  isBuffering = false,
  onPlayPause,
  onSeek,
  onNext,
  onPrev,
  onToggleShuffle,
  onToggleRepeat,
}) => {
  const isControlled = typeof controlledPlaying === "boolean";
  const [localPlaying, setLocalPlaying] = React.useState(false);
  const [localDuration, setLocalDuration] = React.useState(0);
  const [localTime, setLocalTime] = React.useState(0);
  const [localShuffle, setLocalShuffle] = React.useState(false);
  const [localRepeat, setLocalRepeat] = React.useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLInputElement>(null);

  const isPlaying = isControlled ? Boolean(controlledPlaying) : localPlaying;
  const duration = isControlled ? (controlledDuration ?? 0) : localDuration;
  const currentTime = isControlled ? (controlledTime ?? 0) : localTime;
  const shuffleOn = isControlled ? isShuffle : localShuffle;
  const repeatOn = isControlled ? isRepeat : localRepeat;

  useEffect(() => {
    if (isControlled) return;
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    const setAudioData = () => {
      setLocalDuration(audio.duration || 0);
      setLocalTime(audio.currentTime || 0);
    };
    const setAudioTime = () => {
      setLocalTime(audio.currentTime);
      if (progressBarRef.current) {
        const progress = audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0;
        progressBarRef.current.style.setProperty("--progress", `${progress}%`);
      }
    };

    audio.addEventListener("loadeddata", setAudioData);
    audio.addEventListener("timeupdate", setAudioTime);

    if (localPlaying) {
      void audio.play().catch((error) => console.error("Error playing audio:", error));
    } else {
      audio.pause();
    }

    return () => {
      audio.removeEventListener("loadeddata", setAudioData);
      audio.removeEventListener("timeupdate", setAudioTime);
    };
  }, [isControlled, localPlaying, audioSrc]);

  useEffect(() => {
    if (!progressBarRef.current) return;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    progressBarRef.current.style.setProperty("--progress", `${progress}%`);
  }, [currentTime, duration]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (isControlled) {
      onSeek?.(value);
      return;
    }
    if (audioRef.current) audioRef.current.currentTime = value;
  };

  const togglePlayPause = () => {
    if (isControlled) {
      onPlayPause?.();
      return;
    }
    setLocalPlaying((v) => !v);
  };

  const toggleShuffle = () => {
    if (isControlled) {
      onToggleShuffle?.();
      return;
    }
    setLocalShuffle((v) => !v);
  };

  const toggleRepeat = () => {
    if (isControlled) {
      onToggleRepeat?.();
      return;
    }
    setLocalRepeat((v) => !v);
  };

  return (
    <div className="music-player w-full max-w-sm mx-auto bg-[hsl(var(--background))] text-[hsl(var(--foreground))] rounded-2xl p-6 flex flex-col items-center font-sans">
      <style>{`
        .music-player .progress-bar {
            --progress: 0%;
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 8px;
            background: hsl(var(--muted));
            border-radius: 4px;
            outline: none;
            cursor: pointer;
            background-image: linear-gradient(hsl(var(--primary)), hsl(var(--primary)));
            background-size: var(--progress) 100%;
            background-repeat: no-repeat;
        }

        .music-player .progress-bar::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            background: white;
            border: 2px solid hsl(var(--primary));
            border-radius: 50%;
            cursor: pointer;
            margin-top: -4px;
        }

        .music-player .progress-bar::-moz-range-thumb {
            width: 16px;
            height: 16px;
            background: white;
            border: 2px solid hsl(var(--primary));
            border-radius: 50%;
            cursor: pointer;
        }
       `}</style>

      {!isControlled && audioSrc ? (
        <audio ref={audioRef} src={audioSrc} loop={repeatOn} preload="metadata" />
      ) : null}

      <motion.div
        className="relative mb-6"
        animate={{ scale: isPlaying ? 1 : 0.98 }}
        transition={{ duration: 0.2 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={albumArt}
          alt={`${songTitle} album art`}
          className="w-48 h-48 md:w-56 md:h-56 rounded-[22px] object-cover shadow-xl"
          onError={(e) => {
            e.currentTarget.src =
              "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&auto=format&fit=crop&q=60";
          }}
        />
      </motion.div>

      <div className="text-center mb-6 px-2">
        <h2 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">{songTitle}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {artistName}
          {isBuffering ? " · buffering" : ""}
        </p>
      </div>

      <div className="w-full flex items-center gap-x-3 mb-4">
        <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] w-12 text-left">
          {formatTime(currentTime)}
        </span>
        <input
          ref={progressBarRef}
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="progress-bar flex-grow"
          aria-label="Seek"
        />
        <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] w-12 text-right">
          {formatTime(duration)}
        </span>
      </div>

      <div className="flex items-center justify-center gap-6 w-full">
        <motion.button
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleShuffle}
          className={`transition-colors ${shuffleOn ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}
          aria-label="Shuffle"
        >
          <Shuffle size={20} />
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onPrev}
          className="text-[hsl(var(--foreground))]"
          aria-label="Previous"
        >
          <SkipBack size={28} />
        </motion.button>

        <motion.button
          type="button"
          onClick={togglePlayPause}
          className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isPlaying ? "pause" : "play"}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
            </motion.div>
          </AnimatePresence>
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onNext}
          className="text-[hsl(var(--foreground))]"
          aria-label="Next"
        >
          <SkipForward size={28} />
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleRepeat}
          className={`transition-colors ${repeatOn ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}
          aria-label="Repeat"
        >
          <Repeat size={20} />
        </motion.button>
      </div>
    </div>
  );
};
