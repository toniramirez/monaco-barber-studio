import shell from "../Shell.module.css";
import PremiosClient from "./PremiosClient";
import { getMyRewards } from "@/lib/prode/data";
import { getProdeParticipantId } from "@/lib/prode/session";

export const dynamic = "force-dynamic";

const WELCOME_DISCOUNT = 25; // 25% OFF de bienvenida
const WELCOME_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 horas

/**
 * Premios — la vidriera del Prode. Bienvenida 25% (timer 48h), la camiseta como
 * objeto-héroe (flip 3D), premios por desafío y el podio del Gran Premio.
 * El timer de 48h se ancla en la creación del cupón de bienvenida del jugador.
 */
export default async function PremiosPage() {
  const pid = await getProdeParticipantId();

  let welcomeExpiresAt: string | null = null;
  let hasWelcomeReward = false;

  if (pid) {
    const rewards = await getMyRewards(pid);
    const welcome = rewards.find((r) => /bienvenida/i.test(r.name));
    if (welcome) {
      hasWelcomeReward = welcome.status === "available";
      // La ventana de 48h corre desde que se otorgó el cupón (al registrarse).
      const created = new Date(welcome.created_at).getTime();
      if (Number.isFinite(created)) {
        welcomeExpiresAt = new Date(created + WELCOME_WINDOW_MS).toISOString();
      }
    }
  }

  return (
    <main className={shell.content}>
      <PremiosClient
        registered={!!pid}
        welcomeDiscountPct={WELCOME_DISCOUNT}
        welcomeExpiresAt={welcomeExpiresAt}
        hasWelcomeReward={hasWelcomeReward}
      />
    </main>
  );
}
