"use client";

/* ════════════════════════════════════════════════════════════════════════
   "El Camino al Título" — HUB / sendero vertical de Desafíos.
   Eje vertical CONTINUO a la izquierda (la "cuerda" del camino), nodos sobre el
   eje y la tarjeta del desafío a la derecha. Se sube desde La Largada (abajo)
   hasta el Gran Premio (la copa, arriba). El tramo recorrido se pinta dorado.
   La Gran Quiniela es un nodo especial (cofre) dentro del mismo flujo.

   Reglas de oro del proyecto:
   · NADA de reloj/aleatoriedad en render (SSR-safe). Sin emojis: sólo íconos.
   · prefers-reduced-motion respetado en TODAS las animaciones.
   · a11y: aria-labels, role/aria en progreso, foco celeste; nodos locked sin foco.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Lock,
  Crown,
  Check,
  ChevronRight,
  Gift,
  Shirt,
  Scissors,
  Sparkles,
  Trophy,
} from "lucide-react";
import { RouletteIcon } from "./RouletteIcon";
import PlayCta from "./PlayCta";
import shell from "./Shell.module.css";
import styles from "./Sendero.module.css";
import type { ChallengeState, ChallengeRewardTier } from "@/lib/prode/types";

type Props = {
  challenges: ChallengeState[];
  displayName: string;
  totalPoints: number;
  /** Torneo cerrado / sólo-lectura: los CTA dicen "Ver". */
  locked: boolean;
};

/* Ícono de la recompensa por tier (lucide, sin emojis). */
function rewardIcon(tier: ChallengeRewardTier) {
  switch (tier) {
    case "month":
      return <Scissors size={13} aria-hidden="true" />;
    case "jersey":
      return <Shirt size={13} aria-hidden="true" />;
    case "roulette":
      return <RouletteIcon size={13} />;
    case "special":
      return <Crown size={13} aria-hidden="true" />;
  }
}

function ctaText(state: ChallengeState["state"], locked: boolean): string {
  if (locked) return state === "locked" ? "Próximamente" : "Ver";
  switch (state) {
    case "open":
      return "Empezar";
    case "in_progress":
      return "Seguir";
    case "completed":
      return "Revisar";
    case "locked":
      return "Próximamente";
  }
}

const spineVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};
const rowVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(5px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function Sendero({ challenges, displayName, totalPoints, locked }: Props) {
  const rm = useReducedMotion();

  // El cofre (La Gran Quiniela, special) se separa para insertarlo como nodo
  // propio en el flujo. El resto arma el camino en orden de torneo.
  const { chest, path } = useMemo(() => {
    let chest: ChallengeState | null = null;
    const path: ChallengeState[] = [];
    for (const c of challenges) {
      if (c.special) chest = c;
      else path.push(c);
    }
    return { chest, path };
  }, [challenges]);

  // Progreso del camino completo (todos los Desafíos, no sólo los desbloqueados):
  // la barra refleja el viaje entero y crece a medida que completás etapas.
  const completedCount = useMemo(
    () => path.filter((c) => c.state === "completed").length,
    [path],
  );
  const journeyTotal = path.length;
  const pct = journeyTotal > 0 ? Math.round((completedCount / journeyTotal) * 100) : 0;

  // Destino del botón "Jugar": el primer Desafío activo (open/in_progress) o, si
  // no hay ninguno abierto, la Gran Quiniela (el cofre, siempre disponible).
  const play = useMemo(() => {
    const active = path.find((c) => c.state === "open" || c.state === "in_progress");
    const target = active ?? chest;
    return {
      href: `/mundial/jugar/${target?.slug ?? "gran-prode"}`,
      label: locked ? "Ver mi Prode" : "Jugar",
    };
  }, [path, chest, locked]);

  // La ficha del jugador descansa sobre el nodo in_progress más avanzado; si no
  // hay ninguno, sobre el último completado.
  const tokenKey = useMemo(() => {
    let inProgress: string | null = null;
    let lastDone: string | null = null;
    path.forEach((c) => {
      if (c.state === "in_progress") inProgress = c.key;
      if (c.state === "completed") lastDone = c.key;
    });
    return inProgress ?? lastDone;
  }, [path]);

  const initial = (displayName?.trim()?.[0] || "?").toUpperCase();

  // Orden visual TOP→BOTTOM = orden del torneo: La Largada arriba, después
  // Desafío 1 … La Final, y la copa (Gran Premio) abajo de todo (el destino).
  // El cofre (Gran Quiniela) se inserta entre la fase de grupos y las
  // eliminatorias (justo después del último Desafío de grupos).
  const rows = useMemo(() => {
    const out: ({ type: "challenge"; c: ChallengeState } | { type: "cofre" })[] = [];
    let cofreDone = false;
    for (const c of path) {
      if (!cofreDone && chest && c.stage !== "group") {
        out.push({ type: "cofre" });
        cofreDone = true;
      }
      out.push({ type: "challenge", c });
    }
    if (!cofreDone && chest) out.push({ type: "cofre" });
    return out;
  }, [path, chest]);

  return (
    <section className={styles.hub} aria-labelledby="sendero-title">
      {/* ── Header: saludo + fichas + progreso global ── */}
      <header className={styles.header}>
        <div className={styles.headTop}>
          <h1 id="sendero-title" className={styles.greeting}>
            Hola, <span className={shell.em}>{displayName || "crack"}</span>
          </h1>
          <span className={`${shell.pillGold} ${styles.coins}`} aria-label={`${totalPoints} fichas`}>
            <Trophy size={13} aria-hidden="true" />
            <strong>{totalPoints}</strong> fichas
          </span>
        </div>
        <p className={styles.headSub}>Seguí el camino: cada Desafío, más cortes en juego</p>

        <div className={styles.progress}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progreso del camino: ${completedCount} de ${journeyTotal} desafíos`}
          >
            <motion.span
              className={styles.progressFill}
              initial={rm ? false : { width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={rm ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            />
          </div>
          <span className={styles.progressLabel} role="status" aria-live="polite">
            {completedCount}/{journeyTotal} desafíos
          </span>
        </div>
      </header>

      {/* ── CTA: Jugar (al Desafío activo) + Jugar con amigos (crear liga) ── */}
      <PlayCta playHref={play.href} playLabel={play.label} displayName={displayName} />

      {/* ── El camino ── */}
      <motion.div
        className={styles.spine}
        variants={rm ? undefined : spineVariants}
        initial={rm ? false : "hidden"}
        animate={rm ? undefined : "show"}
      >
        {/* LARGADA — el inicio del camino, arriba de todo (acá abre el Desafío 1). */}
        <motion.div variants={rm ? undefined : rowVariants} className={styles.largadaRow} aria-hidden="true">
          <div className={styles.rail}>
            <span className={`${styles.line} ${styles.lineGold} ${styles.lineFromCenter}`} />
            <span className={styles.largadaDot} />
          </div>
          <span className={styles.largadaLabel}>La largada</span>
        </motion.div>

        {rows.map((r, i) => {
          const last = i === rows.length - 1;
          return r.type === "cofre" ? (
            <CofreRow key="cofre" chest={chest!} locked={locked} rm={!!rm} last={last} />
          ) : (
            <PathRow
              key={r.c.key}
              c={r.c}
              locked={locked}
              rm={!!rm}
              last={last}
              token={r.c.key === tokenKey && tokenKey !== null ? { initial, rm: !!rm } : null}
            />
          );
        })}

        {/* META — Gran Premio (la copa, abajo de todo: el destino del camino). */}
        <motion.div variants={rm ? undefined : rowVariants} className={styles.goalRow}>
          <Link href="/mundial/premios" className={styles.goalNode} aria-label="La meta: el Gran Premio. Ver premios">
            <span className={styles.goalGlow} aria-hidden="true" />
            <span className={styles.goalCrown} aria-hidden="true">
              <Crown size={28} />
            </span>
            <span className={styles.goalText}>
              <strong>El Gran Premio</strong>
              <small>La meta: 1 año de cortes + camiseta</small>
            </span>
            <ChevronRight size={18} className={styles.goalChevron} aria-hidden="true" />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ───────────────────────── Fila de un nodo del camino ───────────────────────── */
function PathRow({
  c,
  locked,
  rm,
  last,
  token,
}: {
  c: ChallengeState;
  locked: boolean;
  rm: boolean;
  last: boolean;
  token: { initial: string; rm: boolean } | null;
}) {
  const isLocked = c.state === "locked";
  const pct = c.total > 0 ? Math.min(100, Math.round((c.done / c.total) * 100)) : 0;
  // El tramo está "recorrido" (dorado) si ya lo jugaste o lo estás jugando.
  const reached = c.state === "completed" || c.state === "in_progress";

  const stateClass =
    c.state === "completed"
      ? styles.nodeCompleted
      : c.state === "in_progress"
        ? styles.nodeProgress
        : c.state === "open"
          ? styles.nodeOpen
          : styles.nodeLocked;

  // La cuerda baja desde La Largada (arriba). La última fila (La Final) corta en
  // el centro de su nodo para no asomar hacia la copa que va abajo.
  const lineCls = `${styles.line} ${reached ? styles.lineGold : styles.lineDashed} ${last ? styles.lineToCenter : ""}`;

  const aria = isLocked
    ? `${c.title}. Bloqueado, ${c.subtitle}. Recompensa: ${c.reward.label}`
    : `${c.title}. ${c.done} de ${c.total} jugados. Recompensa: ${c.reward.label}. ${ctaText(c.state, locked)}`;

  const inner = (
    <>
      <div className={styles.rail}>
        <span className={lineCls} aria-hidden="true" />
        <div className={`${styles.node} ${stateClass}`}>
          {c.state === "in_progress" && (
            <span className={styles.ring} aria-hidden="true" style={{ ["--pct" as string]: `${pct}%` }} />
          )}
          <span className={styles.nodeFace}>
            {c.state === "completed" ? (
              <Check size={28} strokeWidth={3} className={styles.checkIcon} aria-hidden="true" />
            ) : isLocked ? (
              <Lock size={22} className={styles.lockIcon} aria-hidden="true" />
            ) : (
              <span className={styles.ballEmoji} aria-hidden="true">⚽</span>
            )}
          </span>
          {token && (
            <motion.span
              className={styles.token}
              aria-hidden="true"
              {...(token.rm
                ? {}
                : {
                    // x: "-50%" preserva el centrado (.token usa translateX(-50%));
                    // si sólo animáramos y, framer pisa el transform y la ficha se
                    // corre a la derecha. Mantenemos el centrado + el flote vertical.
                    initial: { x: "-50%", y: 0 },
                    animate: { x: "-50%", y: [0, -5, 0] },
                    transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
                  })}
            >
              <span className={styles.tokenFace}>{token.initial}</span>
            </motion.span>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTop}>
          <span className={styles.short}>{c.short}</span>
          {isLocked ? (
            <span className={styles.soon}>Próximamente</span>
          ) : (
            <span className={styles.count}>
              {c.done}/{c.total}
            </span>
          )}
        </div>
        <h2 className={styles.cardTitle}>{c.title}</h2>
        <p className={styles.cardSub}>{c.subtitle}</p>
        <div className={styles.cardFoot}>
          <span
            className={`${styles.reward} ${styles[`reward_${c.reward.tier}`] || ""} ${isLocked ? styles.rewardLocked : ""}`}
          >
            {rewardIcon(c.reward.tier)}
            {c.reward.label}
          </span>
          {!isLocked && (
            <span className={styles.cta}>
              {ctaText(c.state, locked)}
              <ChevronRight size={14} aria-hidden="true" />
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <motion.div variants={rm ? undefined : rowVariants} className={styles.rowWrap}>
      {isLocked ? (
        <div className={`${styles.row} ${styles.rowLocked}`} role="group" aria-disabled="true" tabIndex={-1} aria-label={aria}>
          {inner}
        </div>
      ) : (
        <Link href={`/mundial/jugar/${c.slug}`} className={styles.row} aria-label={aria}>
          {inner}
        </Link>
      )}
    </motion.div>
  );
}

/* ───────────────────────── Cofre — La Gran Quiniela (nodo especial) ───────────────────────── */
function CofreRow({
  chest,
  locked,
  rm,
  last,
}: {
  chest: ChallengeState;
  locked: boolean;
  rm: boolean;
  last: boolean;
}) {
  const reached = chest.state === "completed" || chest.state === "in_progress";
  const lineCls = `${styles.line} ${reached ? styles.lineGold : styles.lineDashed} ${last ? styles.lineToCenter : ""}`;
  const aria = `${chest.title}, siempre disponible. ${chest.done} de ${chest.total} respondidas. Recompensa: ${chest.reward.label}. ${
    locked ? "Ver" : chest.state === "completed" ? "Revisar" : chest.done > 0 ? "Seguir" : "Empezar"
  }`;

  return (
    <motion.div variants={rm ? undefined : rowVariants} className={styles.rowWrap}>
      <Link href="/mundial/jugar/gran-prode" className={`${styles.row} ${styles.cofreRow}`} aria-label={aria}>
        <div className={styles.rail}>
          <span className={lineCls} aria-hidden="true" />
          <div className={`${styles.node} ${styles.cofreNode}`}>
            <span className={styles.nodeFace}>
              <Gift size={26} className={styles.checkIcon} aria-hidden="true" />
            </span>
            {chest.state === "completed" && (
              <span className={styles.cofreDone} aria-hidden="true">
                <Sparkles size={12} />
              </span>
            )}
          </div>
        </div>

        <div className={`${styles.card} ${styles.cofreCard}`}>
          <div className={styles.cardTop}>
            <span className={styles.short}>Especial</span>
            <span className={styles.count}>
              {chest.done}/{chest.total}
            </span>
          </div>
          <h2 className={styles.cardTitle}>{chest.title}</h2>
          <p className={styles.cardSub}>{chest.subtitle}</p>
          <div className={styles.cardFoot}>
            <span className={`${styles.reward} ${styles.reward_special}`}>
              <Crown size={13} aria-hidden="true" /> {chest.reward.label}
            </span>
            {!locked && (
              <span className={styles.cta}>
                {chest.state === "completed" ? "Revisar" : chest.done > 0 ? "Seguir" : "Empezar"}
                <ChevronRight size={14} aria-hidden="true" />
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
