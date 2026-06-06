import { createAdminClient } from "@/lib/supabase/admin";
import {
  type ChallengeDef,
  type ChallengeState,
  type ChallengeStateKind,
  type ChallengeMatch,
  type ProdeTeamLite,
  type ParticipantSummary,
} from "./types";

/**
 * "El Camino al Título" — los Desafíos del Prode.
 *
 * Un Desafío es una misión del sendero: o predecís todos los partidos de una
 * etapa (kind="matches", derivado de prode_matches por stage+matchday) o armás
 * la Gran Quiniela (kind="quiniela", las 6 preguntas grandes).
 *
 * NO hay tablas nuevas: el estado se deriva cruzando prode_matches/preguntas
 * con los picks del jugador (ParticipantSummary). Las recompensas son display
 * por ahora (la premiación por-desafío es follow-up de backend).
 *
 * Orden del array = orden del sendero de ABAJO (Desafío 1) hacia ARRIBA (Final).
 * El render del sendero lo invierte (sube hacia la copa).
 */
export const CHALLENGES: ChallengeDef[] = [
  {
    key: "group-1",
    slug: "d1",
    kind: "matches",
    stage: "group",
    matchday: 1,
    title: "Desafío 1",
    short: "D1",
    subtitle: "Fecha 1 · Fase de grupos",
    reward: { label: "1 mes de cortes gratis", tier: "month" },
  },
  {
    key: "group-2",
    slug: "d2",
    kind: "matches",
    stage: "group",
    matchday: 2,
    title: "Desafío 2",
    short: "D2",
    subtitle: "Fecha 2 · Fase de grupos",
    reward: { label: "1 mes de cortes gratis", tier: "month" },
  },
  {
    key: "group-3",
    slug: "d3",
    kind: "matches",
    stage: "group",
    matchday: 3,
    title: "Desafío 3",
    short: "D3",
    subtitle: "Fecha 3 · Cierre de grupos",
    reward: { label: "1 mes de cortes gratis", tier: "month" },
  },
  {
    key: "quiniela",
    slug: "gran-prode",
    kind: "quiniela",
    title: "El Gran Prode",
    short: "GP",
    subtitle: "Campeón, goleador y más",
    reward: { label: "Define el Gran Premio", tier: "special" },
    special: true,
  },
  {
    key: "round_of_32",
    slug: "16vos",
    kind: "matches",
    stage: "round_of_32",
    matchday: null,
    title: "16vos de final",
    short: "16",
    subtitle: "Mata o muere",
    reward: { label: "1 mes + camiseta", tier: "jersey" },
  },
  {
    key: "round_of_16",
    slug: "8vos",
    kind: "matches",
    stage: "round_of_16",
    matchday: null,
    title: "8vos de final",
    short: "8",
    subtitle: "Los mejores 16",
    reward: { label: "1 mes + camiseta", tier: "jersey" },
  },
  {
    key: "quarter_final",
    slug: "4tos",
    kind: "matches",
    stage: "quarter_final",
    matchday: null,
    title: "Cuartos de final",
    short: "4",
    subtitle: "Octava parte",
    reward: { label: "Ruleta por puntos", tier: "roulette" },
  },
  {
    key: "semi_final",
    slug: "semis",
    kind: "matches",
    stage: "semi_final",
    matchday: null,
    title: "Semifinales",
    short: "SF",
    subtitle: "A un paso de la gloria",
    reward: { label: "Ruleta por puntos", tier: "roulette" },
  },
  {
    key: "third_place",
    slug: "3er",
    kind: "matches",
    stage: "third_place",
    matchday: null,
    title: "Tercer puesto",
    short: "3°",
    subtitle: "El bronce",
    reward: { label: "Ruleta por puntos", tier: "roulette" },
  },
  {
    key: "final",
    slug: "final",
    kind: "matches",
    stage: "final",
    matchday: null,
    title: "La Final",
    short: "Final",
    subtitle: "El partido del título",
    reward: { label: "Ruleta por puntos", tier: "roulette" },
  },
];

export function getChallengeBySlug(slug: string): ChallengeDef | null {
  return CHALLENGES.find((c) => c.slug === slug) ?? null;
}

type MatchRow = {
  id: string;
  stage: string;
  matchday: number | null;
  status: string;
  kickoff_at: string;
  home_team_id: string | null;
  away_team_id: string | null;
};

/** ¿El partido tiene ambos equipos definidos? (las eliminatorias arrancan sin equipos). */
const hasTeams = (m: MatchRow) => !!m.home_team_id && !!m.away_team_id;

/**
 * Estado del nodo. `openUnplayed` = partidos que TODAVÍA podés jugar y no jugaste.
 * Un desafío está "completado" cuando jugaste algo y no queda ninguno abierto sin
 * jugar (los partidos que ya arrancaron sin pick no bloquean: te los perdiste).
 */
