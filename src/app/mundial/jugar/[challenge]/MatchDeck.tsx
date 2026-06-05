"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from "framer-motion";
import { useNowSeconds } from "@/lib/prode/clock";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, Plus, Minus, Check, Lock, Clock,
  Flame, Trophy, ArrowRight, PartyPopper, Share2, Sparkles, CalendarClock, Crown,
} from "lucide-react";
import shell from "../../Shell.module.css";
import styles from "./MatchDeck.module.css";
import type { ChallengeMatch, ProdeTeamLite } from "@/lib/prode/types";
import { teamEsName } from "@/lib/prode/countries";
import { submitMatchPrediction } from "../../actions";
import { outcomeFromScore, type MatchOutcome } from "@/lib/prode/matchOfDay";

const MAX_GOALS = 9;
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type SaveStatus = "idle" | "saving" | "saved" | "error";
type Score = { home: number; away: number };
type MyPick = ChallengeMatch["myPick"];

type Props = {
  challengeTitle: string;
  challengeSubtitle: string;
  rewardLabel: string;
  matches: ChallengeMatch[];
  outcomePoints: number;
  exactBonus: number;
  featuredMultiplier: number;
  participantId: string;
  lockedAll: boolean;
};

/* ── Confeti del festejo (posiciones DETERMINISTAS por índice; no rompe SSR) ── */
const BURST_COLORS = ["cGold", "cCeleste", "cWhite", "cGoldDeep"] as const;
/** Burst grande para la pantalla de victoria (patrón del shell). */
const BURST_BIG = Array.from({ length: 22 }, (_, i) => ({
  left: 8 + ((i * 9) % 84),
  bx: (i % 2 ? 1 : -1) * (28 + ((i * 17) % 150)),
  by: 150 + ((i * 13) % 150),
  delay: ((i % 6) * 0.04).toFixed(2),
  color: BURST_COLORS[i % BURST_COLORS.length],
}));
/** Mini-burst sobre la card al guardar ok (~12 piezas, subset del patrón). */
const BURST_MINI = Array.from({ length: 12 }, (_, i) => ({
  left: 14 + ((i * 13) % 72),
  bx: (i % 2 ? 1 : -1) * (22 + ((i * 19) % 96)),
  by: 110 + ((i * 11) % 110),
  delay: ((i % 4) * 0.03).toFixed(2),
  color: BURST_COLORS[i % BURST_COLORS.length],
}));

// Cuenta regresiva PURA a partir del reloj del padre (nowSec, SSR-safe). No usa
// hooks: así el padre tiene UN solo reloj y card+padre quedan consistentes.
function computeCountdown(target: string, nowSec: number | null) {
  const ready = nowSec !== null;
  const diff = nowSec === null ? Infinity : new Date(target).getTime() - nowSec * 1000;
  const done = ready && diff <= 0;
  const s = diff === Infinity ? 0 : Math.max(0, Math.floor(diff / 1000));
  return {
    ready,
    done,
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    sec: s % 60,
  };
}

/**
 * ¿El partido sigue ABIERTO para jugar? Tiene equipos, el torneo no cerró, y aún
 * no arrancó (kickoff futuro y status programado). En el server / primer paint
 * (nowSec null) se asume abierto para no romper hidratación; el cliente refina.
 */
function isMatchOpen(m: ChallengeMatch, nowSec: number | null, lockedAll: boolean): boolean {
  if (!isPlayable(m) || lockedAll) return false;
  if (m.status !== "scheduled") return false;
  if (nowSec === null) return true;
  return new Date(m.kickoff_at).getTime() > nowSec * 1000;
}

function stageLabel(m: ChallengeMatch): string {
  const s = (m.stage || "").toLowerCase();
  const grp = m.group_label ? `Grupo ${m.group_label}` : "";
  if (s.includes("group") || s === "grupo") {
    const fecha = m.matchday ? `Fecha ${m.matchday}` : "Fase de grupos";
    return grp ? `${fecha} · ${grp}` : fecha;
  }
  if (s.includes("final") && !s.includes("semi") && !s.includes("quarter")) return "¡La Final!";
  if (s.includes("semi")) return "Semifinal";
  if (s.includes("quarter") || s.includes("8")) return "Cuartos de final";
  if (s.includes("16")) return "Octavos de final";
  if (s.includes("32")) return "Dieciseisavos";
  return grp || "Mundial 2026";
}

