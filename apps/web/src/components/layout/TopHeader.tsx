"use client";

import { Menu, Moon, PanelLeftOpen, Sun, X } from "lucide-react";
import { useTheme } from "./ThemeProvider";

type TopHeaderProps = {
  onMenuClick: () => void;
  sidebarOpen: boolean;
};

export function TopHeader({ onMenuClick, sidebarOpen }: TopHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="app-header">
      <div className="app-header__start">
        <button
          type="button"
          className="icon-btn menu-trigger"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMenuClick();
          }}
          aria-label={sidebarOpen ? "بستن منو" : "باز کردن منو"}
          aria-expanded={sidebarOpen}
          title={sidebarOpen ? "بستن منو" : "باز کردن منو"}
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <button
          type="button"
          className="icon-btn desktop-sidebar-toggle"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMenuClick();
          }}
          aria-label={sidebarOpen ? "جمع کردن سایدبار" : "باز کردن سایدبار"}
          title={sidebarOpen ? "جمع کردن سایدبار" : "باز کردن سایدبار"}
        >
          {sidebarOpen ? <X size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>

      <div className="app-header__end">
        <button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "حالت تاریک" : "حالت روشن"}
          title={theme === "light" ? "حالت تاریک" : "حالت روشن"}
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  );
}
