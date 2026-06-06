"use client";

import { useCallback, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useNowMs } from "@/lib/prode/clock";
import {
  Ticket,
  Gift,
  Crown,
  Shirt,
  RotateCw,
  Trophy,
  ChevronRight,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  Medal,
} from "lucide-react";
import shell from "../Shell.module.css";
import styles from "./Premios.module.css";
import Countdown from "../Countdown";
import { RouletteIcon } from "../RouletteIcon";

type Props = {
  registered: boolean;
  welcomeDiscountPct: number;
  welcomeExpiresAt: string | null;
  hasWelcomeReward: boolean;
};

/* Entrada con stagger al entrar en viewport (una sola vez). Reduced-motion la
   neutraliza vía la variante `still`. */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  still: { opacity: 1, y: 0 },
};

/** Bloque animado que sube al entrar en pantalla (o queda quieto en reduced-motion). */
function Reveal({
  children,
  className,
  delay = 0,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
} & React.ComponentProps<typeof motion.section>) {
  const rm = useReducedMotion();
  return (
    <motion.section
      className={className}
      variants={fadeUp}
      initial={rm ? "still" : "hidden"}
      whileInView={rm ? "still" : "show"}
      viewport={{ once: true, amount: 0.25 }}
      transition={rm ? undefined : { delay }}
      {...rest}
    >
      {children}
    </motion.section>
  );
}

export default function PremiosClient({
  registered,
  welcomeDiscountPct,
  welcomeExpiresAt,
  hasWelcomeReward,
}: Props) {
  return (
    <>
      <header className={styles.head}>
        <span className={`${shell.eyebrow} ${styles.headEyebrow}`}>
          <Gift size={13} /> Premios
        </span>
        <h1 className={shell.sectionTitle}>
          Acá ganás <span className={shell.em}>cortes de verdad</span>
        </h1>
      </header>

      <WelcomeTicket
        registered={registered}
        welcomeDiscountPct={welcomeDiscountPct}
        welcomeExpiresAt={welcomeExpiresAt}
        hasWelcomeReward={hasWelcomeReward}
      />

      <JerseyHero />

      <ChallengePrizes />

      <GrandPrize />

      <Reveal className={styles.footNote}>
        <ShieldCheck size={14} className={styles.footIcon} aria-hidden="true" />
        Juego gratuito de habilidad sin valor monetario. Las fichas son puntos del
        ranking, no dinero ni apuestas. Premios = servicios de Monaco Barber Studio.
        Al participar aceptás las bases y el tratamiento de tus datos (Ley 25.326).
      </Reveal>
    </>
  );
}

