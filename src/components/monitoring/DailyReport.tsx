import { useEffect, useState, type ReactNode } from "react";
import { FileClock, Download, Upload } from "lucide-react";
import { computeToday, loadYesterday, startDailyScheduler, fmtBytes, type DailySnapshot } from "@/lib/daily-report";
import { isComposing } from "@/lib/compose-lock";

let scheduled = false;

const SERVICE_LABELS: Record<string, string> = {
  steam: "Steam (CS2 / Dota2 / …)",
  epic: "Epic Games (Fortnite / …)",
  riot: "Riot (Valorant / LoL)",
  blizzard: "Blizzard",
  origin: "EA / Origin",
  wsus: "Windows Update",
  windows: "Windows Update",
  microsoft: "Microsoft Store",
  uplay: "Ubisoft",
  rockstar: "Rockstar",
  other: "متفرقه",
};

function svcLabel(s: string) {
  return SERVICE_LABELS[s.toLowerCase()] || s;
}

export function DailyReport() {
  const [today, setToday] = useState<DailySnapshot>(() => computeToday());
  const [yesterday, setYesterday] = useState<DailySnapshot | null>(() => loadYesterday());

  useEffect(() => {
    if (!scheduled) { startDailyScheduler(); scheduled = true; }
    const id = setInterval(() => {
      if (isComposing()) return;
      setToday(computeToday());
      setYesterday(loadYesterday());
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mb-3 rounded-xl p-3 glass-panel">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          <FileClock size={12} /> ▸ <span className="font-fa" lang="fa">گزارش</span> · daily report (rollover 03:00)
        </h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <DayCard title={<><span className="font-fa" lang="fa">امروز</span> · today</>} snap={today} />
        <DayCard
          title={
            yesterday ? (
              <><span className="font-fa" lang="fa">دیروز</span> · {yesterday.date}</>
            ) : (
              <span className="font-fa" lang="fa">دیروز</span>
            )
          }
          snap={yesterday}
          muted
        />
      </div>
    </div>
  );
}

function DayCard({ title, snap, muted }: { title: ReactNode; snap: DailySnapshot | null; muted?: boolean }) {
  return (
    <div className={`rounded-lg border border-border/60 bg-surface/40 p-3 ${muted ? "opacity-80" : ""}`}>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
      {!snap ? (
        <div className="font-mono text-[10px] text-muted-foreground">no data yet</div>
      ) : (
        <>
          {/* Uptime / summary */}
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
            <Row k="WAN1 uptime" v={`${snap.wan1Uptime.toFixed(2)}%`} c="var(--neon-cyan)" />
            <Row k="WAN2 uptime" v={`${snap.wan2Uptime.toFixed(2)}%`} c="var(--neon-magenta)" />
            <Row k="Steam Down" v={<>{snap.steamDownMinutes} <span className="font-fa" lang="fa">دقیقه</span></>} c="var(--neon-amber)" />
            <Row k={<span className="font-fa" lang="fa">بیشترین مصرف</span>} v={snap.topConsumer} c="var(--neon-green)" />
          </div>

          {/* Totals */}
          <div className="mt-3 flex items-center gap-3 border-t border-border/40 pt-2 font-mono text-[11px]">
            <span className="flex items-center gap-1 text-cyan-300"><Download size={11} /> {fmtBytes(snap.totalDown)}</span>
            <span className="flex items-center gap-1 text-fuchsia-300"><Upload size={11} /> {fmtBytes(snap.totalUp)}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">total traffic</span>
          </div>

          {/* Per-machine */}
          <div className="mt-2">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              <span className="font-fa" lang="fa">هر سیستم</span> · per machine
            </div>
            {snap.perMachine.length === 0 ? (
              <div className="font-mono text-[10px] text-muted-foreground/70">
                <span className="font-fa" lang="fa">داده‌ای ثبت نشده — LanCache tail را در Settings فعال کنید</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-0.5 font-mono text-[10.5px] sm:grid-cols-2">
                {snap.perMachine.slice(0, 12).map((m) => (
                  <div key={m.machine} className="flex items-center justify-between rounded border border-border/40 bg-background/40 px-1.5 py-1">
                    <span className="font-bold text-glow-cyan">{m.machine}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-cyan-300">↓{fmtBytes(m.down)}</span>
                      <span className="text-fuchsia-300">↑{fmtBytes(m.up)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per-category */}
          <div className="mt-2">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              <span className="font-fa" lang="fa">بر اساس بازی/برنامه</span> · by service
            </div>
            {snap.perCategory.length === 0 ? (
              <div className="font-mono text-[10px] text-muted-foreground/70">—</div>
            ) : (
              <div className="grid grid-cols-1 gap-0.5 font-mono text-[10.5px]">
                {snap.perCategory.slice(0, 6).map((c) => {
                  const pct = snap.totalDown ? (c.down / snap.totalDown) * 100 : 0;
                  return (
                    <div key={c.service} className="rounded border border-border/40 bg-background/40 px-1.5 py-1">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground">{svcLabel(c.service)}</span>
                        <span className="text-cyan-300">{fmtBytes(c.down)}</span>
                      </div>
                      <div className="mt-0.5 h-1 overflow-hidden rounded bg-border/50">
                        <div className="h-full" style={{ width: `${Math.min(100, pct)}%`, background: "var(--neon-cyan)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ k, v, c }: { k: ReactNode; v: ReactNode; c: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}:</span>
      <span className="font-bold" style={{ color: c }}>{v}</span>
    </div>
  );
}
