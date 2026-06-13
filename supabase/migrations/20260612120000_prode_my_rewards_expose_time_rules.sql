-- Expone activation_delay_minutes y redeemable_weekdays del catálogo en
-- prode_my_rewards para que la app del Prode (cliente) pueda comunicar el
-- cooldown de 2 h y la ventana lun–mié del cupón de bienvenida.
-- La autoridad del canje sigue siendo redeem_coupon_for_visit (mig coupon_time_rules).
-- Additive: agrega 2 claves al JSON; consumidores existentes no se ven afectados.
create or replace function public.prode_my_rewards(p_participant_id uuid)
returns json language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(json_agg(json_build_object(
    'client_reward_id', cr.id,
    'name', rc.name,
    'description', rc.description,
    'discount_pct', rc.discount_pct,
    'is_free_service', rc.is_free_service,
    'status', cr.status,
    'qr_code', cr.qr_code,
    'expires_at', cr.expires_at,
    'created_at', cr.created_at,
    'activation_delay_minutes', rc.activation_delay_minutes,
    'redeemable_weekdays', rc.redeemable_weekdays
  ) order by case cr.status when 'available' then 0 when 'redeemed' then 1 else 2 end, cr.created_at desc), '[]'::json)
  from prode_participants p
  join client_rewards cr on cr.client_id = p.client_id and cr.organization_id = p.organization_id
  join reward_catalog rc on rc.id = cr.reward_id
  where p.id = p_participant_id
    and rc.name ilike '%Mundial%';
$$;
