"use client";

import { TrackList } from "@/components/TrackList";
import type { PublicTrack } from "@/lib/serialize";
import { toPlayerTrack } from "@/lib/serialize";

export function TrackRail({
  title,
  tracks,
  linkHref,
  linkLabel,
}: {
  title: string;
  tracks: PublicTrack[];
  linkHref?: string;
  linkLabel?: string;
}) {
  if (!tracks.length) return null;
  return (
    <section className="section-block">
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        {linkHref ? (
          <a href={linkHref} className="section-link">
            {linkLabel || "بیشتر"}
          </a>
        ) : null}
      </div>
      <TrackList tracks={tracks.map(toPlayerTrack)} />
    </section>
  );
}
