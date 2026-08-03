"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

const DESKTOP_MQ = "(min-width: 1100px)";

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const ready = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const sync = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      // Only auto-open on first paint / when crossing into desktop.
      // Never force-open on mobile.
      if (!ready.current) {
        setSidebarOpen(desktop);
        ready.current = true;
        return;
      }
      if (!desktop) setSidebarOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!isDesktop && sidebarOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [isDesktop, sidebarOpen]);

  function toggleSidebar() {
    setSidebarOpen((v) => !v);
  }

  return (
    <div
      className={[
        "app-frame",
        sidebarOpen ? "is-sidebar-open" : "is-sidebar-closed",
        sidebarOpen && isDesktop ? "is-sidebar-docked" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-sidebar={sidebarOpen ? "open" : "closed"}
      data-desktop={isDesktop ? "true" : "false"}
    >
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isDesktop={isDesktop}
      />
      <div className="app-main">
        <TopHeader sidebarOpen={sidebarOpen} onMenuClick={toggleSidebar} />
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