function deriveState(total: number, done: number, openUnplayed: number): ChallengeStateKind {
  if (total === 0) return "locked";
  if (done > 0 && openUnplayed === 0) return "completed";
  if (done > 0) return "in_progress";
  return "open";
}

/**
 * Estado de TODOS los desafíos para el jugador. Una sola query a prode_matches
 * (104 filas, barata) + cruce con los picks del summary. SSR-safe, sin random.
 */
export async function getChallengesState(
  tournamentId: string,
  summary: ParticipantSummary | null,
): Promise<ChallengeState[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("prode_matches")
    .select("id,stage,matchday,status,kickoff_at,home_team_id,away_team_id")
    .eq("tournament_id", tournamentId);
  const matches = (data as MatchRow[] | null) ?? [];
  const now = Date.now();

  // ¿El partido sigue abierto para jugar? (programado y aún no arrancó).
  const isOpen = (m: MatchRow) => m.status === "scheduled" && new Date(m.kickoff_at).getTime() > now;

  // Set de match_id que el jugador ya jugó (tiene pick guardado).
  const pickedMatchIds = new Set((summary?.matches ?? []).map((m) => m.match_id));
  // Cantidad de preguntas de la Gran Quiniela respondidas (6 preguntas fijas).
  const quinielaDone = summary?.quiniela?.length ?? 0;

  return CHALLENGES.map((def) => {
    if (def.kind === "quiniela") {
      const total = 6;
      const done = Math.min(quinielaDone, total);
      return { ...def, total, done, state: deriveState(total, done, total - done) };
    }
    const playable = matches.filter(
      (m) =>
        m.stage === def.stage &&
        (def.matchday == null || m.matchday === def.matchday) &&
        hasTeams(m),
    );
    const total = playable.length;
    const done = playable.filter((m) => pickedMatchIds.has(m.id)).length;
    const openUnplayed = playable.filter((m) => !pickedMatchIds.has(m.id) && isOpen(m)).length;
    return { ...def, total, done, state: deriveState(total, done, openUnplayed) };
  });
}

/**
 * Partidos de un desafío (kind="matches") para el play, con la jugada previa del
 * jugador ya mergeada. Devuelve [] si el desafío no tiene partidos con equipos.
 */
export async function getChallengeMatches(
  tournamentId: string,
  challenge: ChallengeDef,
  summary: ParticipantSummary | null,
): Promise<ChallengeMatch[]> {
  if (challenge.kind !== "matches" || !challenge.stage) return [];
  const admin = createAdminClient();

  let q = admin
    .from("prode_matches")
    .select(
      "id,stage,group_label,matchday,kickoff_at,status,home_team_id,away_team_id,home_team_label,away_team_label,is_featured",
    )
    .eq("tournament_id", tournamentId)
    .eq("stage", challenge.stage);
  if (challenge.matchday != null) q = q.eq("matchday", challenge.matchday);

  const { data } = await q.order("kickoff_at", { ascending: true });
  type Row = {
    id: string;
    stage: string;
    group_label: string | null;
    matchday: number | null;
    kickoff_at: string;
    status: ChallengeMatch["status"];
    home_team_id: string | null;
    away_team_id: string | null;
    home_team_label: string | null;
    away_team_label: string | null;
    is_featured: boolean;
  };
  const rows = ((data as Row[] | null) ?? []).filter((r) => r.home_team_id && r.away_team_id);
  if (rows.length === 0) return [];

  // Resolver equipos (bandera/código) en un solo fetch.
  const ids = Array.from(
    new Set(rows.flatMap((r) => [r.home_team_id, r.away_team_id]).filter(Boolean) as string[]),
  );
  const teamById = new Map<string, ProdeTeamLite>();
  if (ids.length > 0) {
    const { data: teams } = await admin
      .from("prode_teams")
      .select("id,name,short_name,code,flag_url")
      .in("id", ids);
    (teams as ProdeTeamLite[] | null)?.forEach((t) => teamById.set(t.id, t));
  }

  // Picks previos del jugador, por match_id.
  const pickByMatch = new Map<string, { outcome: string; home: number | null; away: number | null }>();
  (summary?.matches ?? []).forEach((m) =>
    pickByMatch.set(m.match_id, { outcome: m.outcome, home: m.home, away: m.away }),
  );

  return rows.map((r) => ({
    id: r.id,
    stage: r.stage,
    group_label: r.group_label,
    matchday: r.matchday,
    kickoff_at: r.kickoff_at,
    status: r.status,
    is_featured: r.is_featured,
    home: r.home_team_id ? teamById.get(r.home_team_id) ?? null : null,
    away: r.away_team_id ? teamById.get(r.away_team_id) ?? null : null,
    home_label: r.home_team_label,
    away_label: r.away_team_label,
    myPick: pickByMatch.get(r.id) ?? null,
  }));
}
