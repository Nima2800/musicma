/** Shared title cleanup / heuristics for Telegram filenames. */

const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

const AD_PATTERNS = [
  /@[\w\d_]+/g,
  /t\.me\/\S+/gi,
  /https?:\/\/\S+/gi,
  /join\s*chat/gi,
  /subscribe/gi,
  /کانال\s*ما/gi,
  /عضویت/gi,
  /\[.*?telegram.*?\]/gi,
];

export function cleanTitle(raw: string): string {
  let t = raw.replace(EMOJI_RE, " ").trim();
  for (const re of AD_PATTERNS) t = t.replace(re, " ");
  t = t
    .replace(/\.(mp3|m4a|flac|wav|ogg|aac)$/i, "")
    .replace(/[_|]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t.slice(0, 240) || raw.slice(0, 240);
}

export function parseArtistTitle(raw: string): { title: string; artist: string | null } {
  const cleaned = cleanTitle(raw);
  const parts = cleaned.split(/\s[-–—]\s/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { artist: parts[0]!.slice(0, 240), title: parts.slice(1).join(" - ").slice(0, 240) };
  }
  return { title: cleaned, artist: null };
}

export function detectRemix(text: string): boolean {
  return /\b(remix|رمیکس|rmx)\b/i.test(text);
}

export function detectInstrumental(text: string): boolean {
  return /\b(instrumental|بی\s*کلام|karaoke|بیكلام)\b/i.test(text);
}

export function guessLanguage(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return "fa";
  if (/[A-Za-z]{3,}/.test(text)) return "en";
  return "other";
}

export function guessMood(text: string): string | null {
  const t = text.toLowerCase();
  if (/(sad|غمگین|غصه|دلتنگ|گریه|اشک)/i.test(t)) return "sad";
  if (/(party|شاد|رقص|عروسی|dance|happy)/i.test(t)) return "happy";
  if (/(chill|آرام|relax|sleep|لالا|calm|lofi)/i.test(t)) return "calm";
  if (/(energy|ورزش|gym|power|rap|هیجان|fast)/i.test(t)) return "energetic";
  return null;
}

export function guessQuality(fileSize: number | null | undefined, duration: number | null | undefined) {
  if (!fileSize || !duration || duration <= 0) return { bitrate: null as number | null, quality: null as string | null };
  const bitrate = Math.round((fileSize * 8) / duration / 1000);
  const quality = bitrate >= 256 ? "high" : bitrate >= 160 ? "medium" : "low";
  return { bitrate, quality };
}

export function syntheticWaveform(seed: string, bars = 64): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const peaks: number[] = [];
  for (let i = 0; i < bars; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const base = 0.25 + (h % 1000) / 1000 * 0.75;
    const envelope = 0.55 + 0.45 * Math.sin((i / bars) * Math.PI);
    peaks.push(Math.min(1, Number((base * envelope).toFixed(3))));
  }
  return peaks;
}

export function telegramPostUrl(username: string | null | undefined, messageId: string | number) {
  if (!username) return null;
  return `https://t.me/${username.replace(/^@/, "")}/${messageId}`;
}