/* ─────────────────────────── 1 · Ticket de bienvenida ─────────────────────────── */
function WelcomeTicket({
  registered,
  welcomeDiscountPct,
  welcomeExpiresAt,
  hasWelcomeReward,
}: Props) {
  // "Se te pasó" si está registrado y ya no tiene el cupón disponible, o si la
  // ventana de 48h ya venció. El reloj se lee vía useNow (null en SSR) para no
  // romper la hidratación: en el server expired=false y, ya en el cliente, si la
  // fecha pasó conmutamos a estado "vencido" (el Countdown llega a su fin a la par).
  const now = useNowMs();
  const expired =
    now !== null && welcomeExpiresAt
      ? new Date(welcomeExpiresAt).getTime() <= now
      : false;
  const missed = registered && (!hasWelcomeReward || expired);
  const showTimer = registered && !!welcomeExpiresAt && !missed;

  return (
    <Reveal
      className={`${shell.card} ${shell.cardTopline} ${styles.ticket}`}
      aria-labelledby="ticket-title"
    >
      <span className={styles.ticketPerf} aria-hidden="true" />
      <span className={styles.ticketShine} aria-hidden="true" />

      <span className={`${shell.pillCeleste} ${styles.ticketTag}`}>
        <Ticket size={13} /> Cupón de bienvenida
      </span>

      <h2 id="ticket-title" className={styles.ticketAmount}>
        {welcomeDiscountPct}
        <span className={styles.pct}>% OFF</span>
      </h2>
      <p className={styles.ticketLead}>
        {registered
          ? "Tu regalo por sumarte al Prode."
          : "Registrate y arrancás el reloj de 48h."}
      </p>

      {showTimer && (
        <div className={styles.ticketTimer}>
          <span className={styles.ticketTimerLabel}>
            <Clock size={13} aria-hidden="true" /> Tu {welcomeDiscountPct}% vence en
          </span>
          <Countdown target={welcomeExpiresAt!} />
        </div>
      )}

      {missed && (
        <p className={styles.ticketExpired} role="status">
          <Clock size={15} aria-hidden="true" />
          Se te pasó — pero seguí jugando, hay más premios.
        </p>
      )}

      {registered ? (
        <Link
          href="/mundial/cuenta"
          className={`${shell.btnPrimary} ${styles.ticketCta}`}
        >
          Ver mi cupón <ChevronRight size={18} aria-hidden="true" />
        </Link>
      ) : (
        <Link
          href="/mundial/jugar"
          className={`${shell.btnPrimary} ${styles.ticketCta}`}
        >
          Jugar gratis <ArrowRight size={18} aria-hidden="true" />
        </Link>
      )}

      <p className={styles.ticketHint}>
        Canjealo en tu primer corte en Monaco. Una vez por persona.
      </p>
    </Reveal>
  );
}

/* ─────────────────────────── 2 · La camiseta (héroe) ─────────────────────────── */
function JerseyHero() {
  const rm = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const toggle = useCallback(() => setFlipped((f) => !f), []);

  return (
    <Reveal
      className={`${shell.card} ${styles.jerseyBlock}`}
      aria-labelledby="jersey-title"
    >
      <span className={`${shell.pillGold} ${styles.jerseyTag}`}>
        <Shirt size={13} /> El premio que todos quieren
      </span>
      <h2 id="jersey-title" className={`${shell.shineTitle}`} style={{ fontWeight: 900, fontSize: "clamp(1.4rem, 6vw, 1.9rem)", lineHeight: 1.1 }}>
        La camiseta de la selección
      </h2>

      {/* Wrapper externo: float idle (no acumula con la rotación del flip). */}
      <motion.div
        className={styles.jerseyStage}
        animate={rm ? undefined : { y: [0, -9, 0] }}
        transition={rm ? undefined : { duration: 5, ease: "easeInOut", repeat: Infinity }}
      >
        {rm ? (
          // Reduced-motion: crossfade sin rotación 3D ni float.
          <button
            type="button"
            className={styles.jerseyCard}
            onClick={toggle}
            aria-label={flipped ? "Ver el frente de la camiseta" : "Ver la espalda de la camiseta"}
            aria-pressed={flipped}
          >
            <motion.div
              className={styles.jerseyFace}
              animate={{ opacity: flipped ? 0 : 1 }}
              transition={{ duration: 0.25 }}
              style={{ backfaceVisibility: "visible" }}
            >
              <Image
                src="/camiseta_frente.png"
                alt="Camiseta de la selección — frente"
                width={280}
                height={373}
                className={styles.jerseyImg}
                loading="lazy"
                sizes="(max-width: 360px) 240px, 280px"
              />
            </motion.div>
            <motion.div
              className={styles.jerseyFace}
              animate={{ opacity: flipped ? 1 : 0 }}
              transition={{ duration: 0.25 }}
              style={{ backfaceVisibility: "visible", transform: "none" }}
            >
              <Image
                src="/camiseta_atras.png"
                alt="Camiseta de la selección — espalda con MESSI 10"
                width={280}
                height={373}
                className={styles.jerseyImg}
                loading="lazy"
                sizes="(max-width: 360px) 240px, 280px"
              />
            </motion.div>
          </button>
        ) : (
          <motion.button
            type="button"
            className={styles.jerseyCard}
            onClick={toggle}
            aria-label={flipped ? "Ver el frente de la camiseta" : "Ver la espalda de la camiseta"}
            aria-pressed={flipped}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 130, damping: 14, mass: 0.9 }}
          >
            <span className={styles.jerseyFace} aria-hidden={flipped}>
              <span className={styles.jerseyFaceLabel}>Frente</span>
              <Image
                src="/camiseta_frente.png"
                alt="Camiseta de la selección — frente"
                width={280}
                height={373}
                className={styles.jerseyImg}
                loading="lazy"
                sizes="(max-width: 360px) 240px, 280px"
              />
            </span>
            <span className={`${styles.jerseyFace} ${styles.jerseyFaceBack}`} aria-hidden={!flipped}>
              <span className={styles.jerseyFaceLabel}>MESSI · 10</span>
              <Image
                src="/camiseta_atras.png"
                alt="Camiseta de la selección — espalda con MESSI 10"
                width={280}
                height={373}
                className={styles.jerseyImg}
                loading="lazy"
                sizes="(max-width: 360px) 240px, 280px"
              />
            </span>
          </motion.button>
        )}
      </motion.div>

      <button
        type="button"
        className={styles.jerseyTwirl}
        onClick={toggle}
        aria-pressed={flipped}
        aria-label={flipped ? "Ver el frente de la camiseta" : "Ver la espalda de la camiseta"}
      >
        <RotateCw size={15} aria-hidden="true" /> Girar
      </button>

      <p className={styles.jerseyCopy}>
        La camiseta de la selección. <strong>Se la lleva quien llega lejos</strong>: de
        16vos para arriba y todo el podio del Gran Premio.
      </p>
    </Reveal>
  );
}

