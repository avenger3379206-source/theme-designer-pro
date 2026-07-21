import { useState } from "react";
import {
  LayoutDashboard,
  Router,
  Users,
  Gauge,
  Network,
  Bell,
  FileText,
  Settings as SettingsIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

// Vertical nav rail used by the "sidebar" dashboard layout (data-layout="sidebar").
// Purely additive — every other layout renders the page exactly as before.
// Each item scrolls the main content to the matching section id instead of
// navigating away, so nothing about the single-page data flow changes.

const NAV_ITEMS = [
  { id: "sec-overview", icon: LayoutDashboard, label: "Overview", fa: "نمای کلی" },
  { id: "sec-infrastructure", icon: Router, label: "Infrastructure", fa: "زیرساخت" },
  { id: "sec-clients", icon: Users, label: "Clients", fa: "کلاینت‌ها" },
  { id: "sec-internet-control", icon: Gauge, label: "Internet Control", fa: "کنترل اینترنت" },
  { id: "sec-network", icon: Network, label: "Network", fa: "شبکه" },
  { id: "sec-alerts", icon: Bell, label: "Alerts", fa: "هشدارها" },
  { id: "sec-reports", icon: FileText, label: "Reports", fa: "گزارش‌ها" },
] as const;

export function ConsoleSidebar() {
  const [active, setActive] = useState<string>("sec-overview");

  function go(id: string) {
    setActive(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      data-console-sidebar="1"
      className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-1 border-e border-border/50 bg-surface/70 px-3 py-4 backdrop-blur-md lg:flex"
    >
      {NAV_ITEMS.map(({ id, icon: Icon, label, fa }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => go(id)}
            className={
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left font-mono text-[12px] uppercase tracking-wider transition " +
              (isActive
                ? "border border-cyan-400/50 bg-cyan-500/10 text-cyan-300 shadow-[0_0_16px_-6px_var(--neon-cyan)]"
                : "border border-transparent text-muted-foreground hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200")
            }
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1 truncate">{label}</span>
          </button>
        );
      })}

      <div className="my-1 h-px bg-border/50" />

      <Link
        to="/settings"
        className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left font-mono text-[12px] uppercase tracking-wider text-muted-foreground transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
      >
        <SettingsIcon size={16} className="shrink-0 transition group-hover:rotate-45" />
        <span className="flex-1 truncate">Settings</span>
      </Link>
    </nav>
  );
}
