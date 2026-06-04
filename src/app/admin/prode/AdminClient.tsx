"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin, setResult, setFeatured, resolveQuestion } from "./actions";
import styles from "../../mundial/Mundial.module.css";

type Match = {
  id: string; kickoff_at: string; status: string; home_score: number | null; away_score: number | null;
  is_featured: boolean; stage: string; group_label: string | null; home_team_label: string | null; away_team_label: string | null;
};
type Question = { id: string; kind: string; label: string; answer_type: string; options: string[] | null; points: number; correct_answer: string | null; resolved_at: string | null };
type Team = { id: string; name: string };

export function AdminLogin() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className={styles.panel}>
      <h3 className={styles.panelTitle}>Admin · Prode</h3>
      <p className={styles.panelSub}>Ingresá el PIN para gestionar resultados y la Quiniela.</p>
      <div className={styles.field}>
        <label className={styles.label}>PIN</label>
        <input className={`${styles.input} ${styles.otpInput}`} value={pin} type="password"
          onChange={(e) => setPin(e.target.value)} placeholder="••••" inputMode="numeric" />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.primaryBtn} disabled={pending} onClick={() => {
        setError(null);
        start(async () => {
          const r = await loginAdmin(pin);
          if (r.ok) router.refresh();
          else setError(r.error);
        });
      }}>{pending ? "Verificando…" : "Entrar"}</button>
    </div>
  );
}

export function AdminPanel({ matches, questions, teams, players, tournamentName }: {
  matches: Match[]; questions: Question[]; teams: Team[]; players: number; tournamentName: string;
}) {
  const [tab, setTab] = useState<"results" | "quiniela">("results");
  const [filter, setFilter] = useState("");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const fmt = (d: string) => new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const filtered = matches.filter((m) =>
    !filter ||
    `${m.home_team_label ?? ""} ${m.away_team_label ?? ""} ${m.group_label ?? ""}`.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className={styles.panel}>
      <div className={styles.lbHead}>
        <strong>{tournamentName} · Admin</strong>
        <span className={styles.chip}>{players} jugadores</span>
      </div>
      <div className={styles.lbTabs} style={{ marginBottom: "1rem" }}>
        <button className={`${styles.lbTab} ${tab === "results" ? styles.lbTabActive : ""}`} onClick={() => setTab("results")}>Resultados</button>
        <button className={`${styles.lbTab} ${tab === "quiniela" ? styles.lbTabActive : ""}`} onClick={() => setTab("quiniela")}>Quiniela</button>
      </div>
      {msg && <p className={styles.helper} style={{ color: "var(--gold)" }}>{msg}</p>}

      {tab === "results" && (
        <>
          <input className={styles.input} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar por equipo o grupo…" style={{ marginBottom: "0.8rem" }} />
          {matches.length === 0 && <p className={styles.helper}>Todavía no hay partidos. Corré la sincronización (prode-sync) para traer el fixture.</p>}
          <div style={{ maxHeight: 520, overflowY: "auto", display: "grid", gap: "0.5rem" }}>
            {filtered.map((m) => (
              <MatchRow key={m.id} m={m} fmt={fmt} pending={pending} onMsg={setMsg} refresh={() => router.refresh()} start={start} />
            ))}
          </div>
        </>
      )}

      {tab === "quiniela" && (
        <div style={{ display: "grid", gap: "0.8rem" }}>
          {questions.map((q) => (
            <QuestionRow key={q.id} q={q} teams={teams} pending={pending} onMsg={setMsg} refresh={() => router.refresh()} start={start} />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchRow({ m, fmt, pending, onMsg, refresh, start }: {
  m: Match; fmt: (d: string) => string; pending: boolean;
  onMsg: (s: string) => void; refresh: () => void; start: React.TransitionStartFunction;
}) {
  const [h, setH] = useState<string>(m.home_score?.toString() ?? "");
  const [a, setA] = useState<string>(m.away_score?.toString() ?? "");
  return (
    <div className={styles.lbRow} style={{ flexWrap: "wrap", gap: "0.5rem" }}>
      <div style={{ flex: "1 1 100%", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
        {fmt(m.kickoff_at)} · {m.stage}{m.group_label ? ` ${m.group_label}` : ""} {m.status === "finished" ? "· ✅" : ""}
      </div>
      <span style={{ flex: 1, fontWeight: 600 }}>{m.home_team_label ?? "?"} vs {m.away_team_label ?? "?"}</span>
      <input className={styles.input} style={{ width: 48, padding: "0.4rem", textAlign: "center" }} value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
      <input className={styles.input} style={{ width: 48, padding: "0.4rem", textAlign: "center" }} value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
      <button className={styles.lbTab} disabled={pending || h === "" || a === ""} onClick={() => start(async () => {
        const r = await setResult({ matchId: m.id, home: Number(h), away: Number(a) });
        onMsg(r.ok ? `Resultado cargado (${r.data.scored} jugadas puntuadas)` : r.error);
        if (r.ok) refresh();
      })}>Guardar</button>
      <button className={`${styles.lbTab} ${m.is_featured ? styles.lbTabActive : ""}`} disabled={pending} onClick={() => start(async () => {
        const r = await setFeatured({ matchId: m.id, featured: !m.is_featured });
        onMsg(r.ok ? (m.is_featured ? "Quitado de destacado" : "★ Partido del día") : r.error);
        if (r.ok) refresh();
      })}>★</button>
    </div>
  );
}

function QuestionRow({ q, teams, pending, onMsg, refresh, start }: {
  q: Question; teams: Team[]; pending: boolean;
  onMsg: (s: string) => void; refresh: () => void; start: React.TransitionStartFunction;
}) {
  const [val, setVal] = useState<string>(q.correct_answer ?? "");
  return (
    <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--card-border)", borderRadius: 14, padding: "0.85rem" }}>
      <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>
        {q.label} <span className={styles.qPoints} style={{ marginLeft: 6 }}>{q.points} pts</span>
        {q.resolved_at ? <span style={{ color: "var(--live-green)", marginLeft: 6, fontSize: "0.8rem" }}>resuelta</span> : null}
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {q.answer_type === "team" ? (
          <select className={styles.select} value={val} onChange={(e) => setVal(e.target.value)}>
            <option value="">— elegir —</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : q.answer_type === "choice" ? (
          <select className={styles.select} value={val} onChange={(e) => setVal(e.target.value)}>
            <option value="">— elegir —</option>
            {(q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input className={styles.input} value={val} onChange={(e) => setVal(e.target.value)} placeholder="Respuesta correcta" />
        )}
        <button className={styles.lbTab} disabled={pending || !val} onClick={() => start(async () => {
          const r = await resolveQuestion({ questionId: q.id, answer: val });
          onMsg(r.ok ? `Resuelta (${r.data.scored} respuestas puntuadas)` : r.error);
          if (r.ok) refresh();
        })}>Resolver</button>
      </div>
    </div>
  );
}
