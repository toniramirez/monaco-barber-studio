import Link from "next/link";
import {
  Sparkles,
  Timer,
  Trophy,
  ArrowRight,
  MessageCircle,
  ListChecks,
  Scissors,
  Ticket,
  Gift,
  ShieldCheck,
} from "lucide-react";
import shell from "./Shell.module.css";
import styles from "./Inicio.module.css";
import Countdown from "./Countdown";
import CountUp from "./CountUp";
import HeroFX from "./HeroFX";
import PartidoDelDia from "./PartidoDelDia";
import { getTournament, getParticipantCount, getMatchOfTheDay } from "@/lib/prode/data";
import { getMyState } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Inicio — pantalla de aterrizaje del Prode Mundial 2026.
 * Server Component: trae estado del torneo + jugador + partido del día y arma
 * el embudo (hero → partido del día → cómo funciona → premios → legal).
 * El layout ya provee la topbar y la tabbar; acá sólo vive el carril de contenido.
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
            El Prode Mundial todavía no está disponible. ¡Volvé pronto!
          </p>
        </div>
      </main>
    );
  }

  const [myState, matchOfDay, players] = await Promise.all([
    getMyState(),
    getMatchOfTheDay(tournament.id),
    getParticipantCount(tournament.id),
  ]);

  const lockAt = tournament.predictions_lock_at ?? tournament.starts_at;
  const registered = !!myState;
  // Jugada previa del participante para el Partido del Día (si ya jugó).
  const myMatchPick = matchOfDay
    ? myState?.matches.find((m) => m.match_id === matchOfDay.id) ?? null
    : null;

  return (
    <main className={shell.content}>
      {/* ─────────────────────────── Hero ─────────────────────────── */}
      <section className={styles.hero}>
        <HeroFX />
        <div className={styles.heroInner}>
          <span className={shell.eyebrow}>
            🇦🇷 <Sparkles size={13} aria-hidden="true" /> Mundial 2026 · Monaco
          </span>

          <h1 className={`${shell.shineTitle} ${styles.heroTitle}`}>La Quiniela del Campeón</h1>

          <p className={styles.heroSubtitle}>
            Apostá tus <span className={styles.hl}>fichas</span>, ganá{" "}
            <span className={styles.hl}>cortes</span>. ¿Hasta dónde llega la{" "}
            <span className={styles.hlCeleste}>Scaloneta</span>? Adiviná el Mundial 2026 y ganale a
            la Casa.
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
          <p className={styles.ctaNote}>Gratis · te verificamos por WhatsApp en 20 segundos</p>

          <div className={styles.flagStrip} aria-hidden="true">
            🇦🇷 🇧🇷 🇫🇷 🇪🇸 🇵🇹 🇳🇱 🇩🇪 🇺🇾
          </div>
        </div>
      </section>

      {/* ───────────────────────── Partido del día ───────────────────────── */}
      {matchOfDay && (
        <section className={styles.section}>
          <PartidoDelDia match={matchOfDay} registered={registered} myPick={myMatchPick} />
        </section>
      )}

      {/* ───────────────────────── Cómo funciona ───────────────────────── */}
      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <h2 className={shell.sectionTitle}>
            Cómo <span className={shell.em}>funciona</span>
          </h2>
          <p className={shell.sectionSub}>Tres pasos y estás en cancha</p>
        </header>

        <ol className={styles.steps}>
          <li className={`${shell.card} ${styles.step}`}>
            <span className={styles.stepNum} aria-hidden="true">
              1
            </span>
            <MessageCircle className={styles.stepIcon} size={22} aria-hidden="true" />
            <div className={styles.stepBody}>
              <h3 className={styles.stepTitle}>Entrás en segundos</h3>
              <p className={styles.stepText}>
                Tu nombre y tu WhatsApp. Te mandamos un código y listo.
              </p>
            </div>
          </li>
          <li className={`${shell.card} ${styles.step}`}>
            <span className={styles.stepNum} aria-hidden="true">
              2
            </span>
            <ListChecks className={styles.stepIcon} size={22} aria-hidden="true" />
            <div className={styles.stepBody}>
              <h3 className={styles.stepTitle}>Armás tu Quiniela</h3>
              <p className={styles.stepText}>
                Campeón, goleador, la revelación y hasta dónde llega Argentina.
              </p>
            </div>
          </li>
          <li className={`${shell.card} ${styles.step}`}>
            <span className={styles.stepNum} aria-hidden="true">
              3
            </span>
            <Scissors className={styles.stepIcon} size={22} aria-hidden="true" />
            <div className={styles.stepBody}>
              <h3 className={styles.stepTitle}>Ganás cortes</h3>
              <p className={styles.stepText}>
                Sumás fichas en la tabla y las canjeás por servicios en Monaco.
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* ───────────────────────── Los premios ───────────────────────── */}
      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <h2 className={shell.sectionTitle}>
            Los <span className={shell.em}>premios</span>
          </h2>
          <p className={shell.sectionSub}>Acá todos ganan algo 🏆</p>
        </header>

        <div className={styles.prizes}>
          <article className={`${shell.card} ${styles.prize} ${styles.prizeFeatured}`}>
            <span className={styles.prizeCrown}>👑 Gran premio</span>
            <Trophy className={styles.prizeIcon} size={32} aria-hidden="true" />
            <div className={styles.prizeBody}>
              <h3 className={styles.prizeName}>El campeón del prode</h3>
              <p className={styles.prizeText}>
                Quien más le acierta al Mundial se lleva el gran premio en la final.
              </p>
            </div>
          </article>

          <article className={`${shell.card} ${styles.prize}`}>
            <span className={`${shell.pill} ${shell.pillCeleste} ${styles.prizeTag}`}>
              Para todos
            </span>
            <Ticket className={`${styles.prizeIcon} ${styles.prizeIconCeleste}`} size={28} aria-hidden="true" />
            <div className={styles.prizeBody}>
              <h3 className={styles.prizeName}>Bono de bienvenida</h3>
              <p className={styles.prizeText}>
                20% off en tu primer servicio por sumarte al prode.
              </p>
            </div>
          </article>

          <article className={`${shell.card} ${styles.prize}`}>
            <span className={`${shell.pill} ${shell.pillGold} ${styles.prizeTag}`}>Cada semana</span>
            <Gift className={`${styles.prizeIcon} ${styles.prizeIconGold}`} size={28} aria-hidden="true" />
            <div className={styles.prizeBody}>
              <h3 className={styles.prizeName}>Premio semanal</h3>
              <p className={styles.prizeText}>
                El 1º de la tabla de la semana se lleva un servicio gratis.
              </p>
            </div>
          </article>
        </div>
      </section>

      {/* ───────────────────────── Legal ───────────────────────── */}
      <p className={styles.footNote}>
        <ShieldCheck size={13} className={styles.footIcon} aria-hidden="true" /> Juego gratuito de
        habilidad sin valor monetario. Las “fichas” son puntos del ranking, no dinero ni apuestas.
        Premios = servicios de Monaco Barber Studio. Al participar aceptás las bases y el tratamiento
        de tus datos (Ley 25.326). Tus datos se guardan de forma segura y no se comparten.
      </p>
    </main>
  );
}
