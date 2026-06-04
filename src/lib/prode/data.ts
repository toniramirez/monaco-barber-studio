import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MONACO_ORG,
  type Tournament,
  type ProdeTeam,
  type ProdeTeamLite,
  type ProdeQuestion,
  type ProdeMatch,
  type MatchOfTheDay,
  type LeaderboardRow,
  type ParticipantSummary,
  type ProdeReward,
  type ShareData,
} from "./types";

// Lecturas server-side. Usan el admin client (service-role) — nunca se exponen al cliente.

export async function getTournament(): Promise<Tournament | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("prode_tournament")
    .select("id,name,status,predictions_lock_at,starts_at,ends_at,settings")
    .eq("organization_id", MONACO_ORG)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Tournament) ?? null;
}

export async function getTeams(tournamentId: string): Promise<ProdeTeam[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("prode_teams")
    .select("id,name,short_name,code,group_label,flag_url")
    .eq("tournament_id", tournamentId)
    .order("group_label", { ascending: true })
    .order("name", { ascending: true });
  return (data as ProdeTeam[]) ?? [];
}

export async function getQuestions(tournamentId: string): Promise<ProdeQuestion[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("prode_questions")
    .select("id,kind,label,help_text,answer_type,options,points,sort_order,correct_answer")
    .eq("tournament_id", tournamentId)
    .order("sort_order", { ascending: true });
  return (data as ProdeQuestion[]) ?? [];
}

export async function getFeaturedMatch(tournamentId: string): Promise<ProdeMatch | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("prode_matches")
    .select(
      "id,stage,group_label,kickoff_at,status,home_team_id,away_team_id,home_team_label,away_team_label,home_score,away_score,is_featured,venue",
    )
    .eq("tournament_id", tournamentId)
    .eq("is_featured", true)
    .gt("kickoff_at", new Date().toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as ProdeMatch) ?? null;
}

/**
 * El "Partido del Día": el partido destacado vigente (is_featured) o, si no hay
 * ninguno, el próximo a jugarse. Resuelve ambos equipos (bandera/código) y la
 * config de puntos del torneo. Devuelve null si no quedan partidos por jugar.
 */
export async function getMatchOfTheDay(tournamentId: string): Promise<MatchOfTheDay | null> {
  const admin = createAdminClient();

  const { data: match } = await admin
    .from("prode_matches")
    .select(
      "id,stage,group_label,kickoff_at,status,home_team_id,away_team_id,home_team_label,away_team_label,is_featured",
    )
    .eq("tournament_id", tournamentId)
    .eq("status", "scheduled")
    .gt("kickoff_at", new Date().toISOString())
    // destacado primero; entre iguales, el más próximo a jugarse
    .order("is_featured", { ascending: false })
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!match) return null;

  const ids = [match.home_team_id, match.away_team_id].filter(Boolean) as string[];
  const teamById = new Map<string, ProdeTeamLite>();
  if (ids.length > 0) {
    const { data: teams } = await admin
      .from("prode_teams")
      .select("id,name,short_name,code,flag_url")
      .in("id", ids);
    (teams as ProdeTeamLite[] | null)?.forEach((t) => teamById.set(t.id, t));
  }

  const { data: t } = await admin
    .from("prode_tournament")
    .select("settings")
    .eq("id", tournamentId)
    .maybeSingle();
  const settings = (t?.settings ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === "number" ? v : Number(v) || d);

  return {
    id: match.id,
    stage: match.stage,
    group_label: match.group_label,
    kickoff_at: match.kickoff_at,
    status: match.status,
    is_featured: match.is_featured,
    home: match.home_team_id ? teamById.get(match.home_team_id) ?? null : null,
    away: match.away_team_id ? teamById.get(match.away_team_id) ?? null : null,
    home_label: match.home_team_label,
    away_label: match.away_team_label,
    outcome_points: num(settings.match_outcome_points, 3),
    exact_bonus: num(settings.match_exact_bonus, 2),
    featured_multiplier: num(settings.featured_multiplier, 2),
  };
}

export async function getLeaderboard(
  tournamentId: string,
  leagueId: string | null = null,
  limit = 50,
): Promise<LeaderboardRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("prode_public_leaderboard", {
    p_tournament_id: tournamentId,
    p_league_id: leagueId,
    p_limit: limit,
  });
  return (data as LeaderboardRow[]) ?? [];
}

/**
 * Ranking de la semana [weekStart, weekEnd] (puntos sólo de partidos de esa
 * semana). Mapea week_points → total_points para reusar el render de la tabla.
 */
export async function getWeeklyLeaderboard(
  tournamentId: string,
  weekStart: string,
  weekEnd: string,
  limit = 50,
): Promise<LeaderboardRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("prode_weekly_leaderboard", {
    p_tournament_id: tournamentId,
    p_week_start: weekStart,
    p_week_end: weekEnd,
    p_limit: limit,
  });
  type WeeklyRow = {
    rank: number;
    participant_id: string;
    display_name: string;
    week_points: number;
    exact_hits: number;
  };
  return ((data as WeeklyRow[]) ?? []).map((r) => ({
    rank: r.rank,
    participant_id: r.participant_id,
    display_name: r.display_name,
    total_points: r.week_points,
    exact_hits: r.exact_hits,
  }));
}

export async function getParticipantCount(tournamentId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("prode_participants")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  return count ?? 0;
}

/**
 * Ligas privadas (no-house) a las que pertenece el participante. La "liga de la
 * casa" (Liga Monaco) se excluye porque equivale a la tabla general (todos están
 * auto-unidos al registrarse). Devuelve solo id+nombre para el selector de la tabla.
 */
export async function getMyLeagues(
  participantId: string,
): Promise<{ id: string; name: string }[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("prode_leagues")
    .select("id,name,created_at,prode_league_members!inner(participant_id)")
    .eq("is_house", false)
    .eq("prode_league_members.participant_id", participantId)
    .order("created_at", { ascending: true });
  return ((data as { id: string; name: string }[] | null) ?? []).map((l) => ({
    id: l.id,
    name: l.name,
  }));
}

export async function getParticipantSummary(
  participantId: string,
): Promise<ParticipantSummary | null> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("prode_participant_summary", {
    p_participant_id: participantId,
  });
  return (data as ParticipantSummary) ?? null;
}

/**
 * Premios del jugador (welcome / semanal / gran premio) con su QR para canjear.
 * Vía RPC prode_my_rewards (service-role) — el qr_code no se expone hasta acá.
 */
export async function getMyRewards(participantId: string): Promise<ProdeReward[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("prode_my_rewards", { p_participant_id: participantId });
  return (data as ProdeReward[]) ?? [];
}

/**
 * Datos de un jugador para su placa compartible (OG image): nombre, puntos y a
 * quién le apostó como campeón (si ya lo eligió). Una sola RPC (prode_share_card)
 * en vez de ~5 reads, y `cache()` dedupea las 3 invocaciones por request
 * (generateMetadata + page + opengraph-image). Tolerante a fallos.
 */
export const getShareData = cache(async (participantId: string): Promise<ShareData | null> => {
  const admin = createAdminClient();
  const { data } = await admin.rpc("prode_share_card", { p_participant_id: participantId });
  if (!data) return null;
  const d = data as { display_name: string; total_points: number; champion: ProdeTeamLite | null };
  return {
    participant_id: participantId,
    display_name: d.display_name,
    total_points: d.total_points,
    champion: d.champion ?? null,
  };
});
