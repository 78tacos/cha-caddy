alter table cellar_settings add column if not exists pull_photos boolean not null default true;
alter table cellar_settings add column if not exists confirm_photos boolean not null default true;
alter table cellar_settings add column if not exists lookup_sources jsonb;
