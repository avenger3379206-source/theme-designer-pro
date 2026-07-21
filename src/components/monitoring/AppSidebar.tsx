import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Network,
  Users,
  Gauge,
  Wifi,
  BellRing,
  FileBarChart,
  Settings as SettingsIcon,
} from "lucide-react";
import { loadLogo } from "@/lib/branding";
import { loadLayout, type LayoutId } from "@/lib/theme";

// Only renders visually when the "sidebar-command" layout is active
// (see [data-layout="sidebar-command"] .app-sidebar in styles.css).
// It always mounts so switching layouts in Settings works instantly,
// without any extra conditional logic in the page that hosts it.

const NAV_ITEMS: Array<{
  id: string;
  icon: typeof LayoutDashboard;
  en: string;
  fa: string;
  href?: string; // real route (Settings) — otherwise scrolls to #id on the page
}> = [
  { id: "top", icon: LayoutDashboard, en: "Overview", fa: "نمای کلی" },
  { id: "section-infrastructure", icon: Network, en: "Infrastructure", fa: "زیرساخت" },
  { id: "section-clients", icon: Users, en: "Clients", fa: "کلاینت‌ها" },
  { id: "section-internet-control", icon: Gauge, en: "Internet Control", fa: "کنترل اینترنت" },
  { id: "section-network", icon: Wifi, en: "Network", fa: "شبکه" },
  { id: "section-alerts", icon: BellRing, en: "Alerts", fa: "هشدارها" },
  { id: "section-reports", icon: FileBarChart, en: "Reports", fa: "گزارش‌ها" },
  { id: "settings", icon: SettingsIcon, en: "Settings", fa: "تنظیمات", href: "/settings" },
];

export function AppSidebar() {
  const [layout, setLayout] = useState<LayoutId>(() => loadLayout());
  const [active, setActive] = useState<string>("top");
  const routerState = useRouterState();
  const onSettings = routerState.location.pathname === "/settings";

  useEffect(() => {
    const h = () => setLayout(loadLayout());
    window.addEventListener("exir:layout", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("exir:layout", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (layout !== "sidebar-command") return;
    let currentUrl: string | null = null;
    async function refresh() {
      const l = await loadLogo();
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = l ? URL.createObjectURL(l.blob) : null;
      setLogoUrl(currentUrl);
    }
    refresh();
    const h = () => refresh();
    window.addEventListener("exir:logo-changed", h);
    return () => {
      window.removeEventListener("exir:logo-changed", h);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [layout]);

  // Simple scroll-spy: highlight whichever section is currently nearest the
  // top of the viewport. Only runs while this layout is selected.
  useEffect(() => {
    if (layout !== "sidebar-command" || onSettings) return;
    const ids = NAV_ITEMS.filter((n) => !n.href).map((n) => n.id);
    function onScroll() {
      let current = "top";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= 140) current = id;
      }
      setActive(current);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [layout, onSettings]);

  if (layout !== "sidebar-command") return null;

  return (
    <aside className="app-sidebar" aria-label="ناوبری اصلی">
      <div className="app-sidebar-logo">
        {logoUrl ? (
          <img src={logoUrl} alt="logo" />
        ) : (
          <span className="font-mono font-black text-glow-cyan">E</span>
        )}
        <span className="app-sidebar-logo-badge" />
      </div>

      <nav className="app-sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.href ? onSettings : !onSettings && active === item.id;
          if (item.id === "settings") {
            return (
              <Link
                key={item.id}
                to="/settings"
                title={item.fa}
                className={`app-sidebar-item${isActive ? " app-sidebar-item-active" : ""}`}
              >
                <Icon size={18} />
                <span className="app-sidebar-item-label">
                  <span className="font-en">{item.en}</span>
                </span>
              </Link>
            );
          }
          return (
            <a
              key={item.id}
              href={onSettings ? `/#${item.id}` : `#${item.id}`}
              title={item.fa}
              className={`app-sidebar-item${isActive ? " app-sidebar-item-active" : ""}`}
              onClick={(e) => {
                if (onSettings) return; // let it navigate back to "/"
                e.preventDefault();
                if (item.id === "top") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            >
              <Icon size={18} />
              <span className="app-sidebar-item-label">
                <span className="font-en">{item.en}</span>
              </span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
