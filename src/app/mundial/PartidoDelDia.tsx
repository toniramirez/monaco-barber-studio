"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Trophy, Plus, Minus, Check, Lock, Clock, Flame, ArrowRight, Pencil, X } from "lucide-react";
import shell from "./Shell.module.css";
import styles from "./PartidoDelDia.module.css";
import type { MatchOfTheDay } from "@/lib/prode/types";
import { teamEsName } from "@/lib/prode/countries";
import { PENDING_MATCH_KEY, outcomeFromScore, type MatchOutcome } from "@/lib/prode/matchOfDay";
import { submitMatchPrediction } from "./actions";

const MAX_GOALS = 9;

type MyPick = { outcome: string; home: number | null; away: number | null } | null;

type Props = {
  match: MatchOfTheDay;
  /** Tiene sesión activa (puede confirmar directo). Si no, lo mandamos a registrarse. */
  registered: boolean;
  /** Jugada previa del participante para este partido (si ya jugó). */
  myPick: MyPick;
};

// Confeti del festejo (posiciones deterministas para no romper SSR/hidratación).
const BURST_COLORS = ["cGold", "cCeleste", "cWhite", "cGoldDeep"] as const;
const BURST = Array.from({ length: 22 }, (_, i) => ({
  left: 8 + ((i * 9) % 84),
  bx: (i % 2 ? 1 : -1) * (28 + ((i * 17) % 150)),
  by: 150 + ((i * 13) % 150),
  delay: ((i % 6) * 0.04).toFixed(2),
  color: BURST_COLORS[i % BURST_COLORS.length],
}));

function pickToScore(pick: MyPick): { home: number; away: number } {
  if (pick && pick.home != null && pick.away != null) return { home: pick.home, away: pick.away };
  if (pick?.outcome === "home") return { home: 1, away: 0 };
  if (pick?.outcome === "away") return { home: 0, away: 1 };
  if (pick?.outcome === "draw") return { home: 1, away: 1 };
  return { home: 0, away: 0 }; // arranque neutro: no pre-elige ganador
}

// Reloj en vivo vía useSyncExternalStore: en el server (getServerSnapshot) es
// null, así no hay mismatch de hidratación por reloj/zona horaria; en el cliente
// late cada segundo. Sin setState-in-effect.
const subscribeClock = (cb: () => void) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};
function useNowSeconds(): number | null {
  return useSyncExternalStore(subscribeClock, () => Math.floor(Date.now() / 1000), () => null);
}
function useCountdown(target: string) {
  const sec = useNowSeconds();
  const ready = sec !== null;
  const diff = sec === null ? Infinity : new Date(target).getTime() - sec * 1000;
  const done = ready && diff <= 0;
  const s = diff === Infinity ? 0 : Math.max(0, Math.floor(diff / 1000));
  return { ready, done, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), sec: s % 60 };
}

function stageLabel(match: MatchOfTheDay): string {
  const s = (match.stage || "").toLowerCase();
  if (s.includes("group") || s === "grupo") return `Fase de grupos${match.group_label ? ` · Grupo ${match.group_label}` : ""}`;
  if (s.includes("final") && !s.includes("semi") && !s.includes("quarter")) return "¡La Final!";
  if (s.includes("semi")) return "Semifinal";
  if (s.includes("quarter") || s.includes("8")) return "Cuartos de final";
  if (s.includes("16")) return "Octavos de final";
  if (s.includes("32")) return "Dieciseisavos";
  return match.group_label ? `Grupo ${match.group_label}` : "Mundial 2026";
}

function outcomeText(outcome: MatchOutcome, esHome: string, esAway: string): string {
  return outcome === "home" ? `Gana ${esHome}` : outcome === "away" ? `Gana ${esAway}` : "Empatan";
}

