import { useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  User,
  X,
  Plus,
  Phone,
  Clock,
  ListChecks,
  ArrowRight,
  Check,
  Wallet,
} from "lucide-react";
import {
  defaultSeats,
  currentReservation,
  nextReservation,
  listSeatReservations,
  releaseReservation,
  remainingMinutes,
  minutesUntilStart,
  addReservation,
  reservationStatus,
  reservationPrice,
  setReservationPaid,
  getDefaultHourlyRateThousand,
  setDefaultHourlyRateThousand,
  purgeOldReservations,
  type SeatKind,
} from "@/lib/reservations";
import { isComposing } from "@/lib/compose-lock";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const KIND_COLOR: Record<SeatKind, string> = {
  pc: "var(--neon-cyan)",
  ps4: "var(--neon-magenta)",
  ps5: "var(--neon-amber)",
  room: "var(--neon-green)",
};

const QUICK_DURATIONS = [30, 60, 90, 120, 180];

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

/** "16:00" today, or "۲۸ تیر · 16:00" when the reservation isn't today. */
function fmtWhen(ts: number, now = Date.now()): string {
  if (isSameDay(ts, now)) return fmtTime(ts);
  const day = new Date(ts).toLocaleDateString("fa-IR", { day: "numeric", month: "short" });
  return `${day} · ${fmtTime(ts)}`;
}

