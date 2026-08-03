import { notFound } from "next/navigation";
import { TrackList } from "@/components/TrackList";
import { getChannels, getTracks, toPlayerTrack } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function ChannelPage({ params }: Props) {
  const { slug } = await params;
  const [channels, { tracks }] = await Promise.all([
    getChannels(),
    getTracks({ channel: slug, limit: 50 }),
  ]);

  const channel = channels.find((c) => c.slug === slug);
  if (!channel) notFound();

  const telegramUrl = channel.username ? `https://t.me/${channel.username}` : null;

  return (
    <main>
      <header className="page-head channel-head">
        <div className="channel-head__avatar" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={channel.coverUrl || "/images/channel-fallback.png"} alt="" />
        </div>
        <div>
          <h1 className="page-title">{channel.title}</h1>
          <p className="page-lede">
            {channel.username ? `@${channel.username}` : "کانال تلگرام"}
            {typeof channel.trackCount === "number" ? ` · ${channel.trackCount} آهنگ` : ""}
            {channel.lastIndexedAt
              ? ` · آخرین همگام‌سازی ${new Date(channel.lastIndexedAt).toLocaleString("fa-IR")}`
              : ""}
          </p>
          {telegramUrl ? (
            <a className="section-link" href={telegramUrl} target="_blank" rel="noreferrer">
              مشاهده کانال در تلگرام
            </a>
          ) : null}
        </div>
      </header>
      <TrackList tracks={tracks.map(toPlayerTrack)} />
    </main>
  );
}
