// Seat/console reservation manager — local-only (localStorage).
// Seats: 12 PCs (VIP01..VIP12), 4 PS4 (PS4-1..PS4-4), 1 PS5, 1 Room.
//
// v2: each seat can hold a *queue* of reservations (not just one), each with
// its own explicit start + end time and an optional customer phone number.
// A reservation's status is derived from the clock: "upcoming" (hasn't
// started yet) → "active" (in progress) → "done" (past its end time).

export type SeatKind = "pc" | "ps4" | "ps5" | "room";

export interface Seat {
  id: string; // "VIP01", "PS4-1", "PS5", "ROOM"
  kind: SeatKind;
  label: string;
}

export interface Reservation {
  id: string; // unique id, stable across edits
  seatId: string;
  customer: string;
  phone?: string; // customer phone number (optional)
  startedAt: number; // epoch ms — scheduled start
  endAt: number; // epoch ms — scheduled end
  hourlyRateToman?: number; // price per hour, in Toman (e.g. 60000) — optional
  paid: boolean; // has the customer paid for this booking yet?
  note?: string;
  createdAt: number; // epoch ms — when the booking was made
}

export type ReservationStatus = "upcoming" | "active" | "done";

const KEY = "exir.reservations.v2";
const LEGACY_KEY = "exir.reservations.v1";
const DEFAULT_RATE_KEY = "exir.reservations.defaultRateThousandToman";

/** The hourly-rate field remembers the last value typed (in هزار تومان
 * units — e.g. 60 means 60,000 T/hour) and reuses it as the starting value
 * for every new reservation, on any seat, for every client. Defaults to 60
 * until someone changes it for the first time. */
