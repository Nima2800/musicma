"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { TrackList } from "@/components/TrackList";
import type { PublicChannel, PublicTrack } from "@/lib/serialize";
import { toPlayerTrack } from "@/lib/serialize";

type Filters = {
  mood?: string;
  language?: string;
  sort?: string;
  channel?: string;
  quality?: string;
  remix?: string;
  instrumental?: string;
};

export function SearchClient({
  initialQ,
  channels,
  tracks,
  filters,
}: {
  initialQ: string;
  channels: PublicChannel[];
  tracks: PublicTrack[];
  filters: Filters;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);

  function submit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k === "remix" || k === "instrumental" ? k : k, v);
    }
    // read from form selects via FormData
    const fd = new FormData(e.target as HTMLFormElement);
    for (const key of ["mood", "language", "sort", "channel", "quality", "remix", "instrumental"]) {
      const val = String(fd.get(key) || "");
      if (val) params.set(key, val);
      else params.delete(key);
    }
    router.push(`/search?${params.toString()}`);
  }

  return (
    <>
      <form className="search-panel" onSubmit={submit}>
        <div className="search-form">
          <input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو: آهنگ، خواننده، کانال، کپشن…"
            aria-label="جستجو"
          />
          <button type="submit">بگرد</button>
        </div>
        <div className="filter-grid">
          <label>
            مرتب‌سازی
            <select name="sort" defaultValue={filters.sort || "new"}>
              <option value="new">جدید</option>
              <option value="old">قدیمی</option>
              <option value="popular">پرپخش</option>
            </select>
          </label>
          <label>
            زبان
            <select name="language" defaultValue={filters.language || ""}>
              <option value="">همه</option>
              <option value="fa">ایرانی</option>
              <option value="en">خارجی</option>
              <option value="other">دیگر</option>
            </select>
          </label>
          <label>
            حال‌وهوا
            <select name="mood" defaultValue={filters.mood || ""}>
              <option value="">همه</option>
              <option value="happy">شاد</option>
              <option value="sad">غمگین</option>
              <option value="calm">آرام</option>
              <option value="energetic">انرژی‌دار</option>
            </select>
          </label>
          <label>
            کیفیت
            <select name="quality" defaultValue={filters.quality || ""}>
              <option value="">همه</option>
              <option value="high">بالا</option>
              <option value="medium">متوسط</option>
              <option value="low">پایین</option>
            </select>
          </label>
          <label>
            کانال
            <select name="channel" defaultValue={filters.channel || ""}>
              <option value="">همه کانال‌ها</option>
              {channels.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            ریمیکس
            <select name="remix" defaultValue={filters.remix || ""}>
              <option value="">فرقی ندارد</option>
              <option value="1">فقط ریمیکس</option>
              <option value="0">بدون ریمیکس</option>
            </select>
          </label>
          <label>
            بی‌کلام
            <select name="instrumental" defaultValue={filters.instrumental || ""}>
              <option value="">فرقی ندارد</option>
              <option value="1">بی‌کلام</option>
              <option value="0">با کلام</option>
            </select>
          </label>
        </div>
      </form>
      <p className="admin-muted" style={{ marginBottom: "1rem" }}>
        {tracks.length} نتیجه
      </p>
      <TrackList tracks={tracks.map(toPlayerTrack)} />
    </>
  );
}
