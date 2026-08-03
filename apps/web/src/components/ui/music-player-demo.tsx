"use client";

import React from "react";
import { MusicPlayer } from "@/components/ui/music-player";

/** Standalone demo of the MusicPlayer visual (uncontrolled audio). */
export default function MusicPlayerDemo() {
  const song = {
    albumArt:
      "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=900&auto=format&fit=crop&q=60",
    songTitle: "Sunshine Mix",
    artistName: "Lookee Stefane",
    audioSrc: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  };

  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center p-4">
      <MusicPlayer
        albumArt={song.albumArt}
        songTitle={song.songTitle}
        artistName={song.artistName}
        audioSrc={song.audioSrc}
      />
    </div>
  );
}
