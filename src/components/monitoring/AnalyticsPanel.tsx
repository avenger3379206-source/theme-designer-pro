import { useEffect, useState } from "react";
import { BarChart3, Flame, Trophy, RotateCcw, Palette, Copy, Trash2, Save, Check } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  busiestHour,
  hourlyLoad,
  recentDays,
  resetAnalytics,
  topGames,
  type DailyStat,
} from "@/lib/analytics";
import { isComposing } from "@/lib/compose-lock";
import {
  DEFAULT_CHART_COLORS,
  createProfile,
  deleteProfile,
  duplicateProfile,
  getActiveColors,
  loadActiveProfileId,
  loadChartProfiles,
  setActiveProfileId,
  updateProfile,
  type ChartColorPalette,
  type ChartColorProfile,
} from "@/lib/analytics-chart-colors";

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} دقیقه`;
  return `${h.toFixed(1)} ساعت`;
}

function fmtMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)} دقیقه`;
  return `${(m / 60).toFixed(1)} ساعت`;
}

function fmtDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("fa-IR", { day: "numeric", month: "short" });
}

function CustomTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string | number;
  unit: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-surface/95 px-3 py-2 font-mono text-xs shadow-xl">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-bold text-cyan-300">
        {payload[0].value.toFixed(1)} {unit}
      </div>
    </div>
  );
}

// ── Color swatch input (label + <input type=color> + hex readout) ─────────
function SwatchInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-14 cursor-pointer rounded border border-border/60 bg-transparent p-0.5"
        />
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      </div>
    </label>
  );
}

