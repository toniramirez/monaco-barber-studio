import { Ticket } from "lucide-react";
import shell from "../Shell.module.css";
import JugarClient from "./JugarClient";
import { getTournament, getQuestions, getTeams, getMatchOfTheDay } from "@/lib/prode/data";
import { teamEsName } from "@/lib/prode/countries";
import { getMyState } from "../actions";

export const dynamic = "force-dynamic";

/** ¿Ya cerró la quiniela? Helper a nivel de módulo (no es render de componente,
 * así que leer la hora acá no rompe la regla de pureza de hooks). */
function isPast(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

/**
 * Pantalla "Jugar": el embudo de registro (registro → OTP → perfil) + el editor
 * de Quiniela. Server Component: resuelve datos del torneo y la sesión, y los
 * pasa al cliente. La tabla y las ligas viven en otras pestañas.
 */
export default async function JugarPage() {
  const tournament = await getTournament();

  if (!tournament) {
    return (
      <main className={shell.content}>
        <div className={shell.gate}>
          <Ticket className={shell.gateIcon} size={44} aria-hidden="true" />
          <h1 className={shell.sectionTitle}>
            El Prode todavía no <span className={shell.em}>arrancó</span>
          </h1>
          <p className={shell.sectionSub}>
            La Quiniela del Campeón se está preparando. ¡Volvé pronto, crack!
          </p>
        </div>
      </main>
    );
  }

  const [questions, teams, myState, matchOfDay] = await Promise.all([
    getQuestions(tournament.id),
    getTeams(tournament.id),
    getMyState(),
    getMatchOfTheDay(tournament.id),
  ]);

  const lockAt = tournament.predictions_lock_at ?? tournament.starts_at;
  const locked = isPast(lockAt);

  return (
    <main className={shell.content}>
      <JugarClient
        locked={locked}
        questions={questions}
        teams={teams}
        myState={myState}
        matchOfDay={
          matchOfDay
            ? {
                id: matchOfDay.id,
                lockAt: matchOfDay.kickoff_at,
                homeName: teamEsName(matchOfDay.home),
                awayName: teamEsName(matchOfDay.away),
              }
            : null
        }
      />
    </main>
  );
}
