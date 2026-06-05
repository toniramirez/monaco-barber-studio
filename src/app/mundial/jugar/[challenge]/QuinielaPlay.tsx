"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Crown, ChevronLeft, ChevronRight, Search, Check, Trophy, PartyPopper, Lock,
} from "lucide-react";
import shell from "../../Shell.module.css";
import styles from "../Jugar.module.css";
import type { ProdeQuestion, ProdeTeam, ParticipantSummary } from "@/lib/prode/types";
import { teamEsName } from "@/lib/prode/countries";
import { submitQuiniela } from "../../actions";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const BURST_COLORS = ["cGold", "cCeleste", "cWhite", "cGoldDeep"] as const;
const BURST = Array.from({ length: 22 }, (_, i) => ({
  left: 8 + ((i * 9) % 84),
  bx: (i % 2 ? 1 : -1) * (28 + ((i * 17) % 150)),
  by: 150 + ((i * 13) % 150),
  delay: ((i % 6) * 0.04).toFixed(2),
  color: BURST_COLORS[i % BURST_COLORS.length],
}));

type Props = {
  questions: ProdeQuestion[];
  teams: ProdeTeam[];
  myState: ParticipantSummary | null;
  locked: boolean;
  rewardLabel: string;
};

/**
 * La Gran Quiniela (desafío especial): las 6 preguntas grandes (campeón, goleador,
 * etc.) una por una, con guardado al final. Reusa el flujo probado de la quiniela.
 */
