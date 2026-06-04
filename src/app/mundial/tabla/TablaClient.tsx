"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Crown, RefreshCw, Ticket, Users, ChevronRight } from "lucide-react";
import Link from "next/link";
import shell from "../Shell.module.css";
import styles from "./Tabla.module.css";
import type { LeaderboardRow } from "@/lib/prode/types";
import { refreshLeaderboard, refreshWeeklyLeaderboard } from "../actions";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const GENERAL = "general";
const WEEK = "week";

type Props = {
  initialLeaderboard: LeaderboardRow[];
  players: number;
  registered: boolean;
  myParticipantId: string | null;
  myTotalPoints: number;
  /** Ligas privadas del jugador (sin la liga de la casa). Habilita el toggle. */
  myLeagues: { id: string; name: string }[];
  /** Ventana de la semana actual (lun-dom ARG) o null si el torneo no arrancó. */
  currentWeek: { start: string; end: string } | null;
};

/** Inicial (mayúscula) para el avatar del podio, a partir del nombre. */
function initialOf(name: string): string {
  const c = name.trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

export default function TablaClient({
  initialLeaderboard,
  players,
  registered,
  myParticipantId,
  myTotalPoints,
  myLeagues,
  currentWeek,
}: Props) {
  const rm = useReducedMotion();
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>(initialLeaderboard);
  const [pending, setPending] = useState(false);
  // Alcance de la tabla: "general", "week" (semana) o el id de una liga privada.
  const [scope, setScope] = useState<string>(GENERAL);
  const hasLeagues = myLeagues.length > 0;
  const hasScopes = hasLeagues || !!currentWeek;
  const activeLeague =
    scope === GENERAL || scope === WEEK ? null : myLeagues.find((l) => l.id === scope) ?? null;

  // Trae la tabla del alcance pedido. La "semana" usa otra RPC (puntos de esa semana).
  const fetchScope = useCallback(
    (s: string): Promise<LeaderboardRow[]> => {
      if (s === WEEK && currentWeek) return refreshWeeklyLeaderboard(currentWeek.start, currentWeek.end, 50);
      return refreshLeaderboard(s === GENERAL ? null : s, 50);
    },
    [currentWeek],
  );

  // Cambiar de alcance: actualizamos el estado y traemos esa tabla en el mismo
  // handler (imperativo, no en un effect). El "general" inicial ya viene del server.
  function selectScope(next: string) {
    if (next === scope) return;
    setScope(next);
    setPending(true);
    fetchScope(next)
      .then(setLeaderboard)
      .catch(() => {})
      .finally(() => setPending(false));
  }

  // Auto-refresh cada 30s del alcance vigente (la acción devuelve el array directo).
  useEffect(() => {
    const i = setInterval(() => {
      fetchScope(scope).then(setLeaderboard).catch(() => {});
    }, 30000);
    return () => clearInterval(i);
  }, [scope, fetchScope]);

  function onRefresh() {
    if (pending) return;
    setPending(true);
    fetchScope(scope)
      .then(setLeaderboard)
      .catch(() => {})
      .finally(() => setPending(false));
  }

  const podium = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  // Orden visual del podio: 2º (izq), 1º (centro), 3º (der). Solo los que existen.
  const slotOrder = [1, 0, 2] as const;
  const podiumSlots = slotOrder
    .map((idx) => ({ idx, row: podium[idx] }))
    .filter((s): s is { idx: 0 | 1 | 2; row: LeaderboardRow } => !!s.row);

  const myRow = registered && myParticipantId
    ? leaderboard.find((r) => r.participant_id === myParticipantId) ?? null
    : null;

  const fade = rm
    ? { initial: false as const, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: EASE },
      };

  return (
    <main className={shell.content}>
      {/* ── Encabezado ── */}
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={`${shell.sectionTitle} ${styles.title}`}>
            Tabla{" "}
            <span className={shell.em}>
              {scope === WEEK ? "de la semana" : activeLeague ? activeLeague.name : "general"}
            </span>
          </h1>
          <span className={shell.liveDot} aria-hidden="true" />
        </div>
        <p className={shell.sectionSub}>
          {scope === WEEK
            ? "El ranking de esta semana. El 1º se lleva un corte gratis 💈"
            : activeLeague
              ? "Tu liga privada. El ranking acá es solo entre tus invitados."
              : "Sumá fichas y escalá. El 1º de la semana se lleva un corte gratis."}
        </p>

        {/* Selector General / Semana / Mi(s) liga(s). */}
        {hasScopes && (
          <div className={styles.scopeTabs} role="tablist" aria-label="Alcance de la tabla">
            <button
              type="button"
              role="tab"
              aria-selected={scope === GENERAL}
              className={`${styles.scopeTab} ${scope === GENERAL ? styles.scopeTabActive : ""}`}
              onClick={() => selectScope(GENERAL)}
            >
              General
            </button>
            {currentWeek && (
              <button
                type="button"
                role="tab"
                aria-selected={scope === WEEK}
                className={`${styles.scopeTab} ${scope === WEEK ? styles.scopeTabActive : ""}`}
                onClick={() => selectScope(WEEK)}
              >
                Semana
              </button>
            )}
            {myLeagues.map((l) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={scope === l.id}
                className={`${styles.scopeTab} ${scope === l.id ? styles.scopeTabActive : ""}`}
                onClick={() => selectScope(l.id)}
                title={l.name}
              >
                {l.name}
              </button>
            ))}
          </div>
        )}

        <div className={styles.metaRow}>
          <span className={`${shell.pill} ${shell.pillCeleste}`}>
            <Users size={13} aria-hidden="true" />
            {activeLeague ? `${leaderboard.length} en la liga` : `${players} jugando`}
          </span>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={onRefresh}
            disabled={pending}
            aria-label="Actualizar tabla"
          >
            <RefreshCw
              size={14}
              aria-hidden="true"
              className={pending && !rm ? styles.spin : undefined}
            />
            {pending ? "…" : "Actualizar"}
          </button>
        </div>
      </header>

      {leaderboard.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyEmoji} aria-hidden="true">
            🏁
          </div>
          <p className={shell.sectionSub}>Sé el primero en sumar puntos 🏁</p>
        </div>
      ) : (
        <>
          {/* ── Podio (top-3) ── */}
          <motion.section
            className={styles.podium}
            aria-label="Podio: top 3"
            {...fade}
          >
            {podiumSlots.map(({ idx, row }) => {
              const place = idx + 1; // 1, 2 o 3
              const isMe = row.participant_id === myParticipantId;
              const placeClass =
                place === 1 ? styles.gold : place === 2 ? styles.silver : styles.bronze;
              return (
                <div
                  key={row.participant_id}
                  className={`${styles.slot} ${place === 1 ? styles.slotFirst : ""}`}
                >
                  <div className={`${styles.avatar} ${placeClass} ${isMe ? styles.avatarMe : ""}`}>
                    {place === 1 && (
                      <Crown className={styles.crown} size={22} aria-hidden="true" />
                    )}
                    <span className={styles.avatarInitial}>{initialOf(row.display_name)}</span>
                    <span className={styles.medal} aria-hidden="true">
                      {place}
                    </span>
                  </div>
                  <span className={styles.slotName}>
                    {row.display_name}
                    {isMe ? <span className={styles.youTag}> (vos)</span> : null}
                  </span>
                  <span className={styles.slotPts}>
                    <strong>{row.total_points}</strong>
                    <span className={styles.ptsLabel}>pts</span>
                  </span>
                  <div className={`${styles.pedestal} ${placeClass}`}>
                    <span className={styles.pedestalNum}>{place}º</span>
                  </div>
                </div>
              );
            })}
          </motion.section>

          {/* ── Lista (4º en adelante) ── */}
          {rest.length > 0 && (
            <section className={styles.list} aria-label="Resto del ranking">
              {rest.map((row) => {
                const isMe = row.participant_id === myParticipantId;
                return (
                  <div
                    key={row.participant_id}
                    className={`${styles.row} ${isMe ? styles.rowMe : ""}`}
                  >
                    <span className={styles.rank}>{row.rank}</span>
                    <span className={styles.name}>
                      {row.display_name}
                      {isMe ? <span className={styles.youTag}> (vos)</span> : null}
                    </span>
                    <span className={styles.pts}>
                      {row.total_points}
                      <span className={styles.ptsLabel}>pts</span>
                    </span>
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}

      {/* ── Tu fila (fija arriba de la tab bar) ── */}
      <div className={styles.sticky}>
        {!registered ? (
          <Link href="/mundial/jugar" className={shell.btnPrimary}>
            <Ticket size={18} aria-hidden="true" /> Sumate para competir
          </Link>
        ) : myRow ? (
          <div className={`${styles.youCard} ${styles.youCardActive}`} role="status">
            <span className={styles.youArrow} aria-hidden="true">
              ▸
            </span>
            <span className={styles.youRank}>#{myRow.rank}</span>
            <span className={styles.youName}>
              {myRow.display_name} <span className={styles.youTag}>(vos)</span>
            </span>
            <span className={styles.youPts}>
              {myRow.total_points}
              <span className={styles.ptsLabel}>pts</span>
            </span>
          </div>
        ) : (
          <Link href="/mundial/jugar" className={`${styles.youCard} ${styles.youCardOut}`}>
            <span className={styles.youOutText}>
              Vos · <strong>{myTotalPoints} pts</strong> · seguí sumando para entrar al ranking
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </main>
  );
}
