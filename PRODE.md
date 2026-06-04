# Prode Mundial 2026 — Monaco

Juego de pronósticos del Mundial 2026 para captar clientes. Estética Monte Carlo (oro sobre graphite).
Se "apuesta" gratis con **fichas** (puntos del ranking) y los premios se cobran en el local.

- **Público:** `/mundial` — registro + OTP WhatsApp + Quiniela + tabla + ligas + compartir.
- **Admin:** `/admin/prode` — carga/override de resultados, "partido del día", resolver la Quiniela (gate por PIN).
- **Base:** Supabase `gzsfoqpxvnwmvngfoqqk`, org Monaco `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`.
  Todo vive en tablas `prode_*` (no toca tablas existentes). Los premios se materializan en `client_rewards`
  y se canjean con el flujo existente (`redeem_reward_by_qr`).

## Estado
- ✅ DB: tablas + RLS + funciones + seed (torneo, 6 preguntas, Liga Monaco, 3 premios) — **aplicado a producción**.
- ✅ App: `/mundial` y `/admin/prode` (build OK, typecheck OK). Verificado E2E el backend (rollback, sin datos basura).
- ⏳ Pendiente de TU acción: secrets + deploy del edge function + plantilla WhatsApp (ver checklist).

## Checklist para salir en vivo (antes del 11/6)

1. **Completar `.env.local`** (ya tiene URL + publishable key):
   - `SUPABASE_SERVICE_ROLE_KEY` — Dashboard → Project Settings → API → `service_role`. **(obligatorio: sin esto no carga `/mundial`)**
   - `PRODE_SESSION_SECRET` — string random largo (firma cookies).
   - `PRODE_ADMIN_PIN` — el PIN para entrar a `/admin/prode`.
   - `FOOTBALL_DATA_API_KEY` — registrate gratis en https://www.football-data.org/client/register
   - `CRON_SECRET` — string random (protege la ingesta).
   - `PRODE_WA_OTP_TEMPLATE` — nombre de la plantilla de WhatsApp (ver punto 4).

2. **Deploy del edge function de ingesta** (trae los 48 equipos + 104 partidos):
   ```bash
   supabase functions deploy prode-sync --no-verify-jwt --project-ref gzsfoqpxvnwmvngfoqqk
   supabase secrets set FOOTBALL_DATA_API_KEY=xxx CRON_SECRET=xxx --project-ref gzsfoqpxvnwmvngfoqqk
   ```
   Sembrar ahora (una vez):
   ```bash
   curl -X POST https://gzsfoqpxvnwmvngfoqqk.supabase.co/functions/v1/prode-sync -H "x-cron-secret: <CRON_SECRET>"
   ```
   Programar la actualización de resultados durante el torneo: aplicar `supabase/functions/prode-sync/cron.sql`
   (reemplazando `<<CRON_SECRET>>`). Validá que tu plan de football-data.org incluya el Mundial (`WC`);
   si no, el admin permite cargar resultados a mano.

3. **WhatsApp OTP:** crear y hacer aprobar por Meta una plantilla categoría **authentication** (ej. `prode_otp`)
   y poner su nombre en `PRODE_WA_OTP_TEMPLATE`. *La aprobación de Meta tarda — pedila YA.*
   Mientras tanto, en dev el código OTP se muestra en pantalla/consola para poder testear.

4. **Revisar premios** (opcional): editá los nombres/valores en `reward_catalog`
   ("Cupón Mundial: Bienvenida" 20%, "Mundial: Servicio Gratis (Semanal)", "Mundial: Gran Premio").

## Probar local
```bash
npm run dev   # http://localhost:3000/mundial   y   /admin/prode
```
Con `SUPABASE_SERVICE_ROLE_KEY` seteada. Sin WhatsApp configurado, el OTP aparece en pantalla (modo dev).

## Migraciones (en `supabase/migrations/`, ya aplicadas)
`20260529000001_prode_enums_and_tables` · `…002_prode_rls` · `…003_prode_functions` · `…004_prode_seed`.

## Pendiente para fases siguientes (backend listo, falta UI/automatización)
- **Jugada del día** en `/mundial` (1X2 por partido destacado): RPC `prode_submit_match_prediction` y el toggle
  de "partido del día" ya existen; falta el componente público.
- **Premio semanal automático**: falta `prode_award_weekly_prizes` + cron.
- **Recordatorios diarios por WhatsApp**: usar `scheduled_messages` (cron existente) con plantilla aprobada.
- **Placa compartible (OG image)** dinámica por jugador.
