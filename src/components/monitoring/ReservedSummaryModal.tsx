import { useEffect, useState } from "react";
import { X, User, Phone, Clock, CalendarClock, StickyNote, Wallet, Check } from "lucide-react";
import {
  defaultSeats,
  listSeatReservations,
  reservationStatus,
  remainingMinutes,
  minutesUntilStart,
  reservationPrice,
  setReservationPaid,
  releaseReservation,
  type SeatKind,
} from "@/lib/reservations";

const KIND_COLOR: Record<SeatKind, string> = {
  pc: "var(--neon-cyan)",
  ps4: "var(--neon-magenta)",
  ps5: "var(--neon-amber)",
  room: "var(--neon-green)",
};

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
  );
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

/** "16:00" today, or "۲۸ تیر · 16:00" when the reservation isn't today. */
function fmtWhen(ts: number, now: number): string {
  if (isSameDay(ts, now)) return fmtTime(ts);
  const day = new Date(ts).toLocaleDateString("fa-IR", { day: "numeric", month: "short" });
  return `${day} · ${fmtTime(ts)}`;
}

function fmtCountdown(mins: number): string {
  const m = Math.max(0, Math.floor(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h) return `${h} ساعت و ${r} دقیقه`;
  return `${r} دقیقه`;
}

function formatToman(n: number): string {
  return `${Math.round(n).toLocaleString("fa-IR")} تومان`;
}

export function ReservedSummaryModal({ onClose }: { onClose: () => void }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const bump = () => tick((n) => n + 1);
    window.addEventListener("exir:reservations", bump);
    const id = setInterval(bump, 15_000);
    return () => {
      window.removeEventListener("exir:reservations", bump);
      clearInterval(id);
    };
  }, []);

  const now = Date.now();
  const seats = defaultSeats();

  // Only seats that actually have something booked (active or upcoming).
  const rows = seats
    .map((seat) => ({ seat, reservations: listSeatReservations(seat.id).filter((r) => r.endAt > now) }))
    .filter((row) => row.reservations.length > 0);

  const totalReservations = rows.reduce((sum, row) => sum + row.reservations.length, 0);
  const unpaidCount = rows.reduce(
    (sum, row) => sum + row.reservations.filter((r) => !r.paid).length,
    0,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0.05 0.02 260 / 0.65)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl text-right glass-panel neon-border-cyan"
      >
        <div className="flex items-center justify-between border-b border-border/50 p-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-xl font-bold text-glow-cyan">
              <CalendarClock size={20} /> مشخصات رزروها
            </div>
            <div className="mt-1 font-mono text-sm text-muted-foreground">
              {rows.length} سیستم رزرو شده · {totalReservations} رزرو ثبت‌شده
              {unpaidCount > 0 && <span className="text-rose-300"> · {unpaidCount} پرداخت‌نشده</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-border/60 p-2 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {rows.length === 0 ? (
            <p className="py-10 text-center font-mono text-sm text-muted-foreground">
              در حال حاضر هیچ رزروی ثبت نشده
            </p>
          ) : (
            rows.map(({ seat, reservations }) => {
              const accent = KIND_COLOR[seat.kind];
              return (
                <div
                  key={seat.id}
                  className="rounded-xl border-2 p-4"
                  style={{ borderColor: `${accent}55`, background: `${accent}0d` }}
                >
                  <div className="mb-3 flex items-center gap-2 border-b border-border/40 pb-2">
                    <span
                      className="rounded-md px-2.5 py-1 font-mono text-lg font-black"
                      style={{ color: accent, textShadow: `0 0 10px ${accent}55` }}
                    >
                      {seat.label}
                    </span>
                    <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                      {seat.kind}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {reservations.map((r) => {
                      const status = reservationStatus(r, now);
                      const badge =
                        status === "active"
                          ? { label: "در حال استفاده", cls: "bg-cyan-500/20 text-cyan-300" }
                          : { label: "در صف · هنوز شروع نشده", cls: "bg-amber-500/20 text-amber-300" };
                      return (
                        <div
                          key={r.id}
                          className="rounded-lg border border-border/50 bg-background/50 p-3.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <User size={16} className="text-foreground/80" />
                              <span className="font-mono text-base font-bold text-foreground">
                                {r.customer}
                              </span>
                              <span className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold ${badge.cls}`}>
                                {badge.label}
                              </span>
                              <span
                                className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
                                  r.paid
                                    ? "bg-green-500/20 text-green-300"
                                    : "bg-rose-500/20 text-rose-300"
                                }`}
                              >
                                {r.paid ? "پرداخت شده" : "پرداخت نشده"}
                              </span>
                            </div>
                            <button
                              onClick={() => releaseReservation(seat.id, r.id)}
                              title="لغو رزرو"
                              className="rounded-md border border-border/60 px-2 py-1 font-mono text-[11px] text-muted-foreground hover:border-rose-500/60 hover:text-rose-300"
                            >
                              لغو
                            </button>
                          </div>

                          <div dir="ltr" className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {r.phone && (
                              <div className="flex items-center gap-2 font-mono text-sm text-foreground/90">
                                <Phone size={14} className="shrink-0 text-muted-foreground" />
                                <span>{r.phone}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 font-mono text-sm text-foreground/90">
                              <Clock size={14} className="shrink-0 text-muted-foreground" />
                              <span>
                                {fmtWhen(r.startedAt, now)} → {fmtWhen(r.endAt, now)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-1.5 font-mono text-[13px]" style={{ color: accent }}>
                            {status === "active"
                              ? `${fmtCountdown(remainingMinutes(r, now))} تا پایان`
                              : `${fmtCountdown(minutesUntilStart(r, now))} تا شروع`}
                          </div>

                          {reservationPrice(r) > 0 && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-sm font-bold text-amber-300">
                              <Wallet size={14} className="shrink-0" />
                              <span>مبلغ کل: {formatToman(reservationPrice(r))}</span>
                              <button
                                type="button"
                                onClick={() => setReservationPaid(seat.id, r.id, !r.paid)}
                                className={`flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs font-bold transition ${
                                  r.paid
                                    ? "border border-green-500/50 text-green-300 hover:bg-green-500/10"
                                    : "border border-rose-500/50 text-rose-300 hover:bg-rose-500/10"
                                }`}
                              >
                                <Check size={12} /> {r.paid ? "پرداخت شده" : "علامت‌گذاری به‌عنوان پرداخت‌شده"}
                              </button>
                            </div>
                          )}

                          {r.note && (
                            <div className="mt-2 flex items-start gap-2 border-t border-border/40 pt-2 font-mono text-sm text-muted-foreground">
                              <StickyNote size={14} className="mt-0.5 shrink-0" />
                              <span>{r.note}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
