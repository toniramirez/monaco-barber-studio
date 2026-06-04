export const MONACO_ORG = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

export type Tournament = {
  id: string;
  name: string;
  status: "upcoming" | "active" | "finished";
  predictions_lock_at: string | null;
  starts_at: string;
  ends_at: string;
  settings: Record<string, unknown>;
};

export type ProdeTeam = {
  id: string;
  name: string;
  short_name: string | null;
  code: string | null;
  group_label: string | null;
  flag_url: string | null;
};

export type ProdeQuestion = {
  id: string;
  kind: "champion" | "runner_up" | "top_scorer" | "surprise_team" | "team_stage" | "bonus";
  label: string;
  help_text: string | null;
  answer_type: "team" | "text" | "choice" | "number";
  options: string[] | null;
  points: number;
  sort_order: number;
  correct_answer: string | null;
};

export type ProdeMatch = {
  id: string;
  stage: string;
  group_label: string | null;
  kickoff_at: string;
  status: "scheduled" | "live" | "finished" | "cancelled";
  home_team_id: string | null;
  away_team_id: string | null;
  home_team_label: string | null;
  away_team_label: string | null;
  home_score: number | null;
  away_score: number | null;
  is_featured: boolean;
  venue: string | null;
};

/** Equipo "liviano" para la tarjeta del Partido del Día (lado local/visitante). */
export type ProdeTeamLite = {
  id: string;
  name: string;
  short_name: string | null;
  code: string | null;
  flag_url: string | null;
};

/**
 * El "Partido del Día": el partido destacado vigente o, si no hay, el próximo a
 * jugarse. Trae ambos equipos resueltos + la config de puntos del torneo para
 * que la UI muestre el premio sin otra consulta.
 */
export type MatchOfTheDay = {
  id: string;
  stage: string;
  group_label: string | null;
  kickoff_at: string;
  status: ProdeMatch["status"];
  is_featured: boolean;
  home: ProdeTeamLite | null;
  away: ProdeTeamLite | null;
  home_label: string | null;
  away_label: string | null;
  /** Puntos por acertar el resultado (1X2). */
  outcome_points: number;
  /** Bonus extra por clavar el marcador exacto. */
  exact_bonus: number;
  /** Multiplicador si es partido destacado. */
  featured_multiplier: number;
};

export type LeaderboardRow = {
  rank: number;
  participant_id: string;
  display_name: string;
  total_points: number;
  exact_hits: number;
};

export type ParticipantSummary = {
  participant_id: string;
  display_name: string;
  profile_completed: boolean;
  total_points: number;
  quiniela: { question_id: string; answer: string; points: number | null }[];
  matches: { match_id: string; outcome: string; home: number | null; away: number | null; points: number | null }[];
};

/** Un premio del jugador (welcome / semanal / gran premio) listo para canjear en el local. */
export type ProdeReward = {
  client_reward_id: string;
  name: string;
  description: string | null;
  discount_pct: number | null;
  is_free_service: boolean;
  status: "available" | "redeemed" | "expired";
  /** Código de 32 hex que el barbero escanea/ingresa para canjear (redeem_reward_by_qr). */
  qr_code: string;
  expires_at: string | null;
  created_at: string;
};

/** Datos para la placa compartible (OG image) de un jugador. */
export type ShareData = {
  participant_id: string;
  display_name: string;
  total_points: number;
  /** A quién le apostó como campeón (si ya lo eligió en la Quiniela). */
  champion: ProdeTeamLite | null;
};
