"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User, Trophy, ListChecks, Users, Share2, LogOut, ChevronRight, Lock, ArrowLeft,
  Gift, Ticket, Crown, QrCode, X, CheckCircle2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import shell from "../Shell.module.css";
import styles from "./Cuenta.module.css";
import type { ProdeQuestion, ProdeTeam, ParticipantSummary, ProdeReward } from "@/lib/prode/types";
import { teamEsName } from "@/lib/prode/countries";
import { createLeague, joinLeague, logoutProde, getMyInviteCode } from "../actions";

type Props = {
  myState: ParticipantSummary | null;
  questions: ProdeQuestion[];
  teams: ProdeTeam[];
  /** Premios del jugador (welcome / semanal / gran premio) con su QR. */
  rewards: ProdeReward[];
  /** ¿La quiniela sigue abierta? Lo calcula el server (page) para no leer la hora en render. */
  editable: boolean;
};

// Etiqueta de valor del premio (servicio gratis vs % off).
function rewardValueLabel(r: ProdeReward): string {
  if (r.is_free_service) return "Servicio gratis";
  if (r.discount_pct) return `${r.discount_pct}% OFF`;
  return "Premio";
}
// Tipo de premio según el nombre del catálogo (para el ícono/acento).
function rewardKind(name: string): "welcome" | "weekly" | "grand" {
  const n = name.toLowerCase();
  if (n.includes("gran premio")) return "grand";
  if (n.includes("bienvenida")) return "welcome";
  return "weekly";
}
// Nombre corto, sin el prefijo del catálogo.
function rewardShortName(name: string): string {
  return name.replace(/^Cupón Mundial:\s*/i, "").replace(/^Mundial:\s*/i, "");
}
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
}

