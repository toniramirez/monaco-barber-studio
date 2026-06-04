import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Sesión liviana del participante (sin Supabase Auth). Cookie httpOnly firmada
 * con HMAC: el participant_id NO es manipulable desde el cliente. Las Server
 * Actions leen el id de acá (nunca del input) para autorizar mutaciones.
 */
const COOKIE = "prode_session";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 días

function secret(): string {
  const s = env.PRODE_SESSION_SECRET;
  if (!s) {
    // En producción la cookie de sesión gatea TODA mutación del participante y el
    // acceso a sus premios (QR). Si falta el secreto, fallamos en vez de firmar
    // con una constante pública (que permitiría forjar la sesión de cualquiera).
    if (process.env.NODE_ENV === "production") {
      throw new Error("PRODE_SESSION_SECRET no está configurado en producción");
    }
    return "dev-insecure-prode-secret-change-me";
  }
  return s;
}

function sign(participantId: string): string {
  const sig = createHmac("sha256", secret()).update(participantId).digest("base64url");
  return `${participantId}.${sig}`;
}

function verify(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const id = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = createHmac("sha256", secret()).update(id).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return id;
}

export async function setProdeSession(participantId: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, sign(participantId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
  });
}

export async function getProdeParticipantId(): Promise<string | null> {
  const c = await cookies();
  return verify(c.get(COOKIE)?.value);
}

export async function clearProdeSession(): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, "", { path: "/", maxAge: 0 });
}

/**
 * Liga pendiente de invitación (?liga=CODE). Se guarda al abrir un link de
 * invitación SIN estar registrado, y se consume al verificar el alta para
 * auto-unir al jugador a la liga del amigo. Vida corta (no es sesión).
 */
const PENDING_LEAGUE_COOKIE = "prode_pending_league";
// Ventana generosa: un amigo puede abrir el link ahora y registrarse más tarde
// (a la noche) y aun así caer en la liga. Bajo riesgo.
const PENDING_LEAGUE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

export async function setPendingLeague(code: string): Promise<void> {
  const c = await cookies();
  c.set(PENDING_LEAGUE_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: PENDING_LEAGUE_MAX_AGE,
  });
}

export async function getPendingLeague(): Promise<string | null> {
  const c = await cookies();
  return c.get(PENDING_LEAGUE_COOKIE)?.value ?? null;
}

export async function clearPendingLeague(): Promise<void> {
  const c = await cookies();
  c.set(PENDING_LEAGUE_COOKIE, "", { path: "/", maxAge: 0 });
}
