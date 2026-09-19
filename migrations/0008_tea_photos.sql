alter table teas add column if not exists photos jsonb not null default '[]'::jsonb;
