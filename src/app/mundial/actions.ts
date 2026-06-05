"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  setProdeSession,
  getProdeParticipantId,
  clearProdeSession,
  setPendingLeague,
  getPendingLeague,
  clearPendingLeague,
} from "@/lib/prode/session";
import { getTournament, getParticipantSummary, getLeaderboard, getWeeklyLeaderboard } from "@/lib/prode/data";

export type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

const nameSchema = z.string().trim().min(2, "Ingresá tu nombre").max(60);
const phoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(z.string().min(8, "Teléfono inválido").max(15));
const pinSchema = z.string().trim().regex(/^\d{4}$/, "El PIN son 4 dígitos");

type RpcResult = { ok: boolean; error?: string } & Record<string, unknown>;

async function callRpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(fn, args);
  if (error) {
    console.error(`[prode] rpc ${fn} error`, error.message);
    return { ok: false, error: "Error del servidor. Probá de nuevo." };
  }
  return (data as RpcResult) ?? { ok: false, error: "Sin respuesta" };
}

/**
 * Login/registro por PIN (sin OTP, sin mensajes).
 * - Si el teléfono no existe y no vino nombre → { needName:true } (la UI revela el nombre).
 * - Si existe → verifica el PIN (o lo fija si nunca tuvo / fue reseteado).
 * - Si no existe + vino nombre → crea cliente+participante, da el cupón y une a la
 *   liga de la casa. En todos los casos de éxito real setea la sesión.
 */
export async function authWithPin(input: {
  phone: string;
  pin: string;
  firstName?: string;
  lastName?: string;
}): Promise<
  Result<{
    needName?: boolean;
    participantId?: string;
    displayName?: string;
    isNew?: boolean;
    joinedLeague?: string | null;
  }>
> {
  const phone = phoneSchema.safeParse(input.phone);
  if (!phone.success) return fail(phone.error.issues[0]?.message ?? "Teléfono inválido");
  const pin = pinSchema.safeParse(input.pin);
  if (!pin.success) return fail(pin.error.issues[0]?.message ?? "PIN inválido");

  const first = (input.firstName ?? "").trim();
  const last = (input.lastName ?? "").trim();
  if (first) {
    const n = nameSchema.safeParse(first);
    if (!n.success) return fail(n.error.issues[0]?.message ?? "Nombre inválido");
  }

  const res = await callRpc("prode_auth_with_pin", {
    p_phone: phone.data,
    p_pin: pin.data,
    p_first_name: first || null,
    p_last_name: last || null,
  });
  if (!res.ok) return fail(res.error ?? "No se pudo entrar");

  // Teléfono nuevo y sin nombre: la UI debe pedir el nombre (no hay sesión todavía).
  if (res.need_name) return ok({ needName: true });

  const participantId = String(res.participant_id);
  await setProdeSession(participantId);

  // Auto-join a la liga de la invitación (si abrió un link ?liga=CODE sin estar registrado).
  let joinedLeague: string | null = null;
  const pendingCode = await getPendingLeague();
  if (pendingCode) {
    const jr = await callRpc("prode_join_league", { p_participant_id: participantId, p_invite_code: pendingCode });
    await clearPendingLeague();
    if (jr.ok) joinedLeague = String(jr.name ?? "");
  }

  return ok({
    participantId,
    displayName: String(res.display_name ?? ""),
    isNew: Boolean(res.is_new),
    joinedLeague,
  });
}

/**
 * Capturar una invitación de liga (?liga=CODE). Si el jugador YA está
 * registrado, lo une en el acto; si no, guarda el código para auto-unirlo al
 * completar el alta. Devuelve el nombre de la liga para el banner del front.
 * La "liga de la casa" se ignora (equivale a la tabla general).
 */
export async function rememberLeagueInvite(
  code: string,
): Promise<Result<{ joined: boolean; name: string | null }>> {
  const clean = String(code || "").trim().toUpperCase();
  if (clean.length < 4 || clean.length > 16) return fail("Código de liga inválido");

  const admin = createAdminClient();
  const { data: info } = await admin.rpc("prode_league_info", { p_invite_code: clean });
  const league = info as { id: string; name: string; is_house: boolean } | null;
  if (!league?.id) return fail("Liga no encontrada");
  if (league.is_house) return ok({ joined: false, name: null }); // la liga de la casa = tabla general

  const pid = await getProdeParticipantId();
  if (pid) {
    const r = await callRpc("prode_join_league", { p_participant_id: pid, p_invite_code: clean });
    await clearPendingLeague();
    if (!r.ok) return fail(r.error ?? "No se pudo unir a la liga");
    return ok({ joined: true, name: String(r.name ?? league.name) });
  }

  await setPendingLeague(clean);
  return ok({ joined: false, name: league.name });
}

