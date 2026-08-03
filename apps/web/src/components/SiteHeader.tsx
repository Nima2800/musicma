import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand-mark">
        Musicma
      </Link>
      <nav className="site-nav" aria-label="اصلی">
        <Link href="/search">جستجو</Link>
        <Link href="/admin">مدیریت</Link>
      </nav>
    </header>
  );
}