function fmtCountdown(mins: number): string {
  const m = Math.max(0, Math.floor(mins));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** "16:00" from a timestamp, for feeding <input type="time">. */
function timeStringFromTs(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Combine a reference date (day only matters) with an "HH:MM" string. */
function combineDateAndTime(dateRef: Date, hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const d = new Date(dateRef);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d.getTime();
}

function startOfDay(ts: number): Date {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDateLabel(d: Date): string {
  return d.toLocaleDateString("fa-IR", { weekday: "long", day: "numeric", month: "long" });
}

function formatToman(n: number): string {
  return `${Math.round(n).toLocaleString("fa-IR")} تومان`;
}

export function ReservationBoard() {
  const seats = defaultSeats();
  const [, forceTick] = useState(0);
  const [modalSeat, setModalSeat] = useState<string | null>(null);
  const [scheduleSeat, setScheduleSeat] = useState<string | null>(null);

  useEffect(() => {
    purgeOldReservations();
    const bump = () => forceTick((n) => n + 1);
    window.addEventListener("exir:reservations", bump);
    window.addEventListener("storage", bump);
    const id = setInterval(() => {
      if (isComposing()) return;
      bump();
    }, 15_000);
    return () => {
      window.removeEventListener("exir:reservations", bump);
      window.removeEventListener("storage", bump);
      clearInterval(id);
    };
  }, []);

  const now = Date.now();
  let activeCount = 0;
  let upcomingCount = 0;
  let unpaidCount = 0;
  for (const s of seats) {
    if (currentReservation(s.id, now)) activeCount++;
    if (nextReservation(s.id, now)) upcomingCount++;
    for (const r of listSeatReservations(s.id)) {
      if (r.endAt > now && !r.paid) unpaidCount++;
    }
  }

  return (
    <div dir="rtl" className="mb-3 rounded-xl p-3 text-right glass-panel">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          <CalendarClock size={12} /> ▸ رزرو صندلی · seat reservation
        </h3>
        <span className="font-mono text-[9px] text-muted-foreground">
          {activeCount} فعال · {upcomingCount} در صف · {seats.length} صندلی
          {unpaidCount > 0 && <span className="text-rose-300"> · {unpaidCount} پرداخت‌نشده</span>}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9">
        {seats.map((s) => {
          const active = currentReservation(s.id, now);
          const upcoming = nextReservation(s.id, now);
          const accent = KIND_COLOR[s.kind];
          const rem = active ? remainingMinutes(active, now) : 0;

          return (
            <div
              key={s.id}
              className="group relative rounded-lg border p-2 text-center transition"
              style={{
                borderColor: active ? accent : "oklch(0.3 0.02 260 / 0.6)",
                background: active ? `${accent}18` : "oklch(0.14 0.02 260 / 0.5)",
                boxShadow: active ? `0 0 12px ${accent}55` : undefined,
              }}
            >
              <button
                onClick={() => setScheduleSeat(s.id)}
                title="برنامه صندلی · schedule"
                className="absolute -top-1.5 -left-1.5 rounded-full border border-border/60 bg-background p-0.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-cyan-300"
              >
                <ListChecks size={9} />
              </button>

              <div className="font-mono text-[11px] font-bold" style={{ color: accent }}>
                {s.label}
              </div>

              {active ? (
                <>
                  <div className="mt-0.5 flex items-center justify-center gap-1 font-mono text-[10px] text-foreground/90">
                    <User size={9} /> {active.customer}
                  </div>
                  {active.phone && (
                    <div className="flex items-center justify-center gap-1 font-mono text-[9px] text-muted-foreground/80">
                      <Phone size={8} /> {active.phone}
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-1 font-mono text-[10px] text-muted-foreground">
                    <Clock size={9} /> {fmtCountdown(rem)} مونده
                  </div>
                  <div
                    className={`mt-0.5 flex items-center justify-center gap-0.5 font-mono text-[8px] font-bold ${
                      active.paid ? "text-green-300" : "text-rose-300"
                    }`}
                  >
                    {active.paid && <Check size={8} />} {active.paid ? "پرداخت شده" : "پرداخت نشده"}
                  </div>
                  {upcoming && (
                    <div className="mt-0.5 font-mono text-[8px] text-amber-300/80">
                      بعدی {fmtWhen(upcoming.startedAt, now)}
                    </div>
                  )}
                  <button
                    onClick={() => releaseReservation(s.id, active.id)}
                    title="release"
                    className="absolute -top-1.5 -right-1.5 rounded-full border border-border/60 bg-background p-0.5 text-muted-foreground hover:text-rose-300"
                  >
                    <X size={9} />
                  </button>
                </>
              ) : upcoming ? (
                <>
                  <div className="mt-0.5 font-mono text-[9px] text-amber-300/90">
                    رزرو {fmtWhen(upcoming.startedAt, now)}
                  </div>
                  <div className="truncate font-mono text-[9px] text-muted-foreground">
                    {upcoming.customer}
                  </div>
                  <button
                    onClick={() => setModalSeat(s.id)}
                    className="mt-1 inline-flex items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground hover:text-foreground"
                  >
                    <Plus size={9} /> reserve
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setModalSeat(s.id)}
                  className="mt-1 inline-flex items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground hover:text-foreground"
                >
                  <Plus size={9} /> reserve
                </button>
              )}
            </div>
          );
        })}
      </div>

      {modalSeat && (
        <ReserveModal
          seatId={modalSeat}
          onClose={() => {
            setModalSeat(null);
            forceTick((n) => n + 1);
          }}
        />
      )}
      {scheduleSeat && (
        <ScheduleModal
          seatId={scheduleSeat}
          onClose={() => {
            setScheduleSeat(null);
            forceTick((n) => n + 1);
          }}
          onAddNew={() => {
            setScheduleSeat(null);
            setModalSeat(scheduleSeat);
          }}
        />
      )}
    </div>
  );
}

type TimeMode = "range" | "duration";

function ReserveModal({ seatId, onClose }: { seatId: string; onClose: () => void }) {
  const now = Date.now();

  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Price: the person always types the rate for a *single hour* (in هزار
  // تومان — thousands of Toman — so "60" means 60,000 T/hour); the total
  // below is derived automatically from however long this booking runs.
  const [rateInput, setRateInput] = useState(() => String(getDefaultHourlyRateThousand()));
  const [paid, setPaid] = useState(false);

  // The calendar only picks the *day*; start/end clock times are edited
  // separately so the whole thing stays typeable (no fighting a datetime
  // widget to change just the hour).
  const [dateOpen, setDateOpen] = useState(false);
  const [dateObj, setDateObj] = useState<Date>(() => startOfDay(now));
  const [startTime, setStartTime] = useState(() => timeStringFromTs(now));

  // "range": pick an explicit end clock-time ("4 to 6 pm").
  // "duration": pick how long the customer stays ("starts at 4, sits 2h").
  const [mode, setMode] = useState<TimeMode>("duration");
  const [endTime, setEndTime] = useState(() => timeStringFromTs(now + 60 * 60_000));
  const [durH, setDurH] = useState(1);
  const [durM, setDurM] = useState(0);

  const startedAt = combineDateAndTime(dateObj, startTime);
  let endAt =
    mode === "range"
      ? combineDateAndTime(dateObj, endTime)
      : startedAt + (durH * 60 + durM) * 60_000;
  // Sessions can cross midnight (e.g. 11pm → 1am) — if the end clock-time
  // is earlier than start, roll it to the next day instead of erroring.
  const rolledToNextDay = mode === "range" && endAt <= startedAt;
  if (rolledToNextDay) endAt += 24 * 60 * 60_000;

  const durationLabel = (() => {
    const mins = Math.round((endAt - startedAt) / 60_000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h} ساعت و ${m} دقیقه`;
    if (h) return `${h} ساعت`;
    return `${m} دقیقه`;
  })();

  const hourlyRateToman = (Number(rateInput) || 0) * 1000;
  const totalPrice = Math.round(hourlyRateToman * ((endAt - startedAt) / (60 * 60_000)));

  function setToday() {
    setDateObj(startOfDay(Date.now()));
    setDateOpen(false);
  }
  function setTomorrow() {
    setDateObj(startOfDay(Date.now() + 24 * 60 * 60_000));
    setDateOpen(false);
  }
  function startNow() {
    setDateObj(startOfDay(Date.now()));
    setStartTime(timeStringFromTs(Date.now()));
    setError(null);
  }
  function applyQuickDuration(minutes: number) {
    setMode("duration");
    setDurH(Math.floor(minutes / 60));
    setDurM(minutes % 60);
    setError(null);
  }

  function handleSubmit() {
    const res = addReservation({
      seatId,
      customer,
      phone,
      startedAt,
      endAt,
      hourlyRateToman: hourlyRateToman > 0 ? hourlyRateToman : undefined,
      paid,
      note,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0.05 0.02 260 / 0.6)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-5 text-right glass-panel neon-border-cyan"
      >
        <div className="mb-3 font-mono text-lg font-bold text-glow-cyan">Reserve {seatId}</div>

        <label className="block font-mono text-[10px] uppercase text-muted-foreground">
          customer name · نام مشتری
        </label>
        <input
          autoFocus
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1.5 text-right font-mono text-sm outline-none focus:border-cyan-500"
        />

        <label className="mt-3 block font-mono text-[10px] uppercase text-muted-foreground">
          phone · شماره تماس (اختیاری)
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09xxxxxxxxx"
          dir="ltr"
          className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1.5 text-center font-mono text-sm outline-none focus:border-cyan-500"
        />

        {/* Date */}
        <label className="mt-3 block font-mono text-[10px] uppercase text-muted-foreground">
          date · تاریخ
        </label>
        <div className="mt-1 flex gap-1.5">
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex flex-1 items-center gap-2 rounded border border-border bg-background/60 px-2 py-1.5 text-right font-mono text-xs outline-none hover:border-cyan-500/60"
              >
                <CalendarDays size={13} className="shrink-0 text-muted-foreground" />
                {fmtDateLabel(dateObj)}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateObj}
                onSelect={(d) => {
                  if (d) setDateObj(startOfDay(d.getTime()));
                  setDateOpen(false);
                }}
                autoFocus
              />
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={setToday}
            className="shrink-0 rounded border border-border/60 px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground hover:border-cyan-500/60 hover:text-cyan-300"
          >
            امروز
          </button>
          <button
            type="button"
            onClick={setTomorrow}
            className="shrink-0 rounded border border-border/60 px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground hover:border-cyan-500/60 hover:text-cyan-300"
          >
            فردا
          </button>
        </div>

        {/* Mode switch */}
        <div className="mt-3 flex items-center gap-1 rounded-lg border border-border/60 bg-surface/40 p-0.5 font-mono text-[10px] uppercase">
          <button
            type="button"
            onClick={() => setMode("range")}
            className="flex-1 rounded-md px-2 py-1.5 transition"
            style={
              mode === "range"
                ? { background: "oklch(0.85 0.18 200 / 0.15)", color: "var(--neon-cyan)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            بازه زمانی · from–to
          </button>
          <button
            type="button"
            onClick={() => setMode("duration")}
            className="flex-1 rounded-md px-2 py-1.5 transition"
            style={
              mode === "duration"
                ? { background: "oklch(0.85 0.18 200 / 0.15)", color: "var(--neon-cyan)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            شروع + مدت · start+duration
          </button>
        </div>

        {mode === "range" ? (
          <div dir="ltr" className="mt-2 flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-center font-mono text-[10px] uppercase text-muted-foreground">
                start · شروع
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1.5 text-center font-mono text-sm outline-none focus:border-cyan-500"
              />
            </div>
            <ArrowRight size={14} className="mt-4 shrink-0 rotate-180 text-muted-foreground" />
            <div className="flex-1">
              <label className="block text-center font-mono text-[10px] uppercase text-muted-foreground">
                end · پایان
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1.5 text-center font-mono text-sm outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        ) : (
          <div dir="ltr" className="mt-2 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-center font-mono text-[10px] uppercase text-muted-foreground">
                start · شروع
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1.5 text-center font-mono text-sm outline-none focus:border-cyan-500"
              />
            </div>
            <div className="w-16">
              <label className="block text-center font-mono text-[10px] uppercase text-muted-foreground">
                h · ساعت
              </label>
              <input
                type="number"
                min={0}
                max={23}
                value={durH}
                onChange={(e) => setDurH(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1.5 text-center font-mono text-sm outline-none focus:border-cyan-500"
              />
            </div>
            <div className="w-16">
              <label className="block text-center font-mono text-[10px] uppercase text-muted-foreground">
                m · دقیقه
              </label>
              <input
                type="number"
                min={0}
                max={59}
                step={5}
                value={durM}
                onChange={(e) => setDurM(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1.5 text-center font-mono text-sm outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={startNow}
            className="rounded border border-border/60 px-2 py-1 font-mono text-[9px] uppercase text-muted-foreground hover:border-cyan-500/60 hover:text-cyan-300"
          >
            start now
          </button>
          {QUICK_DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => applyQuickDuration(m)}
              className="rounded border border-border/60 px-2 py-1 font-mono text-[9px] uppercase text-muted-foreground hover:border-cyan-500/60 hover:text-cyan-300"
            >
              {m} min
            </button>
          ))}
        </div>

        {/* Price */}
        <label className="mt-3 block font-mono text-[10px] uppercase text-muted-foreground">
          نرخ ساعتی · هزار تومان (اختیاری)
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={5}
            dir="ltr"
            value={rateInput}
            onChange={(e) => {
              const v = e.target.value;
              setRateInput(v);
              const n = Number(v);
              if (Number.isFinite(n) && n >= 0) setDefaultHourlyRateThousand(n);
            }}
            placeholder="مثلاً 60"
            className="w-28 rounded border border-border bg-background/60 px-2 py-1.5 text-center font-mono text-sm outline-none focus:border-cyan-500"
          />
          <span className="font-mono text-xs text-muted-foreground">
            هزار تومان در ساعت — مبلغ کل خودکار حساب می‌شه
          </span>
        </div>

        {/* Payment status */}
        <label className="mt-3 block font-mono text-[10px] uppercase text-muted-foreground">
          وضعیت پرداخت
        </label>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => setPaid(false)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 font-mono text-xs font-bold transition ${
              !paid
                ? "border-rose-500/60 bg-rose-500/15 text-rose-300"
                : "border-border/60 text-muted-foreground hover:border-rose-500/40"
            }`}
          >
            {!paid && <Check size={13} />} پرداخت نشده
          </button>
          <button
            type="button"
            onClick={() => setPaid(true)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 font-mono text-xs font-bold transition ${
              paid
                ? "border-green-500/60 bg-green-500/15 text-green-300"
                : "border-border/60 text-muted-foreground hover:border-green-500/40"
            }`}
          >
            {paid && <Check size={13} />} پرداخت شده
          </button>
        </div>

        {/* Live summary */}
        <div className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-center font-mono text-[11px]">
          <div dir="ltr">
            <span className="text-cyan-300">{fmtTime(startedAt)}</span>
            <span className="mx-1.5 text-muted-foreground">تا</span>
            <span className="text-cyan-300">{fmtTime(endAt)}</span>
            <span className="mx-1.5 text-muted-foreground">·</span>
            <span className="text-muted-foreground">{durationLabel}</span>
            {rolledToNextDay && <span className="mr-1.5 text-amber-300">(تا فردا)</span>}
          </div>
          {hourlyRateToman > 0 && (
            <div className="mt-1.5 border-t border-cyan-500/20 pt-1.5 text-sm font-bold text-amber-300">
              مبلغ کل: {formatToman(totalPrice)}
            </div>
          )}
        </div>

        <label className="mt-3 block font-mono text-[10px] uppercase text-muted-foreground">
          note (optional) · توضیحات
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1.5 text-right font-mono text-sm outline-none focus:border-cyan-500"
        />

        {error && <p className="mt-2 font-mono text-[10px] text-rose-300">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-border/60 py-2 font-mono text-xs uppercase text-muted-foreground hover:text-foreground"
          >
            cancel
          </button>
          <button
            disabled={!customer.trim()}
            onClick={handleSubmit}
            className="flex-1 rounded border border-cyan-500/60 bg-cyan-500/15 py-2 font-mono text-xs font-bold uppercase text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-40"
          >
            reserve
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleModal({
  seatId,
  onClose,
  onAddNew,
}: {
  seatId: string;
  onClose: () => void;
  onAddNew: () => void;
}) {
  const [, tick] = useState(0);

  useEffect(() => {
    const bump = () => tick((n) => n + 1);
    window.addEventListener("exir:reservations", bump);
    return () => window.removeEventListener("exir:reservations", bump);
  }, []);

  const now = Date.now();
  const list = listSeatReservations(seatId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0.05 0.02 260 / 0.6)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-5 text-right glass-panel neon-border-cyan"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="font-mono text-lg font-bold text-glow-cyan">برنامه {seatId}</div>
          <button
            onClick={onAddNew}
            className="flex items-center gap-1 rounded border border-cyan-500/60 bg-cyan-500/15 px-2 py-1 font-mono text-[10px] uppercase text-cyan-300 hover:bg-cyan-500/25"
          >
            <Plus size={10} /> reserve
          </button>
        </div>

        {list.length === 0 ? (
          <p className="py-6 text-center font-mono text-[11px] text-muted-foreground">
            رزروی ثبت نشده
          </p>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {list.map((r) => {
              const st = reservationStatus(r, now);
              const price = reservationPrice(r);
              const badge =
                st === "active"
                  ? { label: "فعال", cls: "bg-cyan-500/20 text-cyan-300" }
                  : st === "upcoming"
                    ? { label: "در صف", cls: "bg-amber-500/20 text-amber-300" }
                    : { label: "پایان‌یافته", cls: "bg-muted text-muted-foreground" };
              return (
                <div key={r.id} className="rounded-lg border border-border/50 bg-background/40 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] font-bold text-foreground">
                        <User size={9} /> {r.customer}
                        <span className={`rounded px-1 py-0.5 text-[8px] uppercase ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span
                          className={`rounded px-1 py-0.5 text-[8px] uppercase ${
                            r.paid
                              ? "bg-green-500/20 text-green-300"
                              : "bg-rose-500/20 text-rose-300"
                          }`}
                        >
                          {r.paid ? "پرداخت شده" : "پرداخت نشده"}
                        </span>
                      </div>
                      {r.phone && (
                        <div dir="ltr" className="mt-0.5 flex items-center justify-end gap-1 font-mono text-[10px] text-muted-foreground">
                          <Phone size={8} /> {r.phone}
                        </div>
                      )}
                      <div dir="ltr" className="mt-0.5 text-right font-mono text-[10px] text-muted-foreground">
                        {fmtWhen(r.startedAt, now)} → {fmtWhen(r.endAt, now)}
                        {st === "active" && ` · ${fmtCountdown(remainingMinutes(r, now))} مونده`}
                        {st === "upcoming" && ` · شروع تا ${Math.ceil(minutesUntilStart(r, now))} دقیقه دیگه`}
                      </div>
                      {price > 0 && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold text-amber-300">
                            {formatToman(price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReservationPaid(seatId, r.id, !r.paid)}
                            className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold transition ${
                              r.paid
                                ? "border border-green-500/50 text-green-300 hover:bg-green-500/10"
                                : "border border-rose-500/50 text-rose-300 hover:bg-rose-500/10"
                            }`}
                          >
                            <Check size={9} /> {r.paid ? "پرداخت شده" : "علامت‌گذاری پرداخت"}
                          </button>
                        </div>
                      )}
                      {r.note && (
                        <div className="mt-0.5 font-mono text-[9px] italic text-muted-foreground/80">
                          {r.note}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => releaseReservation(seatId, r.id)}
                      title="حذف"
                      className="shrink-0 rounded-full border border-border/60 bg-background p-1 text-muted-foreground hover:text-rose-300"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
