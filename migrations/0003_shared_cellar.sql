create table if not exists cellars (
  id text primary key,
  name text not null default 'The cellar',
  join_code text not null unique,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists cellars_join_code_idx on cellars (join_code);
create index if not exists cellars_created_by_idx on cellars (created_by);

create table if not exists cellar_members (
  cellar_id text not null references cellars(id) on delete cascade,
  user_id text not null,
  role text not null default 'member',
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (cellar_id, user_id)
);

create index if not exists cellar_members_user_idx on cellar_members (user_id);

alter table teas add column if not exists cellar_id text;
create index if not exists teas_cellar_id_idx on teas (cellar_id);

alter table steep_sessions add column if not exists author_name text not null default '';

alter table cellar_settings add column if not exists active_cellar_id text;

create table if not exists tea_comments (
  id text primary key,
  tea_id text not null references teas(id) on delete cascade,
  cellar_id text not null,
  user_id text not null,
  author_name text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists tea_comments_tea_idx on tea_comments (tea_id, created_at desc);
create index if not exists tea_comments_cellar_idx on tea_comments (cellar_id);
