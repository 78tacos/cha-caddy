alter table teas add column if not exists subtype text not null default '';

update teas set subtype = 'Wuyi rock', type = 'oolong' where type = 'yancha';
update teas set subtype = 'Phoenix dancong', type = 'oolong' where type = 'dancong';
update teas set subtype = 'Liu Bao / dark tea', type = 'shou' where type = 'heicha';
update teas set subtype = 'Jasmine / scented', type = 'green' where type = 'scented';
update teas set type = 'herbal' where type = 'other';
