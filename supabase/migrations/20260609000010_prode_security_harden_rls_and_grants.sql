-- =============================================================================
-- Prode Mundial 2026 — Endurecimiento de seguridad (RLS + grants de tabla + EXECUTE de RPC)
-- Cierra el alerta de Supabase rls_disabled_in_public y la superficie anon residual.
--
-- TIER 1 (crítico, el alerta del mail): prode_challenge_prizes tenía RLS=OFF (se olvidó
--   el ENABLE al crearla en 20260605000009; las otras 10 lo recibieron en 20260529000002).
--   Con RLS off + grants anon completos quedaba legible/escribible vía PostgREST con la
--   anon key pública. Se enablea RLS sin policy => deny-all, idéntico a prode_weekly_prizes.
--
-- TIER 2 (defensa en profundidad, verificado seguro por análisis de ambos repos):
--   a) REVOKE de escritura (INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) a anon y
--      authenticated en las 12 tablas prode_. Toda escritura va por service-role/SECURITY
--      DEFINER, nunca por anon (verificado: 0 escrituras vía anon client en ambos repos).
--   b) REVOKE de SELECT a anon en las 7 tablas sensibles (PII/predicciones/OTP/premios),
--      que ya estaban en deny-all por RLS: segundo cerrojo (PostgREST chequea el privilegio
--      de tabla ANTES que RLS). Se CONSERVA el SELECT de anon en las 5 de referencia
--      (tournament/teams/matches/questions/leagues) que tienen policy de lectura pública
--      intencional de datos no sensibles.
--
-- TIER 3 (hueco residual hallado en verificación adversarial): prode_auth_with_pin es
--   SECURITY DEFINER (bypassa RLS y los revokes de tabla) y tenía EXECUTE para anon+
--   authenticated. Causa raíz: el revoke de 20260605000008 (líneas 108-109) apuntó a la
--   firma de 4 args (text,text,text,text) pero la función viva es de 5 (…,date), así que
--   fue un no-op y quedó el grant por defecto de Supabase a anon/authenticated. Vía la anon
--   key permitía: crear participants/clients, acuñar cupones de bienvenida reales
--   (client_rewards), secuestrar cuentas con pin_hash NULL y brute-forcear PINs de 4 dígitos.
--   La app SOLO la llama por service-role (createAdminClient en mundial/actions.ts:40-41),
--   que conserva EXECUTE => el login NO se rompe.
--
-- Idempotente: REVOKE no falla si el priv no existe; ENABLE RLS es no-op si ya está activa.
-- NO toca: las 5 policies SELECT, el SELECT de anon en las 5 de referencia, el SELECT de
-- authenticated, ningún otro RPC, ni tablas fuera del prode.
-- =============================================================================

-- TIER 1 -----------------------------------------------------------------------
alter table public.prode_challenge_prizes enable row level security;

comment on table public.prode_challenge_prizes is
  'Prode: premios por desafío. RLS ON deny-all (sin policy). Acceso SOLO vía service-role / RPCs SECURITY DEFINER (prode_award_challenge_prize, prode_challenge_leaderboard, prode_my_rewards). Misma estrategia que prode_weekly_prizes. NO agregar policies de anon/authenticated.';

-- TIER 2.a — revoke de escritura en las 12 tablas prode_ ----------------------
revoke insert, update, delete, truncate, references, trigger on table
  public.prode_tournament,
  public.prode_teams,
  public.prode_matches,
  public.prode_questions,
  public.prode_participants,
  public.prode_match_predictions,
  public.prode_question_predictions,
  public.prode_leagues,
  public.prode_league_members,
  public.prode_otp,
  public.prode_weekly_prizes,
  public.prode_challenge_prizes
from anon, authenticated;

-- TIER 2.b — revoke de SELECT a anon en las 7 sensibles -----------------------
revoke select on table
  public.prode_participants,
  public.prode_match_predictions,
  public.prode_question_predictions,
  public.prode_league_members,
  public.prode_otp,
  public.prode_weekly_prizes,
  public.prode_challenge_prizes
from anon;

-- TIER 3 — revoke EXECUTE de la RPC de login (firma de 5 args, la viva) --------
revoke execute on function public.prode_auth_with_pin(text, text, text, text, date) from anon, authenticated;
grant  execute on function public.prode_auth_with_pin(text, text, text, text, date) to service_role;
