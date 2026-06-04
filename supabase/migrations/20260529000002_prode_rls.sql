-- Prode Mundial 2026 — RLS
-- Estrategia: RLS ON en todo. Lectura pública SOLO en datos de referencia no
-- sensibles. PII (participants), predicciones, miembros de liga y OTP quedan
-- deny-all (sin policy) -> solo accesibles vía service-role / RPCs SECURITY DEFINER.
-- Ninguna tabla tiene policy de INSERT/UPDATE/DELETE para anon/authenticated:
-- toda escritura pasa por service-role o funciones SECURITY DEFINER.

alter table prode_tournament enable row level security;
alter table prode_teams enable row level security;
alter table prode_matches enable row level security;
alter table prode_participants enable row level security;
alter table prode_questions enable row level security;
alter table prode_question_predictions enable row level security;
alter table prode_match_predictions enable row level security;
alter table prode_leagues enable row level security;
alter table prode_league_members enable row level security;
alter table prode_otp enable row level security;

-- Lectura pública de datos de referencia (no sensibles)
drop policy if exists prode_tournament_public_read on prode_tournament;
create policy prode_tournament_public_read on prode_tournament for select to anon, authenticated using (true);

drop policy if exists prode_teams_public_read on prode_teams;
create policy prode_teams_public_read on prode_teams for select to anon, authenticated using (true);

drop policy if exists prode_matches_public_read on prode_matches;
create policy prode_matches_public_read on prode_matches for select to anon, authenticated using (true);

drop policy if exists prode_questions_public_read on prode_questions;
create policy prode_questions_public_read on prode_questions for select to anon, authenticated using (true);

-- Ligas: solo las públicas / la "Liga Monaco" (house) son listables. Las privadas
-- se acceden por invite_code vía RPC. Sin policy de escritura.
drop policy if exists prode_leagues_public_read on prode_leagues;
create policy prode_leagues_public_read on prode_leagues for select to anon, authenticated using (is_public or is_house);
