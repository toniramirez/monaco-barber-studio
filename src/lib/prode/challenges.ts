import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type ChallengeDef,
  type ChallengeState,
  type ChallengeStateKind,
  type ChallengeMatch,
  type ProdeTeamLite,
  type ParticipantSummary,
  type GroupChallengeTimeline,
  type ChallengePhase,
  type ProdeNextEvent,
  type Tournament,
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
 * Orden del array = orden del torneo (Desafío 1 → Final) = orden visual del
 * sendero de ARRIBA (La Largada + Desafío 1) hacia ABAJO (La Final → Gran
 * Premio). El render NO invierte: dibuja el array tal cual, de arriba hacia abajo.
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

/** ¿El partido sigue abierto para jugar? (programado y aún no arrancó). */
const isOpenMatch = (m: MatchRow, now: number) =>
  m.status === "scheduled" && new Date(m.kickoff_at).getTime() > now;

/**
 * Estado de TODOS los desafíos para el jugador. Una sola query a prode_matches
 * (104 filas, barata) + cruce con los picks del summary. SSR-safe, sin random.
 *
 * Apertura POR TIEMPO (no por completar el anterior): cada Desafío de grupos se
 * abre cuando CIERRA el anterior (= último kickoff de su matchday). Así el camino
 * sigue el calendario real del Mundial:
 *  - D1 (fecha 1, ya jugada) → "finished" (su ganador ya está).
 *  - D2 (fecha 2, en curso)  → "open"/"in_progress" (jugable ahora).
 *  - D3 (fecha 3, futura)    → "locked" con `opensAt` para el countdown.
 * Las eliminatorias quedan "locked" hasta que el sorteo carga sus equipos.
 * La Gran Quiniela (special) es el "cofre" siempre disponible (lo gatea aparte el
 * `quinielaLocked` global). Los partidos se cierran uno por uno en su kickoff
 * (lo valida `prode_submit_match_prediction`); acá sólo derivamos el estado visual.
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

  // Último kickoff por matchday de grupos → cuándo se ABRE el desafío siguiente.
  const groupLastKickoff = new Map<number, number>();
  for (const m of matches) {
    if (m.stage !== "group" || m.matchday == null) continue;
    const t = new Date(m.kickoff_at).getTime();
    groupLastKickoff.set(m.matchday, Math.max(groupLastKickoff.get(m.matchday) ?? 0, t));
  }

  // Set de match_id que el jugador ya jugó (tiene pick guardado).
  const pickedMatchIds = new Set((summary?.matches ?? []).map((m) => m.match_id));
  // Cantidad de preguntas de la Gran Quiniela respondidas (6 preguntas fijas).
  const quinielaDone = summary?.quiniela?.length ?? 0;

  const states: ChallengeState[] = CHALLENGES.map((def) => {
    if (def.kind === "quiniela") {
      const total = 6;
      const done = Math.min(quinielaDone, total);
      const state: ChallengeStateKind =
        done >= total ? "completed" : done > 0 ? "in_progress" : "open";
      return { ...def, total, done, state, opensAt: null, endsAt: null };
    }

    const playable = matches.filter(
      (m) =>
        m.stage === def.stage &&
        (def.matchday == null || m.matchday === def.matchday) &&
        hasTeams(m),
    );
    const total = playable.length;
    // Eliminatorias sin equipos todavía → "Próximamente".
    if (total === 0) {
      return { ...def, total: 0, done: 0, state: "locked", opensAt: null, endsAt: null };
    }

    const done = playable.filter((m) => pickedMatchIds.has(m.id)).length;
    const openUnplayed = playable.filter(
      (m) => !pickedMatchIds.has(m.id) && isOpenMatch(m, now),
    ).length;
    const lastKickoff = Math.max(...playable.map((m) => new Date(m.kickoff_at).getTime()));
    const windowClosed = lastKickoff <= now;
    const endsAt = new Date(lastKickoff).toISOString();

    // opensAt: sólo para Desafíos de GRUPOS de la fecha 2+ (se abren al cerrar la
    // fecha anterior). D1 y eliminatorias no tienen apertura diferida por tiempo.
    let opensAt: string | null = null;
    if (def.stage === "group" && def.matchday != null && def.matchday >= 2) {
      const prev = groupLastKickoff.get(def.matchday - 1);
      if (prev != null) opensAt = new Date(prev).toISOString();
    }

    let state: ChallengeStateKind;
    if (opensAt && now < new Date(opensAt).getTime()) {
      state = "locked"; // todavía no se abre (la fecha anterior sigue en juego) → countdown
    } else if (windowClosed) {
      state = "finished"; // todos sus partidos arrancaron → el desafío terminó
    } else if (openUnplayed > 0) {
      state = done > 0 ? "in_progress" : "open";
    } else {
      state = "completed"; // jugaste todo lo que estaba abierto
    }

    return { ...def, total, done, state, opensAt, endsAt };
  });

  return states;
}

/**
 * Línea de tiempo de los Desafíos de fase de grupos (D1/D2/D3), independiente del
 * jugador. Deriva fase (upcoming/active/finished) + apertura de prode_matches.
 * La consumen los anuncios (popup D2 / ganador D1), la home (countdown) y la
 * Tabla (chips por desafío). cache() la dedupea dentro del request.
 */
