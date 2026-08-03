"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Library, Radio, ListMusic } from "lucide-react";

const ITEMS = [
  { href: "/", label: "خانه", icon: Home },
  { href: "/songs", label: "آهنگ‌ها", icon: ListMusic },
  { href: "/radio", label: "رادیو", icon: Radio },
  { href: "/search", label: "جستجو", icon: Search },
  { href: "/library", label: "کتابخانه", icon: Library },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="mobile-nav" aria-label="ناوبری موبایل">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className={active ? "is-active" : ""}>
            <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
