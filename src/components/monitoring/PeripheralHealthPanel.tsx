import { useEffect, useState } from "react";
import { Keyboard, Mouse, Headphones, Gamepad2, Monitor, HardDrive } from "lucide-react";
import { PERIPHERAL_EVT, hasPeripheralProblem, type PeripheralStatus } from "@/lib/peripheral-monitor";
import { DISK_HEALTH_EVT, diskHasProblem, type DiskHealthStatus } from "@/lib/disk-health";

interface Props {
  machine: string;
}

function PeripheralPill({
  ok,
  icon,
  label,
  informational,
}: {
  ok: boolean;
  icon: React.ReactNode;
  label: string;
  informational?: boolean;
}) {
  const color = ok ? "var(--neon-green)" : informational ? "oklch(0.6 0.02 250)" : "var(--neon-red)";
  return (
    <div
      className="flex items-center gap-1.5 rounded-md border p-2"
      style={{ borderColor: `${color}55`, background: `${color}0d` }}
    >
      <span style={{ color }}>{icon}</span>
      <span className="font-mono text-[11px] font-semibold" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

/** Peripheral (keyboard/mouse/headset/controller/monitor) + disk-health
 * (SMART) section for the client station detail modal — kept out of the
 * main dashboard grid so the front page doesn't get crowded; only visible
 * when someone opens a station's details. */
export function PeripheralHealthPanel({ machine }: Props) {
  const [peripherals, setPeripherals] = useState<PeripheralStatus | null>(null);
  useEffect(() => {
    const read = () => {
      const map = window.__exirPeripherals;
      setPeripherals(map?.[machine] || null);
    };
    read();
    window.addEventListener(PERIPHERAL_EVT, read);
    return () => window.removeEventListener(PERIPHERAL_EVT, read);
  }, [machine]);

  const [diskHealth, setDiskHealth] = useState<DiskHealthStatus | null>(null);
  useEffect(() => {
    const read = () => {
      const map = window.__exirDiskHealth;
      setDiskHealth(map?.[machine] || null);
    };
    read();
    window.addEventListener(DISK_HEALTH_EVT, read);
    return () => window.removeEventListener(DISK_HEALTH_EVT, read);
  }, [machine]);

  if (!peripherals && !diskHealth) return null;

  const peripheralProblem = peripherals ? hasPeripheralProblem(peripherals) : false;
  const badDisks = diskHealth?.ok ? diskHealth.disks.filter(diskHasProblem) : [];

  return (
    <div className="relative mt-4 rounded-md border border-border/60 bg-surface/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Keyboard size={11} /> ▸ جانبی‌ها و سلامت دیسک
        </div>
        {(peripheralProblem || badDisks.length > 0) && (
          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-rose-300">
            نیاز به بررسی
          </span>
        )}
      </div>

      {peripherals?.ok ? (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          <PeripheralPill ok={peripherals.keyboard} icon={<Keyboard size={13} />} label="کیبورد" />
          <PeripheralPill ok={peripherals.mouse} icon={<Mouse size={13} />} label="ماوس" />
          <PeripheralPill
            ok={peripherals.monitorCount > 0}
            icon={<Monitor size={13} />}
            label={`مانیتور ×${Math.max(0, peripherals.monitorCount)}`}
          />
          <PeripheralPill ok={peripherals.headset} icon={<Headphones size={13} />} label="هدست" informational />
          <PeripheralPill ok={peripherals.controller} icon={<Gamepad2 size={13} />} label="دسته" informational />
        </div>
      ) : (
        <p className="font-mono text-[10px] text-muted-foreground">
          {peripherals?.error || "منتظر اولین بررسی جانبی‌ها…"}
        </p>
      )}

      {diskHealth?.ok && diskHealth.disks.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-border/40 pt-2.5">
          {diskHealth.disks.map((d, i) => {
            const bad = diskHasProblem(d);
            const color = bad ? "var(--neon-red)" : "var(--neon-green)";
            return (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded border p-2"
                style={{ borderColor: `${color}40`, background: `${color}08` }}
              >
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold" style={{ color }}>
                  <HardDrive size={12} /> {d.name}
                  <span className="text-muted-foreground">
                    ({d.mediaType}{d.sizeGB ? ` · ${d.sizeGB} GB` : ""})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span style={{ color }}>{d.health}</span>
                  {typeof d.temperature === "number" && <span>{d.temperature}°C</span>}
                  {typeof d.wearPercent === "number" && <span>{Math.round(d.wearPercent)}% فرسودگی</span>}
                  {typeof d.readErrorsUncorrected === "number" && d.readErrorsUncorrected > 0 && (
                    <span className="text-rose-300">{d.readErrorsUncorrected} خطای خوانش</span>
                  )}
                  {typeof d.powerOnHours === "number" && <span>{d.powerOnHours.toLocaleString()} ساعت کارکرد</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {diskHealth && !diskHealth.ok && (
        <p className="mt-2 border-t border-border/40 pt-2 font-mono text-[10px] text-muted-foreground">
          {diskHealth.error || "منتظر اولین بررسی سلامت دیسک…"}
        </p>
      )}
    </div>
  );
}