export default function CuentaClient({ myState, questions, teams, rewards, editable }: Props) {
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // liga privada
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [leagueMsg, setLeagueMsg] = useState<string | null>(null);

  // premio cuyo QR se está mostrando (modal)
  const [qrReward, setQrReward] = useState<ProdeReward | null>(null);

  // cerrar el modal del QR con Escape
  useEffect(() => {
    if (!qrReward) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setQrReward(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qrReward]);

  // Pre-cargar el código de la liga privada del jugador (si ya tiene una) para
  // que "Desafiar a un amigo" siempre comparta un link con ?liga= y auto-una.
  useEffect(() => {
    if (!myState) return;
    getMyInviteCode()
      .then((c) => { if (c) setInviteCode(c); })
      .catch(() => {});
  }, [myState]);

  // Ejecuta una acción async y SIEMPRE libera el estado de carga (finally),
  // aunque falle. Mismo patrón que el hub original.
  const run = useCallback((fn: () => Promise<unknown>) => {
    setPending(true);
    Promise.resolve(fn())
      .catch((e) => { console.error("[prode]", e); setError("Algo falló, probá de nuevo."); })
      .finally(() => setPending(false));
  }, []);

  // Lookup de preguntas por id para renderizar "Mi Quiniela" legible.
  const questionsById = useMemo(() => {
    const map = new Map<string, ProdeQuestion>();
    questions.forEach((q) => map.set(q.id, q));
    return map;
  }, [questions]);

  // Lookup de equipos por id (para mapear respuestas de tipo "team" a su nombre ES).
  const teamsById = useMemo(() => {
    const map = new Map<string, ProdeTeam>();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  // ---------- handlers liga ----------
  function onCreateLeague() {
    setLeagueMsg(null);
    setError(null);
    run(async () => {
      const r = await createLeague("Liga de " + (myState?.display_name || "amigos"));
      if (!r.ok) { setLeagueMsg(r.error); return; }
      setInviteCode(r.data.inviteCode);
    });
  }

  function onJoinLeague() {
    setLeagueMsg(null);
    setError(null);
    if (!joinCode.trim()) return;
    run(async () => {
      const r = await joinLeague(joinCode);
      setLeagueMsg(r.ok ? `¡Te uniste a "${r.data.name}"!` : r.error);
    });
  }

  function shareInvite() {
    const base = window.location.origin;
    const pid = myState?.participant_id;
    const ligaQ = inviteCode ? `?liga=${inviteCode}` : "";
    // Link a la placa del jugador: preview lindo (OG) en WhatsApp/IG + auto-une por ?liga.
    const url = pid ? `${base}/mundial/share/${pid}${ligaQ}` : `${base}/mundial${ligaQ}`;
    const text = "Te reto en el Prode Mundial de Monaco 🏆 Armá tu quiniela y ganá cortes:";
    if (navigator.share) navigator.share({ title: "Prode Monaco", text, url }).catch(() => {});
    else { navigator.clipboard?.writeText(`${text} ${url}`); setLeagueMsg("¡Link copiado!"); }
  }

  function onLogout() {
    setError(null);
    run(async () => {
      await logoutProde();
      router.push("/mundial");
      router.refresh();
    });
  }

  // ───────────────────────── No registrado: gate ─────────────────────────
  if (!myState) {
    return (
      <main className={shell.content}>
        <div className={shell.gate}>
          <div className={styles.gateIcons} aria-hidden="true">
            <User className={shell.gateIcon} size={40} />
            <Trophy className={shell.gateIcon} size={40} />
          </div>
          <h1 className={shell.sectionTitle}>Todavía no estás jugando</h1>
          <p className={shell.sectionSub}>
            Sumate al Prode, armá tu quiniela y empezá a sumar fichas para canjear por cortes.
          </p>
          <div className={styles.gateActions}>
            <Link href="/mundial/jugar" className={shell.btnPrimary}>
              Sumate al Prode <ChevronRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/" className={shell.btnGhost}>
              <ArrowLeft size={16} aria-hidden="true" /> Volver al sitio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ───────────────────────── Registrado ─────────────────────────
  const displayName = myState.display_name || "crack";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  const answered = myState.quiniela;

  return (
    <main className={shell.content}>
      <p className={shell.eyebrow}>
        <User size={13} aria-hidden="true" /> Mi cuenta
      </p>

      {/* 1) Perfil */}
      <section className={`${shell.card} ${shell.cardTopline} ${styles.profileCard}`} aria-label="Tu perfil">
        <div className={styles.avatar} aria-hidden="true">{initial}</div>
        <div className={styles.profileInfo}>
          <h1 className={styles.profileName}>{displayName}</h1>
          <p className={styles.profileLine}>¡A romperla, crack!</p>
        </div>
        <div className={styles.profilePts}>
          <span className={styles.ptsNum}>{myState.total_points}</span>
          <span className={styles.ptsLabel}>pts</span>
        </div>
      </section>

      {/* 1.5) Mis premios */}
      <section className={`${shell.card} ${styles.block}`} aria-label="Mis premios">
        <h2 className={styles.blockTitle}>
          <Gift size={18} aria-hidden="true" /> Mis premios
        </h2>

        {rewards.length === 0 ? (
          <p className={shell.helper}>
            Todavía no tenés premios. Jugá, sumá fichas y ganá cortes — tus premios aparecen acá con
            su QR para canjear en Monaco.
          </p>
        ) : (
          <ul className={styles.prizeList}>
            {rewards.map((r) => {
              const kind = rewardKind(r.name);
              const Icon = kind === "grand" ? Crown : kind === "welcome" ? Ticket : Gift;
              const available = r.status === "available";
              return (
                <li
                  key={r.client_reward_id}
                  className={`${styles.prizeItem} ${styles[`prize_${kind}`]} ${available ? "" : styles.prizeUsed}`}
                >
                  <span className={styles.prizeIcon} aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <div className={styles.prizeInfo}>
                    <span className={styles.prizeName}>{rewardShortName(r.name)}</span>
                    <span className={styles.prizeValue}>{rewardValueLabel(r)}</span>
                  </div>
                  {available ? (
                    <button type="button" className={styles.prizeQrBtn} onClick={() => setQrReward(r)}>
                      <QrCode size={16} aria-hidden="true" /> Canjear
                    </button>
                  ) : (
                    <span
                      className={`${styles.prizeStatus} ${r.status === "redeemed" ? styles.prizeStatusDone : ""}`}
                    >
                      {r.status === "redeemed" ? (
                        <>
                          <CheckCircle2 size={13} aria-hidden="true" /> Canjeado
                        </>
                      ) : (
                        "Vencido"
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 2) Mi Quiniela */}
      <section className={`${shell.card} ${styles.block}`} aria-label="Mi Quiniela">
        <h2 className={styles.blockTitle}>
          <ListChecks size={18} aria-hidden="true" /> Mi Quiniela
        </h2>

        {answered.length === 0 ? (
          <div className={styles.emptyQuiniela}>
            <p className={shell.helper}>Todavía no armaste tu Quiniela.</p>
            <Link href="/mundial/jugar/quiniela" className={shell.btnPrimary}>
              Armar mi Quiniela <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <ul className={styles.quinielaList}>
              {answered.map((item) => {
                const q = questionsById.get(item.question_id);
                const label = q?.label ?? "Pregunta";
                let readable = item.answer;
                if (q?.answer_type === "team") {
                  const team = teamsById.get(item.answer);
                  readable = team ? teamEsName(team) : item.answer;
                }
                return (
                  <li className={styles.quinielaRow} key={item.question_id}>
                    <span className={styles.qLabel}>{label}</span>
                    <span className={styles.qAnswer}>{readable}</span>
                    {item.points != null && (
                      <span className={styles.qPts}>
                        <Trophy size={11} aria-hidden="true" /> {item.points} pts
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {editable ? (
              <Link href="/mundial/jugar/quiniela" className={`${shell.btnGhost} ${styles.editBtn}`}>
                Editar mi Quiniela <ChevronRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <p className={styles.lockedNote}>
                <Lock size={13} aria-hidden="true" /> La quiniela ya cerró
              </p>
            )}
          </>
        )}
      </section>

      {/* 3) Tu liga privada */}
      <section className={`${shell.card} ${styles.block}`} aria-label="Tu liga privada">
        <h2 className={styles.blockTitle}>
          <Users size={18} aria-hidden="true" /> Tu liga privada
        </h2>
        <p className={shell.helper}>Competí con tus amigos en una tabla aparte.</p>

        {inviteCode ? (
          <div className={shell.devCode}>
            Código de tu liga: <strong>{inviteCode}</strong> — compartilo
          </div>
        ) : (
          <button type="button" className={`${shell.btnGhost} ${styles.spaced}`} onClick={onCreateLeague} disabled={pending}>
            {pending ? "Creando…" : "Crear mi liga"}
          </button>
        )}

        <div className={styles.joinRow}>
          <input
            className={shell.input}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Código de liga"
            aria-label="Código de liga"
          />
          <button type="button" className={shell.btnGhost} onClick={onJoinLeague} disabled={pending || !joinCode.trim()}>
            Unirme
          </button>
        </div>

        <button type="button" className={`${shell.btnPrimary} ${styles.spaced}`} onClick={shareInvite}>
          <Share2 size={17} aria-hidden="true" /> Desafiar a un amigo
        </button>

        <Link href="/mundial/tabla" className={`${shell.btnGhost} ${styles.spaced}`}>
          <Trophy size={16} aria-hidden="true" /> Ver la tabla de mi liga
          <ChevronRight size={16} aria-hidden="true" />
        </Link>

        {leagueMsg && <p className={`${shell.helper} ${styles.leagueMsg}`} role="status">{leagueMsg}</p>}
      </section>

      {error && <p className={shell.error} role="status">{error}</p>}

      {/* 4) Footer */}
      <footer className={styles.footerActions}>
        <button type="button" className={shell.btnGhost} onClick={onLogout} disabled={pending}>
          <LogOut size={16} aria-hidden="true" /> {pending ? "Saliendo…" : "Cerrar sesión"}
        </button>
        <Link href="/" className={shell.btnGhost}>
          <ArrowLeft size={16} aria-hidden="true" /> Volver al sitio
        </Link>
      </footer>

      {/* Modal del QR del premio */}
      {qrReward && (
        <div
          className={styles.qrOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Tu código de premio"
          onClick={() => setQrReward(null)}
        >
          <div className={styles.qrCard} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.qrClose} aria-label="Cerrar" onClick={() => setQrReward(null)}>
              <X size={18} />
            </button>
            <span className={styles.qrEyebrow}>{rewardValueLabel(qrReward)}</span>
            <h3 className={styles.qrTitle}>{rewardShortName(qrReward.name)}</h3>
            <div className={styles.qrBox}>
              <QRCodeSVG value={qrReward.qr_code} size={216} level="M" bgColor="#ffffff" fgColor="#16181c" />
            </div>
            <p className={styles.qrHelp}>
              Mostrale este código al barbero en Monaco para canjear tu premio.
            </p>
            {qrReward.expires_at && (
              <p className={styles.qrExpiry}>Válido hasta el {fmtDate(qrReward.expires_at)}</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
