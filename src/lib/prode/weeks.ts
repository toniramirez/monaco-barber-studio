/**
 * Ventana de la semana (lunes a domingo) que contiene `now`, calculada en hora
 * de Argentina. Coincide con el criterio del premio semanal en la DB
 * (prode_weekly_leaderboard compara el kickoff del partido AT TIME ZONE ARG).
 * Devuelve fechas YYYY-MM-DD.
 */
export function argWeekWindow(now: Date = new Date()): { start: string; end: string } {
  const argToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "2026-06-03"
  const base = new Date(`${argToday}T00:00:00Z`);
  const isoDow = ((base.getUTCDay() + 6) % 7) + 1; // 1=Lun … 7=Dom
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() - (isoDow - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(monday), end: iso(sunday) };
}