/* ─────────────────────────── 3 · Premios por desafío ─────────────────────────── */
type Challenge = {
  phase: string;
  reward: React.ReactNode;
  ico: React.ReactNode;
  note: string;
  thumb?: boolean;
  teaser?: boolean;
};

const CHALLENGES: Challenge[] = [
  {
    phase: "D1 · D2 · D3",
    ico: <Trophy size={20} aria-hidden="true" />,
    reward: <>1 mes de cortes gratis</>,
    note: "Salís 1º de la fecha → es tuyo.",
  },
  {
    phase: "16vos · 8vos",
    ico: <Shirt size={20} aria-hidden="true" />,
    reward: <>1 mes + camiseta</>,
    note: "Ganás el desafío y te llevás la de la selección.",
    thumb: true,
  },
  {
    phase: "4tos · Semis · 3er · Final",
    ico: <RouletteIcon size={20} />,
    reward: <>Ruleta por puntos</>,
    note: "Se activa en fase final.",
    teaser: true,
  },
];

function ChallengePrizes() {
  const rm = useReducedMotion();
  return (
    <Reveal className={styles.section} aria-labelledby="challenge-title">
      <div className={styles.challengeHead}>
        <span className={shell.eyebrow}>
          <Trophy size={13} /> Por desafío
        </span>
        <h2
          id="challenge-title"
          className={shell.sectionTitle}
          style={{ marginTop: "0.6rem" }}
        >
          Premio en cada ronda
        </h2>
      </div>

      <motion.div
        className={styles.challengeList}
        variants={
          rm ? undefined : { show: { transition: { staggerChildren: 0.08 } } }
        }
        initial={false}
        whileInView={rm ? undefined : "show"}
        viewport={{ once: true, amount: 0.2 }}
      >
        {CHALLENGES.map((c) => (
          <motion.div
            key={c.phase}
            className={`${shell.card} ${styles.challenge} ${c.teaser ? styles.challengeTeaser : ""}`}
            variants={rm ? undefined : fadeUp}
          >
            {c.thumb ? (
              <span className={styles.challengeThumb} aria-hidden="true">
                <Image
                  src="/camiseta_frente.png"
                  alt=""
                  width={46}
                  height={56}
                  className={styles.challengeThumbImg}
                  loading="lazy"
                  sizes="46px"
                />
              </span>
            ) : (
              <span className={styles.challengeIco} aria-hidden="true">
                {c.ico}
              </span>
            )}

            <div className={styles.challengeBody}>
              <span className={styles.challengePhase}>{c.phase}</span>
              <p className={styles.challengeName}>
                <span className={styles.reward}>{c.reward}</span>
                {c.teaser && <span className={styles.teaserChip}>Pronto</span>}
              </p>
              <p className={styles.challengeText}>{c.note}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </Reveal>
  );
}

/* ─────────────────────────── 4 · Gran Premio (podio) ─────────────────────────── */
type Podium = {
  rank: number;
  medalCls: string;
  span: string;
  step: string;
  reward: React.ReactNode;
  crown?: boolean;
};

const PODIUM: Podium[] = [
  {
    rank: 2,
    medalCls: styles.medalSilver,
    span: styles.step2,
    step: "step2",
    reward: (
      <>
        6 MESES
        <span className={styles.mo}>+ camiseta</span>
      </>
    ),
  },
  {
    rank: 1,
    medalCls: styles.medalGold,
    span: styles.step1,
    step: "step1",
    crown: true,
    reward: (
      <>
        1 AÑO gratis
        <span className={styles.mo}>+ camiseta</span>
      </>
    ),
  },
  {
    rank: 3,
    medalCls: styles.medalBronze,
    span: styles.step3,
    step: "step3",
    reward: (
      <>
        3 MESES
        <span className={styles.mo}>+ camiseta</span>
      </>
    ),
  },
];

function GrandPrize() {
  const rm = useReducedMotion();
  return (
    <Reveal
      className={`${shell.card} ${styles.grandPrize}`}
      aria-labelledby="grand-title"
    >
      <span className={`${shell.pillGold} ${styles.grandTag}`}>
        <Sparkles size={13} /> El Gran Premio
      </span>
      <h2 id="grand-title" className={`${shell.shineTitle} ${styles.grandTitle}`}>
        El podio de campeones
      </h2>
      <p className={styles.grandSub}>Tabla general · al final del Mundial</p>

      <div className={styles.podium} role="list" aria-label="Podio del Gran Premio">
        {PODIUM.map((p, i) => (
          <div className={styles.podiumCol} role="listitem" key={p.rank}>
            <div className={styles.podiumPlate}>
              {p.crown && (
                <Crown
                  size={22}
                  className={styles.podiumCrown}
                  aria-hidden="true"
                />
              )}
              <span className={`${styles.podiumMedal} ${p.medalCls}`} aria-hidden="true">
                <Medal size={22} />
              </span>
              <span className={styles.podiumJersey} aria-hidden="true">
                <Image
                  src="/camiseta_frente.png"
                  alt=""
                  width={50}
                  height={60}
                  className={styles.podiumJerseyImg}
                  loading="lazy"
                  sizes="50px"
                />
              </span>
              <span className={styles.podiumReward}>
                <span className={shell.srOnly}>
                  {p.rank}º puesto:{" "}
                </span>
                {p.reward}
              </span>
            </div>

            <motion.div
              className={`${styles.podiumStep} ${p.span}`}
              initial={rm ? false : { scaleY: 0 }}
              whileInView={rm ? undefined : { scaleY: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={
                rm
                  ? undefined
                  : { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 + i * 0.12 }
              }
            >
              <span className={styles.podiumRank}>{p.rank}</span>
            </motion.div>
          </div>
        ))}
      </div>

      <p className={styles.grandFoot}>
        <Trophy size={13} style={{ verticalAlign: "-2px", marginRight: "0.3rem", color: "var(--gold)" }} aria-hidden="true" />
        Las 3 con la camiseta de la selección incluida.
      </p>
    </Reveal>
  );
}
