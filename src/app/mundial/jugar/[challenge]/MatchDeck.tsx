"use client";

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ChevronLeft, Plus, Minus, Check, Lock, Clock, Flame, Trophy, ArrowDown,
  PartyPopper, Share2, CalendarClock, Crown,
} from "lucide-react";
import shell from "../../Shell.module.css";
import styles from "./MatchDeck.module.css";
import type { ChallengeMatch, ProdeTeamLite } from "@/lib/prode/types";
import { teamEsName } from "@/lib/prode/countries";
import { submitMatchPrediction } from "../../actions";
import { outcomeFromScore, type MatchOutcome } from "@/lib/prode/matchOfDay";
import { useNowSeconds } from "@/lib/prode/clock";

const MAX_GOALS = 9;
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type SaveStatus = "idle" | "saving" | "saved" | "error";
type Score = { home: number; away: number };

type Props = {
  challengeTitle: string;
  challengeSubtitle: string;
  rewardLabel: string;
  matches: ChallengeMatch[];
  outcomePoints: number;
  exactBonus: number;
  featuredMultiplier: number;
  participantId: string;
};

/* Confeti del festejo (posiciones DETERMINISTAS por índice; SSR-safe). */
const BURST_COLORS = ["cGold", "cCeleste", "cWhite", "cGoldDeep"] as const;
const BURST_BIG = Array.from({ length: 22 }, (_, i) => ({
  left: 8 + ((i * 9) % 84),
  bx: (i % 2 ? 1 : -1) * (28 + ((i * 17) % 150)),
  by: 150 + ((i * 13) % 150),
  delay: ((i % 6) * 0.04).toFixed(2),
  color: BURST_COLORS[i % BURST_COLORS.length],
}));

/* Cuenta regresiva pura desde el reloj compartido (nowSec). */
function computeCountdown(target: string, nowSec: number | null) {
  const ready = nowSec !== null;
  const diff = nowSec === null ? Infinity : new Date(target).getTime() - nowSec * 1000;
  const done = ready && diff <= 0;
  const s = diff === Infinity ? 0 : Math.max(0, Math.floor(diff / 1000));
  return { ready, done, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60) };
}

/**
 * ¿El partido sigue ABIERTO para jugar? Cada partido se cierra SOLO en su propio
 * kickoff (no hay candado global de torneo para los partidos: eso es exclusivo de
 * la Gran Quiniela). Alineado con la RPC prode_submit_match_prediction, que valida
 * now() >= kickoff_at por partido.
 */
function isMatchOpen(m: ChallengeMatch, nowSec: number | null): boolean {
  if (!m.home || !m.away) return false;
  if (m.status !== "scheduled") return false;
  if (nowSec === null) return true;
  return new Date(m.kickoff_at).getTime() > nowSec * 1000;
}

function pickToScore(pick: ChallengeMatch["myPick"]): Score {
  if (pick && pick.home != null && pick.away != null) return { home: pick.home, away: pick.away };
  if (pick?.outcome === "home") return { home: 1, away: 0 };
  if (pick?.outcome === "away") return { home: 0, away: 1 };
  if (pick?.outcome === "draw") return { home: 1, away: 1 };
  return { home: 0, away: 0 };
}

function outcomeText(o: MatchOutcome, esHome: string, esAway: string): string {
  return o === "home" ? `Gana ${esHome}` : o === "away" ? `Gana ${esAway}` : "Empatan";
}

function vibrate(ms: number) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms);
  } catch {
    /* no load-bearing */
  }
}

