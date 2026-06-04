import { Trophy } from "lucide-react";
import shell from "../Shell.module.css";
import { getTournament, getLeaderboard, getParticipantCount, getMyLeagues } from "@/lib/prode/data";
import { argWeekWindow } from "@/lib/prode/weeks";
import { getMyState } from "../actions";
import TablaClient from "./TablaClient";

export const dynamic = "force-dynamic";

/** ¿Ya arrancó el torneo? Helper a nivel de módulo (no es render de componente,
 * así que leer la hora acá no rompe la regla de pureza de hooks). */
function hasStarted(startsAt: string): boolean {
  return new Date(startsAt).getTime() <= Date.now();
}

/**
 * Pantalla Tabla (/mundial/tabla): ranking general con podio (top-3), lista y
 * una fila fija "tu fila" anclada arriba de la tab bar. Server Component:
 * trae datos y los pasa al client, que se encarga del refresh en vivo.
 */
export default async function TablaPage() {
  const tournament = await getTournament();

  if (!tournament) {
    return (
      <main className={shell.content}>
        <div className={shell.gate}>
          <Trophy className={shell.gateIcon} size={42} aria-hidden="true" />
          <h1 className={shell.sectionTitle}>
            La <span className={shell.em}>tabla</span> todavía no abrió
          </h1>
          <p className={shell.sectionSub}>
            El Prode Mundial todavía no está disponible. ¡Volvé pronto, crack!
          </p>
        </div>
      </main>
    );
  }

  const [leaderboard, myState, players] = await Promise.all([
    getLeaderboard(tournament.id, null, 50),
    getMyState(),
    getParticipantCount(tournament.id),
  ]);

  // Ligas privadas del jugador (para el selector General / Mi liga).
  const myLeagues = myState?.participant_id ? await getMyLeagues(myState.participant_id) : [];

  // Ventana de la semana actual (solo una vez que arrancó el torneo) para el scope "Semana".
  const currentWeek = hasStarted(tournament.starts_at) ? argWeekWindow() : null;

  return (
    <TablaClient
      initialLeaderboard={leaderboard}
      players={players}
      registered={!!myState}
      myParticipantId={myState?.participant_id ?? null}
      myTotalPoints={myState?.total_points ?? 0}
      myLeagues={myLeagues}
      currentWeek={currentWeek}
    />
  );
}
