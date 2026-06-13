import type { ProdeReward } from "./types";

/**
 * Lógica de tiempo del cupón (cooldown de activación + ventana de días) compartida
 * por la pantalla de Premios y la de Mi cuenta. Espeja EXACTO la semántica de la
 * RPC `redeem_coupon_for_visit` (mig coupon_time_rules) y de `validateCouponForCheckout`
 * del panel de barberos: la autoridad del canje es el backend; esto es sólo para
 * COMUNICARLE al cliente cuándo y cómo puede usarlo (que no se cree la cuenta mientras
 * se corta y se lleve la sorpresa al escanear).
 *
 * Funciones puras (sin React) → importables desde server components y client components.
 */

/** TZ canónica del negocio. El día de canje se evalúa en la TZ de la sucursal al
 *  cobrar; acá usamos la del negocio para mostrar "hoy sí / hoy no" de forma estable. */
export const COUPON_TZ = "America/Argentina/Buenos_Aires";

/** Día de la semana ISO (1=lunes .. 7=domingo) para un instante (ms) en una TZ. */
export function isoWeekdayInTz(ms: number, tz: string = COUPON_TZ): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(ms));
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[short] ?? 0;
}

const DIAS_CORTO = ["", "lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const DIAS_LARGO = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

// null/undefined = sin restricción (cualquier día). Un array — INCLUSO vacío `[]` —
// = restricción activa: espeja la semántica `redeemable_weekdays IS NOT NULL` del
// backend (redeem_coupon_for_visit + validateCouponForCheckout), donde un `{}` bloquea
// TODOS los días. Por eso distinguimos null de [] y NO los colapsamos.
function normWeekdays(days: number[] | null | undefined): number[] | null {
  if (days == null) return null;
  return [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
}

/** Versión corta para chips: [1,2,3] → "lun a mié". null → "cualquier día"; [] → "ningún día". */
export function weekdayPhraseShort(days: number[] | null | undefined): string {
  const s = normWeekdays(days);
  if (s === null) return "cualquier día";
  if (s.length === 0) return "ningún día";
  if (s.length === 1) return DIAS_CORTO[s[0]];
  const contiguo = s.every((d, i) => i === 0 || d === s[i - 1] + 1);
  if (contiguo) return `${DIAS_CORTO[s[0]]} a ${DIAS_CORTO[s[s.length - 1]]}`;
  return s.map((d) => DIAS_CORTO[d]).join(", ");
}

/** Versión larga para frases: [1,2,3] → "de lunes a miércoles". null → "cualquier día"; [] → "ningún día". */
export function weekdayPhraseLong(days: number[] | null | undefined): string {
  const s = normWeekdays(days);
  if (s === null) return "cualquier día";
  if (s.length === 0) return "ningún día";
  if (s.length === 1) return `los ${DIAS_LARGO[s[0]]}`;
  const contiguo = s.every((d, i) => i === 0 || d === s[i - 1] + 1);
  if (contiguo) return `de ${DIAS_LARGO[s[0]]} a ${DIAS_LARGO[s[s.length - 1]]}`;
  return s.slice(0, -1).map((d) => DIAS_LARGO[d]).join(", ") + " y " + DIAS_LARGO[s[s.length - 1]];
}

/** Duración corta y amable: "1h 47m" / "47m" / "ya casi". */
export function formatShortDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  if (m >= 1) return `${m}m`;
  return "ya casi";
}

/** Fecha corta es-AR: "27/06/2026". Tolerante a iso null/inválido. */
export function fmtDateAR(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
}

/** Vista mínima de un premio para razonar su estado temporal. */
export type CouponView = {
  status: "available" | "redeemed" | "expired";
  createdAt: string;
  expiresAt: string | null;
  /** createdAt + delay (ISO) o null si no hay activación diferida. */
  activatesAt: string | null;
  redeemableWeekdays: number[] | null;
};

export type CouponPhase =
  | "cooldown" // disponible pero todavía en la ventana de activación (no canjeable aún)
  | "active_today" // canjeable ahora (es un día permitido)
  | "active_off_day" // activo pero hoy no es un día permitido
  | "expired"
  | "redeemed";

/** Construye la vista temporal desde un ProdeReward (resuelve activatesAt). */
export function couponViewFromReward(r: ProdeReward): CouponView {
  const delay = r.activation_delay_minutes ?? 0;
  const createdMs = new Date(r.created_at).getTime();
  return {
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    activatesAt: delay > 0 && Number.isFinite(createdMs) ? new Date(createdMs + delay * 60_000).toISOString() : null,
    redeemableWeekdays: r.redeemable_weekdays ?? null,
  };
}

/** Fase del cupón en un instante (ms). `nowMs` debe venir del reloj del cliente. */
export function couponPhase(v: CouponView, nowMs: number): CouponPhase {
  if (v.status === "redeemed") return "redeemed";
  if (v.status === "expired") return "expired";
  // `<` para espejar EXACTO la RPC (expires_at < now()) y el panel: en el ms exacto del
  // borde el backend aún acepta, así que la UI no debe decir "vencido" antes de tiempo.
  if (v.expiresAt && new Date(v.expiresAt).getTime() < nowMs) return "expired";
  if (v.activatesAt && new Date(v.activatesAt).getTime() > nowMs) return "cooldown";
  // Array no-null (incluso []) = restricción activa (mirror de `IS NOT NULL` del backend):
  // con [] nunca matchea → active_off_day, igual que el backend lo bloquearía.
  if (v.redeemableWeekdays !== null) {
    return v.redeemableWeekdays.includes(isoWeekdayInTz(nowMs)) ? "active_today" : "active_off_day";
  }
  return "active_today";
}