/** Agrupa los partidos por grupo (A–L) para el fixture; eliminatorias juntas. */
function groupMatches(matches: ChallengeMatch[]) {
  const map = new Map<string, { key: string; label: string; sort: string; matches: ChallengeMatch[] }>();
  for (const m of matches) {
    const key = m.group_label ? `g-${m.group_label}` : `s-${m.stage}`;
    const label = m.group_label ? `Grupo ${m.group_label}` : "Eliminatorias";
    const sort = m.group_label ? `0-${m.group_label}` : `1-${m.stage}`;
    if (!map.has(key)) map.set(key, { key, label, sort, matches: [] });
    map.get(key)!.matches.push(m);
  }
  return [...map.values()].sort((a, b) => a.sort.localeCompare(b.sort));
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
}: Props) {
  const rm = useReducedMotion();
  const total = matches.length;
  const nowSec = useNowSeconds();

  // ── Estado por matchId (semilla = pick previo) ──
  const [scores, setScores] = useState<Record<string, Score>>(() => {
    const s: Record<string, Score> = {};
    for (const m of matches) s[m.id] = pickToScore(m.myPick);
    return s;
  });
  const [touched, setTouched] = useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {};
    for (const m of matches) s[m.id] = !!m.myPick;
    return s;
  });
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>(() => {
    const s: Record<string, SaveStatus> = {};
    for (const m of matches) s[m.id] = m.myPick ? "saved" : "idle";
    return s;
  });
  const [saved, setSaved] = useState<Record<string, Score | null>>(() => {
    const s: Record<string, Score | null> = {};
    for (const m of matches) s[m.id] = m.myPick ? pickToScore(m.myPick) : null;
    return s;
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    const timers = saveTimers.current;
    return () => Object.values(timers).forEach((t) => clearTimeout(t));
  }, []);

  // ── Progreso: cuentan los que jugaste + los que siguen abiertos ──
  const isDone = useCallback((id: string) => statuses[id] === "saved", [statuses]);
  const counting = useMemo(
    () => matches.filter((m) => isDone(m.id) || isMatchOpen(m, nowSec)),
    [matches, isDone, nowSec],
  );
  const playableCount = counting.length;
  const donePlayable = useMemo(() => counting.filter((m) => isDone(m.id)).length, [counting, isDone]);
  const openUnplayed = playableCount - donePlayable;
  const allPlayed = donePlayable > 0 && openUnplayed === 0;
  const pct = playableCount > 0 ? Math.round((donePlayable / playableCount) * 100) : 0;

  // Festejo una sola vez al completar.
  const [celebrate, setCelebrate] = useState(false);
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (allPlayed && !celebratedRef.current) {
      celebratedRef.current = true;
      if (!rm) {
        setCelebrate(true);
        const t = setTimeout(() => setCelebrate(false), 1800);
        return () => clearTimeout(t);
      }
    }
  }, [allPlayed, rm]);

  // ── Guardado (chequea SIEMPRE el error; idempotente en el server) ──
  const doSave = useCallback((id: string, score: Score) => {
    setStatuses((p) => ({ ...p, [id]: "saving" }));
    setErrors((p) => ({ ...p, [id]: null }));
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
          vibrate(8);
        } else {
          setStatuses((p) => ({ ...p, [id]: "error" }));
          setErrors((p) => ({ ...p, [id]: r.error }));
        }
      })
      .catch(() => {
        setStatuses((p) => ({ ...p, [id]: "error" }));
        setErrors((p) => ({ ...p, [id]: "Algo falló, probá de nuevo." }));
      });
  }, []);

  // Cambiar marcador → autosave con debounce por partido (no hay botón "confirmar").
  const onScore = useCallback(
    (id: string, next: Score) => {
      setScores((p) => ({ ...p, [id]: next }));
      setTouched((p) => ({ ...p, [id]: true }));
      if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
      saveTimers.current[id] = setTimeout(() => doSave(id, next), 650);
    },
    [doSave],
  );

  // "Ir al primero sin jugar": scrollea a la card (no hay swipe).
  const firstUnplayed = useMemo(
    () => matches.find((m) => isMatchOpen(m, nowSec) && !isDone(m.id))?.id ?? null,
    [matches, nowSec, isDone],
  );
  const scrollToFirst = useCallback(() => {
    if (!firstUnplayed) return;
    const el = cardRefs.current[firstUnplayed];
    el?.scrollIntoView({ behavior: rm ? "auto" : "smooth", block: "center" });
  }, [firstUnplayed, rm]);

  const groups = useMemo(() => groupMatches(matches), [matches]);

  // Compartir.
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const onShare = useCallback(async () => {
    const url =
      typeof window === "undefined"
        ? `/mundial/share/${participantId}`
        : `${window.location.origin}/mundial/share/${participantId}`;
    const text = `¡Ya jugué mis pronósticos del Mundial en el Prode de Monaco! ¿Le ganás a mi jugada? Jugá por ${rewardLabel}.`;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: "Mi jugada · Prode Mundial 2026", text, url });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      /* sin clipboard: noop */
    }
  }, [participantId, rewardLabel]);

  // ── Sin partidos (eliminatoria sin equipos todavía) ──
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
      {/* Arena de fondo: la pelota reventando la red. */}
      <div className={styles.arena} aria-hidden="true">
        <Image src="/fondo_prode.png" alt="" fill priority sizes="(max-width: 560px) 100vw, 560px" className={styles.arenaImg} />
        <div className={styles.arenaShade} />
      </div>

      {/* ── HUD sticky: volver + título + progreso ── */}
      <div className={styles.hud}>
        <div className={styles.hudTop}>
          <Link href="/mundial/jugar" className={styles.backLink}>
            <ChevronLeft size={16} /> <span>{challengeTitle}</span>
          </Link>
          <span className={styles.hudStage}>{challengeSubtitle}</span>
        </div>

        <div className={styles.progressWrap}>
          <div
            className={styles.progressBar}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${donePlayable} de ${total} partidos jugados`}
          >
            <motion.span
              className={styles.progressFill}
              initial={rm ? false : { width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={rm ? { duration: 0 } : { duration: 0.5, ease: EASE }}
            />
          </div>
          <span className={styles.progressNum} role="status" aria-live="polite">
            <b>{donePlayable}</b>/{total}
          </span>
        </div>

        <div className={styles.hudActions}>
          {openUnplayed > 0 ? (
            <>
              <span className={styles.remaining}>
                <Flame size={13} /> Te {openUnplayed === 1 ? "falta" : "faltan"} <b>{openUnplayed}</b> para el sorteo
              </span>
              {firstUnplayed && (
                <button type="button" className={styles.jumpBtn} onClick={scrollToFirst}>
                  <ArrowDown size={13} /> Ir al que falta
                </button>
              )}
            </>
          ) : (
            <span className={`${styles.remaining} ${styles.remainingDone}`}>
              <Check size={14} /> Jugaste todos los partidos
            </span>
          )}
        </div>
      </div>

      {/* ── Banner de festejo al completar ── */}
      <AnimatePresence>
        {allPlayed && (
          <motion.section
            className={`${shell.card} ${shell.cardTopline} ${styles.victory}`}
            initial={rm ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={rm ? { opacity: 0 } : { opacity: 0, y: -8 }}
            aria-labelledby="md-victory"
          >
            {celebrate && (
              <div className={shell.burst} aria-hidden="true">
                {BURST_BIG.map((p, i) => (
                  <span
                    key={i}
                    className={`${shell.burstPiece} ${shell[p.color]}`}
                    style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, ["--bx" as string]: `${p.bx}px`, ["--by" as string]: `${p.by}px` }}
                  />
                ))}
              </div>
            )}
            <PartyPopper size={32} className={styles.victoryIcon} aria-hidden="true" />
            <div className={styles.victoryBody}>
              <h2 id="md-victory" className={`${shell.shineTitle} ${styles.victoryTitle}`}>¡Desafío jugado!</h2>
              <p className={styles.victorySub}>
                Jugaste los <b>{donePlayable}</b> partidos. Ya estás adentro del sorteo por <b>{rewardLabel}</b>.
              </p>
            </div>
            <button type="button" className={`${shell.btnPrimary} ${styles.victoryShare}`} onClick={onShare}>
              <Share2 size={16} /> Compartir
            </button>
            {copied && (
              <span className={styles.copied} role="status" aria-live="polite">
                <Check size={13} /> ¡Link copiado!
              </span>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── El fixture: partidos por grupo, scrollable, editables en el lugar ── */}
      <div className={styles.fixture}>
        {groups.map((g) => (
          <section key={g.key} className={styles.group} aria-label={g.label}>
            <header className={styles.groupHead}>
              <span className={styles.groupLabel}>{g.label}</span>
              <span className={styles.groupCount}>{g.matches.length} partidos</span>
            </header>
            <div className={styles.groupMatches}>
              {g.matches.map((m) => (
                <MatchCard
                  key={m.id}
                  ref={(el) => {
                    cardRefs.current[m.id] = el;
                  }}
                  match={m}
                  rm={!!rm}
                  nowSec={nowSec}
                  score={scores[m.id] ?? { home: 0, away: 0 }}
                  touched={!!touched[m.id]}
                  status={statuses[m.id] ?? "idle"}
                  savedScore={saved[m.id] ?? null}
                  error={errors[m.id] ?? null}
                  outcomePoints={outcomePoints}
                  exactBonus={exactBonus}
                  featuredMultiplier={featuredMultiplier}
                  onScore={(s) => onScore(m.id, s)}
                />
              ))}
            </div>
          </section>
        ))}

        <Link href="/mundial/jugar" className={`${shell.btnGhost} ${styles.backToPath}`}>
          <ChevronLeft size={16} /> Volver al camino
        </Link>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Card de partido del fixture: marcador compacto con steppers + autosave.
   ════════════════════════════════════════════════════════════════════════ */
const MatchCard = forwardRef<
  HTMLElement,
  {
    match: ChallengeMatch;
    rm: boolean;
    nowSec: number | null;
    score: Score;
    touched: boolean;
    status: SaveStatus;
    savedScore: Score | null;
    error: string | null;
    outcomePoints: number;
    exactBonus: number;
    featuredMultiplier: number;
    onScore: (s: Score) => void;
  }
>(function MatchCard(
  { match, rm, nowSec, score, touched, status, savedScore, error, outcomePoints, exactBonus, featuredMultiplier, onScore },
  ref,
) {
  const cd = computeCountdown(match.kickoff_at, nowSec);
  const kickedOff = cd.done;
  const playable = !!match.home && !!match.away;
  const readOnly = kickedOff || !playable;
  const editable = !readOnly && status !== "saving";

  const esHome = teamEsName(match.home);
  const esAway = teamEsName(match.away);
  const outcome = outcomeFromScore(score.home, score.away);
  const featured = match.is_featured && featuredMultiplier > 1;

  const timeLine = !cd.ready
    ? ""
    : kickedOff
      ? "Ya empezó"
      : cd.d > 0
        ? `Cierra en ${cd.d}d ${cd.h}h`
        : cd.h > 0
          ? `Cierra en ${cd.h}h ${cd.m}m`
          : `Cierra en ${cd.m}m`;

  const srStatus = touched ? `${esHome} ${score.home}, ${esAway} ${score.away}. ${outcomeText(outcome, esHome, esAway)}.` : "";

  return (
    <section
      ref={ref}
      className={`${shell.card} ${styles.match} ${featured ? styles.matchFeatured : ""} ${status === "saved" ? styles.matchSaved : ""} ${readOnly ? styles.matchLocked : ""}`}
      aria-label={`${esHome} vs ${esAway}`}
    >
      <div className={styles.board}>
        <TeamSide
          team={match.home}
          name={esHome}
          value={score.home}
          onChange={(n) => onScore({ home: n, away: score.away })}
          editable={editable}
          winning={touched && outcome === "home"}
          draw={touched && outcome === "draw"}
          dim={touched && outcome === "away"}
        />

        <div className={styles.center}>
          {touched ? (
            <span className={`${styles.outcome} ${outcome === "draw" ? styles.outcomeDraw : styles.outcomeWin}`}>
              {outcomeText(outcome, esHome, esAway)}
            </span>
          ) : (
            <span className={styles.vs} aria-hidden="true">VS</span>
          )}
        </div>

        <TeamSide
          team={match.away}
          name={esAway}
          value={score.away}
          onChange={(n) => onScore({ home: score.home, away: n })}
          editable={editable}
          winning={touched && outcome === "away"}
          draw={touched && outcome === "draw"}
          dim={touched && outcome === "home"}
        />
      </div>

      <div className={shell.srOnly} role="status" aria-live="polite">{srStatus}</div>

      <div className={styles.foot}>
        <span className={styles.footState}>
          {readOnly ? (
            <span className={styles.stLocked}>
              <Lock size={13} />
              {savedScore ? <>Tu jugada: <b>{savedScore.home} - {savedScore.away}</b></> : "Este partido ya empezó"}
            </span>
          ) : status === "saving" ? (
            <span className={styles.stSaving}>Guardando…</span>
          ) : status === "saved" ? (
            <span className={styles.stSaved}><Check size={14} /> Guardado</span>
          ) : status === "error" ? (
            <span className={styles.stError}>{error ?? "No se guardó"}</span>
          ) : (
            <span className={styles.stHint}>Tocá + y − para jugar</span>
          )}
        </span>

        <span className={styles.pts}>
          <Trophy size={12} /> +{outcomePoints}·+{exactBonus}
          {featured ? <em className={styles.mult}><Flame size={10} /> x{featuredMultiplier}</em> : null}
          {timeLine ? <span className={styles.time}><Clock size={11} /> {timeLine}</span> : null}
        </span>
      </div>
    </section>
  );
});

/* Lado de equipo compacto: bandera + nombre + stepper. */
function TeamSide({
  team, name, value, onChange, editable, winning, draw, dim,
}: {
  team: ProdeTeamLite | null;
  name: string;
  value: number;
  onChange: (n: number) => void;
  editable: boolean;
  winning: boolean;
  draw: boolean;
  dim: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  const state = winning ? styles.teamWin : draw ? styles.teamDraw : dim ? styles.teamDim : "";
  return (
    <div className={`${styles.team} ${state}`}>
      <div className={styles.flagWrap}>
        {team?.flag_url && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.flag} src={team.flag_url} alt="" width={44} height={44} loading="lazy" onError={() => setImgOk(false)} />
        ) : (
          <span className={styles.flag} aria-hidden="true" />
        )}
        {winning && <span className={styles.crown} aria-hidden="true"><Crown size={11} strokeWidth={2.5} /></span>}
      </div>
      <div className={styles.teamName}>{(name || "A definir").toUpperCase()}</div>
      <div className={styles.stepper}>
        <button type="button" className={styles.step} aria-label={`Restar gol a ${name}`} onClick={() => onChange(Math.max(0, value - 1))} disabled={!editable || value <= 0}>
          <Minus size={15} />
        </button>
        <span className={styles.num}>{value}</span>
        <button type="button" className={styles.step} aria-label={`Sumar gol a ${name}`} onClick={() => onChange(Math.min(MAX_GOALS, value + 1))} disabled={!editable || value >= MAX_GOALS}>
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}