export const getGroupChallengeTimeline = cache(
  async (tournamentId: string): Promise<GroupChallengeTimeline[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("prode_matches")
      .select("matchday,kickoff_at,home_team_id,away_team_id")
      .eq("tournament_id", tournamentId)
      .eq("stage", "group");
    const rows =
      (data as
        | {
            matchday: number | null;
            kickoff_at: string;
            home_team_id: string | null;
            away_team_id: string | null;
          }[]
        | null) ?? [];
    const now = Date.now();

    const byMd = new Map<number, { first: number; last: number; count: number }>();
    for (const r of rows) {
      if (r.matchday == null || !r.home_team_id || !r.away_team_id) continue;
      const t = new Date(r.kickoff_at).getTime();
      const cur = byMd.get(r.matchday) ?? { first: t, last: t, count: 0 };
      cur.first = Math.min(cur.first, t);
      cur.last = Math.max(cur.last, t);
      cur.count += 1;
      byMd.set(r.matchday, cur);
    }

    const groupDefs = CHALLENGES.filter(
      (c) => c.kind === "matches" && c.stage === "group" && c.matchday != null,
    ).sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0));

    const out: GroupChallengeTimeline[] = [];
    for (const def of groupDefs) {
      const md = def.matchday as number;
      const agg = byMd.get(md);
      if (!agg) continue; // sin partidos cargados todavía
      const prev = byMd.get(md - 1);
      const opensAtMs = md >= 2 && prev ? prev.last : null;
      const opensAt = opensAtMs != null ? new Date(opensAtMs).toISOString() : null;
      let phase: ChallengePhase;
      if (opensAtMs != null && now < opensAtMs) phase = "upcoming";
      else if (agg.last <= now) phase = "finished";
      else phase = "active";
      out.push({
        key: def.key,
        slug: def.slug,
        title: def.title,
        short: def.short,
        subtitle: def.subtitle,
        matchday: md,
        phase,
        opensAt,
        firstKickoff: new Date(agg.first).toISOString(),
        lastKickoff: new Date(agg.last).toISOString(),
        matches: agg.count,
      });
    }
    return out;
  },
);

/**
 * Próximo hito del prode para el countdown de la home (arregla el countdown que
 * apuntaba a `predictions_lock_at`, ya en el pasado). Prioridad:
 *  1) próximo Desafío de grupos por abrir (ej: "Desafío 3 se abre en…"),
 *  2) próximo partido programado,
 *  3) cierre del torneo.
 */
export async function getNextProdeEvent(
  tournamentId: string,
  tournament: Tournament | null,
): Promise<ProdeNextEvent | null> {
  const timeline = await getGroupChallengeTimeline(tournamentId);
  const upcoming = timeline
    .filter((t) => t.phase === "upcoming" && t.opensAt)
    .sort((a, b) => new Date(a.opensAt!).getTime() - new Date(b.opensAt!).getTime())[0];
  if (upcoming?.opensAt) {
    return { target: upcoming.opensAt, kind: "challenge_open", label: `${upcoming.title} se abre en` };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("prode_matches")
    .select("kickoff_at")
    .eq("tournament_id", tournamentId)
    .eq("status", "scheduled")
    .gt("kickoff_at", new Date().toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const next = (data as { kickoff_at: string } | null)?.kickoff_at;
  if (next) return { target: next, kind: "match", label: "Próximo partido en" };

  if (tournament?.ends_at) {
    return { target: tournament.ends_at, kind: "tournament_end", label: "El prode cierra en" };
  }
  return null;
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
