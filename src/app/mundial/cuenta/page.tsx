import type { Metadata } from "next";
import CuentaClient from "./CuentaClient";
import { getTournament, getQuestions, getTeams, getMyRewards } from "@/lib/prode/data";
import { getMyState } from "../actions";

export const metadata: Metadata = {
  title: "Mi cuenta | Prode Mundial 2026 — Monaco",
  description: "Tu perfil, tu prode, tu liga privada y tus fichas en el Prode Mundial 2026 de Monaco.",
};

export const dynamic = "force-dynamic";

/** ¿Sigue abierta la quiniela? Helper a nivel de módulo (fuera del render de
 * componente) para poder leer la hora sin romper la regla de pureza de hooks. */
function stillOpen(lockAt: string | null): boolean {
  if (!lockAt) return true;
  return new Date(lockAt).getTime() > Date.now();
}

/**
 * Mi cuenta: perfil + resumen de "Mi Quiniela" + liga privada + compartir +
 * cerrar sesión. Server Component: trae el estado del jugador y, si está
 * registrado, el torneo/preguntas/equipos para renderizar la quiniela legible.
 */
export default async function CuentaPage() {
  const myState = await getMyState();

  // Sólo necesitamos catálogo (preguntas/equipos) + premios si hay jugador que mostrar.
  const tournament = myState ? await getTournament() : null;
  const [questions, teams, rewards] =
    tournament && myState
      ? await Promise.all([
          getQuestions(tournament.id),
          getTeams(tournament.id),
          getMyRewards(myState.participant_id),
        ])
      : [[], [], []];
  const lockAt = tournament ? tournament.predictions_lock_at ?? tournament.starts_at : null;
  const editable = stillOpen(lockAt);

  return (
    <CuentaClient
      myState={myState}
      questions={questions}
      teams={teams}
      rewards={rewards}
      editable={editable}
    />
  );
}