export default function QuinielaPlay({ questions, teams, myState, locked, rewardLabel }: Props) {
  const rm = useReducedMotion();

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    myState?.quiniela?.forEach((q) => { seed[q.question_id] = q.answer; });
    return seed;
  });
  const [qIndex, setQIndex] = useState(0);
  const [teamSearch, setTeamSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const animate = rm
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 16, filter: "blur(4px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -12, filter: "blur(4px)" },
        transition: { duration: 0.4, ease: EASE },
      };

  function onSave() {
    setError(null);
    const payload = Object.entries(answers)
      .filter(([, a]) => a && a.length > 0)
      .map(([question_id, answer]) => ({ question_id, answer }));
    setPending(true);
    submitQuiniela(payload)
      .then((r) => {
        if (!r.ok) { setError(r.error); return; }
        setCelebrate(true);
        setDone(true);
      })
      .catch(() => setError("Algo falló, probá de nuevo."))
      .finally(() => setPending(false));
  }

  const total = questions.length;
  const q = total > 0 ? questions[Math.min(qIndex, total - 1)] : null;
  const value = q ? answers[q.id] ?? "" : "";
  const setValue = (v: string) => q && setAnswers((prev) => ({ ...prev, [q.id]: v }));
  const isLast = qIndex >= total - 1;
  const answeredCount = useMemo(
    () => questions.filter((qq) => (answers[qq.id] ?? "").length > 0).length,
    [questions, answers],
  );

  const filteredTeams = useMemo(() => {
    if (!teamSearch) return teams;
    const needle = teamSearch.toLowerCase();
    return teams.filter(
      (t) => t.name.toLowerCase().includes(needle) || teamEsName(t).toLowerCase().includes(needle),
    );
  }, [teams, teamSearch]);

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <Link href="/mundial/jugar" className={styles.backLink}>
          <ChevronLeft size={16} aria-hidden="true" /> Volver al camino
        </Link>
        <h1 className={shell.sectionTitle}>
          <Crown size={24} className={styles.headIcon} aria-hidden="true" /> La Gran{" "}
          <span className={shell.em}>Quiniela</span>
        </h1>
        <p className={shell.sectionSub}>
          Campeón, goleador y más. {rewardLabel} — el desafío que define al campeón del prode.
        </p>
      </header>

      <div className={`${shell.card} ${shell.cardTopline} ${styles.flowCard}`}>
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" {...animate} className={styles.done}>
              {celebrate && (
                <div className={shell.burst} aria-hidden="true">
                  {BURST.map((p, i) => (
                    <span key={i} className={`${shell.burstPiece} ${shell[p.color]}`}
                      style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, ["--bx" as string]: `${p.bx}px`, ["--by" as string]: `${p.by}px` }} />
                  ))}
                </div>
              )}
              <PartyPopper className={styles.doneIcon} size={40} aria-hidden="true" />
              <h2 className={styles.doneTitle}>¡Gran Quiniela guardada! 👑</h2>
              <p className={styles.doneSub}>
                Tus pronósticos grandes están cargados. Seguí completando los Desafíos para sumar fichas.
              </p>
              <div className={styles.doneActions}>
                <Link href="/mundial/jugar" className={shell.btnPrimary}>
                  Volver al camino <ChevronRight size={18} aria-hidden="true" />
                </Link>
                <Link href="/mundial/tabla" className={shell.btnGhost}>
                  Ver la tabla
                </Link>
              </div>
            </motion.div>
          ) : total === 0 ? (
            <motion.div key="empty" {...animate}>
              <p className={styles.stepSub}>La Quiniela se está preparando. Volvé en un rato.</p>
            </motion.div>
          ) : (
            <motion.div key={`q-${q!.id}`} {...animate}>
              <div className={styles.qProgress}>Pregunta {qIndex + 1} de {total} · {answeredCount} respondidas</div>
              <div
                className={styles.qBar}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={qIndex + 1}
                aria-label="Progreso de la Gran Quiniela"
              >
                <div className={styles.qBarFill} style={{ width: `${((qIndex + 1) / total) * 100}%` }} />
              </div>

              <span className={`${shell.pill} ${shell.pillGold} ${styles.qPoints}`}>
                <Trophy size={12} aria-hidden="true" /> {q!.points} pts
              </span>
              <div className={styles.qLabel}>{q!.label}</div>
              {q!.help_text && <div className={styles.qHelp}>{q!.help_text}</div>}

              {q!.answer_type === "team" && (
                teams.length === 0 ? (
                  <p className={shell.helper}>El fixture se está cargando. Guardá el resto y volvé.</p>
                ) : (
                  <>
                    <div className={`${shell.field} ${styles.searchField}`}>
                      <Search size={15} className={styles.searchIcon} aria-hidden="true" />
                      <input className={`${shell.input} ${styles.searchInput}`} value={teamSearch} onChange={(e) => setTeamSearch(e.target.value)} placeholder="Buscar selección…" aria-label="Buscar selección" />
                    </div>
                    <div className={styles.options}>
                      {filteredTeams.map((t) => {
                        const active = value === t.id;
                        return (
                          <button key={t.id} type="button" aria-pressed={active} className={`${styles.teamOption} ${active ? styles.teamOptionActive : ""}`} onClick={() => setValue(t.id)}>
                            {t.flag_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img className={styles.optionFlag} src={t.flag_url} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                            ) : (
                              <span className={styles.optionFlag} aria-hidden="true" />
                            )}
                            <span className={styles.optionName}>{teamEsName(t)}</span>
                            {t.group_label ? <span className={`${shell.pill} ${styles.optionGroup}`}>{t.group_label}</span> : null}
                            {active && <Check size={18} className={styles.optionCheck} aria-hidden="true" />}
                          </button>
                        );
                      })}
                      {filteredTeams.length === 0 && <p className={shell.helper}>No encontramos esa selección.</p>}
                    </div>
                  </>
                )
              )}

              {q!.answer_type === "choice" && (
                <div className={styles.options}>
                  {(q!.options ?? []).map((opt) => (
                    <button key={opt} type="button" aria-pressed={value === opt} className={`${styles.option} ${value === opt ? styles.optionActive : ""}`} onClick={() => setValue(opt)}>
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q!.answer_type === "text" && (
                <input className={shell.input} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Escribí tu respuesta" aria-label={q!.label} />
              )}

              {q!.answer_type === "number" && (
                <input className={shell.input} value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" aria-label={q!.label} />
              )}

              {locked && (
                <p className={styles.lockedNote}>
                  <Lock size={13} aria-hidden="true" /> La quiniela ya cerró — guardás solo para verla.
                </p>
              )}
              {error && <p className={shell.error} role="alert">{error}</p>}

              <div className={styles.qNav}>
                {qIndex > 0 && (
                  <button className={`${shell.btnGhost} ${styles.navBtn}`} onClick={() => setQIndex((i) => i - 1)}>
                    <ChevronLeft size={16} aria-hidden="true" /> Atrás
                  </button>
                )}
                {!isLast ? (
                  <button className={`${shell.btnPrimary} ${styles.navBtn}`} onClick={() => setQIndex((i) => i + 1)}>
                    Siguiente <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <button className={`${shell.btnPrimary} ${styles.navBtn}`} onClick={onSave} disabled={pending}>
                    {pending ? "Guardando…" : "Guardar mi Quiniela 🏆"}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
