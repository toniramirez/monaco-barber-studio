import { getTournament } from "@/lib/prode/data";
import { getGroupChallengeTimeline } from "@/lib/prode/challenges";
import { getProdeParticipantId } from "@/lib/prode/session";
import ProdeAnnouncements from "./ProdeAnnouncements";

/**
 * Gate (server) del anuncio del prode. Decide por el calendario del torneo si el
 * Desafío 2 está "active" (en juego) → muestra el popup "se abre el Desafío 2".
 * El cliente decide si ya se vio (localStorage). Liviano: getTournament + timeline
 * van cacheados por request (los comparte el resto del árbol).
 */
export default async function ProdeAnnouncementsGate() {
  const tournament = await getTournament();
  if (!tournament) return null;

  const timeline = await getGroupChallengeTimeline(tournament.id);
  const d2 = timeline.find((t) => t.matchday === 2);
  const d2Active = d2?.phase === "active";
  if (!d2Active) return null;

  const pid = await getProdeParticipantId();

  return <ProdeAnnouncements d2Active={d2Active} registered={!!pid} d2Slug={d2?.slug ?? "d2"} />;
}
