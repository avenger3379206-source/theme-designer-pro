import { useEffect, useRef, useState } from "react";
import { Bell, Volume2, Upload, Trash2, Play } from "lucide-react";
import {
  DEFAULT_ALERT_SETTINGS,
  MAX_ALERT_SOUND_BYTES,
  clearCustomAlertSound,
  loadAlertSettings,
  loadCustomAlertSound,
  playAlertSound,
  saveAlertSettings,
  saveCustomAlertSound,
  type AlertSettings,
  type StoredAlertSound,
} from "@/lib/alert-settings";

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

export function AlertSettingsPanel() {
  const [s, setS] = useState<AlertSettings>(() => loadAlertSettings());
  const [customSound, setCustomSound] = useState<StoredAlertSound | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => loadCustomAlertSound().then(setCustomSound);
    refresh();
    window.addEventListener("exir:alert-sound-changed", refresh);
    return () => window.removeEventListener("exir:alert-sound-changed", refresh);
  }, []);

  function update(patch: Partial<AlertSettings>) {
    const next = { ...s, ...patch };
    setS(next);
    saveAlertSettings(next);
  }

  function updateCondition(patch: Partial<AlertSettings["conditions"]>) {
    update({ conditions: { ...s.conditions, ...patch } });
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    const res = await saveCustomAlertSound(file);
    setUploading(false);
    if (!res.ok) {
      setUploadError(res.error || "خطا در ذخیره فایل");
      return;
    }
    update({ soundMode: "custom" });
  }

  async function removeCustomSound() {
    await clearCustomAlertSound();
    if (s.soundMode === "custom") update({ soundMode: "default" });
  }

  return (
    <div className="mb-6 rounded-xl p-5 glass-panel">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-cyan-300" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-glow-cyan">
            Alerts · هشدارها
          </h2>
        </div>
        <button
          onClick={() => update({ enabled: !s.enabled })}
          className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
            s.enabled
              ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
              : "border-border/60 bg-surface/40 text-muted-foreground"
          }`}
        >
          {s.enabled ? "روشن" : "خاموش"}
        </button>
      </div>

      <p className="mb-4 font-mono text-[11px] text-muted-foreground">
        وقتی یکی از این اتفاق‌ها بیفته، هم یه Toast روی صفحه نشون داده می‌شه و هم صدای هشدار پخش می‌شه.
      </p>

      <div className={s.enabled ? "" : "pointer-events-none opacity-40"}>
        {/* Conditions */}
        <div className="mb-5 grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5">
            <input
              type="checkbox"
              checked={s.conditions.overheat}
              onChange={(e) => updateCondition({ overheat: e.target.checked })}
              className="size-4 accent-cyan-500"
            />
            <span className="font-mono text-xs text-foreground">دمای بحرانی GPU/CPU</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5">
            <input
              type="checkbox"
              checked={s.conditions.offline}
              onChange={(e) => updateCondition({ offline: e.target.checked })}
              className="size-4 accent-cyan-500"
            />
            <span className="font-mono text-xs text-foreground">آفلاین شدن کلاینت</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5">
            <input
              type="checkbox"
              checked={s.conditions.wanDown}
              onChange={(e) => updateCondition({ wanDown: e.target.checked })}
              className="size-4 accent-cyan-500"
            />
            <span className="font-mono text-xs text-foreground">قطعی شبکه (پینگ)</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5">
            <input
              type="checkbox"
              checked={s.conditions.reservationEnding}
              onChange={(e) => updateCondition({ reservationEnding: e.target.checked })}
              className="size-4 accent-cyan-500"
            />
            <span className="font-mono text-xs text-foreground">اتمام نزدیک رزرو</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5">
            <input
              type="checkbox"
              checked={s.conditions.reservationStarting}
              onChange={(e) => updateCondition({ reservationStarting: e.target.checked })}
              className="size-4 accent-cyan-500"
            />
            <span className="font-mono text-xs text-foreground">شروع نزدیک رزرو</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5">
            <input
              type="checkbox"
              checked={s.conditions.peripheralDisconnected}
              onChange={(e) => updateCondition({ peripheralDisconnected: e.target.checked })}
              className="size-4 accent-cyan-500"
            />
            <span className="font-mono text-xs text-foreground">قطع شدن کیبورد/ماوس/مانیتور</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5">
            <input
              type="checkbox"
              checked={s.conditions.diskHealth}
              onChange={(e) => updateCondition({ diskHealth: e.target.checked })}
              className="size-4 accent-cyan-500"
            />
            <span className="font-mono text-xs text-foreground">سلامت دیسک (SMART)</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5">
            <input
              type="checkbox"
              checked={s.conditions.cameraMotion}
              onChange={(e) => updateCondition({ cameraMotion: e.target.checked })}
              className="size-4 accent-cyan-500"
            />
            <span className="font-mono text-xs text-foreground">حرکت دوربین (CCTV)</span>
          </label>
        </div>

        {s.conditions.reservationEnding && (
          <div className="mb-3 flex items-center gap-3">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              هشدار اتمام رزرو چند دقیقه قبل؟
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={s.conditions.reservationEndingMinutes}
              onChange={(e) =>
                updateCondition({ reservationEndingMinutes: Math.max(1, Number(e.target.value) || 1) })
              }
              className="w-20 rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-sm outline-none focus:border-cyan-500"
            />
            <span className="font-mono text-[10px] text-muted-foreground">دقیقه</span>
          </div>
        )}

        {s.conditions.reservationStarting && (
          <div className="mb-5 flex items-center gap-3">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              هشدار شروع رزرو چند دقیقه قبل؟
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={s.conditions.reservationStartingMinutes}
              onChange={(e) =>
                updateCondition({ reservationStartingMinutes: Math.max(1, Number(e.target.value) || 1) })
              }
              className="w-20 rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-sm outline-none focus:border-cyan-500"
            />
            <span className="font-mono text-[10px] text-muted-foreground">دقیقه</span>
          </div>
        )}

        {/* Volume */}
        <div className="mb-5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <Volume2 size={12} /> میزان صدا
            </label>
            <span className="font-mono text-xs font-bold text-cyan-300">{s.volume}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={s.volume}
            onChange={(e) => update({ volume: Number(e.target.value) })}
            className="mt-2 w-full accent-cyan-500"
          />
        </div>

        {/* Sound source */}
        <div className="mb-2">
          <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            نوع صدای هشدار
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => update({ soundMode: "default" })}
              className={`flex-1 rounded-lg border px-3 py-2 font-mono text-xs uppercase tracking-wider transition ${
                s.soundMode === "default"
                  ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                  : "border-border/60 bg-surface/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              صدای پیش‌فرض
            </button>
            <button
              onClick={() => customSound && update({ soundMode: "custom" })}
              disabled={!customSound}
              className={`flex-1 rounded-lg border px-3 py-2 font-mono text-xs uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40 ${
                s.soundMode === "custom"
                  ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                  : "border-border/60 bg-surface/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              فایل شخصی من
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-border/60 bg-surface/40 p-3">
          {customSound ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-mono text-xs text-foreground">{customSound.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {formatBytes(customSound.size)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-border/60 bg-surface/60 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  جایگزینی
                </button>
                <button
                  onClick={removeCustomSound}
                  className="flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-red-300 hover:bg-red-500/20"
                >
                  <Trash2 size={12} /> حذف
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:border-cyan-500/50 hover:text-cyan-300 disabled:opacity-50"
            >
              <Upload size={14} /> {uploading ? "در حال آپلود…" : "انتخاب فایل صوتی از سیستم (تا ۱۰۰ مگابایت)"}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          {uploadError && (
            <p className="mt-2 font-mono text-[10px] text-red-300">{uploadError}</p>
          )}
          <p className="mt-2 font-mono text-[9px] text-muted-foreground/70">
            حداکثر حجم مجاز: {formatBytes(MAX_ALERT_SOUND_BYTES)}
          </p>
        </div>

        <button
          onClick={() => playAlertSound(s)}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/20"
        >
          <Play size={12} /> پخش آزمایشی
        </button>
      </div>

      {JSON.stringify(s) !== JSON.stringify(DEFAULT_ALERT_SETTINGS) && (
        <button
          onClick={() => update(DEFAULT_ALERT_SETTINGS)}
          className="mt-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground underline decoration-dotted hover:text-foreground"
        >
          بازگشت به پیش‌فرض
        </button>
      )}
    </div>
  );
}
