create table if not exists teas (
  id text primary key,
  user_id text not null,
  name text not null,
  name_zh text not null default '',
  pinyin text not null default '',
  type text not null default 'other',
  origin text not null default '',
  region text not null default '',
  cultivar text not null default '',
  vendor text not null default '',
  year text not null default '',
  quantity text not null default '',
  processing text not null default '',
  description text not null default '',
  tasting_notes jsonb not null default '[]'::jsonb,
  liquor text not null default '',
  brew jsonb,
  aging text not null default '',
  rest_days integer not null default 14,
  photo_url text not null default '',
  acquired_at text not null default '',
  created_at timestamptz not null default now(),
  last_steeped_at timestamptz,
  sources jsonb not null default '[]'::jsonb,
  unknown boolean not null default false,
  prompt text not null default ''
);

create index if not exists teas_user_id_idx on teas (user_id);
create index if not exists teas_user_created_idx on teas (user_id, created_at desc);

create table if not exists steep_sessions (
  id text primary key,
  tea_id text not null references teas(id) on delete cascade,
  user_id text not null,
  steeped_at timestamptz not null default now(),
  note text not null default '',
  rating integer
);

create index if not exists steep_sessions_user_idx on steep_sessions (user_id, steeped_at desc);
create index if not exists steep_sessions_tea_idx on steep_sessions (tea_id);

create table if not exists cellar_settings (
  user_id text primary key,
  notify boolean not null default false,
  last_notified_on text,
  seeded boolean not null default false
);
