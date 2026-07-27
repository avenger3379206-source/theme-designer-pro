import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { clearAlertLog, loadAlertLog, markAllAlertsSeen, type AlertLogEntry } from "@/lib/alert-log";

function timeAgo(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "همین الان";
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ساعت پیش`;
  const d = Math.floor(h / 24);
  return `${d} روز پیش`;
}

export function AlertBell() {
  const [entries, setEntries] = useState<AlertLogEntry[]>(() => loadAlertLog());
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = () => setEntries(loadAlertLog());
    window.addEventListener("exir:alert-log", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("exir:alert-log", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const unseenCount = entries.filter((e) => !e.seen).length;
  const hasUnseen = unseenCount > 0;

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next && hasUnseen) markAllAlertsSeen();
      return next;
    });
  }

  function handleReset() {
    clearAlertLog();
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={toggle}
        title="هشدارها"
        className={`relative flex size-10 items-center justify-center rounded-lg border transition ${
          hasUnseen
            ? "alarm-blink border-red-500/60 text-red-300"
            : "border-border/60 bg-surface/60 text-muted-foreground hover:border-cyan-500/60 hover:text-cyan-300"
        }`}
      >
        <Bell size={16} />
        {hasUnseen && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 font-mono text-[9px] font-bold leading-none text-white">
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div
          dir="rtl"
          className="absolute top-12 right-0 z-50 w-80 max-w-[90vw] rounded-xl border border-border/60 bg-surface/95 p-3 shadow-2xl backdrop-blur"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
              هشدارها
            </h3>
            <button
              onClick={handleReset}
              disabled={entries.length === 0}
              className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground underline decoration-dotted hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ریست
            </button>
          </div>

          {entries.length === 0 ? (
            <p className="py-6 text-center font-mono text-[11px] text-muted-foreground">
              هیچ هشداری ثبت نشده
            </p>
          ) : (
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {entries.map((e) => (
                <div key={e.id} className="rounded-lg border border-border/50 bg-background/40 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: e.kind === "error" ? "var(--neon-red, #ef4444)" : "#facc15" }}
                      />
                      <span className="truncate font-mono text-[11px] font-bold text-foreground">
                        {e.title}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                      {timeAgo(e.createdAt)}
                    </span>
                  </div>
                  {e.description && (
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
                      {e.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
