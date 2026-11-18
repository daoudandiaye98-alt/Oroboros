-- Mare Liberum · schema v1
-- One open index of agentic resources. Every RPC takes one jsonb and returns one jsonb,
-- so any node (Postgres, PGlite, a mirror) speaks the same interface.

create extension if not exists pg_trgm;

create table if not exists public.mare_entries (
  id            text primary key,            -- ARD identifier: urn:air:<publisher>:[<ns>:]<name>
  publisher     text not null,               -- domain that vouches for the entry
  display_name  text not null,
  type          text not null,               -- IANA media type of the artifact
  kind          text not null,               -- mcp | a2a | x402 | skill | registry | catalog | api | other
  url           text,
  data          jsonb,
  description   text,
  tags          text[] not null default '{}',
  capabilities  text[] not null default '{}',
  queries       text[] not null default '{}',
  version       text,
  endpoints     jsonb not null default '[]', -- how to reach it directly: [{transport,url,...}]
  pay           jsonb,                       -- payment terms when the resource is paid
  source        text not null,               -- which lake it flowed in from
  source_ref    text,
  attested_by   text not null default 'source', -- domain | mcp-registry-namespace | bazaar-listing | source
  quality       real not null default 0,     -- 0..10, measured usage signal from the source
  updated_at    timestamptz,
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  fts           tsvector
);

create index if not exists mare_entries_fts   on public.mare_entries using gin (fts);
create index if not exists mare_entries_kind  on public.mare_entries (kind);
create index if not exists mare_entries_src   on public.mare_entries (source);
create index if not exists mare_entries_pub   on public.mare_entries (publisher);
create index if not exists mare_entries_name  on public.mare_entries using gin (display_name gin_trgm_ops);

create table if not exists public.mare_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.mare_rate (
  key text not null,
  win bigint not null,
  n   int not null default 0,
  primary key (key, win)
);

alter table public.mare_entries enable row level security;
alter table public.mare_state   enable row level security;
alter table public.mare_rate    enable row level security;

-- ---------------------------------------------------------------- upsert
create or replace function public.mare_upsert(p jsonb) returns jsonb
language plpgsql as $$
declare n int;
begin
  with rows as (
    select distinct on (r.id) r.*
    from jsonb_to_recordset(coalesce(p->'rows','[]'::jsonb)) as r(
      id text, publisher text, display_name text, type text, kind text, url text, data jsonb,
      description text, tags text[], capabilities text[], queries text[], version text,
      endpoints jsonb, pay jsonb, source text, source_ref text, attested_by text,
      quality real, updated_at timestamptz)
    where r.id is not null and r.display_name is not null and r.type is not null
  ), up as (
    insert into public.mare_entries as e
      (id, publisher, display_name, type, kind, url, data, description, tags, capabilities, queries,
       version, endpoints, pay, source, source_ref, attested_by, quality, updated_at, last_seen, fts)
    select r.id, r.publisher, r.display_name, r.type, coalesce(r.kind,'other'), r.url, r.data, r.description,
           coalesce(r.tags,'{}'), coalesce(r.capabilities,'{}'), coalesce(r.queries,'{}'),
           r.version, coalesce(r.endpoints,'[]'::jsonb), r.pay, r.source, r.source_ref,
           coalesce(r.attested_by,'source'), coalesce(r.quality,0), r.updated_at, now(),
           setweight(to_tsvector('simple', coalesce(r.display_name,'')), 'A') ||
           setweight(to_tsvector('simple', coalesce(array_to_string(r.capabilities,' '),'') || ' ' ||
                                           coalesce(array_to_string(r.tags,' '),'')), 'B') ||
           setweight(to_tsvector('simple', left(coalesce(r.description,''),2000) || ' ' ||
                                           coalesce(array_to_string(r.queries,' '),'')), 'C') ||
           setweight(to_tsvector('simple', regexp_replace(r.id,'[^a-zA-Z0-9]+',' ','g')), 'D')
    from rows r
    on conflict (id) do update set
      publisher = excluded.publisher, display_name = excluded.display_name, type = excluded.type,
      kind = excluded.kind, url = excluded.url, data = excluded.data, description = excluded.description,
      tags = excluded.tags, capabilities = excluded.capabilities, queries = excluded.queries,
      version = excluded.version, endpoints = excluded.endpoints, pay = excluded.pay,
      source = excluded.source, source_ref = excluded.source_ref, attested_by = excluded.attested_by,
      quality = excluded.quality, updated_at = excluded.updated_at, last_seen = now(), fts = excluded.fts
    returning 1
  )
  select count(*) into n from up;
  return jsonb_build_object('upserted', n);
end $$;

-- ---------------------------------------------------------------- public shape of one entry
create or replace function public.mare_public(e public.mare_entries, full_entry boolean) returns jsonb
language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'identifier', e.id,
    'displayName', e.display_name,
    'type', e.type,
    'url', e.url,
    'description', case when full_entry then e.description else left(e.description, 280) end,
    'capabilities', case when cardinality(e.capabilities) > 0 then to_jsonb(e.capabilities) end,
    'tags', case when cardinality(e.tags) > 0 then to_jsonb(e.tags) end,
    'version', e.version,
    'updatedAt', e.updated_at,
    'representativeQueries', case when full_entry and cardinality(e.queries) > 0 then to_jsonb(e.queries) end,
    'data', case when full_entry then e.data end,
    'metadata', jsonb_strip_nulls(jsonb_build_object(
      'kind', e.kind,
      'publisher', e.publisher,
      'endpoints', case when jsonb_array_length(e.endpoints) > 0 then e.endpoints end,
      'pay', e.pay,
      'attestedBy', e.attested_by,
      'lake', e.source,
      'lakeRef', e.source_ref,
      'firstSeen', case when full_entry then e.first_seen end,
      'lastSeen', case when full_entry then e.last_seen end))
  ))
