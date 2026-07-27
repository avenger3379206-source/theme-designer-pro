// Watches live client/ping/reservation data and raises a toast + sound when
// something needs attention: overheat, a client going offline, a WAN/game
// ping loss, or a reservation about to run out. Respects the user's alert
// settings (master switch, per-condition toggles, volume, custom sound).

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ClientStatus, PingTarget } from "@/lib/monitoring-types";
import { listUpcomingAndActive, minutesUntilStart, remainingMinutes, reservationStatus } from "@/lib/reservations";
import { PERIPHERAL_EVT, hasPeripheralProblem } from "@/lib/peripheral-monitor";
import { DISK_HEALTH_EVT, diskHasProblem } from "@/lib/disk-health";
import { isComposing } from "@/lib/compose-lock";
import { loadAlertSettings, playAlertSound } from "@/lib/alert-settings";
import { pushAlertLog } from "@/lib/alert-log";
import { loadCameraConfig } from "@/lib/camera-config";

// Same alert (same key) won't fire again for this long, so a client stuck
// at 85°C doesn't spam a toast+sound every 3-second tick.
const COOLDOWN_MS = 90_000;
const GPU_CRITICAL = 80;
const CPU_CRITICAL = 78;

export function useAlertEngine(clients: ClientStatus[], pings: PingTarget[]) {
  const lastFiredRef = useRef<Record<string, number>>({});
  const prevOnlineRef = useRef<Record<string, boolean>>({});
  const seenOnceRef = useRef<Set<string>>(new Set());

  function fire(key: string, title: string, description: string, kind: "warning" | "error") {
    const settings = loadAlertSettings();
    if (!settings.enabled) return;
    const now = Date.now();
    const last = lastFiredRef.current[key] || 0;
    if (now - last < COOLDOWN_MS) return;
    lastFiredRef.current[key] = now;
    if (kind === "error") toast.error(title, { description });
    else toast.warning(title, { description });
    playAlertSound(settings);
    pushAlertLog({ key, title, description, kind });
  }

  // Overheat + offline — re-checked whenever the client list updates (~3s tick).
  useEffect(() => {
    const settings = loadAlertSettings();
    if (!settings.enabled || isComposing()) return;
    for (const c of clients) {
      const online = c.online !== false;
      const wasOnline = prevOnlineRef.current[c.machine];
      const seen = seenOnceRef.current.has(c.machine);

      if (settings.conditions.offline && seen && wasOnline === true && !online) {
        fire(
          `offline:${c.machine}`,
          `کلاینت ${c.machine} آفلاین شد`,
          "اتصال این سیستم قطع شده — بررسی کن.",
          "error",
        );
      }

      if (online && settings.conditions.overheat) {
        if (c.gpuTemp >= GPU_CRITICAL) {
          fire(
            `gpu-hot:${c.machine}`,
            `دمای GPU بحرانی · ${c.machine}`,
            `${Math.round(c.gpuTemp)}°C`,
            "error",
          );
        }
        if (c.cpuTemp >= CPU_CRITICAL) {
          fire(
            `cpu-hot:${c.machine}`,
            `دمای CPU بحرانی · ${c.machine}`,
            `${Math.round(c.cpuTemp)}°C`,
            "error",
          );
        }
      }

      prevOnlineRef.current[c.machine] = online;
      seenOnceRef.current.add(c.machine);
    }
  }, [clients]);

  // WAN / game ping loss — re-checked whenever ping history updates (~2s tick).
  useEffect(() => {
    const settings = loadAlertSettings();
    if (!settings.enabled || !settings.conditions.wanDown || isComposing()) return;
    for (const t of pings) {
      const last = t.history[t.history.length - 1];
      if (last && last.v === -1) {
        fire(`wan-down:${t.label}`, `قطعی شبکه · ${t.label}`, "پینگ این مقصد قطع شده.", "error");
      }
    }
  }, [pings]);

  // Reservation ending soon / starting soon — polled independently every 20s.
  useEffect(() => {
    const check = () => {
      if (isComposing()) return;
      const settings = loadAlertSettings();
      if (!settings.enabled) return;
      const now = Date.now();
      for (const r of listUpcomingAndActive()) {
        const status = reservationStatus(r, now);

        if (status === "active" && settings.conditions.reservationEnding) {
          const remaining = remainingMinutes(r, now);
          if (remaining > 0 && remaining <= settings.conditions.reservationEndingMinutes) {
            fire(
              `res-ending:${r.id}`,
              `پایان رزرو نزدیک است · ${r.seatId}`,
              `${r.customer || "مشتری"}${r.phone ? ` (${r.phone})` : ""} — ${Math.ceil(remaining)} دقیقه مونده`,
              "warning",
            );
          }
        }

        if (status === "upcoming" && settings.conditions.reservationStarting) {
          const until = minutesUntilStart(r, now);
          if (until > 0 && until <= settings.conditions.reservationStartingMinutes) {
            fire(
              `res-starting:${r.id}`,
              `شروع رزرو نزدیک است · ${r.seatId}`,
              `${r.customer || "مشتری"}${r.phone ? ` (${r.phone})` : ""} — ${Math.ceil(until)} دقیقه تا شروع`,
              "warning",
            );
          }
        }
      }
    };
    check();
    const id = setInterval(check, 20_000);
    return () => clearInterval(id);
  }, []);

  // Peripheral disconnects (keyboard/mouse/monitor) — event-driven, fired
  // whenever ClientPeripheralProbe publishes a fresh poll (~every 20s).
  useEffect(() => {
    const check = () => {
      if (isComposing()) return;
      const settings = loadAlertSettings();
      if (!settings.enabled || !settings.conditions.peripheralDisconnected) return;
      const map = window.__exirPeripherals;
      if (!map) return;
      for (const p of Object.values(map)) {
        if (!hasPeripheralProblem(p)) continue;
        const missing = [!p.keyboard && "کیبورد", !p.mouse && "ماوس", p.monitorCount === 0 && "مانیتور"]
          .filter(Boolean)
          .join("، ");
        fire(
          `peripheral:${p.machine}`,
          `قطع شدن جانبی · ${p.machine}`,
          `${missing} قطع شده یا سیگنال نداره`,
          "error",
        );
      }
    };
    check();
    window.addEventListener(PERIPHERAL_EVT, check);
    return () => window.removeEventListener(PERIPHERAL_EVT, check);
  }, []);

  // Disk health (SMART) — event-driven, fired whenever ClientDiskHealthProbe
  // publishes a fresh poll (every ~5 minutes; disk health barely changes).
  useEffect(() => {
    const check = () => {
      if (isComposing()) return;
      const settings = loadAlertSettings();
      if (!settings.enabled || !settings.conditions.diskHealth) return;
      const map = window.__exirDiskHealth;
      if (!map) return;
      for (const status of Object.values(map)) {
        if (!status.ok) continue;
        for (const d of status.disks) {
          if (!diskHasProblem(d)) continue;
          const bits = [d.health !== "Healthy" && d.health];
          if (typeof d.wearPercent === "number" && d.wearPercent >= 85)
            bits.push(`${Math.round(d.wearPercent)}% فرسودگی`);
          if (typeof d.readErrorsUncorrected === "number" && d.readErrorsUncorrected > 0)
            bits.push(`${d.readErrorsUncorrected} خطای خوانش تصحیح‌نشده`);
          fire(
            `disk:${status.machine}:${d.name}`,
            `هشدار سلامت دیسک · ${status.machine}`,
            `${d.name} — ${bits.filter(Boolean).join(" · ")}`,
            "error",
          );
        }
      }
    };
    check();
    window.addEventListener(DISK_HEALTH_EVT, check);
    return () => window.removeEventListener(DISK_HEALTH_EVT, check);
  }, []);

  // Camera motion (CCTV panel) — polled from the local agent's in-memory
  // motion log every 5s. Only fires on a NEW event (timestamp increased
  // since last check), so a camera sitting in continuous motion doesn't
  // re-fire every poll — cooldown below still applies on top of that.
  const lastMotionRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const check = async () => {
      if (isComposing()) return;
      const settings = loadAlertSettings();
      if (!settings.enabled || !settings.conditions.cameraMotion) return;
      try {
        const res = await fetch("http://localhost:8765/camera-motion");
        const json = (await res.json()) as { motion?: Record<string, number> };
        const motion = json.motion || {};
        const cameras = loadCameraConfig().cameras;
        for (const [key, ts] of Object.entries(motion)) {
          const last = lastMotionRef.current[key] || 0;
          if (ts > last) {
            lastMotionRef.current[key] = ts;
            const cam = cameras.find((c) => c.motionKey === key);
            fire(
              `camera-motion:${key}`,
              `حرکت شناسایی شد · ${cam?.name || key}`,
              "دوربین حرکت گزارش کرد — بررسی کن.",
              "warning",
            );
          }
        }
      } catch {
        /* agent offline */
      }
    };
    check();
    const id = setInterval(check, 5_000);
    return () => clearInterval(id);
  }, []);
}
