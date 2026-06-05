/**
 * Helpers de marcador 1X2 compartidos por el predictor de partidos (MatchDeck).
 */
export type MatchOutcome = "home" | "draw" | "away";

/** Resultado 1X2 derivado del marcador. */
export function outcomeFromScore(home: number, away: number): MatchOutcome {
  return home > away ? "home" : home < away ? "away" : "draw";
}
