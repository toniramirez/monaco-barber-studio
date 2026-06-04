"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProdeAdmin, verifyAdminPin } from "@/lib/prode/admin";

export type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

export async function loginAdmin(pin: string): Promise<Result<null>> {
  const ok = await verifyAdminPin(pin);
  if (!ok) return { ok: false, error: "PIN incorrecto o no configurado" };
  return { ok: true, data: null };
}

async function guard(): Promise<boolean> {
  return isProdeAdmin();
}

/** Cargar / corregir un resultado: setea finished + score y dispara el scoring. */
export async function setResult(input: {
  matchId: string;
  home: number;
  away: number;
}): Promise<Result<{ scored: number }>> {
  if (!(await guard())) return { ok: false, error: "No autorizado" };
  const p = z
    .object({
      matchId: z.string().uuid(),
      home: z.number().int().min(0).max(30),
      away: z.number().int().min(0).max(30),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "Datos inválidos" };

  const admin = createAdminClient();
  const { error: uErr } = await admin
    .from("prode_matches")
    .update({ status: "finished", home_score: p.data.home, away_score: p.data.away, updated_at: new Date().toISOString() })
    .eq("id", p.data.matchId);
  if (uErr) return { ok: false, error: uErr.message };

  const { data, error } = await admin.rpc("prode_score_match", { p_match_id: p.data.matchId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/prode");
  return { ok: true, data: { scored: Number((data as { scored?: number })?.scored ?? 0) } };
}

/** Marcar / desmarcar "partido del día". */
export async function setFeatured(input: { matchId: string; featured: boolean }): Promise<Result<null>> {
  if (!(await guard())) return { ok: false, error: "No autorizado" };
  const admin = createAdminClient();
  const { error } = await admin.from("prode_matches").update({ is_featured: input.featured }).eq("id", input.matchId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/prode");
  return { ok: true, data: null };
}

/** Resolver una pregunta de la Quiniela (campeón, goleador, etc.) y puntuar. */
export async function resolveQuestion(input: { questionId: string; answer: string }): Promise<Result<{ scored: number }>> {
  if (!(await guard())) return { ok: false, error: "No autorizado" };
  const p = z.object({ questionId: z.string().uuid(), answer: z.string().trim().min(1).max(120) }).safeParse(input);
  if (!p.success) return { ok: false, error: "Datos inválidos" };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("prode_resolve_question", {
    p_question_id: p.data.questionId,
    p_correct: p.data.answer,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/prode");
  return { ok: true, data: { scored: Number((data as { scored?: number })?.scored ?? 0) } };
}
