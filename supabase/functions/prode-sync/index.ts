// Prode Mundial 2026 — ingesta de fixtures/resultados desde football-data.org
// Siembra prode_teams (48) + prode_matches (104). Para los partidos FINISHED
// escribe el resultado y llama prode_score_match (idempotente).
//
// Auth: header `x-cron-secret` == CRON_SECRET (custom auth -> verify_jwt=false).
// Secrets (Supabase Edge Function): FOOTBALL_DATA_API_KEY, CRON_SECRET.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MONACO_ORG = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const FD_BASE = "https://api.football-data.org/v4";

const STAGE_MAP: Record<string, string> = {
  GROUP_STAGE: "group",
  LAST_32: "round_of_32",
  ROUND_OF_32: "round_of_32",
  LAST_16: "round_of_16",
  ROUND_OF_16: "round_of_16",
  QUARTER_FINALS: "quarter_final",
  QUARTER_FINAL: "quarter_final",
  SEMI_FINALS: "semi_final",
  SEMI_FINAL: "semi_final",
  THIRD_PLACE: "third_place",
  "3RD_PLACE_FINAL": "third_place",
  FINAL: "final",
};
const STATUS_MAP: Record<string, string> = {
  SCHEDULED: "scheduled", TIMED: "scheduled",
  IN_PLAY: "live", PAUSED: "live",
  FINISHED: "finished",
  SUSPENDED: "scheduled", POSTPONED: "scheduled",
  CANCELLED: "cancelled", CANCELED: "cancelled",
};

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return json({ ok: false, error: "forbidden" }, 403);
  }
  const fdKey = Deno.env.get("FOOTBALL_DATA_API_KEY");
  if (!fdKey) return json({ ok: false, error: "FOOTBALL_DATA_API_KEY no configurada" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Torneo activo de Monaco
  const { data: tour } = await supabase
    .from("prode_tournament").select("id")
    .eq("organization_id", MONACO_ORG).eq("season", "2026").limit(1).maybeSingle();
  if (!tour) return json({ ok: false, error: "torneo no encontrado" }, 404);
  const tournamentId = (tour as { id: string }).id;

  const fd = (path: string) => fetch(`${FD_BASE}${path}`, { headers: { "X-Auth-Token": fdKey } });

  // ===== 1) Equipos =====
  let teamsUpserted = 0;
  const extToTeamId = new Map<string, string>();
  try {
    const res = await fd("/competitions/WC/teams");
    if (res.ok) {
      const body = await res.json();
      const teams = (body.teams ?? []) as Array<Record<string, unknown>>;
      for (const t of teams) {
        const row = {
          tournament_id: tournamentId,
          external_id: String(t.id),
          name: (t.name as string) ?? (t.tla as string) ?? "??",
          short_name: (t.shortName as string) ?? null,
          code: (t.tla as string) ?? null,
          flag_url: (t.crest as string) ?? null,
        };
        const { data: up } = await supabase
          .from("prode_teams")
          .upsert(row, { onConflict: "tournament_id,external_id" })
          .select("id, external_id").maybeSingle();
        if (up) { extToTeamId.set(String((up as { external_id: string }).external_id), (up as { id: string }).id); teamsUpserted++; }
      }
    }
  } catch (e) { console.error("teams error", e); }

  // Mapa completo ext->id (por si ya existían)
  {
    const { data: allTeams } = await supabase
      .from("prode_teams").select("id, external_id").eq("tournament_id", tournamentId);
    for (const t of (allTeams ?? []) as Array<{ id: string; external_id: string | null }>) {
      if (t.external_id) extToTeamId.set(String(t.external_id), t.id);
    }
  }

  // ===== 2) Partidos =====
  let matchesUpserted = 0;
  let scored = 0;
  try {
    const res = await fd("/competitions/WC/matches");
    if (!res.ok) return json({ ok: false, error: `football-data ${res.status}`, teamsUpserted }, 502);
    const body = await res.json();
    const matches = (body.matches ?? []) as Array<Record<string, any>>;
    for (const m of matches) {
      const status = STATUS_MAP[m.status] ?? "scheduled";
      const homeExt = m.homeTeam?.id ? String(m.homeTeam.id) : null;
      const awayExt = m.awayTeam?.id ? String(m.awayTeam.id) : null;
      const fullHome = m.score?.fullTime?.home ?? null;
      const fullAway = m.score?.fullTime?.away ?? null;
      const row: Record<string, unknown> = {
        tournament_id: tournamentId,
        external_id: String(m.id),
        stage: STAGE_MAP[m.stage] ?? "group",
        group_label: m.group ? String(m.group).replace(/GROUP_/i, "").trim() : null,
        matchday: m.matchday ?? null,
        home_team_id: homeExt ? extToTeamId.get(homeExt) ?? null : null,
        away_team_id: awayExt ? extToTeamId.get(awayExt) ?? null : null,
        home_team_label: m.homeTeam?.name ?? null,
        away_team_label: m.awayTeam?.name ?? null,
        kickoff_at: m.utcDate,
        venue: m.venue ?? null,
        status,
        home_score: status === "finished" ? fullHome : null,
        away_score: status === "finished" ? fullAway : null,
      };
      const { data: up } = await supabase
        .from("prode_matches")
        .upsert(row, { onConflict: "tournament_id,external_id" })
        .select("id, status").maybeSingle();
      matchesUpserted++;
      // Puntuar si finalizó y hay marcador
      if (up && status === "finished" && fullHome !== null && fullAway !== null) {
        const { error: scoreErr } = await supabase.rpc("prode_score_match", { p_match_id: (up as { id: string }).id });
        if (!scoreErr) scored++;
      }
    }
  } catch (e) {
    console.error("matches error", e);
    return json({ ok: false, error: String(e), teamsUpserted }, 500);
  }

  return json({ ok: true, teamsUpserted, matchesUpserted, scored });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
