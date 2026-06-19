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
  Lock,
  CalendarDays,
  CheckCircle2,
  Hourglass,
} from "lucide-react";
import shell from "../Shell.module.css";
import styles from "./Premios.module.css";
import Countdown from "../Countdown";
import {
  couponPhase,
  weekdayPhraseShort,
  weekdayPhraseLong,
  fmtDateAR,
  type CouponView,
} from "@/lib/prode/coupon";

type Props = {
  registered: boolean;
  welcomeDiscountPct: number;
  /** Vista temporal del cupón de bienvenida del jugador (null si no está registrado). */
  welcome: CouponView | null;
  /** Días canjeables del catálogo (fallback para invitados, que no tienen cupón aún). */
  ruleWeekdays: number[] | null;
  /** Validez en días del cupón (catálogo) — para comunicar la ventana sin hardcodear. */
  validityDays: number;
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
  welcome,
  ruleWeekdays,
  validityDays,
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
        welcome={welcome}
        ruleWeekdays={ruleWeekdays}
        validityDays={validityDays}
      />

      <JerseyHero />

      <GrandPrize />

      <MembershipShowcase />

      <Reveal className={styles.footNote}>
        <ShieldCheck size={14} className={styles.footIcon} aria-hidden="true" />
        Juego gratuito de habilidad sin valor monetario. Las fichas son puntos del
        ranking, no dinero ni apuestas. Premios = servicios de Monaco Barber Studio.
        Al participar aceptás las bases y el tratamiento de tus datos (Ley 25.326).
      </Reveal>
    </>
  );
}

/* ─────────────────────────── 1 · Ticket de bienvenida ───────────────────────────
   El cupón tiene reglas reales del backend: cooldown de 2 h (recién canjeable un
   rato DESPUÉS de crear la cuenta → es para la próxima visita, no para mientras te
   cortás) + ventana lun–mié + 15 días. La fase se calcula con el reloj del cliente
   (`useNowMs`): en SSR/primer render es null → estado neutro idéntico al server (sin
   romper hidratación); ya en el cliente conmuta a cooldown/activo/etc. */
