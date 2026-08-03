"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  href: string;
  title: string;
  meta?: string;
  coverUrl?: string | null;
  mini?: boolean;
};

export function ChannelCard({ href, title, meta, coverUrl, mini = false }: Props) {
  const [broken, setBroken] = useState(false);
  const letter = (title || "?").trim().slice(0, 1) || "?";
  const showImage = Boolean(coverUrl) && !broken;

  return (
    <Link href={href} className={`channel-card ${mini ? "channel-card--mini" : ""}`}>
      <div className="channel-card__thumb" aria-hidden>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl!}
            alt=""
            onError={() => setBroken(true)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="channel-card__fallback"
            src="/images/channel-fallback.png"
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        {!showImage ? <span className="channel-card__letter">{letter}</span> : null}
      </div>
      <div className="channel-card__title">{title}</div>
      {meta ? <div className="channel-card__meta">{meta}</div> : null}
    </Link>
  );
}
