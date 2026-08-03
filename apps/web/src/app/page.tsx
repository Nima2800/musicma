import Link from "next/link";
import { Music2, Sparkles } from "lucide-react";
import { ChannelCard } from "@/components/ChannelCard";
import { HeroPlay } from "@/components/HomeClientExtras";
import { TrackList } from "@/components/TrackList";
import { getHomeSections, toPlayerTrack } from "@/lib/catalog";

export const revalidate = 60;

export default async function HomePage() {
  const data = await getHomeSections();
  const hero = data.hero;
  const latest = data.latest.slice(0, 10).map(toPlayerTrack);
  const topToday = data.topToday.slice(0, 7).map(toPlayerTrack);
  const channels = data.channels.slice(0, 6);
  const nextFeaturedLabel = data.featuredNextAt
    ? new Date(data.featuredNextAt).toLocaleTimeString("fa-IR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <main className="home-dash">
      <section className="home-panel home-dash__latest" id="latest">
        <div className="section-head">
          <h2 className="section-title">تازه‌ها</h2>
          <Link href="/songs" className="section-link">
            همه
          </Link>
        </div>
        <TrackList tracks={latest} compact />
      </section>

      <section className="home-panel home-hero">
        <Music2 className="home-hero__note home-hero__note--a" size={22} aria-hidden />
        <Music2 className="home-hero__note home-hero__note--b" size={16} aria-hidden />
        <span className="home-hero__badge">
          <Sparkles size={13} aria-hidden />
          ویژه امروز
        </span>
        <div className="home-vinyl" aria-hidden>
          <div className="vinyl-disc home-vinyl__disc">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero?.coverUrl || "/images/hero-musicma.png"} alt="" />
          </div>
          <div className="hero-eq" aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="home-hero__copy">
          <h1>{hero ? hero.title : "Musicma"}</h1>
          <p>
            {hero
              ? `${hero.artist || hero.channelTitle || "ناشناس"}${
                  hero.channelTitle ? ` · ${hero.channelTitle}` : ""
                }`
              : "آهنگ‌های کانال‌های تلگرام را یکجا پیدا کن و همان لحظه پخش کن."}
          </p>
          {nextFeaturedLabel ? (
            <p className="home-hero__rotate">
              تعویض ویژه بعدی حدود ساعت {nextFeaturedLabel}
            </p>
          ) : null}
          <div className="hero-banner__actions">
            {hero ? (
              <HeroPlay
                track={toPlayerTrack(hero)}
                queue={data.latest.map(toPlayerTrack)}
              />
            ) : (
              <Link href="/songs" className="btn btn-primary">
                گوش بده
              </Link>
            )}
            <Link href="/songs" className="btn btn-ghost">
              همه آهنگ‌ها
            </Link>
          </div>
        </div>
      </section>

      <div className="home-dash__side">
        <section className="home-panel home-channels">
          <div className="section-head">
            <h2 className="section-title">کانال‌ها</h2>
          </div>
          {channels.length ? (
            <div className="home-channels__grid">
              {channels.map((ch) => (
                <ChannelCard
                  key={ch.id}
                  mini
                  href={`/channel/${ch.slug}`}
                  title={ch.title}
                  coverUrl={ch.coverUrl}
                  meta={
                    typeof ch.trackCount === "number"
                      ? `${ch.trackCount} آهنگ`
                      : "کانال"
                  }
                />
              ))}
            </div>
          ) : (
            <p className="empty-state">هنوز کانالی اضافه نشده.</p>
          )}
        </section>

        <section className="home-panel home-top">
          <div className="section-head">
            <h2 className="section-title">پرپخش‌ترین‌های امروز</h2>
            <Link href="/songs" className="section-link">
              همه
            </Link>
          </div>
          <TrackList tracks={topToday} compact />
        </section>
      </div>
    </main>
  );
}