function outcomeText(o: MatchOutcome, esHome: string, esAway: string): string {
  return o === "home" ? `Gana ${esHome}` : o === "away" ? `Gana ${esAway}` : "Empatan";
}

function pickToScore(pick: MyPick): Score {
  if (pick && pick.home != null && pick.away != null) return { home: pick.home, away: pick.away };
  if (pick?.outcome === "home") return { home: 1, away: 0 };
  if (pick?.outcome === "away") return { home: 0, away: 1 };
  if (pick?.outcome === "draw") return { home: 1, away: 1 };
  return { home: 0, away: 0 }; // arranque NEUTRO: no pre-elige ganador
}

/** Un partido es jugable si tiene ambos equipos resueltos. */
function isPlayable(m: ChallengeMatch): boolean {
  return !!m.home && !!m.away;
}

function vibrate(ms: number) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
    }
  } catch {
    /* no load-bearing */
  }
}

export default function MatchDeck({
  challengeTitle,
  challengeSubtitle,
  rewardLabel,
  matches,
  outcomePoints,
  exactBonus,
  featuredMultiplier,
  participantId,
  lockedAll,
}: Props) {
  const rm = useReducedMotion();
  const total = matches.length;
  // UN solo reloj SSR-safe para todo el mazo (la card lo recibe por prop).
  const nowSec = useNowSeconds();

  // Marcador en vivo por matchId (semilla = pick previo o 0-0 neutro).
  const [scores, setScores] = useState<Record<string, Score>>(() => {
    const seed: Record<string, Score> = {};
    for (const m of matches) seed[m.id] = pickToScore(m.myPick);
    return seed;
  });
  // ¿Tocó un stepper en este partido? (hasta entonces no resaltamos ganador).
  const [touched, setTouched] = useState<Record<string, boolean>>(() => {
    const seed: Record<string, boolean> = {};
    for (const m of matches) seed[m.id] = !!m.myPick;
    return seed;
  });
  // Estado de guardado por matchId.
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>(() => {
    const seed: Record<string, SaveStatus> = {};
    for (const m of matches) seed[m.id] = m.myPick ? "saved" : "idle";
    return seed;
  });
  // Marcador efectivamente guardado en el server (para mostrar "tu jugada").
  const [saved, setSaved] = useState<Record<string, Score | null>>(() => {
    const seed: Record<string, Score | null> = {};
    for (const m of matches) seed[m.id] = m.myPick ? pickToScore(m.myPick) : null;
    return seed;
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const [index, setIndex] = useState(0);
  // dirección del slide (+1 = avanza a la derecha, -1 = retrocede).
  const [dir, setDir] = useState(1);
  // mini-burst sobre la card actual al guardar ok.
  const [celebrate, setCelebrate] = useState(false);
  // pantalla de victoria explícita (al completar todo via "confirmar").
  const [showVictory, setShowVictory] = useState(false);
  const [copied, setCopied] = useState(false);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (burstTimer.current) clearTimeout(burstTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const current = total > 0 ? matches[Math.min(index, total - 1)] : null;

  // Partidos que CUENTAN para completar el desafío: los que ya jugaste + los que
  // siguen abiertos. Un partido ya arrancado y sin jugar (te lo perdiste) NO se
  // puede jugar más, así que no bloquea la compleción ni el contador "te faltan".
  const isDone = useCallback((id: string) => statuses[id] === "saved", [statuses]);
  const counting = useMemo(
    () => matches.filter((m) => isDone(m.id) || isMatchOpen(m, nowSec, lockedAll)),
    [matches, isDone, nowSec, lockedAll],
  );
  const playableCount = counting.length;
  const donePlayable = useMemo(
    () => counting.filter((m) => isDone(m.id)).length,
    [counting, isDone],
  );
  // Quedan partidos abiertos sin jugar.
  const openUnplayed = playableCount - donePlayable;
  const allPlayed = donePlayable > 0 && openUnplayed === 0;

  // Próximo partido ABIERTO y sin jugar (saltamos cerrados y ya jugados).
  const firstUnplayedIndex = useMemo(
    () => matches.findIndex((m) => isMatchOpen(m, nowSec, lockedAll) && !isDone(m.id)),
    [matches, nowSec, lockedAll, isDone],
  );

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= total) return;
      setDir(next >= index ? 1 : -1);
      setIndex(next);
    },
    [index, total],
  );

  const fireMiniBurst = useCallback(() => {
    if (rm) return;
    setCelebrate(true);
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setCelebrate(false), 1600);
  }, [rm]);

  const setScore = useCallback((id: string, next: Score) => {
    setScores((p) => ({ ...p, [id]: next }));
    setTouched((p) => ({ ...p, [id]: true }));
    // si estaba "saved" y vuelve a tocar, pasa a edición (idle) sin borrar lo guardado.
    setStatuses((p) => (p[id] === "saved" ? { ...p, [id]: "idle" } : p));
  }, []);

  // Avanza al próximo partido ABIERTO sin jugar; si no queda ninguno, victoria.
  const advance = useCallback(
    (fromId: string) => {
      const open = (m: ChallengeMatch) =>
        isMatchOpen(m, nowSec, lockedAll) && !isDone(m.id) && m.id !== fromId;
      const after = matches.findIndex((m, i) => i > index && open(m));
      if (after !== -1) return goTo(after);
      const anyLeft = matches.findIndex((m) => open(m));
      if (anyLeft !== -1) return goTo(anyLeft);
      // No queda ningún partido abierto sin jugar → festejo full.
      setShowVictory(true);
    },
    [matches, index, nowSec, lockedAll, isDone, goTo],
  );

  const confirmCurrent = useCallback(() => {
    if (!current || !isPlayable(current)) return;
    const id = current.id;
    if (statuses[id] === "saving") return; // ya hay un envío en curso
    const score = scores[id] ?? { home: 0, away: 0 };
    // Si ya está guardado y el marcador no cambió, no reenvíes: solo avanzá.
    const prev = saved[id];
    if (statuses[id] === "saved" && prev && prev.home === score.home && prev.away === score.away) {
      advance(id);
      return;
    }
    setErrors((p) => ({ ...p, [id]: null }));
    setStatuses((p) => ({ ...p, [id]: "saving" }));
    submitMatchPrediction({
      matchId: id,
      outcome: outcomeFromScore(score.home, score.away),
      home: score.home,
      away: score.away,
    })
      .then((r) => {
        if (r.ok) {
          setSaved((p) => ({ ...p, [id]: { ...score } }));
          setStatuses((p) => ({ ...p, [id]: "saved" }));
          fireMiniBurst();
          vibrate(18);
          // Solo avanzamos/festejamos cuando el server confirmó ok.
          if (advanceTimer.current) clearTimeout(advanceTimer.current);
          advanceTimer.current = setTimeout(() => advance(id), rm ? 0 : 240);
        } else {
          setStatuses((p) => ({ ...p, [id]: "error" }));
          setErrors((p) => ({ ...p, [id]: r.error }));
        }
      })
      .catch(() => {
        setStatuses((p) => ({ ...p, [id]: "error" }));
        setErrors((p) => ({ ...p, [id]: "Algo falló, probá de nuevo." }));
      });
  }, [current, scores, statuses, saved, fireMiniBurst, advance, rm]);

  // ── CASO: sin partidos (eliminatoria sin equipos todavía) ──
  if (total === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.hud}>
          <Link href="/mundial/jugar" className={styles.backLink}>
            <ChevronLeft size={16} /> <span>{challengeTitle}</span>
          </Link>
        </div>
        <section className={`${shell.card} ${styles.empty}`}>
          <div className={shell.gate}>
            <CalendarClock size={42} className={shell.gateIcon} aria-hidden="true" />
            <h1 className={styles.emptyTitle}>Todavía no hay equipos</h1>
            <p className={styles.emptySub}>
              Este desafío se abre cuando terminen los grupos y se sepa quién pasa de fase. ¡Volvé pronto, crack!
            </p>
            <Link href="/mundial/jugar" className={shell.btnGhost}>
              <ChevronLeft size={18} /> Volver al camino
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* ── Arena de fondo: la pelota reventando la red, detrás del marcador ── */}
      <div className={styles.arena} aria-hidden="true">
        <Image
          src="/fondo_prode.png"
          alt=""
          fill
          priority
          sizes="(max-width: 560px) 100vw, 560px"
          className={styles.arenaImg}
        />
        <div className={styles.arenaShade} />
      </div>

      <AnimatePresence mode="wait">
        {showVictory && allPlayed ? (
          <Victory
            key="victory"
            rm={!!rm}
            total={total}
            playableCount={donePlayable}
            rewardLabel={rewardLabel}
            participantId={participantId}
            copied={copied}
            onShareCopied={() => {
              setCopied(true);
              if (copyTimer.current) clearTimeout(copyTimer.current);
              copyTimer.current = setTimeout(() => setCopied(false), 2200);
            }}
            onReplay={() => setShowVictory(false)}
          />
        ) : (
          <motion.div
            key="deck"
            initial={rm ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={rm ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          >
            {/* ── HUD superior ── */}
            <div className={styles.hud}>
              <Link href="/mundial/jugar" className={styles.backLink}>
                <ChevronLeft size={16} /> <span>{challengeTitle}</span>
              </Link>

              <div className={styles.hudRow}>
                <span className={styles.hudStage}>{current ? stageLabel(current) : challengeSubtitle}</span>
                <span className={styles.hudProgress} role="status" aria-live="polite">
                  Partido <b>{index + 1}</b> de {total}
                </span>
              </div>

              <div className={styles.dots} role="group" aria-label="Partidos del desafío">
                {matches.map((m, i) => {
                  const done = statuses[m.id] === "saved";
                  const isCurrent = i === index;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-current={isCurrent ? "true" : undefined}
                      aria-label={`Ir al partido ${i + 1}${done ? " (jugado)" : isCurrent ? " (actual)" : " (pendiente)"}`}
                      className={`${styles.dot} ${done ? styles.dotDone : ""} ${isCurrent ? styles.dotCurrent : ""}`}
                      onClick={() => goTo(i)}
                    />
                  );
                })}
              </div>

              {firstUnplayedIndex !== -1 && firstUnplayedIndex !== index && (
                <button type="button" className={styles.jumpFirst} onClick={() => goTo(firstUnplayedIndex)}>
                  <ArrowRight size={13} /> Ir al primero sin jugar
                </button>
              )}

              {donePlayable > 0 && openUnplayed > 0 && (
                <span className={styles.remaining} role="status" aria-live="polite">
                  <Flame size={13} /> Te {openUnplayed === 1 ? "falta" : "faltan"}{" "}
                  <b>{openUnplayed}</b> para entrar al sorteo
                </span>
              )}
            </div>

            {/* ── Escenario del mazo: una card a la vez con slide ── */}
            <div className={styles.stage}>
              <AnimatePresence mode="popLayout" custom={dir} initial={false}>
                {current && (
                  <MatchCard
                    key={current.id}
                    match={current}
                    dir={dir}
                    rm={!!rm}
                    nowSec={nowSec}
                    lockedAll={lockedAll}
                    score={scores[current.id] ?? { home: 0, away: 0 }}
                    touched={!!touched[current.id]}
                    status={statuses[current.id] ?? "idle"}
                    savedScore={saved[current.id] ?? null}
                    error={errors[current.id] ?? null}
                    celebrate={celebrate}
                    outcomePoints={outcomePoints}
                    exactBonus={exactBonus}
                    featuredMultiplier={featuredMultiplier}
                    isFirst={index === 0}
                    isLast={index === total - 1}
                    onScore={(s) => setScore(current.id, s)}
                    onConfirm={confirmCurrent}
                    onPrev={() => goTo(index - 1)}
                    onNext={() => goTo(index + 1)}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   La card de partido (el héroe). Marcador con TeamSide + stepper flip,
   countdown propio, autosave y transición de salida/entrada del mazo.
   ════════════════════════════════════════════════════════════════════════ */
function MatchCard({
  match,
  dir,
  rm,
  nowSec,
  lockedAll,
  score,
  touched,
  status,
  savedScore,
  error,
  celebrate,
  outcomePoints,
  exactBonus,
  featuredMultiplier,
  isFirst,
  isLast,
  onScore,
  onConfirm,
  onPrev,
  onNext,
}: {
  match: ChallengeMatch;
  dir: number;
  rm: boolean;
  nowSec: number | null;
  lockedAll: boolean;
  score: Score;
  touched: boolean;
  status: SaveStatus;
  savedScore: Score | null;
  error: string | null;
  celebrate: boolean;
  outcomePoints: number;
  exactBonus: number;
  featuredMultiplier: number;
  isFirst: boolean;
  isLast: boolean;
  onScore: (s: Score) => void;
  onConfirm: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const cd = computeCountdown(match.kickoff_at, nowSec);
  const kickedOff = cd.done;
  const playable = isPlayable(match);
  const readOnly = lockedAll || kickedOff || !playable;

  const esHome = teamEsName(match.home);
  const esAway = teamEsName(match.away);
  const outcome = outcomeFromScore(score.home, score.away);
  const featured = match.is_featured && featuredMultiplier > 1;

  const kickoffTxt = useMemo(() => {
    try {
      return new Date(match.kickoff_at).toLocaleString("es-AR", {
        weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [match.kickoff_at]);

  const timeLine = !cd.ready
    ? "Editás hasta que empiece"
    : kickedOff
      ? "El partido ya empezó"
      : (cd.d > 0
          ? `Cierra en ${cd.d}d ${cd.h}h`
          : cd.h > 0
            ? `Cierra en ${cd.h}h ${cd.m}m`
            : `Cierra en ${cd.m}m ${String(cd.sec).padStart(2, "0")}s`) +
        (kickoffTxt ? ` · ${kickoffTxt}` : "");

  const editable = !readOnly && status !== "saving";
  const showScore = savedScore ?? score;
  const srStatus = touched
    ? `${esHome} ${score.home}, ${esAway} ${score.away}. ${outcomeText(outcome, esHome, esAway)}.`
    : "";

  // Variantes del slide del mazo (desactivadas en reduced-motion → crossfade).
  const variants = rm
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        enter: (d: number) => ({ x: d > 0 ? 120 : -90, opacity: 0, rotate: d > 0 ? 4 : -4, scale: 0.96 }),
        center: { x: 0, opacity: 1, rotate: 0, scale: 1 },
        exit: (d: number) => ({ x: d > 0 ? "120%" : "-90%", opacity: 0, rotate: d > 0 ? 5 : -5, scale: 0.95 }),
      };

  const onDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      if (rm) return;
      const dx = info.offset.x;
      const vx = info.velocity.x;
      if ((dx < -70 || vx < -350) && !isLast) onNext();
      else if ((dx > 70 || vx > 350) && !isFirst) onPrev();
    },
    [rm, isLast, isFirst, onNext, onPrev],
  );

  return (
    <motion.section
      className={`${shell.card} ${shell.cardTopline} ${styles.match} ${featured ? styles.matchFeatured : ""}`}
      aria-label={`${esHome} vs ${esAway} — ${stageLabel(match)}`}
      custom={dir}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={rm ? { duration: 0.18 } : { type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
      drag={rm || readOnly ? false : "x"}
      dragSnapToOrigin
      dragElastic={0.16}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={onDragEnd}
    >
      {/* mini-burst de confeti sobre la card al guardar ok */}
      {celebrate && (
        <div className={shell.burst} aria-hidden="true">
          {BURST_MINI.map((p, i) => (
            <span
              key={i}
              className={`${shell.burstPiece} ${shell[p.color]}`}
              style={{
                left: `${p.left}%`,
                animationDelay: `${p.delay}s`,
                ["--bx" as string]: `${p.bx}px`,
                ["--by" as string]: `${p.by}px`,
              }}
            />
          ))}
        </div>
      )}

      <div className={styles.matchHead}>
        {featured ? (
          <span className={`${shell.pillGold} ${styles.featBadge}`}>
            <Flame size={13} /> Partido destacado
          </span>
        ) : null}
        <span className={styles.matchStage}>{stageLabel(match)}</span>
      </div>

      <div className={styles.board}>
        <TeamSide
          id="md-team-home"
          team={match.home}
          label={match.home_label}
          name={esHome}
          value={score.home}
          onChange={(n) => onScore({ home: n, away: score.away })}
          editable={editable}
          winning={touched && outcome === "home"}
          draw={touched && outcome === "draw"}
          dim={touched && outcome === "away"}
          side="home"
          rm={rm}
        />

        <div className={styles.center}>
          <div className={styles.vs} aria-hidden="true">VS</div>
        </div>

        <TeamSide
          team={match.away}
          label={match.away_label}
          name={esAway}
          value={score.away}
          onChange={(n) => onScore({ home: score.home, away: n })}
          editable={editable}
          winning={touched && outcome === "away"}
          draw={touched && outcome === "draw"}
          dim={touched && outcome === "home"}
          side="away"
          rm={rm}
        />
      </div>

      <div className={styles.resultRow}>
        {touched ? (
          <OutcomeChip outcome={outcome} esHome={esHome} esAway={esAway} rm={rm} />
        ) : (
          <span className={styles.hint}>Tocá + y − para armar tu marcador</span>
        )}
      </div>
      <div className={shell.srOnly} role="status" aria-live="polite">{srStatus}</div>

      <div className={styles.meta}>
        <span className={styles.pts}>
          <Trophy size={13} /> +{outcomePoints} si acertás · +{exactBonus} si clavás el marcador
          {featured ? (
            <em className={styles.mult}>
              <Flame size={11} /> x{featuredMultiplier}
            </em>
          ) : null}
        </span>
        <span className={styles.countdown}>
          <Clock size={13} /> {timeLine}
        </span>
      </div>

      {error && (
        <p className={shell.error}>
          {error}
          {savedScore ? ` · Tu jugada guardada sigue siendo ${savedScore.home} - ${savedScore.away}.` : ""}
        </p>
      )}

      {/* ── Pie: read-only / guardado / CTA ── */}
      {readOnly ? (
        <div className={styles.locked}>
          <Lock size={15} />
          {!playable
            ? "Este partido todavía no tiene equipos."
            : savedScore
              ? <>Este partido ya empezó · tu jugada: <strong className={styles.lockedPick}>{savedScore.home} - {savedScore.away}</strong></>
              : "Este partido ya empezó."}
        </div>
      ) : (
        <>
          {status === "saved" && (
            <div className={`${shell.noticeGood} ${styles.savedMini}`}>
              <Check size={15} /> Guardado: <strong className={styles.savedScore}>{showScore.home} - {showScore.away}</strong>
            </div>
          )}

          <button
            type="button"
            className={`${shell.btnPrimary} ${styles.cta}`}
            onClick={onConfirm}
            disabled={status === "saving" || !touched}
          >
            {status === "saving" ? (
              "Guardando…"
            ) : status === "saved" ? (
              isLast ? <>Reconfirmar <Check size={18} /></> : <>Confirmar y siguiente <ArrowRight size={18} /></>
            ) : isLast ? (
              <>Confirmar mi jugada <Check size={18} /></>
            ) : (
              <>Confirmar y siguiente <ArrowRight size={18} /></>
            )}
          </button>
        </>
      )}

      {/* ── Navegación entre partidos (siempre disponible) ── */}
      <div className={styles.nav}>
        <button
          type="button"
          className={`${shell.btnGhost} ${styles.navBtn}`}
          onClick={onPrev}
          disabled={isFirst}
          aria-label="Partido anterior"
        >
          <ChevronLeft size={18} /> Anterior
        </button>
        <button
          type="button"
          className={`${shell.btnGhost} ${styles.navBtn}`}
          onClick={onNext}
          disabled={isLast}
          aria-label="Siguiente partido"
        >
          Siguiente <ChevronRight size={18} />
        </button>
      </div>
      {!rm && !readOnly && (
        <p className={styles.dragHint} aria-hidden="true">Deslizá para cambiar de partido →</p>
      )}
    </motion.section>
  );
}

/* ── Chip de resultado animado (copiado de PartidoDelDia) ── */
function OutcomeChip({
  outcome, esHome, esAway, rm,
}: { outcome: MatchOutcome; esHome: string; esAway: string; rm: boolean }) {
  const txt = outcomeText(outcome, esHome, esAway);
  const cls = `${styles.outcome} ${outcome === "draw" ? styles.outcomeDraw : styles.outcomeWin}`;
  if (rm) return <span className={cls}>{txt}</span>;
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={txt}
        className={cls}
        initial={{ opacity: 0, scale: 0.85, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: -4 }}
        transition={{ duration: 0.22, ease: EASE }}
      >
        {txt}
      </motion.span>
    </AnimatePresence>
  );
}

/* ── Lado de equipo: bandera circular + stepper con flip del número + corona ── */
function TeamSide({
  id, team, label, name, value, onChange, editable, winning, draw, dim, side, rm,
}: {
  id?: string;
  team: ProdeTeamLite | null;
  label: string | null;
  name: string;
  value: number;
  onChange: (n: number) => void;
  editable: boolean;
  winning: boolean;
  draw: boolean;
  dim: boolean;
  side: "home" | "away";
  rm: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  const state = winning ? styles.teamWin : draw ? styles.teamDraw : dim ? styles.teamDim : "";
  return (
    <div className={`${styles.team} ${state}`}>
      <div className={styles.flagWrap}>
        {team?.flag_url && imgOk ? (
          <img
            className={styles.flag}
            src={team.flag_url}
            alt={name}
            width={64}
            height={64}
            loading="lazy"
            onError={() => setImgOk(false)}
          />
        ) : (
          <span className={styles.flag} aria-hidden="true" />
        )}
        {winning && <span className={styles.crown} aria-hidden="true"><Crown size={13} strokeWidth={2.5} /></span>}
      </div>
      <div id={id} className={styles.teamName}>{(name || label || "A definir").toUpperCase()}</div>

      <div className={styles.stepper}>
        <button
          type="button"
          className={styles.step}
          aria-label={`Restar gol a ${name}`}
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={!editable || value <= 0}
        >
          <Minus size={18} />
        </button>
        <div className={styles.numWrap}>
          {rm ? (
            <span className={styles.num}>{value}</span>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={value}
                className={styles.num}
                initial={{ y: side === "home" ? 18 : -18, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: side === "home" ? -18 : 18, opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                {value}
              </motion.span>
            </AnimatePresence>
          )}
        </div>
        <button
          type="button"
          className={styles.step}
          aria-label={`Sumar gol a ${name}`}
          onClick={() => onChange(Math.min(MAX_GOALS, value + 1))}
          disabled={!editable || value >= MAX_GOALS}
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Pantalla de victoria: BURST grande + shineTitle + recap + compartir.
   ════════════════════════════════════════════════════════════════════════ */
function Victory({
  rm, total, playableCount, rewardLabel, participantId, copied, onShareCopied, onReplay,
}: {
  rm: boolean;
  total: number;
  playableCount: number;
  rewardLabel: string;
  participantId: string;
  copied: boolean;
  onShareCopied: () => void;
  onReplay: () => void;
}) {
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `/mundial/share/${participantId}`;
    return `${window.location.origin}/mundial/share/${participantId}`;
  }, [participantId]);

  const onShare = useCallback(async () => {
    const text = `¡Ya jugué mis pronósticos del Mundial en el Prode de Monaco! ¿Le ganás a mi jugada? Jugá por ${rewardLabel}.`;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: "Mi jugada · Prode Mundial 2026", text, url: shareUrl });
        return;
      }
    } catch {
      return; // el usuario canceló el share nativo: no es un error
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      onShareCopied();
    } catch {
      /* sin clipboard: no-op, el link igual está en pantalla via los CTA */
    }
  }, [shareUrl, rewardLabel, onShareCopied]);

  return (
    <motion.section
      className={`${shell.card} ${shell.cardTopline} ${styles.victory}`}
      initial={rm ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      aria-labelledby="md-victory-title"
    >
      {!rm && (
        <div className={shell.burst} aria-hidden="true">
          {BURST_BIG.map((p, i) => (
            <span
              key={i}
              className={`${shell.burstPiece} ${shell[p.color]}`}
              style={{
                left: `${p.left}%`,
                animationDelay: `${p.delay}s`,
                ["--bx" as string]: `${p.bx}px`,
                ["--by" as string]: `${p.by}px`,
              }}
            />
          ))}
        </div>
      )}

      <PartyPopper size={46} className={styles.victoryIcon} aria-hidden="true" />
      <h1 id="md-victory-title" className={`${shell.shineTitle} ${styles.victoryTitle}`}>
        ¡Desafío jugado!
      </h1>
      <p className={styles.victorySub}>
        Jugaste los <b>{playableCount} de {total}</b> partidos. Ya estás adentro del sorteo por <b>{rewardLabel}</b>. ¡Dale que la clavás!
      </p>

      <div className={styles.victoryActions}>
        <button type="button" className={shell.btnPrimary} onClick={onShare}>
          <Share2 size={18} /> Compartir mi jugada
        </button>
        <Link href="/mundial/jugar" className={shell.btnGhost}>
          <ChevronsLeft size={18} /> Volver al camino
        </Link>
        <button type="button" className={shell.btnGhost} onClick={onReplay}>
          <Sparkles size={18} /> Revisar mis partidos
        </button>
      </div>

      {copied && (
        <p className={styles.copied} role="status" aria-live="polite">
          <Check size={14} style={{ verticalAlign: "-2px" }} /> ¡Link copiado! Pegalo donde quieras.
        </p>
      )}
    </motion.section>
  );
}
