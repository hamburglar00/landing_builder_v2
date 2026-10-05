import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {localDatabase, root} from '../phase0/local-runtime.mjs';

// Isolated synthetic PostgreSQL fixture: no linked project, network or commercial rows.
const migration = readFileSync(join(root, 'supabase/migrations/20261005154805_landing_weighted_quota.sql'), 'utf8');
const rollback = readFileSync(join(root, 'docs/landing-weighted-quota/rollback.sql'), 'utf8');
const landing = '81000000-0000-4000-8000-000000000001';
const owner = '81000000-0000-4000-8000-000000000002';
const fixture = `
create schema if not exists private;
create table public.landings (
  id uuid primary key, user_id uuid not null, name text unique not null,
  gerencia_selection_mode text not null default 'weighted_random'
    constraint landings_gerencia_selection_mode_check check (gerencia_selection_mode in ('weighted_random','fair')),
  gerencia_fair_criterion text not null default 'usage_count',
  landing_type text default 'internal', publish_target text default 'constructor'
);
create table public.gerencias (
  id integer primary key, user_id uuid not null, gerencia_id integer,
  fair_criterion text not null default 'usage_count'
);
create table public.gerencia_phones (
  id bigint primary key, gerencia_id integer not null references public.gerencias(id),
  phone text not null, status text not null default 'active',
  kind text not null default 'carga', assignment_role text not null default 'acquisition',
  usage_count bigint not null default 0,
  messages_reset_at timestamptz
);
create table public.landings_gerencias (
  landing_id uuid not null references public.landings(id),
  gerencia_id integer not null references public.gerencias(id),
  weight integer not null, phone_mode text not null default 'random',
  phone_kind text not null default 'carga',
  interval_start_hour integer, interval_end_hour integer,
  primary key (landing_id, gerencia_id)
);
create table public.landing_phone_assignment_reservations (
  id uuid primary key default gen_random_uuid(),
  landing_id uuid not null references public.landings(id),
  gerencia_id integer not null references public.gerencias(id),
  phone_id bigint not null references public.gerencia_phones(id),
  phone text not null, phone_kind text not null,
  status text not null default 'prewarmed',
  reserved_at timestamptz not null default clock_timestamp(),
  clicked_at timestamptz, expires_at timestamptz not null
);
create table public.landing_phone_cache (
  landing_id uuid not null references public.landings(id),
  landing_name text not null, payload jsonb not null,
  refreshed_at timestamptz not null, status text not null
);
create table public.phone_assignment_scope_metrics (
  scope_type text not null, scope_id uuid not null,
  gerencia_id integer not null, phone_id bigint not null,
  usage_count bigint not null default 0,
  primary key (scope_type, scope_id, gerencia_id, phone_id)
);
create table private.synthetic_message_load (
  landing_id uuid not null, gerencia_id integer not null, n bigint not null default 0,
  event_at timestamptz not null default clock_timestamp(),
  primary key (landing_id, gerencia_id)
);
create function public.phone_assignment_scope_usage(text, uuid, integer, text, bigint)
returns bigint language sql stable as $$
  select coalesce(sum(m.usage_count),0)::bigint
  from public.phone_assignment_scope_metrics m
  join public.gerencia_phones gp on gp.id=m.phone_id
  where m.scope_type=$1 and m.scope_id=$2 and m.gerencia_id=$3
    and gp.kind=$4 and ($5 is null or m.phone_id=$5)
$$;
create function private.landing_phone_message_load(uuid, integer, text, uuid, bigint)
returns bigint language sql stable as $$
  select coalesce((select m.n from private.synthetic_message_load m
    join public.gerencia_phones gp on gp.gerencia_id=m.gerencia_id
    where m.landing_id=$1 and m.gerencia_id=$2 and gp.kind=$3
      and ($5 is null or gp.id=$5)
      and (gp.messages_reset_at is null or m.event_at>=gp.messages_reset_at)),0)
    + (select count(*) from public.landing_phone_assignment_reservations r
       join public.gerencia_phones gp on gp.id=r.phone_id
       where r.landing_id=$1 and r.gerencia_id=$2
         and ($5 is null or r.phone_id=$5)
         and r.status in ('prewarmed','clicked') and r.expires_at>now()
         and (gp.messages_reset_at is null or r.reserved_at>=gp.messages_reset_at))
$$;
create function public.increment_phone_assignment_scope_usage(bigint,text,uuid,uuid,integer)
returns void language plpgsql as $$ begin
  update public.gerencia_phones set usage_count=usage_count+1 where id=$1;
  insert into public.phone_assignment_scope_metrics(scope_type,scope_id,gerencia_id,phone_id,usage_count)
  values ($2,$3,$5,$1,1)
  on conflict (scope_type,scope_id,gerencia_id,phone_id)
  do update set usage_count=public.phone_assignment_scope_metrics.usage_count+1;
end $$;
insert into public.landings(id,user_id,name,gerencia_selection_mode)
  values ('${landing}','${owner}','quota-synthetic','weighted_random');
insert into public.gerencias(id,user_id,gerencia_id)
  values (8101,'${owner}',8101),(8102,'${owner}',8102),
         (8103,'${owner}',8103),(8104,'${owner}',8104);
insert into public.gerencia_phones(id,gerencia_id,phone)
  values (810101,8101,'000001'),(810201,8102,'000002'),
         (810301,8103,'000003'),(810401,8104,'000004');
insert into public.landings_gerencias(landing_id,gerencia_id,weight)
  values ('${landing}',8101,20),('${landing}',8102,40),
         ('${landing}',8103,20),('${landing}',8104,20);
`;

