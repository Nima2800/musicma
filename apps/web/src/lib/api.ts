import type { PublicChannel, PublicTrack } from "@/lib/serialize";

const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json() as Promise<T>;
}

export async function fetchChannels() {
  try {
    return await getJson<{ channels: PublicChannel[] }>("/api/channels");
  } catch {
    return { channels: [] as PublicChannel[] };
  }
}

export async function fetchTracks(params: { channel?: string; q?: string; page?: number } = {}) {
  const sp = new URLSearchParams();
  if (params.channel) sp.set("channel", params.channel);
  if (params.q) sp.set("q", params.q);
  if (params.page) sp.set("page", String(params.page));
  const qs = sp.toString();
  try {
    return await getJson<{
      tracks: PublicTrack[];
      page: number;
      total: number;
      totalPages: number;
    }>(`/api/tracks${qs ? `?${qs}` : ""}`);
  } catch {
    return { tracks: [] as PublicTrack[], page: 1, total: 0, totalPages: 0 };
  }
}
