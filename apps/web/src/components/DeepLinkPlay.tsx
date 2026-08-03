"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "@/components/player/PlayerProvider";
import { toPlayerTrack, type PublicTrack } from "@/lib/serialize";

/** Opens shared links like /?play=trackId&at=42 */
export function DeepLinkPlay() {
  const { playTrack, seek } = usePlayer();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    const sp = new URLSearchParams(window.location.search);
    const id = sp.get("play");
    if (!id) return;
    done.current = true;
    const at = Number(sp.get("at") || 0);

    void (async () => {
      try {
        const res = await fetch(`/api/tracks/${id}`);
        if (!res.ok) return;
        const data = (await res.json()) as { track: PublicTrack };
        playTrack(toPlayerTrack(data.track), [toPlayerTrack(data.track)]);
        if (at > 0) {
          window.setTimeout(() => seek(at), 400);
        }
        const url = new URL(window.location.href);
        url.searchParams.delete("play");
        url.searchParams.delete("at");
        window.history.replaceState({}, "", url.pathname + url.search);
      } catch {
        // ignore
      }
    })();
  }, [playTrack, seek]);

  return null;
}
