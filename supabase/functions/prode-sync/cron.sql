-- Prode Mundial 2026 — programación de la ingesta (pg_cron + pg_net).
-- ESTADO: APLICADO en producción el 29/06/2026 (jobid 18, jobname 'prode-sync-tournament').
--
-- Por qué existe: prode-sync trae de football-data.org los equipos ya resueltos de
-- cada ronda de eliminatorias (round_of_32, round_of_16, …) + los resultados. La
-- UI mantiene un Desafío en "Próximamente" mientras NINGÚN partido de esa ronda
-- tenga ambos equipos (ver src/lib/prode/challenges.ts → getChallengesState, rama
-- `total === 0`). Sin este cron la ronda siguiente queda trabada hasta que alguien
-- corre la sync a mano (fue exactamente el bug de "16vos sigue bloqueado", 29/06).
--
-- Deploy de la función (ya hecho; aquí por referencia):
--   supabase functions deploy prode-sync --no-verify-jwt --project-ref gzsfoqpxvnwmvngfoqqk
--   supabase secrets set FOOTBALL_DATA_API_KEY=xxxx --project-ref gzsfoqpxvnwmvngfoqqk
--
-- Invocación manual para sembrar/forzar AHORA (idempotente, upsert por external_id):
--   curl -X POST https://gzsfoqpxvnwmvngfoqqk.supabase.co/functions/v1/prode-sync

-- Cada 30 min, TODAS las horas, junio y julio 2026 (torneo: 11/jun – 19/jul).
-- Nota: corre todo el día a propósito. Los sorteos de bracket de football-data se
-- publican a cualquier hora (el de 16vos salió 05:20 UTC); una ventana sólo-diurna
-- dejaba la ronda trabada hasta las 12:00 ARG. El costo es trivial (2 calls/run,
-- free tier 10/min). cron.schedule hace upsert por nombre → re-ejecutar es seguro.
select cron.schedule(
  'prode-sync-tournament',
  '*/30 * * 6,7 *',
  $$
  select net.http_post(
    url := 'https://gzsfoqpxvnwmvngfoqqk.supabase.co/functions/v1/prode-sync',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- SEGURIDAD (pendiente, opcional): hoy la función es invocable sin auth porque el
-- secret CRON_SECRET NO está seteado en el edge (la guarda `if (cronSecret && …)`
-- se saltea cuando está vacío). Para cerrarla:
--   1) supabase secrets set CRON_SECRET=<random> --project-ref gzsfoqpxvnwmvngfoqqk
--   2) volver a correr este cron.schedule agregando el header en el jsonb_build_object:
--        'x-cron-secret', '<el mismo valor>'
-- Si seteás el secret SIN actualizar el cron, el cron empezará a recibir 403.

-- Para borrar el cron al terminar el Mundial:
--   select cron.unschedule('prode-sync-tournament');