export default function PartidoDelDia({ match, registered, myPick }: Props) {
  const router = useRouter();
  const rm = useReducedMotion();
  const seed = useMemo(() => pickToScore(myPick), [myPick]);
  const [home, setHome] = useState(seed.home);
  const [away, setAway] = useState(seed.away);
  // Hasta que el usuario no toca un stepper no resaltamos ganador (evita sesgo al local).
  const [touched, setTouched] = useState<boolean>(!!myPick);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(myPick ? "saved" : "idle");
  const [saved, setSaved] = useState<{ home: number; away: number } | null>(myPick ? seed : null);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cd = useCountdown(match.kickoff_at);
  const locked = cd.done;

  const outcome = outcomeFromScore(home, away);
  const esHome = teamEsName(match.home);
  const esAway = teamEsName(match.away);

  const fireConfetti = useCallback(() => {
    if (rm) return; // respeta prefers-reduced-motion
    setCelebrate(true);
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setCelebrate(false), 1700);
  }, [rm]);

  useEffect(() => () => { if (burstTimer.current) clearTimeout(burstTimer.current); }, []);

  const setHomeTouched = useCallback((n: number) => { setTouched(true); setHome(n); }, []);
  const setAwayTouched = useCallback((n: number) => { setTouched(true); setAway(n); }, []);

  const onConfirm = useCallback(() => {
    if (locked) return;
    setError(null);
    if (!registered) {
      // Guardamos la jugada y lo llevamos al alta; al entrar al hub se confirma sola.
      try { window.localStorage.setItem(PENDING_MATCH_KEY, JSON.stringify({ matchId: match.id, home, away })); } catch { /* noop */ }
      router.push("/mundial/jugar");
      return;
    }
    setStatus("saving");
    submitMatchPrediction({ matchId: match.id, outcome: outcomeFromScore(home, away), home, away })
      .then((r) => {
        if (r.ok) { setSaved({ home, away }); setStatus("saved"); fireConfetti(); }
        else { setStatus("error"); setError(r.error); }
      })
      .catch(() => { setStatus("error"); setError("Algo falló, probá de nuevo."); });
  }, [locked, registered, match.id, home, away, fireConfetti, router]);

  const onCancelEdit = useCallback(() => {
    if (!saved) return;
    setHome(saved.home); setAway(saved.away); setError(null); setStatus("saved");
  }, [saved]);

  const kickoffTxt = useMemo(() => {
    try {
      return new Date(match.kickoff_at).toLocaleString("es-AR", {
        weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      });
    } catch { return ""; }
  }, [match.kickoff_at]);

  const timeLine = !cd.ready
    ? "Cierra al empezar el partido"
    : locked
      ? "El partido ya empezó"
      : (cd.d > 0 ? `Faltan ${cd.d}d ${cd.h}h`
        : cd.h > 0 ? `Cierra en ${cd.h}h ${cd.m}m`
        : `Cierra en ${cd.m}m ${String(cd.sec).padStart(2, "0")}s`)
        + (kickoffTxt ? ` · ${kickoffTxt}` : "");

  const editable = !locked && status !== "saved";
  const editingSaved = status !== "saved" && saved !== null; // está cambiando una jugada ya guardada
  const srStatus = touched ? `${esHome} ${home}, ${esAway} ${away}. ${outcomeText(outcome, esHome, esAway)}.` : "";

  return (
    <section className={`${shell.card} ${shell.cardTopline} ${styles.pdd}`} aria-labelledby="pdd-title">
      {celebrate && (
        <div className={shell.burst} aria-hidden="true">
          {BURST.map((p, i) => (
            <span key={i} className={`${shell.burstPiece} ${shell[p.color]}`}
              style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, ["--bx" as string]: `${p.bx}px`, ["--by" as string]: `${p.by}px` }} />
          ))}
        </div>
      )}

      <div className={styles.head}>
        <span className={`${match.is_featured ? shell.pillGold : shell.pillCeleste} ${styles.badge}`}>
          {match.is_featured ? <Flame size={13} /> : <span className={shell.liveDot} aria-hidden="true" />}
          {match.is_featured ? "Partido del día" : "Próximo partido"}
        </span>
        <span className={styles.stage}>{stageLabel(match)}</span>
      </div>

      <h2 id="pdd-title" className={`${shell.shineTitle} ${styles.title}`}>¡Adiviná el resultado!</h2>
      <p className={styles.sub}>Clavá el marcador exacto y sumá fichas para el sorteo de cortes 🙌</p>

      <div className={styles.board}>
        <TeamSide
          team={match.home} label={match.home_label} name={esHome}
          value={home} onChange={setHomeTouched} editable={editable}
          winning={touched && outcome === "home"} draw={touched && outcome === "draw"} side="home" rm={!!rm}
        />

        <div className={styles.center}>
          <div className={styles.vs} aria-hidden="true">VS</div>
        </div>

        <TeamSide
          team={match.away} label={match.away_label} name={esAway}
          value={away} onChange={setAwayTouched} editable={editable}
          winning={touched && outcome === "away"} draw={touched && outcome === "draw"} side="away" rm={!!rm}
        />
      </div>

      <div className={styles.resultRow}>
        {touched
          ? <OutcomeChip outcome={outcome} esHome={esHome} esAway={esAway} rm={!!rm} />
          : <span className={styles.hint}>Tocá + y − para armar tu marcador 👆</span>}
      </div>
      <div className={shell.srOnly} role="status" aria-live="polite">{srStatus}</div>

      <div className={styles.meta}>
        <span className={styles.pts}>
          <Trophy size={13} /> +{match.outcome_points} al ganador · +{match.exact_bonus} si clavás el marcador
          {match.is_featured && match.featured_multiplier > 1 ? <em className={styles.mult}>x{match.featured_multiplier}</em> : null}
        </span>
        <span className={styles.countdown}><Clock size={13} /> {timeLine}</span>
      </div>

      {error && (
        <p className={shell.error}>
          {error}{saved ? ` · Tu jugada guardada sigue siendo ${saved.home} - ${saved.away}.` : ""}
        </p>
      )}

      <AnimatePresence mode="wait">
        {locked ? (
          <motion.div key="locked" initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }} className={styles.locked}>
            <Lock size={15} /> Las jugadas para este partido ya cerraron.
          </motion.div>
        ) : status === "saved" ? (
          <motion.div key="saved" initial={rm ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className={shell.noticeGood}>
              <Check size={16} /> Tu jugada quedó registrada: <strong className={styles.savedScore}>{saved?.home ?? home} - {saved?.away ?? away}</strong>. ¡Mucha suerte!
            </div>
            <button type="button" className={styles.edit} onClick={() => setStatus("idle")}>
              <Pencil size={14} /> Cambiar mi jugada
            </button>
          </motion.div>
        ) : (
          <motion.div key="confirm" initial={rm ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <button type="button" className={shell.btnPrimary} onClick={onConfirm} disabled={status === "saving" || (!touched && registered)}>
              {status === "saving"
                ? "Guardando…"
                : registered
                  ? <>Confirmar mi jugada <Check size={18} /></>
                  : <>Jugar gratis <ArrowRight size={18} /></>}
            </button>
            {editingSaved && (
              <button type="button" className={styles.edit} onClick={onCancelEdit}>
                <X size={14} /> Cancelar
              </button>
            )}
            {!registered && <p className={styles.note}>Gratis · te verificamos por WhatsApp en 20 segundos</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function OutcomeChip({ outcome, esHome, esAway, rm }: { outcome: MatchOutcome; esHome: string; esAway: string; rm: boolean }) {
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
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {txt}
      </motion.span>
    </AnimatePresence>
  );
}

function TeamSide({
  team, label, name, value, onChange, editable, winning, draw, side, rm,
}: {
  team: MatchOfTheDay["home"];
  label: string | null;
  name: string;
  value: number;
  onChange: (n: number) => void;
  editable: boolean;
  winning: boolean;
  draw: boolean;
  side: "home" | "away";
  rm: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  const state = winning ? styles.teamWin : draw ? styles.teamDraw : "";
  return (
    <div className={`${styles.team} ${state}`}>
      <div className={styles.flagWrap}>
        {team?.flag_url && imgOk
          ? <img className={styles.flag} src={team.flag_url} alt={name} width={72} height={72} loading="lazy" onError={() => setImgOk(false)} />
          : <span className={styles.flag} aria-hidden="true" />}
        {winning && <span className={styles.crown} aria-hidden="true">★</span>}
      </div>
      <div className={styles.teamName}>{(name || label || "A definir").toUpperCase()}</div>

      <div className={styles.stepper}>
        <button type="button" className={styles.step} aria-label={`Restar gol a ${name}`}
          onClick={() => onChange(Math.max(0, value - 1))} disabled={!editable || value <= 0}>
          <Minus size={18} />
        </button>
        <div className={styles.numWrap}>
          {rm ? (
            <span className={styles.num}>{value}</span>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={value} className={styles.num}
                initial={{ y: side === "home" ? 18 : -18, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: side === "home" ? -18 : 18, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
                {value}
              </motion.span>
            </AnimatePresence>
          )}
        </div>
        <button type="button" className={styles.step} aria-label={`Sumar gol a ${name}`}
          onClick={() => onChange(Math.min(MAX_GOALS, value + 1))} disabled={!editable || value >= MAX_GOALS}>
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
