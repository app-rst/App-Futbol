import { TZDate } from "@date-fns/tz";

/** Zona horaria en la que se muestran y cargan todas las fechas (se guardan en UTC). */
export const APP_TIME_ZONE = "America/Argentina/Buenos_Aires";

const DAY_MS = 24 * 3600 * 1000;

const dateFmt = new Intl.DateTimeFormat("es-AR", { timeZone: APP_TIME_ZONE, dateStyle: "medium" });
const weekdayFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toDate(value: string | Date): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** "16 oct 2026" en hora de Argentina. */
export function formatDate(value: string | Date): string {
  return dateFmt.format(toDate(value));
}

/** "21:00" en hora de Argentina. */
export function formatTime(value: string | Date): string {
  return timeFmt.format(toDate(value));
}

/** "Sáb 18 oct" en hora de Argentina. */
export function formatDay(value: string | Date): string {
  const s = weekdayFmt.format(toDate(value)).replace(",", "").replace(/\.$/, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Sáb 18 oct · 21:00 a 22:00" */
export function formatMatchWhen(startsAt: string | Date, endsAt: string | Date): string {
  return `${formatDay(startsAt)} · ${formatTime(startsAt)} a ${formatTime(endsAt)}`;
}

/** "Sáb 18 oct, 19:00" */
export function formatDateTime(value: string | Date): string {
  return `${formatDay(value)}, ${formatTime(value)}`;
}

/** Fecha ("YYYY-MM-DD") + hora ("HH:mm") en hora de Argentina → instante UTC. */
export function localToUtc(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [y, mo, da] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [h, mi] = [Number(t[1]), Number(t[2])];
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59) return null;
  const result = new TZDate(y, mo - 1, da, h, mi, 0, APP_TIME_ZONE);
  // Rechaza fechas inexistentes como el 31/02 (Date las "corre" al mes siguiente).
  if (result.getDate() !== da || result.getMonth() !== mo - 1) return null;
  return new Date(result.getTime());
}

/** Instante → { date: "YYYY-MM-DD", time: "HH:mm" } en hora de Argentina (para precargar formularios). */
export function utcToLocalParts(value: string | Date): { date: string; time: string } {
  const z = new TZDate(toDate(value).getTime(), APP_TIME_ZONE);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`,
    time: `${pad(z.getHours())}:${pad(z.getMinutes())}`,
  };
}

/**
 * Inicio y fin del partido a partir del formulario. Si la hora de fin es menor
 * o igual a la de inicio, el partido termina al día siguiente (ej. 23:00 a 00:30).
 */
export function matchTimesFromForm(date: string, startTime: string, endTime: string) {
  const startsAt = localToUtc(date, startTime);
  let endsAt = localToUtc(date, endTime);
  if (!startsAt || !endsAt) return null;
  const nextDay = endsAt.getTime() <= startsAt.getTime();
  if (nextDay) endsAt = new Date(endsAt.getTime() + DAY_MS);
  return { startsAt, endsAt, nextDay };
}

/** Suma minutos a una fecha/hora local y devuelve las partes locales. */
export function shiftLocal(date: string, time: string, minutes: number) {
  const base = localToUtc(date, time);
  if (!base) return null;
  return utcToLocalParts(new Date(base.getTime() + minutes * 60_000));
}

/** ¿El instante ya pasó? (relativo a `now`, por defecto el momento del request). */
export function isPast(value: string | Date, now: Date = new Date()): boolean {
  return toDate(value).getTime() <= now.getTime();
}

export type MatchPhase ="cancelled" | "upcoming" | "playing" | "voting" | "closed";

/**
 * Estado del partido derivado del reloj:
 * próximo → en juego (inicio-fin) → votación MVP (24 h desde el fin) → cerrado.
 */
export function matchPhase(
  m: { status: string; starts_at: string; ends_at: string },
  now: Date = new Date(),
): MatchPhase {
  if (m.status === "cancelled") return "cancelled";
  const t = now.getTime();
  if (t < new Date(m.starts_at).getTime()) return "upcoming";
  const end = new Date(m.ends_at).getTime();
  if (t < end) return "playing";
  if (t < end + DAY_MS) return "voting";
  return "closed";
}

export const PHASE_LABEL: Record<MatchPhase, string> = {
  cancelled: "Cancelado",
  upcoming: "Próximo",
  playing: "En juego",
  voting: "Votación MVP",
  closed: "Finalizado",
};
