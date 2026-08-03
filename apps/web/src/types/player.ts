export type PlayerTrack = {
  id: string;
  title: string;
  artist: string | null;
  duration: number | null;
  coverUrl: string | null;
  channelId?: string;
  channelTitle?: string;
  channelSlug?: string;
  channelUsername?: string | null;
  caption?: string | null;
  telegramPostUrl?: string | null;
  waveformPeaks?: number[] | null;
  mood?: string | null;
  genre?: string | null;
  album?: string | null;
  playCount?: number;
  likeCount?: number;
};

export type RepeatMode = "off" | "one" | "all";
