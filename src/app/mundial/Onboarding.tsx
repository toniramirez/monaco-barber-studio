"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Swords, KeyRound, LogIn, PartyPopper, CheckCircle2, ChevronRight } from "lucide-react";
import shell from "./Shell.module.css";
import styles from "./jugar/Jugar.module.css";
import { authWithPin, completeProfile } from "./actions";

type View = "register" | "profile" | "done";
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Confeti determinista por índice (SSR-safe), igual patrón que el resto del Prode.
const BURST_COLORS = ["cGold", "cCeleste", "cWhite", "cGoldDeep"] as const;
const BURST = Array.from({ length: 20 }, (_, i) => ({
  left: 12 + ((i * 9) % 76),
  bx: (i % 2 ? 1 : -1) * (24 + ((i * 17) % 150)),
  by: 150 + ((i * 11) % 130),
  delay: ((i % 6) * 0.04).toFixed(2),
  color: BURST_COLORS[i % BURST_COLORS.length],
}));

/**
 * Alta del Prode (sin OTP): registro/login por PIN + perfil. Preserva la lógica
 * battle-tested de authWithPin/completeProfile. Al terminar, manda al sendero de
 * Desafíos. Es la pantalla raíz de /mundial/jugar cuando el jugador no existe.
 */
export default function Onboarding() {
  const router = useRouter();
  const rm = useReducedMotion();

  const [view, setView] = useState<View>("register");
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [email, setEmail] = useState("");
  const [dni, setDni] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [consent, setConsent] = useState(false);

  const [joinedLeagueMsg, setJoinedLeagueMsg] = useState<string | null>(null);

  const run = useCallback((fn: () => Promise<unknown>) => {
    setPending(true);
    Promise.resolve(fn())
      .catch((e) => {
        console.error("[prode]", e);
        setError("Algo falló, probá de nuevo.");
      })
      .finally(() => setPending(false));
  }, []);

  function onRegister() {
    setError(null);
    if (firstName.trim().length < 2) return setError("Ingresá tu nombre");
    if (phone.replace(/\D/g, "").length < 8) return setError("Ingresá un teléfono válido");
    if (!/^\d{4}$/.test(pin)) return setError("Elegí un PIN de 4 dígitos");
    run(async () => {
      const r = await authWithPin({ phone, pin, firstName, lastName });
      if (!r.ok) return setError(r.error);
      if (r.data.needName) return setError("Completá tu nombre para crear la cuenta");
      if (r.data.displayName) setDisplayName(r.data.displayName);
      if (r.data.joinedLeague) setJoinedLeagueMsg(`¡Te uniste a la liga "${r.data.joinedLeague}"! 🤝`);
      setView("profile");
    });
  }

  function onLogin() {
    setError(null);
    if (phone.replace(/\D/g, "").length < 8) return setError("Ingresá tu teléfono");
    if (!/^\d{4}$/.test(pin)) return setError("El PIN son 4 dígitos");
    run(async () => {
      const r = await authWithPin({ phone, pin });
      if (!r.ok) return setError(r.error);
      if (r.data.needName) {
        setAuthMode("register");
        return setError("No encontramos una cuenta con ese teléfono. Creá la tuya 👇");
      }
      // Jugador que vuelve: recargamos para hidratar su estado y caer en el sendero.
      router.refresh();
    });
  }

  function onCompleteProfile() {
    setError(null);
    if (!consent) return setError("Necesitamos tu OK para participar y avisarte si ganás");
    run(async () => {
      const r = await completeProfile({ email, dni, birthdate, consent });
      if (!r.ok) return setError(r.error);
      setCelebrate(true);
      setView("done");
    });
  }

  const animate = rm
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 16, filter: "blur(4px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -12, filter: "blur(4px)" },
        transition: { duration: 0.4, ease: EASE },
      };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={shell.sectionTitle}>
          <Swords size={24} className={styles.headIcon} aria-hidden="true" /> Sumate al{" "}
          <span className={shell.em}>Prode</span>
        </h1>
        <p className={shell.sectionSub}>
          Gratis y en 20 segundos. Entrás con un PIN, sin esperar códigos.
        </p>
      </header>

      <div className={`${shell.card} ${shell.cardTopline} ${styles.flowCard}`}>
        <AnimatePresence mode="wait">
          {view === "register" && authMode === "register" && (
            <motion.div key="register" {...animate}>
              <h2 className={styles.stepTitle}>Creá tu cuenta 🎰</h2>
              <p className={styles.stepSub}>
                Elegí un PIN de 4 dígitos. Después entrás solo con el PIN, sin esperar códigos.
              </p>
              <div className={shell.row2}>
                <div className={shell.field}>
                  <label className={shell.label} htmlFor="ob-nombre">Nombre</label>
                  <input id="ob-nombre" className={shell.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nacho" autoComplete="given-name" />
                </div>
                <div className={shell.field}>
                  <label className={shell.label} htmlFor="ob-apellido">Apellido</label>
                  <input id="ob-apellido" className={shell.input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Pérez" autoComplete="family-name" />
                </div>
              </div>
              <div className={shell.field}>
                <label className={shell.label} htmlFor="ob-wpp">WhatsApp</label>
                <input id="ob-wpp" className={shell.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="351 555 5555" inputMode="tel" autoComplete="tel" />
              </div>
              <div className={shell.field}>
                <label className={shell.label} htmlFor="ob-pin">Elegí tu PIN (4 dígitos)</label>
                <input id="ob-pin" className={`${shell.input} ${styles.otpInput}`} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" inputMode="numeric" autoComplete="new-password" maxLength={4} />
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
                <label className={shell.label} htmlFor="ob-wpp-l">WhatsApp</label>
                <input id="ob-wpp-l" className={shell.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="351 555 5555" inputMode="tel" autoComplete="tel" />
              </div>
              <div className={shell.field}>
                <label className={shell.label} htmlFor="ob-pin-l">PIN (4 dígitos)</label>
                <input id="ob-pin-l" className={`${shell.input} ${styles.otpInput}`} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" inputMode="numeric" autoComplete="current-password" maxLength={4} />
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
              <h2 className={styles.stepTitle}>Confirmá tus datos</h2>
              <p className={styles.stepSub}>
                Los necesitamos para validar tu identidad cuando cobres el premio en el local.
              </p>
              <div className={shell.field}>
                <label className={shell.label} htmlFor="ob-email">Email</label>
                <input id="ob-email" className={shell.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@email.com" type="email" autoComplete="email" />
              </div>
              <div className={shell.row2}>
                <div className={shell.field}>
                  <label className={shell.label} htmlFor="ob-dni">DNI</label>
                  <input id="ob-dni" className={shell.input} value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="30111222" inputMode="numeric" />
                </div>
                <div className={shell.field}>
                  <label className={shell.label} htmlFor="ob-nac">Nacimiento</label>
                  <input id="ob-nac" className={shell.input} value={birthdate} onChange={(e) => setBirthdate(e.target.value)} type="date" />
                </div>
              </div>
              <label className={shell.consent}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>Acepto las bases y que Monaco use mis datos para el prode y avisarme novedades (Ley 25.326).</span>
              </label>
              {error && <p className={shell.error} role="alert">{error}</p>}
              <button className={shell.btnPrimary} onClick={onCompleteProfile} disabled={pending}>
                {pending ? "Guardando…" : "Guardar y ver mis desafíos"}
              </button>
            </motion.div>
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
              <h2 className={styles.doneTitle}>¡Estás adentro, {displayName || "crack"}!</h2>
              <p className={styles.doneSub}>
                Ya tenés tu cupón de bienvenida. Ahora empezá el Camino al Título: completá los
                Desafíos y ganá cortes.
              </p>

              {joinedLeagueMsg && (
                <div className={shell.noticeGood} role="status">
                  <CheckCircle2 size={18} aria-hidden="true" /> {joinedLeagueMsg}
                </div>
              )}

              <div className={styles.doneActions}>
                <button
                  className={shell.btnPrimary}
                  onClick={() => router.refresh()}
                >
                  Empezar el Desafío 1 <ChevronRight size={18} aria-hidden="true" />
                </button>
                <Link href="/mundial/premios" className={shell.btnGhost}>
                  Ver mis premios
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
