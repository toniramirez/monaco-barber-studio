import { Swords } from "lucide-react";
import shell from "../Shell.module.css";
import Onboarding from "../Onboarding";
import Sendero from "../Sendero";
import { getTournament } from "@/lib/prode/data";
import { getChallengesState } from "@/lib/prode/challenges";
import { getMyState } from "../actions";

export const dynamic = "force-dynamic";

function isPast(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

/**
 * Jugar — el hub "Camino al Título". Si el jugador no está registrado, muestra
 * el alta (Onboarding, flujo de PIN preservado). Si está, muestra el sendero de
 * Desafíos. El play de cada desafío vive en /mundial/jugar/[slug].
 */
export default async function JugarPage() {
  const tournament = await getTournament();

  if (!tournament) {
    return (
      <main className={shell.content}>
        <div className={shell.gate}>
          <Swords className={shell.gateIcon} size={44} aria-hidden="true" />
          <h1 className={shell.sectionTitle}>
            El Prode todavía no <span className={shell.em}>arrancó</span>
          </h1>
          <p className={shell.sectionSub}>
            El Prode de Monaco se está preparando. ¡Volvé pronto, crack!
          </p>
        </div>
      </main>
    );
  }

  const myState = await getMyState();
  // El camino es sólo-lectura recién cuando TERMINA el torneo (no cuando arranca el
  // primer partido). Los Desafíos de partidos se cierran uno por uno en su kickoff;
  // la Gran Quiniela cierra al inicio (predictions_lock_at) → se pasa aparte al cofre.
  const tournamentOver = isPast(tournament.ends_at);
  const quinielaLocked = isPast(tournament.predictions_lock_at ?? tournament.starts_at);

  if (!myState) {
    return (
      <main className={shell.content}>
        <Onboarding />
      </main>
    );
  }

  const challenges = await getChallengesState(tournament.id, myState);

  return (
    <main className={shell.content}>
      <Sendero
        challenges={challenges}
        displayName={myState.display_name}
        totalPoints={myState.total_points}
        locked={tournamentOver}
        quinielaLocked={quinielaLocked}
      />
    </main>
  );
}
