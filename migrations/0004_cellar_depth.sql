alter table teas add column if not exists form text not null default 'cake';
alter table teas add column if not exists original_grams double precision;
alter table teas add column if not exists remaining_grams double precision;
alter table teas add column if not exists factory text not null default '';
alter table teas add column if not exists recipe text not null default '';
alter table teas add column if not exists listing_url text not null default '';
alter table teas add column if not exists storage text not null default 'cabinet';
alter table teas add column if not exists intent text not null default 'drink';
alter table teas add column if not exists locked boolean not null default false;
alter table teas add column if not exists wrapper_photo_url text not null default '';
alter table teas add column if not exists last_drinker_name text not null default '';
alter table teas add column if not exists last_steep_times jsonb not null default '[]'::jsonb;
alter table teas add column if not exists last_vessel text not null default '';

create index if not exists teas_factory_idx on teas (factory);
create index if not exists teas_recipe_idx on teas (recipe);
create index if not exists teas_year_idx on teas (year);

alter table steep_sessions add column if not exists vessel text not null default '';
alter table steep_sessions add column if not exists leaf_grams double precision;
alter table steep_sessions add column if not exists water_ml double precision;
alter table steep_sessions add column if not exists water_temp integer;
alter table steep_sessions add column if not exists infusion_count integer;
alter table steep_sessions add column if not exists liquor_photo_url text not null default '';
alter table steep_sessions add column if not exists wet_leaf_photo_url text not null default '';
alter table steep_sessions add column if not exists steep_times jsonb not null default '[]'::jsonb;
alter table steep_sessions add column if not exists taste_tags jsonb not null default '[]'::jsonb;
