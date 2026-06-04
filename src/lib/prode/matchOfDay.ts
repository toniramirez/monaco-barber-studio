/**
 * Contrato compartido entre <PartidoDelDia/> y <ProdeClient/> para el traspaso
 * de la "jugada del Partido del Día" cuando el visitante la dial­a ANTES de
 * registrarse. Single-source: si se renombra, ambos lados rompen en compilación.
 */
export const PENDING_MATCH_KEY = "prode_pending_match";
export const MATCH_CONFIRMED_EVENT = "prode:match-confirmed";

export type PendingMatch = { matchId: string; home: number; away: number };
export type MatchOutcome = "home" | "draw" | "away";

/** Resultado 1X2 derivado del marcador. */
export function outcomeFromScore(home: number, away: number): MatchOutcome {
  return home > away ? "home" : home < away ? "away" : "draw";
}