function WelcomeTicket({
  registered,
  welcomeDiscountPct,
  welcome,
  ruleWeekdays,
  validityDays,
}: {
  registered: boolean;
  welcomeDiscountPct: number;
  welcome: CouponView | null;
  ruleWeekdays: number[] | null;
  validityDays: number;
}) {
  const now = useNowMs();
  const ready = now !== null;

  // Días a mostrar: si hay cupón del jugador, los suyos; si es invitado, los del catálogo.
  const displayWeekdays = welcome ? welcome.redeemableWeekdays : ruleWeekdays;
  const weekdaysShort = weekdayPhraseShort(displayWeekdays);
  const weekdaysLong = weekdayPhraseLong(displayWeekdays);

  // Fase: sólo con reloj de cliente. En SSR/primer render → null (estado neutro).
  const phase = ready && welcome ? couponPhase(welcome, now) : null;
  const inCooldown = phase === "cooldown";
  const isMissed = phase === "redeemed" || phase === "expired";

  const lead = !registered
    ? "Sumate al Prode y es tuyo para tu próxima visita."
    : phase === "redeemed"
      ? `Ya usaste tu ${welcomeDiscountPct}% — seguí jugando, hay más.`
      : phase === "expired"
        ? "Tu ventana se cerró — seguí jugando, hay más premios."
        : "Tu regalo por sumarte al Prode.";

  // Target del reloj: cooldown → activación; activo → vencimiento.
  const timerTarget = inCooldown ? welcome?.activatesAt ?? null : welcome?.expiresAt ?? null;
  const showTimer = registered && !!welcome && !isMissed && !!timerTarget;

  // Las reglas-chip se muestran cuando no hay una nota dedicada (cooldown/off-day) ni
  // el estado terminal: invitado, estado neutro y "activo hoy".
  const showRules = !isMissed && !(ready && (inCooldown || phase === "active_off_day"));

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
      <p className={styles.ticketLead}>{lead}</p>

      {/* Chip de estado (sólo con reloj de cliente, para no romper la hidratación) */}
      {ready && registered && welcome && !isMissed && (
        inCooldown ? (
          <span className={`${styles.ticketStatus} ${styles.statusCooldown}`}>
            <Lock size={13} aria-hidden="true" /> Se activa pronto
          </span>
        ) : phase === "active_today" ? (
          <span className={`${styles.ticketStatus} ${styles.statusActive}`}>
            <CheckCircle2 size={13} aria-hidden="true" /> Activo · hoy sí
          </span>
        ) : (
          <span className={`${styles.ticketStatus} ${styles.statusOff}`}>
            <CalendarDays size={13} aria-hidden="true" /> Canjeable {weekdaysShort}
          </span>
        )
      )}

      {showTimer && (
        <div className={styles.ticketTimer}>
          <span
            className={`${styles.ticketTimerLabel} ${inCooldown ? styles.ticketTimerLabelCooldown : ""}`}
          >
            <Clock size={13} aria-hidden="true" />{" "}
            {inCooldown ? "Se activa en" : `Tu ${welcomeDiscountPct}% vence en`}
          </span>
          <Countdown
            target={timerTarget!}
            compact={inCooldown}
            zero={null}
            ariaLabel="Tiempo del cupón de bienvenida"
          />
        </div>
      )}

      {/* Nota contextual según la fase */}
      {ready && inCooldown && (
        <p className={`${styles.ticketNote} ${styles.noteCooldown}`} role="status">
          <Lock size={15} aria-hidden="true" />
          Es para tu próxima visita: se activa 2&nbsp;h después de crear tu cuenta. Después lo canjeás {weekdaysLong}
          {welcome?.expiresAt ? ` (válido hasta el ${fmtDateAR(welcome.expiresAt)})` : ""}.
        </p>
      )}
      {ready && phase === "active_off_day" && (
        <p className={`${styles.ticketNote} ${styles.noteOff}`} role="status">
          <CalendarDays size={15} aria-hidden="true" />
          Hoy no — tu {welcomeDiscountPct}% se canjea {weekdaysLong}. ¡Te esperamos!
        </p>
      )}
      {isMissed && (
        <p className={styles.ticketExpired} role="status">
          <Clock size={15} aria-hidden="true" />
          {phase === "redeemed"
            ? `Ya canjeaste tu ${welcomeDiscountPct}% — seguí jugando, hay más premios.`
            : "Se te pasó — pero seguí jugando, hay más premios."}
        </p>
      )}

      {showRules && (
        <ul className={styles.ticketRules} aria-label="Cómo funciona el cupón">
          <li>
            <Lock size={12} aria-hidden="true" /> Se activa 2&nbsp;h después
          </li>
          <li>
            <CalendarDays size={12} aria-hidden="true" /> Canjeable {weekdaysShort}
          </li>
          <li>
            <Hourglass size={12} aria-hidden="true" /> Vale {validityDays} días
          </li>
        </ul>
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
        {registered
          ? "Mostrale el QR al barbero en Monaco. Una vez por persona."
          : "Canjealo en tu próxima visita a Monaco. Una vez por persona."}
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
        {/* Etiqueta del lado visible: vive FUERA de la tarjeta que rota. Si estuviera
            dentro del back-face, en algunos navegadores/GPUs el texto del dorso se
            espeja (se ve "MESSI" al revés). Acá sólo cambia el texto, nunca rota. */}
        <span className={styles.jerseyFaceLabel} aria-hidden="true">
          {flipped ? "MESSI · 10" : "Frente"}
        </span>
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
        La camiseta de la selección. <strong>Se la lleva el podio del Gran Premio</strong>:
        el 1º, 2º y 3º de la tabla general al final del Mundial.
      </p>
    </Reveal>
  );
}

/* ─────────────────────────── 3 · Gran Premio (podio) ─────────────────────────── */
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

/* ─────────────────────────── 4 · Las membresías (premios reales) ─────────────────────────── */
type Membership = {
  src: string;
  alt: string;
  rank: string;
  tierCls: string;
};

const MEMBERSHIPS: Membership[] = [
  {
    src: "/memberships/1_ano.png",
    alt: "Membresía Monaco — 1 año de cortes gratis",
    rank: "1° · Campeón",
    tierCls: "membership_gold",
  },
  {
    src: "/memberships/6_meses.png",
    alt: "Membresía Monaco — 6 meses de cortes gratis",
    rank: "2° puesto",
    tierCls: "membership_silver",
  },
  {
    src: "/memberships/3_meses.png",
    alt: "Membresía Monaco — 3 meses de cortes gratis",
    rank: "3° puesto",
    tierCls: "membership_bronze",
  },
];

function MembershipShowcase() {
  return (
    <Reveal className={styles.section} aria-labelledby="membership-title">
      <div className={styles.challengeHead}>
        <span className={shell.eyebrow}>
          <Crown size={13} /> Membresías
        </span>
        <h2 id="membership-title" className={shell.sectionTitle} style={{ marginTop: "0.6rem" }}>
          Cortes gratis, en serio
        </h2>
        <p className={styles.membershipSub}>
          El podio del Gran Premio se lleva una membresía Monaco. Deslizá para verlas.
        </p>
      </div>

      <div className={styles.membershipRow}>
        {MEMBERSHIPS.map((m) => (
          <figure key={m.src} className={styles.membershipCard}>
            <Image
              src={m.src}
              alt={m.alt}
              width={1254}
              height={1254}
              className={styles.membershipImg}
              loading="lazy"
              sizes="(max-width: 560px) 80vw, 300px"
            />
            <figcaption className={`${styles.membershipCaption} ${styles[m.tierCls]}`}>
              {m.rank}
            </figcaption>
          </figure>
        ))}
      </div>
    </Reveal>
  );
}
