import type { Metadata } from "next";
import { isProdeAdmin } from "@/lib/prode/admin";
import { getTournament } from "@/lib/prode/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminLogin, AdminPanel } from "./AdminClient";
import styles from "../../mundial/Mundial.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Prode Mundial | Monaco", robots: { index: false } };

export default async function AdminProdePage() {
  if (!(await isProdeAdmin())) {
    return (
      <main className={styles.page}>
        <div className={styles.game}>
          <AdminLogin />
        </div>
      </main>
    );
  }

  const tournament = await getTournament();
  if (!tournament) {
    return <main className={styles.page}><div className={styles.empty}>No hay torneo configurado.</div></main>;
  }

  const admin = createAdminClient();
  const [matchesRes, questionsRes, teamsRes, playersRes] = await Promise.all([
    admin
      .from("prode_matches")
      .select("id,kickoff_at,status,home_score,away_score,is_featured,stage,group_label,home_team_label,away_team_label")
      .eq("tournament_id", tournament.id)
      .order("kickoff_at", { ascending: true }),
    admin
      .from("prode_questions")
      .select("id,kind,label,answer_type,options,points,correct_answer,resolved_at")
      .eq("tournament_id", tournament.id)
      .order("sort_order", { ascending: true }),
    admin.from("prode_teams").select("id,name").eq("tournament_id", tournament.id).order("name", { ascending: true }),
    admin.from("prode_participants").select("id", { count: "exact", head: true }).eq("tournament_id", tournament.id),
  ]);

  return (
    <main className={styles.page}>
      <div className={styles.game}>
        <AdminPanel
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          matches={(matchesRes.data as any[]) ?? []}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          questions={(questionsRes.data as any[]) ?? []}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          teams={(teamsRes.data as any[]) ?? []}
          players={playersRes.count ?? 0}
          tournamentName={tournament.name}
        />
      </div>
    </main>
  );
}
