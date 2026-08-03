import { SearchClient } from "@/components/SearchClient";
import { getChannels, getTracks } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = one(sp.q) || "";
  const mood = one(sp.mood);
  const language = one(sp.language) as "fa" | "en" | "other" | undefined;
  const sort = (one(sp.sort) as "new" | "old" | "popular" | undefined) || "new";
  const channel = one(sp.channel);
  const quality = one(sp.quality);
  const isRemix = one(sp.remix) === "1" ? true : one(sp.remix) === "0" ? false : undefined;
  const isInstrumental =
    one(sp.instrumental) === "1" ? true : one(sp.instrumental) === "0" ? false : undefined;

  const [channels, result] = await Promise.all([
    getChannels(),
    getTracks({
      q,
      mood,
      language,
      sort,
      channel,
      quality,
      isRemix,
      isInstrumental,
      limit: 40,
    }),
  ]);

  return (
    <main>
      <header className="page-head">
        <h1 className="page-title">جستجو</h1>
        <p className="page-lede">آهنگ، خواننده، کانال، کپشن، سبک و هشتگ</p>
      </header>
      <SearchClient
        initialQ={q}
        channels={channels}
        tracks={result.tracks}
        filters={{
          mood,
          language,
          sort,
          channel,
          quality,
          remix: one(sp.remix),
          instrumental: one(sp.instrumental),
        }}
      />
    </main>
  );
}
