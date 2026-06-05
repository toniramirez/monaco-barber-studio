"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Ticket, KeyRound, LogIn, ChevronRight, ChevronLeft, PartyPopper,
  Search, Check, Target, Trophy, CheckCircle2,
} from "lucide-react";
import shell from "../Shell.module.css";
import styles from "./Jugar.module.css";
import type { ProdeQuestion, ProdeTeam, ParticipantSummary } from "@/lib/prode/types";
import { teamEsName } from "@/lib/prode/countries";
import {
  PENDING_MATCH_KEY, outcomeFromScore, type PendingMatch,
} from "@/lib/prode/matchOfDay";
import {
  authWithPin, completeProfile, submitQuiniela, submitMatchPrediction,
} from "../actions";

type View = "register" | "profile" | "quiniela" | "done";
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Confeti de festejo al terminar (posiciones DETERMINISTAS por índice — nunca
// random — para no romper la hidratación). Se dispara una sola vez.
const BURST_COLORS = ["cGold", "cCeleste", "cWhite", "cGoldDeep"] as const;
const BURST = Array.from({ length: 20 }, (_, i) => ({
  left: 12 + ((i * 9) % 76),
  bx: (i % 2 ? 1 : -1) * (24 + ((i * 17) % 150)),
  by: 150 + ((i * 11) % 130),
  delay: ((i % 6) * 0.04).toFixed(2),
  color: BURST_COLORS[i % BURST_COLORS.length],
}));

type Props = {
  /** ¿La quiniela ya cerró? Lo calcula el server (page) para no leer la hora en render. */
  locked: boolean;
  questions: ProdeQuestion[];
  teams: ProdeTeam[];
  myState: ParticipantSummary | null;
  matchOfDay: { id: string; lockAt: string; homeName: string; awayName: string } | null;
};

export default function JugarClient({ locked, questions, teams, myState, matchOfDay }: Props) {
  const rm = useReducedMotion();

  const hasQuiniela = (myState?.quiniela.length ?? 0) > 0;

  const initialView: View = !myState
    ? "register"
    : !myState.profile_completed
      ? "profile"
      : locked
        ? "done"
        : "quiniela";

  const [view, setView] = useState<View>(initialView);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  // registro
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [displayName, setDisplayName] = useState(myState?.display_name ?? "");

  // perfil
  const [email, setEmail] = useState("");
  const [dni, setDni] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [consent, setConsent] = useState(false);

  // quiniela
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    myState?.quiniela?.forEach((q) => { seed[q.question_id] = q.answer; });
    return seed;
  });
  const [qIndex, setQIndex] = useState(0);
  const [teamSearch, setTeamSearch] = useState("");
  const [savedQuiniela, setSavedQuiniela] = useState(hasQuiniela);

  // ¿ya está registrado el participante? (alta original o tras verificar)
  const [registered, setRegistered] = useState(!!myState);

  // Confirmación de la "jugada del Partido del Día" que venía pendiente del pre-registro.
  const [matchDayMsg, setMatchDayMsg] = useState<string | null>(null);
  // Liga a la que se auto-unió al registrarse (si llegó por un link ?liga=CODE).
  const [joinedLeagueMsg, setJoinedLeagueMsg] = useState<string | null>(null);
  // Jugada dialada antes de registrarse (para mostrarla durante el alta) + latch anti doble-envío.
  const [pendingPick, setPendingPick] = useState<PendingMatch | null>(null);
  const matchHandledRef = useRef(false);

  // Ejecuta una acción async y SIEMPRE libera el estado de carga (finally),
  // aunque falle o el componente cambie de vista. Evita que el botón quede
  // pegado en "Enviando…".
  const run = useCallback((fn: () => Promise<unknown>) => {
    setPending(true);
    Promise.resolve(fn())
      .catch((e) => { console.error("[prode]", e); setError("Algo falló, probá de nuevo."); })
      .finally(() => setPending(false));
  }, []);

  // Mostrar durante el alta la jugada que el visitante dejó dialada (banner del embudo).
  useEffect(() => {
    if (!matchOfDay) return;
    try {
      const raw = window.localStorage.getItem(PENDING_MATCH_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as PendingMatch;
      // localStorage es client-only: leerlo en un effect (no en render) mantiene
      // server y primer render del cliente en null → sin mismatch de hidratación.
      // Este setState es intencional y de una sola vez.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (p && p.matchId === matchOfDay.id) setPendingPick(p);
    } catch { /* noop */ }
  }, [matchOfDay]);

  // Una vez registrado: confirmamos la jugada pendiente y recién ahí borramos la
  // clave. Si falla, NO la borramos (no se pierde la jugada) y soltamos el latch
  // para reintentar. La tarjeta vive en otra pantalla, así que no despachamos evento.
  useEffect(() => {
    if (!matchOfDay || !registered || matchHandledRef.current) return;
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(PENDING_MATCH_KEY); } catch { return; }
    if (!raw) return;
    let parsed: PendingMatch | null = null;
    try { parsed = JSON.parse(raw) as PendingMatch; } catch { parsed = null; }
    if (!parsed || parsed.matchId !== matchOfDay.id) return;
    if (new Date(matchOfDay.lockAt).getTime() <= Date.now()) {
      try { window.localStorage.removeItem(PENDING_MATCH_KEY); } catch { /* noop */ }
      return; // el partido ya cerró
    }
    const pick = parsed;
    matchHandledRef.current = true;
    submitMatchPrediction({
      matchId: pick.matchId, outcome: outcomeFromScore(pick.home, pick.away), home: pick.home, away: pick.away,
    }).then((r) => {
      if (r.ok) {
        try { window.localStorage.removeItem(PENDING_MATCH_KEY); } catch { /* noop */ }
        setMatchDayMsg(`¡Tu jugada del Partido del Día quedó confirmada: ${pick.home} - ${pick.away}! 🎯`);
        setPendingPick(null);
      } else {
        matchHandledRef.current = false; // permitir reintento
      }
    }).catch(() => { matchHandledRef.current = false; });
  }, [registered, matchOfDay]);

  // ---------- handlers ----------
  function afterAuth(data: { displayName?: string; joinedLeague?: string | null }) {
    if (data.displayName) setDisplayName(data.displayName);
    if (data.joinedLeague) setJoinedLeagueMsg(`¡Te uniste a la liga "${data.joinedLeague}"! 🤝`);
    setRegistered(true);
    setView("profile");
  }

  function onRegister() {
    setError(null);
    if (firstName.trim().length < 2) return setError("Ingresá tu nombre");
    if (phone.replace(/\D/g, "").length < 8) return setError("Ingresá un teléfono válido");
    if (!/^\d{4}$/.test(pin)) return setError("Elegí un PIN de 4 dígitos");
    run(async () => {
      const r = await authWithPin({ phone, pin, firstName, lastName });
      if (!r.ok) { setError(r.error); return; }
      if (r.data.needName) { setError("Completá tu nombre para crear la cuenta"); return; }
      afterAuth(r.data);
    });
  }

  function onLogin() {
    setError(null);
    if (phone.replace(/\D/g, "").length < 8) return setError("Ingresá tu teléfono");
    if (!/^\d{4}$/.test(pin)) return setError("El PIN son 4 dígitos");
    run(async () => {
      const r = await authWithPin({ phone, pin });
      if (!r.ok) { setError(r.error); return; }
      if (r.data.needName) {
        setAuthMode("register");
        setError("No encontramos una cuenta con ese teléfono. Creá la tuya 👇");
        return;
      }
      // Jugador que vuelve: recargamos para hidratar su estado (perfil/quiniela ya
      // hechos) y caer en la vista correcta. La sesión ya quedó seteada en el server.
      window.location.reload();
    });
  }

  function onCompleteProfile() {
    setError(null);
    if (!consent) return setError("Necesitamos tu OK para participar y avisarte si ganás");
    run(async () => {
      const r = await completeProfile({ email, dni, birthdate, consent });
      if (!r.ok) { setError(r.error); return; }
      const next: View = locked ? "done" : "quiniela";
      if (next === "done") setCelebrate(true);
      setView(next);
    });
  }

  function onSaveQuiniela() {
    setError(null);
    const payload = Object.entries(answers)
      .filter(([, a]) => a && a.length > 0)
      .map(([question_id, answer]) => ({ question_id, answer }));
    run(async () => {
      const r = await submitQuiniela(payload);
      if (!r.ok) { setError(r.error); return; }
      setSavedQuiniela(true);
      setCelebrate(true);
      setView("done");
    });
  }

  // ---------- animaciones de transición entre vistas ----------
  const animate = rm
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 16, filter: "blur(4px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -12, filter: "blur(4px)" },
        transition: { duration: 0.4, ease: EASE },
      };

  const showPendingBanner = !!pendingPick && !!matchOfDay && view !== "done" && view !== "quiniela";
  const editing = registered && hasQuiniela;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={shell.sectionTitle}>
          <Ticket size={24} className={styles.headIcon} aria-hidden="true" />{" "}
          {editing ? <>Editá tu <span className={shell.em}>jugada</span></> : <>Armá tu <span className={shell.em}>jugada</span></>}
        </h1>
        <p className={shell.sectionSub}>
          Gratis y en 20 segundos. Cuanto más le acertás, más cortes ganás.
        </p>
      </header>

      <div className={`${shell.card} ${shell.cardTopline} ${styles.flowCard}`}>
        {showPendingBanner && (
          <div className={styles.pendingPick}>
            <Target size={16} aria-hidden="true" />
            <span>
              Estás a un paso de confirmar tu <strong>{pendingPick!.home} - {pendingPick!.away}</strong>{" "}
              en {matchOfDay!.homeName} vs {matchOfDay!.awayName}. Creá tu cuenta y lo dejamos jugado.
            </span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === "register" && authMode === "register" && (
            <motion.div key="register" {...animate}>
              <h2 className={styles.stepTitle}>Sumate al Prode 🎰</h2>
              <p className={styles.stepSub}>
                Creá tu cuenta en 20 segundos y elegí un PIN. Después entrás solo con el PIN, sin esperar códigos.
              </p>
              <div className={shell.row2}>
                <div className={shell.field}>
                  <label className={shell.label} htmlFor="jg-nombre">Nombre</label>
                  <input id="jg-nombre" className={shell.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nacho" autoComplete="given-name" />
                </div>
                <div className={shell.field}>
                  <label className={shell.label} htmlFor="jg-apellido">Apellido</label>
                  <input id="jg-apellido" className={shell.input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Pérez" autoComplete="family-name" />
                </div>
              </div>
              <div className={shell.field}>
                <label className={shell.label} htmlFor="jg-wpp">WhatsApp</label>
                <input id="jg-wpp" className={shell.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="351 555 5555" inputMode="tel" autoComplete="tel" />
              </div>
              <div className={shell.field}>
                <label className={shell.label} htmlFor="jg-pin">Elegí tu PIN (4 dígitos)</label>
                <input
                  id="jg-pin"
                  className={`${shell.input} ${styles.otpInput}`}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={4}
                />
              </div>
              {error && <p className={shell.error} role="alert">{error}</p>}
              <button className={shell.btnPrimary} onClick={onRegister} disabled={pending}>
                {pending ? "Entrando…" : <>Crear cuenta y entrar <KeyRound size={18} aria-hidden="true" /></>}
              </button>
              <button className={shell.btnGhost} onClick={() => { setError(null); setPin(""); setAuthMode("login"); }}>
                ¿Ya jugás? Entrá con tu PIN
              </button>
            </motion.div>
          )}

          {view === "register" && authMode === "login" && (
            <motion.div key="login" {...animate}>
              <h2 className={styles.stepTitle}>Entrá con tu PIN 🔑</h2>
              <p className={styles.stepSub}>Poné tu teléfono y el PIN que elegiste cuando te sumaste.</p>
              <div className={shell.field}>
                <label className={shell.label} htmlFor="jg-wpp-l">WhatsApp</label>
                <input id="jg-wpp-l" className={shell.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="351 555 5555" inputMode="tel" autoComplete="tel" />
              </div>
              <div className={shell.field}>
                <label className={shell.label} htmlFor="jg-pin-l">PIN (4 dígitos)</label>
                <input
                  id="jg-pin-l"
                  className={`${shell.input} ${styles.otpInput}`}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  inputMode="numeric"
                  autoComplete="current-password"
                  maxLength={4}
                />
              </div>
              {error && <p className={shell.error} role="alert">{error}</p>}
              <button className={shell.btnPrimary} onClick={onLogin} disabled={pending || pin.length !== 4}>
                {pending ? "Entrando…" : <>Entrar <LogIn size={18} aria-hidden="true" /></>}
              </button>
              <button className={shell.btnGhost} onClick={() => { setError(null); setPin(""); setAuthMode("register"); }}>
                ¿Primera vez? Creá tu cuenta
              </button>
            </motion.div>
          )}

          {view === "profile" && (
            <motion.div key="profile" {...animate}>
              <h2 className={styles.stepTitle}>Confirmá tu jugada</h2>
              <p className={styles.stepSub}>
                Necesitamos estos datos para validar tu identidad cuando cobres el premio en el local.
              </p>
              <div className={shell.field}>
                <label className={shell.label} htmlFor="jg-email">Email</label>
                <input id="jg-email" className={shell.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@email.com" type="email" autoComplete="email" />
              </div>
              <div className={shell.row2}>
                <div className={shell.field}>
                  <label className={shell.label} htmlFor="jg-dni">DNI</label>
                  <input id="jg-dni" className={shell.input} value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="30111222" inputMode="numeric" />
                </div>
                <div className={shell.field}>
                  <label className={shell.label} htmlFor="jg-nac">Nacimiento</label>
                  <input id="jg-nac" className={shell.input} value={birthdate} onChange={(e) => setBirthdate(e.target.value)} type="date" />
                </div>
              </div>
              <label className={shell.consent}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>Acepto las bases y que Monaco use mis datos para el prode y avisarme novedades (Ley 25.326).</span>
              </label>
              {error && <p className={shell.error} role="alert">{error}</p>}
              <button className={shell.btnPrimary} onClick={onCompleteProfile} disabled={pending}>
                {pending ? "Guardando…" : locked ? "Guardar y ver la tabla" : "Guardar y armar mi Quiniela"}
              </button>
            </motion.div>
          )}

          {view === "quiniela" && (
            <QuinielaView
              questions={questions} teams={teams} answers={answers} setAnswers={setAnswers}
              qIndex={qIndex} setQIndex={setQIndex} teamSearch={teamSearch} setTeamSearch={setTeamSearch}
              onSave={onSaveQuiniela} pending={pending} error={error} animate={animate}
            />
          )}

          {view === "done" && (
            <motion.div key="done" {...animate} className={styles.done}>
              {celebrate && (
                <div className={shell.burst} aria-hidden="true">
                  {BURST.map((p, i) => (
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
              <PartyPopper className={styles.doneIcon} size={40} aria-hidden="true" />
              <h2 className={styles.doneTitle}>
                {savedQuiniela
                  ? `¡Estás adentro, ${displayName || "crack"}!`
                  : `¡Bienvenido, ${displayName || "crack"}!`}
              </h2>
              <p className={styles.doneSub}>
                {!locked && !savedQuiniela
                  ? "Te falta armar tu Quiniela para sumar puntos."
                  : "Seguí los partidos y escalá en la tabla. Tus fichas se canjean por cortes en Monaco."}
              </p>

              {matchDayMsg && (
                <div className={shell.noticeGood} role="status">
                  <CheckCircle2 size={18} aria-hidden="true" /> {matchDayMsg}
                </div>
              )}

              {joinedLeagueMsg && (
                <div className={shell.noticeGood} role="status">
                  <CheckCircle2 size={18} aria-hidden="true" /> {joinedLeagueMsg}
                </div>
              )}

              <div className={styles.doneActions}>
                {!locked && !savedQuiniela && (
                  <button className={shell.btnPrimary} onClick={() => { setQIndex(0); setView("quiniela"); }}>
                    Armar mi Quiniela <ChevronRight size={18} aria-hidden="true" />
                  </button>
                )}
                {!locked && savedQuiniela && (
                  <button className={shell.btnGhost} onClick={() => { setQIndex(0); setError(null); setView("quiniela"); }}>
                    Editar mi Quiniela
                  </button>
                )}
                <Link href="/mundial/tabla" className={shell.btnPrimary}>
                  Ver la tabla <Trophy size={18} aria-hidden="true" />
                </Link>
                <Link href="/mundial/cuenta" className={shell.btnGhost}>
                  Mi cuenta y mi liga
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ===== Quiniela (cards por pregunta) =====
function QuinielaView({
  questions, teams, answers, setAnswers, qIndex, setQIndex, teamSearch, setTeamSearch, onSave, pending, error, animate,
}: {
  questions: ProdeQuestion[];
  teams: ProdeTeam[];
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  qIndex: number;
  setQIndex: React.Dispatch<React.SetStateAction<number>>;
  teamSearch: string;
  setTeamSearch: (s: string) => void;
  onSave: () => void;
  pending: boolean;
  error: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  animate: any;
}) {
  if (questions.length === 0) {
    return (
      <motion.div key="quiniela-empty" {...animate}>
        <p className={styles.stepSub}>La Quiniela se está preparando. Volvé en un rato.</p>
      </motion.div>
    );
  }

  const q = questions[Math.min(qIndex, questions.length - 1)];
  const total = questions.length;
  const value = answers[q.id] ?? "";
  const setValue = (v: string) => setAnswers((prev) => ({ ...prev, [q.id]: v }));

  const filteredTeams = teamSearch
    ? teams.filter((t) => {
        const needle = teamSearch.toLowerCase();
        return t.name.toLowerCase().includes(needle) || teamEsName(t).toLowerCase().includes(needle);
      })
    : teams;

  const isLast = qIndex >= total - 1;
  const answeredCount = questions.filter((qq) => (answers[qq.id] ?? "").length > 0).length;

  return (
    <motion.div key={`q-${q.id}`} {...animate}>
      <div className={styles.qProgress}>Pregunta {qIndex + 1} de {total} · {answeredCount} respondidas</div>
      <div className={styles.qBar}>
        <div className={styles.qBarFill} style={{ width: `${((qIndex + 1) / total) * 100}%` }} />
      </div>

      <span className={`${shell.pill} ${shell.pillGold} ${styles.qPoints}`}>
        <Trophy size={12} aria-hidden="true" /> {q.points} pts
      </span>
      <div className={styles.qLabel}>{q.label}</div>
      {q.help_text && <div className={styles.qHelp}>{q.help_text}</div>}

      {q.answer_type === "team" && (
        teams.length === 0 ? (
          <p className={shell.helper}>
            El fixture se está cargando. Vas a poder elegir el equipo en breve — guardá el resto y volvé.
          </p>
        ) : (
          <>
            <div className={`${shell.field} ${styles.searchField}`}>
              <Search size={15} className={styles.searchIcon} aria-hidden="true" />
              <input
                className={`${shell.input} ${styles.searchInput}`}
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Buscar selección…"
                aria-label="Buscar selección"
              />
            </div>
            <div className={styles.options}>
              {filteredTeams.map((t) => {
                const active = value === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    className={`${styles.teamOption} ${active ? styles.teamOptionActive : ""}`}
                    onClick={() => setValue(t.id)}
                  >
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

      {q.answer_type === "choice" && (
        <div className={styles.options}>
          {(q.options ?? []).map((opt) => (
            <button
              key={opt}
              type="button"
              aria-pressed={value === opt}
              className={`${styles.option} ${value === opt ? styles.optionActive : ""}`}
              onClick={() => setValue(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {q.answer_type === "text" && (
        <input className={shell.input} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Escribí tu respuesta" aria-label={q.label} />
      )}

      {q.answer_type === "number" && (
        <input className={shell.input} value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" aria-label={q.label} />
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
  );
}