$$;

-- ---------------------------------------------------------------- search
create or replace function public.mare_search(p jsonb) returns jsonb
language plpgsql stable as $$
declare
  tsq   tsquery;
  lim   int := least(greatest(coalesce((p->>'limit')::int, 10), 1), 100);
  off   int := greatest(coalesce((p->>'offset')::int, 0), 0);
  kinds text[];
  types text[];
  paid  boolean := (p->>'paid')::boolean;
  res   jsonb;
begin
  if jsonb_typeof(p->'kinds') = 'array' and jsonb_array_length(p->'kinds') > 0 then
    kinds := array(select jsonb_array_elements_text(p->'kinds'));
  end if;
  if jsonb_typeof(p->'types') = 'array' and jsonb_array_length(p->'types') > 0 then
    types := array(select jsonb_array_elements_text(p->'types'));
  end if;
  begin
    tsq := to_tsquery('simple', coalesce(p->>'tsq', ''));
  exception when others then
    tsq := null;
  end;
  if tsq is null or numnode(tsq) = 0 then
    return jsonb_build_object('results', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(x.r order by x.score desc, x.id), '[]'::jsonb) into res
  from (
    select e.id,
           least(100, round((ts_rank(e.fts, tsq, 32) * 160
                 + e.quality
                 + case when e.attested_by = 'domain' then 6 else 0 end
                 + case when jsonb_array_length(e.endpoints) > 0 then 2 else 0 end)::numeric))::int as score,
           e as ent
    from public.mare_entries e
    where e.fts @@ tsq
      and (kinds is null or e.kind = any(kinds))
      and (types is null or e.type = any(types))
      and (paid is null or (e.pay is not null) = paid)
    order by 2 desc, e.id
    limit lim offset off
  ) s
  cross join lateral (
    select s.id, s.score, public.mare_public(s.ent, false) || jsonb_build_object('score', s.score) as r
  ) x;

  return jsonb_build_object('results', res);
end $$;

-- ---------------------------------------------------------------- get / list / stats
create or replace function public.mare_get(p jsonb) returns jsonb
language sql stable as $$
  select coalesce((select public.mare_public(e, true) from public.mare_entries e where e.id = p->>'id'), 'null'::jsonb)
$$;

create or replace function public.mare_list(p jsonb) returns jsonb
language sql stable as $$
  with page as (
    select e from public.mare_entries e
    where (p->>'after' is null or e.id > p->>'after')
      and (p->>'kind' is null or e.kind = p->>'kind')
      and (p->>'type' is null or e.type = p->>'type')
      and (p->>'publisher' is null or e.publisher = p->>'publisher')
    order by e.id
    limit least(greatest(coalesce((p->>'limit')::int, 20), 1), 1000)
  )
  select jsonb_build_object(
    'entries', coalesce(jsonb_agg(public.mare_public(page.e, coalesce((p->>'full')::boolean, false)) order by (page.e).id), '[]'::jsonb),
    'last', max((page.e).id))
  from page
$$;

create or replace function public.mare_stats(p jsonb) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'entries',    (select count(*) from public.mare_entries),
    'publishers', (select count(distinct publisher) from public.mare_entries),
    'paid',       (select count(*) from public.mare_entries where pay is not null),
    'domainAttested', (select count(*) from public.mare_entries where attested_by = 'domain'),
    'byKind',     (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) from (select kind, count(*) n from public.mare_entries group by kind) k),
    'byLake',     (select coalesce(jsonb_object_agg(source, n), '{}'::jsonb) from (select source, count(*) n from public.mare_entries group by source) s),
    'lastSeen',   (select max(last_seen) from public.mare_entries))
$$;

-- ---------------------------------------------------------------- state + rate limit
create or replace function public.mare_state_get(p jsonb) returns jsonb
language sql stable as $$
  select coalesce((select value from public.mare_state where key = p->>'key'), 'null'::jsonb)
$$;

create or replace function public.mare_state_set(p jsonb) returns jsonb
language plpgsql as $$
begin
  insert into public.mare_state(key, value, updated_at) values (p->>'key', p->'value', now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mare_rate_hit(p jsonb) returns jsonb
language plpgsql as $$
declare
  w   bigint := floor(extract(epoch from now()) / greatest((p->>'window')::int, 1));
  cnt int;
begin
  insert into public.mare_rate(key, win, n) values (p->>'key', w, 1)
  on conflict (key, win) do update set n = public.mare_rate.n + 1
  returning n into cnt;
  delete from public.mare_rate where win < w - 2;
  return jsonb_build_object('ok', cnt <= (p->>'max')::int, 'n', cnt);
end $$;

-- The node reaches these with its service key only.
revoke execute on function public.mare_upsert(jsonb), public.mare_search(jsonb), public.mare_get(jsonb),
  public.mare_list(jsonb), public.mare_stats(jsonb), public.mare_state_get(jsonb),
  public.mare_state_set(jsonb), public.mare_rate_hit(jsonb) from public;
