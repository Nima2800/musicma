import Link from "next/link";
import {
  ContinueListening,
  ForYouFallback,
  RecentlyPlayed,
} from "@/components/HomeClientExtras";
import { TrackRail } from "@/components/TrackRail";
import { getHomeSections } from "@/lib/catalog";

export const revalidate = 60;

export default async function SongsPage() {
  const data = await getHomeSections();

  return (
    <main>
      <header className="page-head">
        <h1 className="page-title">آهنگ‌ها</h1>
        <p className="page-lede">همه آهنگ‌ها، ترندها و پلی‌لیست‌های حال‌وهوا یکجا</p>
      </header>

      <ContinueListening />
      <TrackRail title="تازه‌ها" tracks={data.latest} linkHref="/search?sort=new" linkLabel="بیشتر" />
      <TrackRail title="پرپخش‌ترین‌های امروز" tracks={data.topToday} />
      <TrackRail title="پرپخش‌ترین‌های هفته" tracks={data.topWeek} />
      <TrackRail title="آهنگ‌های ترند" tracks={data.trending} />
      <RecentlyPlayed />
      <TrackRail title="تازه‌منتشرشده از هر کانال" tracks={data.freshByChannel} />
      <TrackRail title="آهنگ‌های تصادفی" tracks={data.random} />

      <section className="section-block">
        <div className="section-head">
          <h2 className="section-title">پلی‌لیست حال‌وهوا</h2>
        </div>
        <div className="mood-grid">
          {[
            { mood: "energetic", title: "ورزش و انرژی", desc: "ریتم تند" },
            { mood: "calm", title: "خواب و آرامش", desc: "سبک و آرام" },
            { mood: "happy", title: "مهمانی", desc: "حال خوب" },
            { mood: "sad", title: "دل‌گرفته", desc: "غمگین و عمیق" },
          ].map((m) => (
            <Link key={m.mood} href={`/search?mood=${m.mood}`} className="mood-card">
              <strong>{m.title}</strong>
              <span>{m.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      {(data.popularArtists.length > 0 || data.popularMoods.length > 0) && (
        <section className="section-block">
          <div className="section-head">
            <h2 className="section-title">خواننده‌ها و سبک‌های محبوب</h2>
          </div>
          <div className="chip-row">
            {data.popularArtists.map((a) => (
              <Link
                key={a.name}
                href={`/search?q=${encodeURIComponent(a.name)}`}
                className="chip"
              >
                {a.name}
                <span>{a.count}</span>
              </Link>
            ))}
            {data.popularMoods.map((m) => (
              <Link
                key={m.name}
                href={`/search?mood=${encodeURIComponent(m.name)}`}
                className="chip chip--mood"
              >
                {moodLabel(m.name)}
                <span>{m.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <ForYouFallback tracks={data.trending} />
    </main>
  );
}

function moodLabel(mood: string) {
  const map: Record<string, string> = {
    happy: "شاد",
    sad: "غمگین",
    calm: "آرام",
    energetic: "انرژی‌دار",
  };
  return map[mood] || mood;
}
