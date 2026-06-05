import Link from "next/link";
import Image from "next/image";
import { Sparkles, Timer, Trophy, ArrowRight, Gift } from "lucide-react";
import shell from "./Shell.module.css";
import styles from "./Inicio.module.css";
import Countdown from "./Countdown";
import CountUp from "./CountUp";
import HeroFX from "./HeroFX";
import { getTournament, getParticipantCount } from "@/lib/prode/data";

export const dynamic = "force-dynamic";

/**
 * Inicio — SOLO el hero. Portada de juego (no landing scrolleable): título,
 * countdown al cierre, prueba social, CTA gigante y la tira de banderas viva.
 * Todo lo demás (cómo se juega, partido, premios, legal) vive en Jugar/Premios.
 */
export default async function MundialPage() {
  const tournament = await getTournament();

  if (!tournament) {
    return (
      <main className={shell.content}>
        <div className={shell.gate}>
          <Sparkles className={shell.gateIcon} size={40} aria-hidden="true" />
          <h1 className={shell.sectionTitle}>El Prode todavía no arrancó</h1>
          <p className={shell.sectionSub}>
            La Quiniela del Campeón se está preparando. ¡Volvé pronto, crack!
          </p>
        </div>
      </main>
    );
  }

  const players = await getParticipantCount(tournament.id);
  const lockAt = tournament.predictions_lock_at ?? tournament.starts_at;

  return (
    <main className={`${shell.content} ${styles.homeMain}`}>
      <section className={styles.hero}>
        <HeroFX />
        {/* Arena de fondo: la pelota reventando la red, tenue, fundida hacia los bordes.
            Vía next/image (AVIF/WebP optimizado) en vez del PNG crudo de 1.8MB. */}
        <div className={styles.heroArena} aria-hidden="true">
          <Image
            src="/fondo_prode.png"
            alt=""
            fill
            priority
            sizes="(max-width: 560px) 100vw, 560px"
            className={styles.heroArenaImg}
          />
        </div>

        <div className={styles.heroInner}>
          <span className={shell.eyebrow}>
            🇦🇷 <Sparkles size={13} aria-hidden="true" /> Mundial 2026 · Monaco
          </span>

          <h1 className={`${shell.shineTitle} ${styles.heroTitle}`}>La Quiniela del Campeón</h1>

          <p className={styles.heroSubtitle}>
            Adiviná el Mundial y ganale a la <span className={styles.hlCeleste}>Casa</span>.{" "}
            <span className={styles.hl}>Cortes gratis</span> y la camiseta en juego.
          </p>

          <div className={styles.countdownWrap}>
            <span className={styles.countdownLabel}>
              <Timer size={13} aria-hidden="true" /> Falta para que cierre la quiniela
            </span>
            <Countdown target={lockAt} />
          </div>

          <div className={styles.heroMeta}>
            <span className={`${shell.pill} ${styles.metaPill}`}>
              <CountUp to={players} className={styles.metaNum} />{" "}
              {players === 1 ? "ya juega" : "ya juegan"}
            </span>
            <span className={`${shell.pill} ${shell.pillGold} ${styles.metaPill}`}>
              <Trophy size={14} aria-hidden="true" /> Cortes gratis en juego
            </span>
          </div>

          <Link href="/mundial/jugar" className={`${shell.btnPrimary} ${styles.heroCta}`}>
            Jugar gratis <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <p className={styles.ctaNote}>Gratis · entrás con un PIN de 4 dígitos</p>

          <Link href="/mundial/premios" className={styles.prizesPeek}>
            <Gift size={14} aria-hidden="true" /> Mirá los premios
          </Link>

          {/* Tira de banderas en movimiento (marquee, duplicada para loop sin corte) */}
          <div className={styles.flagMarquee} aria-hidden="true">
            <div className={styles.flagTrack}>
              <span>🇦🇷 🇧🇷 🇫🇷 🇪🇸 🇵🇹 🇳🇱 🇩🇪 🇺🇾 🇲🇽 🇬🇧 🇭🇷 🇲🇦</span>
              <span>🇦🇷 🇧🇷 🇫🇷 🇪🇸 🇵🇹 🇳🇱 🇩🇪 🇺🇾 🇲🇽 🇬🇧 🇭🇷 🇲🇦</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