export function getDefaultHourlyRateThousand(): number {
  try {
    const raw = localStorage.getItem(DEFAULT_RATE_KEY);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch {
    /* ignore */
  }
  return 60;
}

export function setDefaultHourlyRateThousand(value: number) {
  try {
    localStorage.setItem(DEFAULT_RATE_KEY, String(value));
  } catch {
    /* ignore */
  }
}

export function defaultSeats(): Seat[] {
  const pcs: Seat[] = Array.from({ length: 12 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return { id: `VIP${n}`, kind: "pc", label: `VIP${n}` };
  });
  const ps4: Seat[] = Array.from({ length: 4 }, (_, i) => ({
    id: `PS4-${i + 1}`, kind: "ps4", label: `PS4 #${i + 1}`,
  }));
  return [
    ...pcs,
    ...ps4,
    { id: "PS5", kind: "ps5", label: "PS5" },
    { id: "ROOM", kind: "room", label: "Private Room" },
  ];
}

function genId(seatId: string): string {
  return `${seatId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// One-time migration from the old "1 reservation per seat, duration-based"
// shape into the new queue-based shape, so nobody loses in-progress bookings
// when this update ships.
function migrateLegacyIfNeeded(): Record<string, Reservation[]> | null {
  try {
    if (localStorage.getItem(KEY)) return null; // already on v2
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const old = JSON.parse(raw) as Record<
      string,
      { seatId: string; customer: string; startedAt: number; minutes: number; note?: string }
    >;
    const migrated: Record<string, Reservation[]> = {};
    for (const [seatId, r] of Object.entries(old)) {
      migrated[seatId] = [
        {
          id: genId(seatId),
          seatId,
          customer: r.customer,
          startedAt: r.startedAt,
          endAt: r.startedAt + r.minutes * 60_000,
          paid: false,
          note: r.note,
          createdAt: r.startedAt,
        },
      ];
    }
    return migrated;
  } catch {
    return null;
  }
}

export function loadAll(): Record<string, Reservation[]> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const migrated = migrateLegacyIfNeeded();
  if (migrated) {
    saveAll(migrated);
    return migrated;
  }
  return {};
}

export function saveAll(all: Record<string, Reservation[]>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore quota errors */
  }
  window.dispatchEvent(new Event("exir:reservations"));
}

export function listSeatReservations(seatId: string): Reservation[] {
  const all = loadAll();
  return (all[seatId] || []).slice().sort((a, b) => a.startedAt - b.startedAt);
}

/** Every reservation across every seat that hasn't ended yet, soonest first. */
export function listUpcomingAndActive(): Reservation[] {
  const all = loadAll();
  const now = Date.now();
  const out: Reservation[] = [];
  for (const list of Object.values(all)) {
    for (const r of list) if (r.endAt > now) out.push(r);
  }
  return out.sort((a, b) => a.startedAt - b.startedAt);
}

export function reservationStatus(r: Reservation, now = Date.now()): ReservationStatus {
  if (now >= r.endAt) return "done";
  if (now < r.startedAt) return "upcoming";
  return "active";
}

export function currentReservation(seatId: string, now = Date.now()): Reservation | null {
  return listSeatReservations(seatId).find((r) => reservationStatus(r, now) === "active") ?? null;
}

export function nextReservation(seatId: string, now = Date.now()): Reservation | null {
  return listSeatReservations(seatId).find((r) => reservationStatus(r, now) === "upcoming") ?? null;
}

export function remainingMinutes(r: Reservation, now = Date.now()): number {
  return Math.max(0, (r.endAt - now) / 60_000);
}

export function minutesUntilStart(r: Reservation, now = Date.now()): number {
  return Math.max(0, (r.startedAt - now) / 60_000);
}

export function hasConflict(seatId: string, startedAt: number, endAt: number, excludeId?: string): boolean {
  return listSeatReservations(seatId).some(
    (r) => r.id !== excludeId && startedAt < r.endAt && endAt > r.startedAt,
  );
}

export interface AddReservationInput {
  seatId: string;
  customer: string;
  phone?: string;
  startedAt: number;
  endAt: number;
  hourlyRateToman?: number;
  paid?: boolean;
  note?: string;
}

/** Total price for a reservation, computed from its hourly rate × duration.
 * Returns 0 when no rate was set. Rounded to the nearest Toman. */
export function reservationPrice(r: Reservation): number {
  if (!r.hourlyRateToman) return 0;
  const hours = (r.endAt - r.startedAt) / (60 * 60_000);
  return Math.round(r.hourlyRateToman * hours);
}

export type AddReservationResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; error: string };

export function addReservation(input: AddReservationInput): AddReservationResult {
  const { seatId, startedAt, endAt } = input;
  const customer = input.customer.trim();
  if (!customer) return { ok: false, error: "نام مشتری الزامیه." };
  if (!Number.isFinite(startedAt) || !Number.isFinite(endAt)) {
    return { ok: false, error: "تاریخ/ساعت انتخابی نامعتبره." };
  }
  if (endAt <= startedAt) return { ok: false, error: "زمان پایان باید بعد از زمان شروع باشه." };
  if (endAt - startedAt < 5 * 60_000) return { ok: false, error: "حداقل مدت رزرو ۵ دقیقه‌ست." };
  if (endAt - startedAt > 12 * 60 * 60_000) return { ok: false, error: "حداکثر مدت رزرو ۱۲ ساعته." };
  if (hasConflict(seatId, startedAt, endAt)) {
    return { ok: false, error: "این بازه زمانی با یه رزرو دیگه روی همین صندلی تداخل داره." };
  }
  const reservation: Reservation = {
    id: genId(seatId),
    seatId,
    customer,
    phone: input.phone?.trim() || undefined,
    startedAt,
    endAt,
    hourlyRateToman:
      input.hourlyRateToman && input.hourlyRateToman > 0 ? Math.round(input.hourlyRateToman) : undefined,
    paid: input.paid ?? false,
    note: input.note?.trim() || undefined,
    createdAt: Date.now(),
  };
  const all = loadAll();
  all[seatId] = [...(all[seatId] || []), reservation];
  saveAll(all);
  return { ok: true, reservation };
}

export function releaseReservation(seatId: string, id: string) {
  const all = loadAll();
  const list = (all[seatId] || []).filter((r) => r.id !== id);
  if (list.length) all[seatId] = list;
  else delete all[seatId];
  saveAll(all);
}

/** Releases whichever reservation is currently active on a seat, if any. */
export function releaseActive(seatId: string) {
  const active = currentReservation(seatId);
  if (active) releaseReservation(seatId, active.id);
}

export function extendReservation(seatId: string, id: string, extraMinutes: number) {
  const all = loadAll();
  const list = all[seatId] || [];
  const r = list.find((x) => x.id === id);
  if (!r) return;
  r.endAt += extraMinutes * 60_000;
  saveAll(all);
}

/** Marks (or unmarks) a reservation as paid — used for the paid/unpaid
 * toggle so staff don't have to delete and recreate a booking just to
 * flip its payment status. */
export function setReservationPaid(seatId: string, id: string, paid: boolean) {
  const all = loadAll();
  const list = all[seatId] || [];
  const r = list.find((x) => x.id === id);
  if (!r) return;
  r.paid = paid;
  saveAll(all);
}

/** Seat ids that currently have a reservation (active or upcoming) —
 * used to highlight a client card as "reserved" even while offline. */
export function reservedSeatIds(now = Date.now()): Set<string> {
  const all = loadAll();
  const ids = new Set<string>();
  for (const [seatId, list] of Object.entries(all)) {
    if (list.some((r) => r.endAt > now)) ids.add(seatId);
  }
  return ids;
}

/** Housekeeping: drop reservations that ended a while ago so localStorage
 * doesn't grow forever. Safe to call often; it's a no-op most of the time. */
export function purgeOldReservations(olderThanMs = 24 * 60 * 60 * 1000) {
  const all = loadAll();
  const now = Date.now();
  let changed = false;
  for (const seatId of Object.keys(all)) {
    const kept = all[seatId].filter((r) => now - r.endAt < olderThanMs);
    if (kept.length !== all[seatId].length) changed = true;
    if (kept.length) all[seatId] = kept;
    else delete all[seatId];
  }
  if (changed) saveAll(all);
}
