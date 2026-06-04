-- Prode Mundial 2026 — seed (idempotente). Torneo + Quiniela + Liga Monaco + premios.
-- Los valores de premios son defaults sensatos, editables luego desde el admin.
do $$
declare v_t uuid; v_org uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
begin
  select id into v_t from prode_tournament where organization_id=v_org and season='2026' limit 1;
  if v_t is null then
    insert into prode_tournament(name, season, status, predictions_lock_at, starts_at, ends_at, settings)
    values ('Mundial 2026','2026','upcoming',
      '2026-06-11 19:00:00+00','2026-06-11 19:00:00+00','2026-07-19 23:59:00+00',
      '{"match_outcome_points":3,"match_exact_bonus":2,"featured_multiplier":2}'::jsonb)
    returning id into v_t;
  end if;

  if not exists (select 1 from prode_questions where tournament_id=v_t) then
    insert into prode_questions(tournament_id, kind, label, help_text, answer_type, options, points, sort_order) values
    (v_t,'champion','¿Quién sale campeón del Mundial?',null,'team',null,30,1),
    (v_t,'runner_up','¿Quién es el subcampeón (pierde la final)?',null,'team',null,15,2),
    (v_t,'top_scorer','Goleador del Mundial (Botín de Oro)','Nombre del jugador','text',null,20,3),
    (v_t,'surprise_team','La selección revelación','El equipo que más sorprenda','team',null,15,4),
    (v_t,'team_stage','¿Hasta dónde llega Argentina?',null,'choice',
      '["Fase de grupos","Ronda de 32","Octavos","Cuartos","Semifinal","Subcampeón","Campeón"]'::jsonb,15,5),
    (v_t,'bonus','¿La final se define por penales?',null,'choice','["Sí","No"]'::jsonb,10,6);
  end if;

  if not exists (select 1 from prode_leagues where tournament_id=v_t and is_house) then
    insert into prode_leagues(tournament_id, name, is_public, is_house) values (v_t,'Liga Monaco',true,true);
  end if;

  if not exists (select 1 from reward_catalog where organization_id=v_org and name='Cupón Mundial: Bienvenida') then
    insert into reward_catalog(name, description, type, discount_pct, is_free_service, is_active, points_cost, valid_until, organization_id)
    values ('Cupón Mundial: Bienvenida','20% off en tu primer servicio por sumarte al Prode Mundial','return_discount',20,false,true,0,'2026-08-31',v_org);
  end if;
  if not exists (select 1 from reward_catalog where organization_id=v_org and name='Mundial: Servicio Gratis (Semanal)') then
    insert into reward_catalog(name, description, type, is_free_service, is_active, points_cost, valid_until, organization_id)
    values ('Mundial: Servicio Gratis (Semanal)','Servicio gratis para el 1° de la tabla de la semana','milestone_free',true,true,0,'2026-08-31',v_org);
  end if;
  if not exists (select 1 from reward_catalog where organization_id=v_org and name='Mundial: Gran Premio') then
    insert into reward_catalog(name, description, type, is_free_service, is_active, points_cost, valid_until, organization_id)
    values ('Mundial: Gran Premio','Gran premio para el campeón del Prode Mundial','manual',true,true,0,'2026-08-31',v_org);
  end if;
end $$;