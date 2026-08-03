"use client";

import type { PlayerTrack } from "@/types/player";

const KEY = "musicma.library.v1";

export type PlaylistLocal = {
  id: string;
  name: string;
  isPublic: boolean;
  trackIds: string[];
  createdAt: string;
};

export type LibraryState = {
  likes: string[];
  saves: string[];
  history: { track: PlayerTrack; at: string; position: number }[];
  continueAt: Record<string, number>;
  playlists: PlaylistLocal[];
};

const empty: LibraryState = {
  likes: [],
  saves: [],
  history: [],
  continueAt: {},
  playlists: [],
};

/** Stable empty state for SSR/hydration fallbacks (never read from localStorage). */
export const EMPTY_LIBRARY: LibraryState = empty;

export function readLibrary(): LibraryState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return empty;
  }
}

export function writeLibrary(state: LibraryState) {
  localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new Event("musicma-library"));
}

export function toggleLike(trackId: string) {
  const lib = readLibrary();
  lib.likes = lib.likes.includes(trackId)
    ? lib.likes.filter((id) => id !== trackId)
    : [trackId, ...lib.likes];
  writeLibrary(lib);
  return lib.likes.includes(trackId);
}

export function toggleSave(trackId: string) {
  const lib = readLibrary();
  lib.saves = lib.saves.includes(trackId)
    ? lib.saves.filter((id) => id !== trackId)
    : [trackId, ...lib.saves];
  writeLibrary(lib);
  return lib.saves.includes(trackId);
}

export function pushHistory(track: PlayerTrack, position = 0) {
  const lib = readLibrary();
  lib.history = [
    { track, at: new Date().toISOString(), position },
    ...lib.history.filter((h) => h.track.id !== track.id),
  ].slice(0, 100);
  lib.continueAt[track.id] = position;
  writeLibrary(lib);
}

export function setContinue(trackId: string, position: number) {
  const lib = readLibrary();
  lib.continueAt[trackId] = position;
  writeLibrary(lib);
}

export function createPlaylist(name: string, isPublic = false) {
  const lib = readLibrary();
  const pl: PlaylistLocal = {
    id: `pl_${Date.now().toString(36)}`,
    name,
    isPublic,
    trackIds: [],
    createdAt: new Date().toISOString(),
  };
  lib.playlists = [pl, ...lib.playlists];
  writeLibrary(lib);
  return pl;
}

export function addToPlaylist(playlistId: string, trackId: string) {
  const lib = readLibrary();
  lib.playlists = lib.playlists.map((p) =>
    p.id === playlistId && !p.trackIds.includes(trackId)
      ? { ...p, trackIds: [...p.trackIds, trackId] }
      : p,
  );
  writeLibrary(lib);
}
