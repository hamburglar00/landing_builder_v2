import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";

test("NexoBet marketing preserves existing clients and isolates bindings, landings and statistics", async () => {
  const name = `nexo-builder-test-${randomUUID().slice(0, 8)}`;
  const docker = (...args) =>
    execFileSync("docker", args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  let container;
  try {
    container = docker(
      "run",
      "--detach",
      "--rm",
      "--pull=never",
      "--name",
      name,
      "--env",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:17-alpine",
    );
    for (let i = 0; i < 60; i++) {
      try {
        docker("exec", container, "pg_isready", "-U", "postgres");
        break;
      } catch {
        if (i === 59) throw Error("Postgres did not start");
        await wait(300);
      }
    }
    const sql = (q) =>
      execFileSync(
        "docker",
        [
          "exec",
          "-i",
          container,
          "psql",
          "-U",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
          "-At",
        ],
        {
          input: q,
          encoding: "utf8",
          windowsHide: true,
          timeout: 15000,
          stdio: ["pipe", "pipe", "pipe"],
        },
      ).trim();
    sql(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key,raw_app_meta_data jsonb);
   create table public.profiles(id uuid primary key);
   create table public.pbadmin_accounts(owner_id bigint primary key,account_id uuid,ready boolean,legacy boolean);
   create table public.client_subscriptions(user_id uuid primary key,status text,expires_at timestamptz);
   create table public.atrio_clients(id uuid primary key,user_id uuid,workspace_currency text);
   create table public.landings(id uuid primary key,user_id uuid,workspace_currency text,landing_type text,publish_target text,name text unique,comment text,pixel_id text,post_url text,config jsonb,landing_config jsonb,updated_at timestamptz);
   create table public.landings_atrio_clients(landing_id uuid,atrio_client_id uuid,user_id uuid,weight integer,primary key(landing_id,atrio_client_id));
   create table public.conversions(user_id uuid,currency text,lead_event_time bigint,registration_event_time bigint,purchase_event_time bigint);
   create function public.is_client_access_blocked(p_user_id uuid) returns boolean language sql as $$select exists(select 1 from public.client_subscriptions where user_id=p_user_id and (status<>'active' or expires_at<now()))$$;`);
    sql(
      readFileSync(
        new URL(
          "../supabase/migrations/20261107023059_nexobet_marketing_bridge.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const [a, b, old, account, other, advisor, foreign, landing] = Array.from(
      { length: 8 },
      () => randomUUID(),
    );
    for (const [id, owner, legacy] of [
      [a, 101, false],
      [b, 202, false],
      [old, 303, true],
    ])
      sql(
        `insert into profiles values('${id}');insert into auth.users values('${id}','{"pbadmin_owner_id":${owner},"pbadmin_kind":"builder"}');insert into pbadmin_accounts values(${owner},'${id}',true,${legacy});insert into client_subscriptions values('${id}','active',now()+interval '30 days');`,
      );
    assert.throws(
      () => sql(`select nexobet_bind_builder('${account}',303,'${old}')`),
      /Invalid NexoBet binding/,
    );
    assert.throws(
      () => sql(`select nexobet_bind_builder('${account}',101,'${b}')`),
      /Invalid NexoBet binding/,
    );
    sql(
      `select nexobet_bind_builder('${account}',101,'${a}');select nexobet_bind_builder('${account}',101,'${a}')`,
    );
    assert.equal(sql(`select count(*) from nexobet_builder_accounts`), "1");
    assert.equal(
      sql(
        `select expires_at is null from client_subscriptions where user_id='${a}'`,
      ),
      "t",
    );
    assert.equal(
      sql(
        `select count(*) from client_subscriptions where user_id in('${b}','${old}') and expires_at is not null`,
      ),
      "2",
    );
    assert.throws(
      () => sql(`select nexobet_bind_builder('${account}',202,'${b}')`),
      /Conflicting NexoBet binding/,
    );
    sql(
      `select nexobet_bind_builder('${other}',202,'${b}');insert into atrio_clients values('${advisor}','${a}','ARS'),('${foreign}','${b}','ARS')`,
    );
    const payload = JSON.stringify({
      name: "nx-fixture",
      comment: "Fixture",
      pixel_id: "",
      post_url: "https://example.test",
      config: { template: "template9", ctaDestination: "atrio" },
      landing_config: {},
    });
    assert.throws(
      () =>
        sql(
          `select nexobet_save_landing('${account}','${b}','${landing}','${foreign}','${payload}')`,
        ),
      /Account unavailable/,
    );
    assert.throws(
      () =>
        sql(
          `select nexobet_save_landing('${account}','${a}','${landing}','${foreign}','${payload}')`,
        ),
      /Advisor unavailable/,
    );
    assert.throws(
      () =>
        sql(
          `select nexobet_save_landing('${account}','${a}','${landing}','${advisor}','{}')`,
        ),
      /Invalid template/,
    );
    sql(
      `select nexobet_save_landing('${account}','${a}','${landing}','${advisor}','${payload}');select nexobet_save_landing('${account}','${a}','${landing}','${advisor}','${payload}')`,
    );
    assert.equal(sql("select count(*) from landings"), "1");
    assert.equal(sql("select count(*) from landings_atrio_clients"), "1");
    assert.throws(
      () =>
        sql(
          `select nexobet_save_landing('${other}','${b}','${landing}','${foreign}','${payload}')`,
        ),
      /Landing unavailable/,
    );
    sql(
      `insert into conversions values('${a}','ARS',extract(epoch from now())::bigint,null,null),('${b}','ARS',extract(epoch from now())::bigint,null,null),('${a}','USD',extract(epoch from now())::bigint,null,null),('${a}','ARS',extract(epoch from now()-interval '91 days')::bigint,null,null)`,
    );
    assert.deepEqual(
      JSON.parse(sql(`select nexobet_marketing_stats('${a}',1)`)),
      { leads: 1, registrations: 0, withPurchase: 0 },
    );
    assert.throws(
      () => sql(`select nexobet_marketing_stats('${old}',30)`),
      /Invalid statistics scope/,
    );
    assert.throws(
      () =>
        sql(`set role authenticated;select * from nexobet_builder_accounts`),
      /permission denied/,
    );
    assert.throws(
      () =>
        sql(
          `set role anon;select nexobet_bind_builder('${account}',101,'${a}')`,
        ),
      /permission denied/,
    );
    sql(
      `update client_subscriptions set status='paused' where user_id='${a}';select nexobet_bind_builder('${account}',101,'${a}')`,
    );
    assert.equal(
      sql(`select status from client_subscriptions where user_id='${a}'`),
      "paused",
    );
    assert.throws(
      () =>
        sql(
          `select nexobet_save_landing('${account}','${a}','${landing}','${advisor}','${payload}')`,
        ),
      /Account unavailable/,
    );
  } finally {
    if (container) docker("stop", container);
  }
});
