"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Settings2, Radio, X, PanelLeftClose, Library, ListMusic } from "lucide-react";

const NAV = [
  { href: "/", label: "خانه", icon: Home },
  { href: "/songs", label: "آهنگ‌ها", icon: ListMusic },
  { href: "/radio", label: "رادیو", icon: Radio },
  { href: "/search", label: "جستجو", icon: Search },
  { href: "/library", label: "کتابخانه", icon: Library },
  { href: "/admin", label: "مدیریت", icon: Settings2 },
] as const;

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  isDesktop: boolean;
};

export function Sidebar({ open, onClose, isDesktop }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        className={`sidebar-overlay ${open && !isDesktop ? "is-open" : ""}`}
        onClick={onClose}
        aria-label="بستن منو"
        tabIndex={open && !isDesktop ? 0 : -1}
      />
      <aside
        className={`app-sidebar ${open ? "is-open" : ""}`}
        aria-label="ناوبری اصلی"
        aria-hidden={!open}
      >
        <div className="app-sidebar__brand">
          <Link href="/" className="brand-lockup" onClick={() => !isDesktop && onClose()}>
            <span className="brand-lockup__mark" aria-hidden>
              <Radio size={18} />
            </span>
            <span className="brand-lockup__text">Musicma</span>
          </Link>
          <button
            type="button"
            className="icon-btn sidebar-close"
            onClick={onClose}
            aria-label="بستن منو"
          >
            {isDesktop ? <PanelLeftClose size={18} /> : <X size={18} />}
          </button>
        </div>

        <p className="sidebar-label">منو</p>
        <nav className="sidebar-nav">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-link ${active ? "is-active" : ""}`}
                onClick={() => !isDesktop && onClose()}
              >
                <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-promo" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/channel-fallback.png" alt="" />
          </div>
          <p className="sidebar-footnote">آرشیو زنده کانال‌های تلگرام</p>
        </div>
      </aside>
    </>
  );
}
