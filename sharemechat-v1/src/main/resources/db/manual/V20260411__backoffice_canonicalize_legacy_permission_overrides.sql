drop temporary table if exists tmp_backoffice_permission_aliases;
create temporary table tmp_backoffice_permission_aliases (
    legacy_code varchar(255) not null,
    canonical_code varchar(255) not null,
    primary key (legacy_code)
);

insert into tmp_backoffice_permission_aliases (legacy_code, canonical_code)
values
    ('FINANCE.VIEW_SUMMARY', 'FINANCE.READ_SUMMARY');

drop temporary table if exists tmp_backoffice_override_resolution;
create temporary table tmp_backoffice_override_resolution as
select
    uo.user_id as user_id,
    canonical_permissions.id as canonical_permission_id,
    min(case when uo.allowed then 1 else 0 end) as resolved_allowed
from user_permission_overrides uo
join permissions source_permissions on source_permissions.id = uo.permission_id
join tmp_backoffice_permission_aliases aliases
    on upper(source_permissions.code) = aliases.legacy_code
    or upper(source_permissions.code) = aliases.canonical_code
join permissions canonical_permissions
    on upper(canonical_permissions.code) = aliases.canonical_code
group by uo.user_id, canonical_permissions.id;

delete uo
from user_permission_overrides uo
join permissions source_permissions on source_permissions.id = uo.permission_id
join tmp_backoffice_permission_aliases aliases
    on upper(source_permissions.code) = aliases.legacy_code
    or upper(source_permissions.code) = aliases.canonical_code;

insert into user_permission_overrides (user_id, permission_id, allowed)
select
    resolved.user_id,
    resolved.canonical_permission_id,
    resolved.resolved_allowed
from tmp_backoffice_override_resolution resolved;

drop temporary table if exists tmp_backoffice_override_resolution;
drop temporary table if exists tmp_backoffice_permission_aliases;
