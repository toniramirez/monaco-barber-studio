"use client";

/* ════════════════════════════════════════════════════════════════════════
   "El Camino al Título" — HUB / sendero vertical de Desafíos.
   Estilo mapa Duolingo/Candy-Crush: nodos circulares conectados por una línea
   que se pinta dorada en los tramos completados. Serpentea izq/der. El nodo
   especial (La Gran Quiniela) cuelga como un cofre al costado. Arriba de todo,
   el Gran Premio (meta, no jugable) linkea a /mundial/premios.

   Reglas de oro de este proyecto:
   · NADA de reloj/aleatoriedad en render (no rompemos hidratación SSR). Las
     posiciones del serpenteo son DETERMINISTAS por índice.
   · Respetamos prefers-reduced-motion en TODAS las animaciones (sin stagger,
     sin idle-bounce; estados finales directos).
   · a11y: aria-labels, role="status" donde cambia el progreso, foco celeste,
     alt en imágenes; los nodos locked no son foco (tabIndex -1 + aria-disabled).
   · Nombres de selección vía teamEsName (acá no aplica: no hay equipos).
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Lock,
  Crown,
  Trophy,
  Check,
  ChevronRight,
  Gift,
  Shirt,
  Sparkles,
} from "lucide-react";
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

/* ── Helpers de presentación de la recompensa por tier ── */
function rewardIcon(tier: ChallengeRewardTier) {
  switch (tier) {
    case "month":
      return <Trophy size={13} aria-hidden="true" />;
    case "jersey":
      return <Shirt size={13} aria-hidden="true" />;
    case "roulette":
      return <span className={styles.rewardEmoji} aria-hidden="true">🎡</span>;
    case "special":
      return <Crown size={13} aria-hidden="true" />;
  }
}

/** Etiqueta corta del CTA según el estado y si el torneo está cerrado. */
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

/* ── Variantes de animación (framer-motion). El contenedor escalona los
   hijos como si el camino se dibujara de a poco. ── */
const trackVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const nodeVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function Sendero({ challenges, displayName, totalPoints, locked }: Props) {
  const rm = useReducedMotion();

  // Separamos el cofre (La Gran Quiniela, special) — se dibuja como rama lateral,
  // siempre disponible. El resto arma el sendero principal en orden de torneo.
  const { chest, path } = useMemo(() => {
    let chest: ChallengeState | null = null;
    const path: ChallengeState[] = [];
    for (const c of challenges) {
      if (c.special) chest = c;
      else path.push(c);
    }
    return { chest, path };
  }, [challenges]);

  // Progreso global = desafíos completados / desafíos jugables (no locked).
  const playable = useMemo(() => path.filter((c) => c.state !== "locked"), [path]);
  const completedCount = useMemo(
    () => playable.filter((c) => c.state === "completed").length,
    [playable],
  );
  const pct = playable.length > 0 ? Math.round((completedCount / playable.length) * 100) : 0;

  // La ficha del jugador descansa sobre el nodo in_progress más avanzado; si no
  // hay ninguno en curso, sobre el último completado. (Índice en el array
  // ordenado de torneo: "más avanzado" = índice mayor.)
  const tokenIndex = useMemo(() => {
    let inProgress = -1;
    let lastDone = -1;
    path.forEach((c, i) => {
      if (c.state === "in_progress") inProgress = i;
      if (c.state === "completed") lastDone = i;
    });
    return inProgress !== -1 ? inProgress : lastDone;
  }, [path]);

  const initial = (displayName?.trim()?.[0] || "?").toUpperCase();

  // Render visual: ABAJO la Largada → Desafío 1 … hacia ARRIBA Final → Gran Premio
  // (la copa). Con column-reverse en CSS, el orden del DOM (Largada, D1…Final,
  // Gran Premio) se invierte visualmente, así el stagger entra primero por abajo
  // (la largada) y "sube" el camino hacia la meta.

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
        <p className={styles.headSub}>Cada Desafío, más cortes en juego</p>

        <div className={styles.progress}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progreso del camino: ${completedCount} de ${playable.length} desafíos`}
          >
            <motion.span
              className={styles.progressFill}
              initial={rm ? false : { width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={rm ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            />
          </div>
          <span className={styles.progressLabel} role="status" aria-live="polite">
            {completedCount}/{playable.length} desafíos
          </span>
        </div>
      </header>

      {/* ── El sendero ── */}
      <motion.div
        className={styles.track}
        variants={rm ? undefined : trackVariants}
        initial={rm ? false : "hidden"}
        animate={rm ? undefined : "show"}
      >
        {/* LARGADA — el inicio del camino. Primero en el DOM → con column-reverse
            queda visualmente ABAJO de todo (desde acá se sube hacia la copa). */}
        <motion.div className={styles.startRow} variants={rm ? undefined : nodeVariants} aria-hidden="true">
          <span className={styles.startDot} />
          <span className={styles.startLabel}>La largada</span>
        </motion.div>

        {/* Nodos del torneo: Final (arriba) … D1 (abajo). El cofre cuelga del D3. */}
        {path.map((c, i) => {
          const side: "left" | "right" = i % 2 === 0 ? "left" : "right";
          // Tramo conector dorado si ESTE nodo ya está completado (el camino
          // hasta él quedó "iluminado").
          const linkDone = c.state === "completed";
          const hasToken = i === tokenIndex && tokenIndex !== -1;
          // El cofre se ancla a la altura del último grupo (group-3), que es el
          // último nodo antes de que arranque la fase eliminatoria.
          const showChest = chest != null && c.key === "group-3";

          return (
            <NodeRow
              key={c.key}
              challenge={c}
              side={side}
              linkDone={linkDone}
              locked={locked}
              token={hasToken ? { initial, name: displayName, rm: !!rm } : null}
              chest={showChest ? chest : null}
              chestLocked={locked}
              rm={!!rm}
              index={i}
            />
          );
        })}

        {/* META — Gran Premio (no jugable). Último en el DOM → con column-reverse
            queda visualmente ARRIBA de todo (la copa, el final del camino). */}
        <motion.div className={styles.goalRow} variants={rm ? undefined : nodeVariants}>
          <Link href="/mundial/premios" className={styles.goalNode} aria-label="La meta: el Gran Premio. Ver premios">
            <span className={styles.goalGlow} aria-hidden="true" />
            <span className={styles.goalCrown} aria-hidden="true">
              <Crown size={30} />
            </span>
            <span className={styles.goalText}>
              <strong>El Gran Premio</strong>
              <small>La meta: 1 año + camiseta</small>
            </span>
            <ChevronRight size={18} className={styles.goalChevron} aria-hidden="true" />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ───────────────────────── Fila de un nodo ───────────────────────── */

function NodeRow({
  challenge: c,
  side,
  linkDone,
  locked,
  token,
  chest,
  chestLocked,
  rm,
  index,
}: {
  challenge: ChallengeState;
  side: "left" | "right";
  /** El tramo conector que sale de este nodo (hacia el de arriba) va dorado. */
  linkDone: boolean;
  locked: boolean;
  token: { initial: string; name: string; rm: boolean } | null;
  chest: ChallengeState | null;
  chestLocked: boolean;
  rm: boolean;
  index: number;
}) {
  const isLocked = c.state === "locked";
  const pct = c.total > 0 ? Math.min(100, Math.round((c.done / c.total) * 100)) : 0;

  const stateClass =
    c.state === "completed"
      ? styles.nodeCompleted
      : c.state === "in_progress"
        ? styles.nodeProgress
        : c.state === "open"
          ? styles.nodeOpen
          : styles.nodeLocked;

  // a11y label completo del nodo.
  const aria = isLocked
    ? `${c.title}. Bloqueado, ${c.subtitle}. Recompensa: ${c.reward.label}`
    : `${c.title}. ${c.done} de ${c.total} jugados. Recompensa: ${c.reward.label}. ${ctaText(c.state, locked)}`;

  const inner = (
    <>
      {/* Anillo de progreso (sólo in_progress): conic-gradient dorado. */}
      {c.state === "in_progress" && (
        <span
          className={styles.ring}
          aria-hidden="true"
          style={{ ["--pct" as string]: `${pct}%` }}
        />
      )}

      <span className={styles.nodeFace}>
        {c.state === "completed" ? (
          <Check size={30} strokeWidth={3} className={styles.checkIcon} aria-hidden="true" />
        ) : isLocked ? (
          <Lock size={24} className={styles.lockIcon} aria-hidden="true" />
        ) : (
          <span className={styles.emoji} aria-hidden="true">{c.emoji}</span>
        )}
      </span>

      {/* Número de orden del desafío (shineTitle en completados). */}
      <span
        className={`${styles.nodeIndex} ${c.state === "completed" ? shell.shineTitle : ""}`}
        aria-hidden="true"
      >
        {index + 1}
      </span>

      {/* Ficha del jugador descansando sobre el nodo. */}
      {token && (
        <motion.span
          className={styles.token}
          aria-hidden="true"
          {...(token.rm
            ? {}
            : {
                animate: { y: [0, -5, 0] },
                transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
              })}
        >
          <span className={styles.tokenFace}>{token.initial}</span>
        </motion.span>
      )}
    </>
  );

  return (
    <motion.div
      className={`${styles.row} ${side === "left" ? styles.rowLeft : styles.rowRight}`}
      variants={rm ? undefined : nodeVariants}
    >
      {/* Conector vertical que sube hacia el nodo de arriba. */}
      <span
        className={`${styles.connector} ${linkDone ? styles.connectorDone : ""}`}
        aria-hidden="true"
      />

      <div className={styles.nodeWrap}>
        <div className={styles.nodeCol}>
          {isLocked ? (
            <div
              className={`${styles.node} ${stateClass}`}
              role="group"
              aria-disabled="true"
              tabIndex={-1}
              aria-label={aria}
            >
              {inner}
            </div>
          ) : (
            <Link
              href={`/mundial/jugar/${c.slug}`}
              className={`${styles.node} ${stateClass}`}
              aria-label={aria}
            >
              {inner}
            </Link>
          )}
        </div>

        {/* Cartel del desafío (al lado del nodo, hacia el centro). */}
        <div className={styles.info}>
          <div className={styles.infoTop}>
            <span className={styles.infoShort}>{c.short}</span>
            {c.state !== "locked" && (
              <span className={styles.infoCount} role="status" aria-live="off">
                {c.done}/{c.total}
              </span>
            )}
          </div>
          <h2 className={styles.infoTitle}>{c.title}</h2>
          <p className={styles.infoSub}>{isLocked ? c.subtitle : c.subtitle}</p>

          <div className={styles.infoFoot}>
            <span
              className={`${styles.reward} ${styles[`reward_${c.reward.tier}`] || ""} ${isLocked ? styles.rewardLocked : ""}`}
            >
              {rewardIcon(c.reward.tier)}
              {c.reward.label}
            </span>
            <span className={`${styles.cta} ${isLocked ? styles.ctaLocked : ""}`}>
              {ctaText(c.state, locked)}
              {!isLocked && <ChevronRight size={14} aria-hidden="true" />}
            </span>
          </div>
        </div>
      </div>

      {/* Cofre lateral — La Gran Quiniela (special). Rama al costado. */}
      {chest && <Chest chest={chest} locked={chestLocked} side={side} />}
    </motion.div>
  );
}

/* ───────────────────────── Cofre lateral (Gran Quiniela) ───────────────────────── */

function Chest({
  chest,
  locked,
  side,
}: {
  chest: ChallengeState;
  locked: boolean;
  side: "left" | "right";
}) {
  const pct = chest.total > 0 ? Math.min(100, Math.round((chest.done / chest.total) * 100)) : 0;
  const aria = `${chest.title}, siempre disponible. ${chest.done} de ${chest.total} respondidas. Recompensa: ${chest.reward.label}. ${
    locked ? "Ver" : chest.state === "completed" ? "Revisar" : chest.done > 0 ? "Seguir" : "Empezar"
  }`;

  return (
    <Link
      href="/mundial/jugar/quiniela"
      className={`${styles.chest} ${side === "left" ? styles.chestRight : styles.chestLeft}`}
      aria-label={aria}
    >
      <span className={styles.chestBranch} aria-hidden="true" />
      <span className={styles.chestBox}>
        <span className={styles.chestGlow} aria-hidden="true" />
        <Gift size={26} className={styles.chestIcon} aria-hidden="true" />
        {chest.done > 0 && chest.done < chest.total && (
          <span className={styles.chestPct} aria-hidden="true">{pct}%</span>
        )}
        {chest.state === "completed" && (
          <span className={styles.chestDone} aria-hidden="true">
            <Sparkles size={13} />
          </span>
        )}
      </span>
      <span className={styles.chestText}>
        <strong>{chest.short}</strong>
        <small>{chest.subtitle}</small>
        <span className={`${shell.pillGold} ${styles.chestReward}`}>
          <Crown size={11} aria-hidden="true" /> {chest.reward.label}
        </span>
      </span>
    </Link>
  );
}
