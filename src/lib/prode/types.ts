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

/** Equipo "liviano" (lado local/visitante de una card de partido). */
export type ProdeTeamLite = {
  id: string;
  name: string;
  short_name: string | null;
  code: string | null;
  flag_url: string | null;
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

// ───────────────────────── Desafíos ("Camino al Título") ─────────────────────────

/** Tipo de mecánica del desafío: predecir partidos o la Gran Quiniela (preguntas). */
export type ChallengeKind = "matches" | "quiniela";

/** Familia de recompensa del desafío (para el ícono/acento, display-only por ahora). */
export type ChallengeRewardTier = "month" | "jersey" | "roulette" | "special";

/** Estado derivado de un desafío para el jugador actual. */
export type ChallengeStateKind =
  | "locked" // eliminatorias sin equipos todavía / "Próximamente"
  | "open" // jugable, sin empezar (0 jugados)
  | "in_progress" // jugable, parcial
  | "completed"; // todos jugados

/** Definición estática de un desafío (config en challenges.ts). */
export type ChallengeDef = {
  key: string;
  /** Slug de URL: /mundial/jugar/[slug]. */
  slug: string;
  kind: ChallengeKind;
  /** Para kind="matches": etapa + (grupos) número de fecha. */
  stage?: ProdeMatch["stage"];
  matchday?: number | null;
  title: string;
  short: string;
  subtitle: string;
  emoji: string;
  reward: { label: string; tier: ChallengeRewardTier };
  /** El nodo especial "cofre" (Gran Quiniela) se dibuja al costado del sendero. */
  special?: boolean;
};

/** Desafío con su estado calculado server-side para el jugador. */
export type ChallengeState = ChallengeDef & {
  /** Cantidad de unidades jugables (partidos con equipos / preguntas). */
  total: number;
  /** Cuántas ya jugó el participante. */
  done: number;
  state: ChallengeStateKind;
};

/** Un partido dentro del play de un desafío, con la jugada previa del jugador. */
export type ChallengeMatch = {
  id: string;
  stage: string;
  group_label: string | null;
  matchday: number | null;
  kickoff_at: string;
  status: ProdeMatch["status"];
  is_featured: boolean;
  home: ProdeTeamLite | null;
  away: ProdeTeamLite | null;
  home_label: string | null;
  away_label: string | null;
  /** Jugada previa del participante (si ya jugó este partido). */
  myPick: { outcome: string; home: number | null; away: number | null } | null;
};

/** Datos para la placa compartible (OG image) de un jugador. */
export type ShareData = {
  participant_id: string;
  display_name: string;
  total_points: number;
  /** A quién le apostó como campeón (si ya lo eligió en la Quiniela). */
  champion: ProdeTeamLite | null;
};
