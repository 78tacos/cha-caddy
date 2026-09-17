alter table cellar_settings add column if not exists categories jsonb;

update teas
set
  type = 'heicha',
  subtype = case
    when subtype is null or btrim(subtype) = '' then 'Ripe puerh'
    when lower(subtype) like '%liu bao%' then 'Liu Bao'
    when lower(subtype) like '%fu brick%' or lower(subtype) like '%anhua%' then 'Fu brick / Anhua'
    when lower(subtype) in ('ripe cake', 'other ripe') then 'Ripe puerh'
    else subtype
  end
where type = 'shou';