/** Paso 3: completar perfil (email/DNI/nacimiento/consentimiento). */
export async function completeProfile(input: {
  email: string;
  dni: string;
  birthdate: string;
  consent: boolean;
}): Promise<Result<null>> {
  const pid = await getProdeParticipantId();
  if (!pid) return fail("Tu sesión expiró. Verificá tu teléfono de nuevo.");

  const parsed = z
    .object({
      email: z.string().trim().email("Email inválido"),
      dni: z
        .string()
        .trim()
        .transform((s) => s.replace(/\D/g, ""))
        .pipe(z.string().min(6, "DNI inválido").max(10)),
      birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
      consent: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  if (!parsed.data.consent) return fail("Necesitamos tu consentimiento para participar");

  const res = await callRpc("prode_complete_profile", {
    p_participant_id: pid,
    p_email: parsed.data.email,
    p_dni: parsed.data.dni,
    p_birthdate: parsed.data.birthdate,
    p_consent: parsed.data.consent,
  });
  if (!res.ok) return fail(res.error ?? "No se pudo guardar el perfil");
  return ok(null);
}

/** Guardar la Quiniela (predicciones grandes). */
export async function submitQuiniela(
  answers: { question_id: string; answer: string }[],
): Promise<Result<{ saved: number }>> {
  const pid = await getProdeParticipantId();
  if (!pid) return fail("Tu sesión expiró. Verificá tu teléfono de nuevo.");

  const parsed = z
    .array(z.object({ question_id: z.string().uuid(), answer: z.string().trim().min(1).max(120) }))
    .max(50)
    .safeParse(answers);
  if (!parsed.success) return fail("Respuestas inválidas");

  const res = await callRpc("prode_submit_quiniela", { p_participant_id: pid, p_answers: parsed.data });
  if (!res.ok) return fail(res.error ?? "No se pudo guardar la quiniela");
  return ok({ saved: Number(res.saved ?? 0) });
}

/** Guardar predicción de un partido (1X2 + marcador opcional). */
export async function submitMatchPrediction(input: {
  matchId: string;
  outcome: "home" | "draw" | "away";
  home?: number | null;
  away?: number | null;
}): Promise<Result<null>> {
  const pid = await getProdeParticipantId();
  if (!pid) return fail("Tu sesión expiró. Verificá tu teléfono de nuevo.");

  const parsed = z
    .object({
      matchId: z.string().uuid(),
      outcome: z.enum(["home", "draw", "away"]),
      home: z.number().int().min(0).max(30).nullable().optional(),
      away: z.number().int().min(0).max(30).nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fail("Datos inválidos");

  const res = await callRpc("prode_submit_match_prediction", {
    p_participant_id: pid,
    p_match_id: parsed.data.matchId,
    p_outcome: parsed.data.outcome,
    p_home: parsed.data.home ?? null,
    p_away: parsed.data.away ?? null,
  });
  if (!res.ok) return fail(res.error ?? "No se pudo guardar la jugada");
  return ok(null);
}

export async function createLeague(name: string): Promise<Result<{ leagueId: string; inviteCode: string }>> {
  const pid = await getProdeParticipantId();
  if (!pid) return fail("Tu sesión expiró.");
  const res = await callRpc("prode_create_league", { p_participant_id: pid, p_name: z.string().trim().max(60).parse(name || "Mi Liga") });
  if (!res.ok) return fail(res.error ?? "No se pudo crear la liga");
  return ok({ leagueId: String(res.league_id), inviteCode: String(res.invite_code) });
}

export async function joinLeague(code: string): Promise<Result<{ leagueId: string; name: string }>> {
  const pid = await getProdeParticipantId();
  if (!pid) return fail("Tu sesión expiró.");
  const res = await callRpc("prode_join_league", { p_participant_id: pid, p_invite_code: String(code || "").trim() });
  if (!res.ok) return fail(res.error ?? "No se pudo unir a la liga");
  return ok({ leagueId: String(res.league_id), name: String(res.name ?? "Liga") });
}

/**
 * Código de invitación de la primera liga privada del jugador (si tiene alguna).
 * Lo usa "Mi cuenta" para que "Desafiar a un amigo" siempre comparta un link con
 * ?liga= aunque la liga se haya creado en otra sesión.
 */
export async function getMyInviteCode(): Promise<string | null> {
  const pid = await getProdeParticipantId();
  if (!pid) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("prode_leagues")
    .select("invite_code, created_at, prode_league_members!inner(participant_id)")
    .eq("is_house", false)
    .eq("prode_league_members.participant_id", pid)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { invite_code: string } | null)?.invite_code ?? null;
}

/** Estado del jugador (sus picks + puntos), para hidratar la UI al volver. */
export async function getMyState() {
  const pid = await getProdeParticipantId();
  if (!pid) return null;
  return getParticipantSummary(pid);
}

/** Refrescar tabla (para polling / al postear un resultado). */
export async function refreshLeaderboard(leagueId: string | null = null, limit = 50) {
  const t = await getTournament();
  if (!t) return [];
  return getLeaderboard(t.id, leagueId, limit);
}

/** Refrescar la tabla de la semana (scope "Semana" de la tabla pública). */
export async function refreshWeeklyLeaderboard(weekStart: string, weekEnd: string, limit = 50) {
  const t = await getTournament();
  if (!t) return [];
  return getWeeklyLeaderboard(t.id, weekStart, weekEnd, limit);
}

export async function logoutProde(): Promise<Result<null>> {
  await clearProdeSession();
  return ok(null);
}