// ── Color / profile customization drawer ───────────────────────────────────
function ChartColorEditor({
  colors,
  onColorsChange,
}: {
  colors: ChartColorPalette;
  onColorsChange: (c: ChartColorPalette) => void;
}) {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<ChartColorProfile[]>(() => loadChartProfiles());
  const [activeId, setActiveId] = useState(() => loadActiveProfileId());
  const [newName, setNewName] = useState("");

  useEffect(() => {
    const refresh = () => {
      setProfiles(loadChartProfiles());
      setActiveId(loadActiveProfileId());
      onColorsChange(getActiveColors());
    };
    window.addEventListener("exir:analytics-colors", refresh);
    return () => window.removeEventListener("exir:analytics-colors", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDefault = activeId === "default";

  function patchColor(patch: Partial<ChartColorPalette>) {
    const next = { ...colors, ...patch };
    onColorsChange(next);
    if (!isDefault) updateProfile(activeId, { colors: next });
  }

  function handleSaveAsNew() {
    const name = newName.trim() || `پروفایل ${profiles.length}`;
    createProfile(name, colors);
    setNewName("");
  }

  return (
    <div className="mb-3 rounded-lg border border-border/50 bg-background/30 p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <Palette size={13} className="text-fuchsia-300" /> رنگ‌بندی نمودارها · پروفایل‌ها
        </span>
        <span className="text-[11px] text-muted-foreground">{open ? "بستن ▲" : "باز کردن ▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {/* Profile switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveProfileId(p.id)}
                className={
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs " +
                  (p.id === activeId
                    ? "border-fuchsia-400/70 bg-fuchsia-500/10 text-fuchsia-200"
                    : "border-border/60 bg-surface/40 text-muted-foreground hover:text-foreground")
                }
              >
                {p.id === activeId && <Check size={11} />}
                {p.name}
              </button>
            ))}
          </div>

          {/* Swatches for the active profile */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SwatchInput label="ساعت‌های پرترافیک" value={colors.hourBar} onChange={(v) => patchColor({ hourBar: v })} />
            <SwatchInput label="روند روزانه" value={colors.dayBar} onChange={(v) => patchColor({ dayBar: v })} />
            <SwatchInput label="گرادینت بازی‌ها — شروع" value={colors.gameBarFrom} onChange={(v) => patchColor({ gameBarFrom: v })} />
            <SwatchInput label="گرادینت بازی‌ها — پایان" value={colors.gameBarTo} onChange={(v) => patchColor({ gameBarTo: v })} />
            <SwatchInput label="خطوط شبکه نمودار" value={colors.gridLine} onChange={(v) => patchColor({ gridLine: v })} />
            <SwatchInput label="رنگ متن محورها" value={colors.axisText} onChange={(v) => patchColor({ axisText: v })} />
          </div>

          {isDefault && (
            <p className="font-mono text-[11px] text-amber-300/80">
              پروفایل «پیش‌فرض» قابل ویرایش دائمی نیست — رنگ‌ها رو عوض کن و پایین «ذخیره به‌عنوان پروفایل جدید» رو بزن.
            </p>
          )}

          {/* Save-as-new + profile management */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="نام پروفایل جدید…"
              className="min-w-[140px] flex-1 rounded-lg border border-border/60 bg-surface/40 px-2.5 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/60"
            />
            <button
              onClick={handleSaveAsNew}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-400/60 bg-cyan-500/10 px-2.5 py-1.5 font-mono text-xs text-cyan-200 hover:bg-cyan-500/20"
            >
              <Save size={12} /> ذخیره به‌عنوان پروفایل جدید
            </button>
            {!isDefault && (
              <>
                <button
                  onClick={() => duplicateProfile(activeId)}
                  className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
                >
                  <Copy size={12} /> کپی این پروفایل
                </button>
                <button
                  onClick={() => {
                    if (confirm(`پروفایل «${profiles.find((p) => p.id === activeId)?.name}» حذف بشه؟`)) {
                      deleteProfile(activeId);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/50 px-2.5 py-1.5 font-mono text-xs text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 size={12} /> حذف پروفایل
                </button>
              </>
            )}
            <button
              onClick={() => setActiveProfileId("default")}
              className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw size={12} /> برگشت به پیش‌فرض
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalyticsPanel() {
  const [hours, setHours] = useState(() => hourlyLoad());
  const [peak, setPeak] = useState(() => busiestHour());
  const [days, setDays] = useState<DailyStat[]>(() => recentDays(14));
  const [games, setGames] = useState(() => topGames(8));
  const [colors, setColors] = useState<ChartColorPalette>(() => getActiveColors());

  useEffect(() => {
    const refresh = () => {
      if (isComposing()) return;
      setHours(hourlyLoad());
      setPeak(busiestHour());
      setDays(recentDays(14));
      setGames(topGames(8));
    };
    window.addEventListener("exir:analytics", refresh);
    const id = setInterval(refresh, 15_000);
    return () => {
      window.removeEventListener("exir:analytics", refresh);
      clearInterval(id);
    };
  }, []);

  function handleReset() {
    const sure = confirm("همه‌ی آمار جمع‌آوری‌شده (ساعت شلوغی، روند روزانه، بازی‌های پرطرفدار) پاک بشه؟");
    if (!sure) return;
    resetAnalytics();
    setHours(hourlyLoad());
    setPeak(busiestHour());
    setDays(recentDays(14));
    setGames(topGames(8));
  }

  const hourData = hours.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}:00`, avg: h.avg }));
  const dayData = days.map((d) => ({ label: fmtDayLabel(d.date), gameHours: Number(d.gameHours.toFixed(2)) }));
  const maxGameMinutes = games.length > 0 ? games[0].minutes : 1;
  const c = colors || DEFAULT_CHART_COLORS;

  return (
    <div className="mb-3 rounded-xl p-3 glass-panel">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-mono text-sm uppercase tracking-[0.3em] text-muted-foreground">
          <BarChart3 size={14} /> ▸ <span className="font-fa" lang="fa">آمار و تحلیل روند</span> · analytics
        </h3>
        <button
          onClick={handleReset}
          title="پاک کردن همه‌ی آمار"
          className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface/60 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:border-red-500/50 hover:text-red-300"
        >
          <RotateCcw size={12} /> ریست آمار
        </button>
      </div>

      <ChartColorEditor colors={c} onColorsChange={setColors} />

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Busiest hours */}
        <div className="rounded-lg border border-border/50 bg-background/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              <Flame size={14} className="text-amber-400" /> ساعت‌های پرترافیک
            </span>
            {peak && (
              <span className="font-mono text-xs text-amber-300">
                اوج: {String(peak.hour).padStart(2, "0")}:00 · میانگین {peak.avg.toFixed(1)} ایستگاه
              </span>
            )}
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={c.gridLine} />
                <XAxis
                  dataKey="label"
                  interval={2}
                  tick={{ fontSize: 11, fill: c.axisText }}
                  axisLine={{ stroke: "oklch(1 0 0 / 0.1)" }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: c.axisText }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "oklch(1 0 0 / 0.05)" }}
                  content={<CustomTooltip unit="ایستگاه" />}
                />
                <Bar dataKey="avg" fill={c.hourBar} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily trend */}
        <div className="rounded-lg border border-border/50 bg-background/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              روند روزانه (ساعت‌های بازی)
            </span>
            {dayData.length > 0 && (
              <span className="font-mono text-xs" style={{ color: c.dayBar }}>
                امروز: {fmtHours(dayData[dayData.length - 1].gameHours)}
              </span>
            )}
          </div>
          <div className="h-44 w-full">
            {dayData.length === 0 ? (
              <div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground">
                هنوز داده‌ای جمع نشده
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={c.gridLine} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: c.axisText }}
                    axisLine={{ stroke: "oklch(1 0 0 / 0.1)" }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: c.axisText }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "oklch(1 0 0 / 0.05)" }} content={<CustomTooltip unit="ساعت" />} />
                  <Bar dataKey="gameHours" fill={c.dayBar} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Popular games */}
      <div className="mt-3 rounded-lg border border-border/50 bg-background/30 p-3">
        <div className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <Trophy size={14} className="text-yellow-400" /> بازی‌ها / برنامه‌های پرطرفدار (کل زمان اجرا)
        </div>
        {games.length === 0 ? (
          <p className="py-4 text-center font-mono text-xs text-muted-foreground">
            هنوز داده‌ای جمع نشده
          </p>
        ) : (
          <div className="space-y-2">
            {games.map((g, i) => (
              <div key={g.name} className="flex items-center gap-2">
                <span className="w-5 shrink-0 font-mono text-[11px] text-muted-foreground">#{i + 1}</span>
                <span className="w-36 shrink-0 truncate font-mono text-xs text-foreground" title={g.name}>
                  {g.name}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface/60">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, (g.minutes / maxGameMinutes) * 100)}%`,
                      background: `linear-gradient(90deg, ${c.gameBarFrom}, ${c.gameBarTo})`,
                    }}
                  />
                </div>
                <span className="w-16 shrink-0 text-left font-mono text-[11px] text-muted-foreground">
                  {fmtMinutes(g.minutes)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
