-- Prode Mundial 2026 — programación de la ingesta (pg_cron + pg_net).
-- APLICAR DESPUÉS de: (1) desplegar la función prode-sync, (2) setear los secrets
-- FOOTBALL_DATA_API_KEY y CRON_SECRET. Reemplazá <<CRON_SECRET>> por el valor real.
--
-- Deploy de la función (desde la raíz del repo, con Supabase CLI logueado):
--   supabase functions deploy prode-sync --no-verify-jwt --project-ref gzsfoqpxvnwmvngfoqqk
--   supabase secrets set FOOTBALL_DATA_API_KEY=xxxx CRON_SECRET=xxxx --project-ref gzsfoqpxvnwmvngfoqqk
--
-- Invocación manual para sembrar AHORA (una vez):
--   curl -X POST https://gzsfoqpxvnwmvngfoqqk.supabase.co/functions/v1/prode-sync \
--        -H "x-cron-secret: <<CRON_SECRET>>"

-- Durante el torneo: poll cada 30 min entre las 12:00 y 23:59 (hora ARG = UTC 15:00-02:59).
select cron.schedule(
  'prode-sync-tournament',
  '*/30 15-23,0-2 * 6,7 *',
  $$
  select net.http_post(
    url := 'https://gzsfoqpxvnwmvngfoqqk.supabase.co/functions/v1/prode-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<<CRON_SECRET>>'),
    body := '{}'::jsonb
  );
  $$
);

-- Para borrar el cron si hace falta:
--   select cron.unschedule('prode-sync-tournament');
