"use client";

type Props = {
  peaks?: number[] | null;
  progress?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  className?: string;
};

export function Waveform({
  peaks,
  progress = 0,
  duration = 0,
  onSeek,
  className = "",
}: Props) {
  const bars = peaks?.length ? peaks : Array.from({ length: 48 }, (_, i) => 0.3 + ((i * 37) % 70) / 100);
  const ratio = duration > 0 ? progress / duration : 0;

  return (
    <div
      className={`waveform ${className}`}
      role={onSeek ? "slider" : "img"}
      aria-label="نمودار موج صدا"
      aria-valuemin={0}
      aria-valuemax={Math.floor(duration || 0)}
      aria-valuenow={Math.floor(progress || 0)}
      onClick={(e) => {
        if (!onSeek || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const p = Math.min(1, Math.max(0, x / rect.width));
        onSeek(p * duration);
      }}
    >
      {bars.map((peak, i) => {
        const active = i / bars.length <= ratio;
        return (
          <span
            key={i}
            style={{ height: `${Math.max(12, peak * 100)}%` }}
            className={active ? "is-active" : ""}
          />
        );
      })}
    </div>
  );
}
