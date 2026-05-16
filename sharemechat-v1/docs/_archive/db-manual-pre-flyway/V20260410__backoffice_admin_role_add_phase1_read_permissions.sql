insert into role_permissions (role_id, permission_id)
select br.id, p.id
from backoffice_roles br
join permissions p on upper(p.code) in (
    'MODELS.READ_LIST',
    'MODELS.READ_KYC_MODE',
    'MODELS.UPDATE_CHECKLIST',
    'MODERATION.READ_REPORTS',
    'MODERATION.READ_REPORT_DETAIL',
    'STREAMS.READ_ACTIVE',
    'STREAMS.READ_DETAIL',
    'STATS.READ_OVERVIEW',
    'FINANCE.READ_SUMMARY',
    'FINANCE.READ_TOP_MODELS',
    'FINANCE.READ_TOP_CLIENTS'
)
where upper(br.code) = 'ADMIN'
  and not exists (
      select 1
      from role_permissions rp
      where rp.role_id = br.id
        and rp.permission_id = p.id
  );