const db = await localDatabase();
try {
  db.sql(fixture);
  db.sql(migration);
  assert.equal(db.sql(`select count(*) from public.landings where gerencia_selection_mode='weighted_random'`).trim(), '1');
  db.sql(`update public.landings set gerencia_selection_mode='weighted_quota' where id='${landing}'`);

  const read = sql => db.sql(sql).trim().split(/\r?\n/).at(-1);
  assert.equal(read("select public.get_phone_for_landing('quota-synthetic',false)->>'gerenciaSelectionMode'"), 'weighted_quota');
  assert.equal(read("select to_regclass('private.landing_gerencia_quota_state') is null"), 't');

  const oldReservation = '81000000-0000-4000-8000-000000000003';
  db.sql(`insert into public.landing_phone_assignment_reservations
    (id, landing_id, gerencia_id, phone_id, phone, phone_kind, reserved_at, expires_at)
    values ('${oldReservation}','${landing}',8101,810101,'000001','carga',
      clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days')`);
  const cleanupSelection = read("select public.get_phone_for_landing('quota-synthetic',true)->>'assignmentReservationId'");
  assert.equal(read(`select count(*) from public.landing_phone_assignment_reservations where id='${oldReservation}'`), '0');
  db.sql(`delete from public.landing_phone_assignment_reservations where id='${cleanupSelection}'`);

  db.sql(`do $$ begin for i in 1..100 loop perform public.get_phone_for_landing('quota-synthetic',true); end loop; end $$;`);
  assert.equal(read(`select string_agg(n::text,',' order by gerencia_id) from
    (select gerencia_id,count(*) n from public.landing_phone_assignment_reservations
     group by gerencia_id) x`), '20,40,20,20');
  assert.equal(read("select public.get_cached_constructor_landing_phone('quota-synthetic') is null"), 't');
  db.sql(`insert into public.landing_phone_cache(landing_id,landing_name,payload,refreshed_at,status)
    values ('${landing}','quota-synthetic','{"phone":"000001","gerencia":{"id":8101}}',now(),'ok')`);
  assert.equal(read("select public.get_cached_constructor_landing_phone('quota-synthetic') is null"), 't');

  const raced = await Promise.all(Array.from({length: 12}, () =>
    db.concurrentSql("select public.get_phone_for_landing('quota-synthetic',true)")));
  assert.ok(raced.every(result => result.code === 0), 'concurrent quota selectors succeeded');
  const concurrentCounts = read(`select string_agg(n::text,',' order by gerencia_id) from
    (select gerencia_id,count(*) n from public.landing_phone_assignment_reservations
     group by gerencia_id) x`).split(',').map(Number);
  assert.equal(concurrentCounts.reduce((sum, n) => sum + n, 0), 112);
  assert.ok(concurrentCounts[1] >= 44 && concurrentCounts[1] <= 45);
  assert.ok([concurrentCounts[0], concurrentCounts[2], concurrentCounts[3]].every(n => n >= 22 && n <= 23));

  const reservation = read(`select id from public.landing_phone_assignment_reservations order by reserved_at,id limit 1`);
  const phone = read(`select phone_id from public.landing_phone_assignment_reservations where id='${reservation}'`);
  const number = read(`select phone from public.landing_phone_assignment_reservations where id='${reservation}'`);
  // A visitor may click after a prewarmed reservation has expired.
  db.sql(`update public.landing_phone_assignment_reservations
    set status='expired', reserved_at=clock_timestamp()-interval '11 minutes',
      expires_at=clock_timestamp()-interval '10 minutes'
    where id='${reservation}'`);
  const click = `select public.count_landing_controlled_click('${reservation}','${landing}',${phone},'${number}')`;
  assert.equal(read(click), 't');
  assert.equal(read(click), 'f');
  assert.equal(read(`select usage_count from public.gerencia_phones where id=${phone}`), '1');
  assert.equal(read(`select click_counted_at is not null from public.landing_phone_assignment_reservations where id='${reservation}'`), 't');

  // An unavailable manager stops receiving reservations.
  db.sql("update public.gerencia_phones set status='inactive' where gerencia_id=8102");
  db.sql(`do $$ begin for i in 1..30 loop perform public.get_phone_for_landing('quota-synthetic',true); end loop; end $$;`);
  assert.equal(read(`select count(*) from public.landing_phone_assignment_reservations where gerencia_id=8102`), '45');
  db.sql("update public.gerencia_phones set status='active' where gerencia_id=8102");

  // The same operational counter reset used in Telefonos starts a new period.
  // Old unclicked reservations must not carry over into the quota calculation.
  db.sql(`update public.gerencia_phones
    set usage_count=0, assignment_counter_reset_at=clock_timestamp();
    update public.phone_assignment_scope_metrics set usage_count=0`);
  const afterCounterReset = Number(read(`select count(*) from public.landing_phone_assignment_reservations`));
  db.sql(`do $$ begin for i in 1..5 loop perform public.get_phone_for_landing('quota-synthetic',true); end loop; end $$;`);
  assert.equal(read(`select string_agg(n::text,',' order by gerencia_id) from
    (select gerencia_id,count(*) n from
      (select gerencia_id from public.landing_phone_assignment_reservations
       order by reserved_at,id offset ${afterCounterReset}) latest
     group by gerencia_id) x`), '1,2,1,1');

  // With bot-confirmed messages, the quota pursues LEAD counts, not purchases.
  db.sql("update public.landings set gerencia_fair_criterion='messages_received'");
  db.sql("update public.gerencia_phones set messages_reset_at=clock_timestamp()");
  db.sql(`insert into private.synthetic_message_load(landing_id,gerencia_id,n)
    values ('${landing}',8101,0),('${landing}',8102,0),
           ('${landing}',8103,0),('${landing}',8104,0)`);
  db.sql(`update private.synthetic_message_load
    set n=100, event_at=clock_timestamp() where gerencia_id=8102`);
  const beforeHighLead = Number(read(`select count(*) from public.landing_phone_assignment_reservations`));
  db.sql(`do $$ begin for i in 1..20 loop perform public.get_phone_for_landing('quota-synthetic',true); end loop; end $$;`);
  assert.equal(read(`select count(*) from
    (select gerencia_id from public.landing_phone_assignment_reservations
     order by reserved_at,id offset ${beforeHighLead}) latest
    where gerencia_id=8102`), '0');

  // Resetting Messages clears the old bot count and provisional reservations.
  db.sql("update public.gerencia_phones set messages_reset_at=clock_timestamp()");
  const afterMessageReset = Number(read(`select count(*) from public.landing_phone_assignment_reservations`));
  db.sql(`do $$ begin for i in 1..5 loop perform public.get_phone_for_landing('quota-synthetic',true); end loop; end $$;`);
  assert.equal(read(`select string_agg(n::text,',' order by gerencia_id) from
    (select gerencia_id,count(*) n from
      (select gerencia_id from public.landing_phone_assignment_reservations
       order by reserved_at,id offset ${afterMessageReset}) latest
     group by gerencia_id) x`), '1,2,1,1');

  const hour = Number(read("select extract(hour from now() at time zone 'America/Argentina/Buenos_Aires')::integer"));
  db.sql(`update public.landings_gerencias set interval_start_hour=${(hour + 1) % 24},
    interval_end_hour=${(hour + 2) % 24}`);
  assert.equal(read("select public.get_phone_for_landing('quota-synthetic',true)->>'_status'"), 'no_assignments');
  db.sql(`update public.landings_gerencias set interval_start_hour=${hour},
    interval_end_hour=${(hour + 1) % 24}`);
  assert.equal(read("select public.get_phone_for_landing('quota-synthetic',true)->>'gerenciaSelectionMode'"), 'weighted_quota');

  db.sql('update public.landings_gerencias set weight=0 where gerencia_id<>8104');
  const beforeZeroWeight = Number(read(`select count(*) from public.landing_phone_assignment_reservations`));
  db.sql(`do $$ begin for i in 1..5 loop perform public.get_phone_for_landing('quota-synthetic',true); end loop; end $$;`);
  assert.equal(read(`select count(*) from
    (select gerencia_id from public.landing_phone_assignment_reservations
     order by reserved_at,id offset ${beforeZeroWeight}) latest
    where gerencia_id=8104`), '5');
  db.sql("update public.gerencia_phones set status='inactive'");
  assert.equal(read("select public.get_phone_for_landing('quota-synthetic',true)->>'_status'"), 'no_phones');
  db.sql("update public.gerencia_phones set status='active'");

  // The existing weighted lottery and constructor cache remain callable.
  db.sql("update public.landings set gerencia_selection_mode='weighted_random'");
  assert.equal(read("select public.get_phone_for_landing('quota-synthetic',true)->>'gerenciaSelectionMode'"), 'weighted_random');
  assert.equal(read("select public.get_cached_constructor_landing_phone('quota-synthetic')->>'phone'"), '000001');

  // Fair by counter now uses the same provisional load and idempotent click.
  db.sql(`update public.landings_gerencias set weight=20;
    update public.landings set gerencia_selection_mode='fair',
      gerencia_fair_criterion='usage_count';
    update public.gerencia_phones
      set usage_count=0, assignment_counter_reset_at=clock_timestamp();
    update public.phone_assignment_scope_metrics set usage_count=0`);
  const beforeFair = Number(read('select count(*) from public.landing_phone_assignment_reservations'));
  db.sql(`do $$ begin for i in 1..100 loop perform public.get_phone_for_landing('quota-synthetic',true); end loop; end $$;`);
  assert.equal(read(`select string_agg(n::text,',' order by gerencia_id) from
    (select gerencia_id,count(*) n from
      (select gerencia_id from public.landing_phone_assignment_reservations
       order by reserved_at,id offset ${beforeFair}) latest
     group by gerencia_id) x`), '25,25,25,25');
  const fairRaced = await Promise.all(Array.from({length: 12}, () =>
    db.concurrentSql("select public.get_phone_for_landing('quota-synthetic',true)")));
  assert.ok(fairRaced.every(result => result.code === 0), 'concurrent fair selectors succeeded');
  assert.equal(read(`select string_agg(n::text,',' order by gerencia_id) from
    (select gerencia_id,count(*) n from
      (select gerencia_id from public.landing_phone_assignment_reservations
       order by reserved_at,id offset ${beforeFair}) latest
     group by gerencia_id) x`), '28,28,28,28');
  const fairReservation = read(`select id from public.landing_phone_assignment_reservations
    order by reserved_at,id offset ${beforeFair} limit 1`);
  const fairPhone = read(`select phone_id from public.landing_phone_assignment_reservations
    where id='${fairReservation}'`);
  const fairNumber = read(`select phone from public.landing_phone_assignment_reservations
    where id='${fairReservation}'`);
  const fairClick = `select public.count_landing_controlled_click(
    '${fairReservation}','${landing}',${fairPhone},'${fairNumber}')`;
  assert.equal(read(fairClick), 't');
  assert.equal(read(fairClick), 'f');
  assert.equal(read(`select public.phone_assignment_scope_usage(
    'landing','${landing}',(select gerencia_id from public.gerencia_phones where id=${fairPhone}),
    'carga',${fairPhone})`), '1');

  // The shared Telefonos reset drops both old pending and counted clicks.
  db.sql(`update public.gerencia_phones
    set usage_count=0, assignment_counter_reset_at=clock_timestamp();
    update public.phone_assignment_scope_metrics set usage_count=0`);
  const afterFairReset = Number(read('select count(*) from public.landing_phone_assignment_reservations'));
  db.sql(`do $$ begin for i in 1..4 loop perform public.get_phone_for_landing('quota-synthetic',true); end loop; end $$;`);
  assert.equal(read(`select string_agg(n::text,',' order by gerencia_id) from
    (select gerencia_id,count(*) n from
      (select gerencia_id from public.landing_phone_assignment_reservations
       order by reserved_at,id offset ${afterFairReset}) latest
     group by gerencia_id) x`), '1,1,1,1');

  // Fair by messages continues to read confirmed LEAD and pending reservations.
  db.sql("update public.landings set gerencia_fair_criterion='messages_received'");
  assert.equal(read("select public.get_phone_for_landing('quota-synthetic',true)->>'gerenciaSelectionMode'"), 'fair');
  assert.equal(read(`select has_function_privilege('anon',
    'public.count_landing_controlled_click(uuid,uuid,bigint,text)','EXECUTE')`), 'f');
  db.sql(rollback);
  assert.equal(read(`select position('weighted_quota' in pg_get_functiondef(
    'public.get_phone_for_landing(text,boolean)'::regprocedure))`), '0');
  console.log('PASS: quota 20/40/20/20, fair 25/25/25/25, concurrent selection, late idempotent click, expired reservation cleanup, shared resets, eligibility, legacy lottery, functional rollback');
} finally {
  db.close();
}
