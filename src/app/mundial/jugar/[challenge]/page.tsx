import { redirect, notFound } from "next/navigation";
import MatchDeck from "./MatchDeck";
import QuinielaPlay from "./QuinielaPlay";
import { getTournament, getQuestions, getTeams } from "@/lib/prode/data";
import { getChallengeBySlug, getChallengeMatches, getChallengesState } from "@/lib/prode/challenges";
import { getMyState } from "../../actions";
import { getProdeParticipantId } from "@/lib/prode/session";

export const dynamic = "force-dynamic";

function isPast(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

function num(v: unknown, d: number): number {
  return typeof v === "number" ? v : Number(v) || d;
}

/**
 * Play de un Desafío. Slug → desafío (challenges.ts). Gatea sesión (si no hay,
 * manda a registrarse). Dos mecánicas:
 *  - kind="matches": la consola de marcador (MatchDeck), un partido a la vez.
 *  - kind="quiniela": la Gran Quiniela (QuinielaPlay), las 6 preguntas grandes.
 */
export default async function ChallengePage({
  params,
}: {
  params: Promise<{ challenge: string }>;
}) {
  const { challenge: slug } = await params;
  const challenge = getChallengeBySlug(slug);
  if (!challenge) notFound();

  const [tournament, pid] = await Promise.all([getTournament(), getProdeParticipantId()]);
  if (!tournament) notFound();
  // Sin sesión: hay que registrarse primero (el hub muestra el alta).
  if (!pid) redirect("/mundial/jugar");

  const myState = await getMyState();
  // OJO: predictions_lock_at es un cutoff GLOBAL del torneo (hoy = kickoff del 1er
  // partido). Solo aplica a la Gran Quiniela. Los partidos se cierran uno por uno
  // en su propio kickoff (lo resuelve MatchDeck con match.kickoff_at). NO pasar
  // este lock global a MatchDeck o congela partidos todavía abiertos.
  const lockAt = tournament.predictions_lock_at ?? tournament.starts_at;
  const quinielaLocked = isPast(lockAt);

  // Apertura progresiva: si el Desafío todavía está bloqueado (no es el activo del
  // camino), no se puede jugar por URL directa → vuelta al hub.
  const states = await getChallengesState(tournament.id, myState);
  if (states.find((s) => s.slug === slug)?.state === "locked") redirect("/mundial/jugar");

  if (challenge.kind === "quiniela") {
    const [questions, teams] = await Promise.all([
      getQuestions(tournament.id),
      getTeams(tournament.id),
    ]);
    return (
      <QuinielaPlay
        questions={questions}
        teams={teams}
        myState={myState}
        locked={quinielaLocked}
        rewardLabel={challenge.reward.label}
      />
    );
  }

  const matches = await getChallengeMatches(tournament.id, challenge, myState);
  const settings = (tournament.settings ?? {}) as Record<string, unknown>;

  return (
    <MatchDeck
      challengeTitle={challenge.title}
      challengeSubtitle={challenge.subtitle}
      rewardLabel={challenge.reward.label}
      matches={matches}
      outcomePoints={num(settings.match_outcome_points, 3)}
      exactBonus={num(settings.match_exact_bonus, 2)}
      featuredMultiplier={num(settings.featured_multiplier, 2)}
      participantId={pid}
    />
  );
}
