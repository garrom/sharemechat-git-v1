package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.security.BackofficeAuthorities;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class BackofficeAccessService {

    private static final Logger log = LoggerFactory.getLogger(BackofficeAccessService.class);

    private final JdbcTemplate jdbcTemplate;

    public BackofficeAccessService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public BackofficeAccessProfile loadProfile(Long userId, String productRole) {
        LinkedHashSet<String> roles = new LinkedHashSet<>();
        LinkedHashSet<String> permissions = new LinkedHashSet<>();

        String normalizedProductRole = normalize(productRole);
        if (BackofficeAuthorities.ROLE_ADMIN.equals(normalizedProductRole)
                || Constants.Roles.ADMIN.equals(normalizedProductRole)) {
            roles.add(BackofficeAuthorities.ROLE_ADMIN);
        }

        if (userId != null) {
            roles.addAll(loadBackofficeRoles(userId));
            permissions.addAll(loadRolePermissions(userId));
            applyOverrides(userId, permissions);
        }

        if (roles.contains(BackofficeAuthorities.ROLE_ADMIN)) {
            permissions.addAll(BackofficeAuthorities.SUPPORT_PHASE1_PERMISSIONS);
        }

        return new BackofficeAccessProfile(Set.copyOf(roles), Set.copyOf(permissions));
    }

    public BackofficeAdminOverview listAdminOverview() {
        List<BackofficeUserAdminRow> baseUsers = jdbcTemplate.query("""
                select distinct u.id, u.email, u.nickname, u.role
                from users u
                left join user_backoffice_roles ubr on ubr.user_id = u.id
                where upper(coalesce(u.role, '')) = 'ADMIN'
                   or ubr.user_id is not null
                order by lower(u.email), u.id
                """, (rs, rowNum) -> new BackofficeUserAdminRow(
                rs.getLong("id"),
                rs.getString("email"),
                rs.getString("nickname"),
                normalize(rs.getString("role")),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                false
        ));

        List<BackofficeUserAdminRow> users = new ArrayList<>();

        for (BackofficeUserAdminRow base : baseUsers) {
            BackofficeAccessProfile profile = loadProfile(base.userId(), base.productRole());
            Set<String> roles = profile.roles();
            Set<String> permissions = profile.permissions();
            OverrideSummary overrides = loadPermissionOverrides(base.userId());

            users.add(new BackofficeUserAdminRow(
                    base.userId(),
                    base.email(),
                    base.nickname(),
                    base.productRole(),
                    roles.stream().sorted().toList(),
                    permissions.stream().sorted().toList(),
                    overrides.allowed().stream().sorted().toList(),
                    overrides.denied().stream().sorted().toList(),
                    !overrides.allowed().isEmpty() || !overrides.denied().isEmpty()
            ));
        }

        users.sort(Comparator.comparing(BackofficeUserAdminRow::email, String.CASE_INSENSITIVE_ORDER));

        long adminCount = users.stream().filter(u -> u.backofficeRoles().contains(BackofficeAuthorities.ROLE_ADMIN)).count();
        long supportCount = users.stream().filter(u -> u.backofficeRoles().contains(BackofficeAuthorities.ROLE_SUPPORT)).count();
        long auditCount = users.stream().filter(u -> u.backofficeRoles().contains(BackofficeAuthorities.ROLE_AUDIT)).count();
        long overrideCount = users.stream().filter(BackofficeUserAdminRow::hasOverrides).count();

        return new BackofficeAdminOverview(
                users,
                Map.of(
                        "totalUsers", users.size(),
                        "adminUsers", adminCount,
                        "supportUsers", supportCount,
                        "auditUsers", auditCount,
                        "usersWithOverrides", overrideCount
                )
        );
    }

    private Set<String> loadBackofficeRoles(Long userId) {
        List<String> rows = tryQueryForList(userId,
                """
                    select upper(br.code)
                    from user_backoffice_roles ubr
                    join backoffice_roles br on br.id = ubr.role_id
                    where ubr.user_id = ?
                    """,
                """
                    select upper(br.code)
                    from user_backoffice_roles ubr
                    join backoffice_roles br on br.id = ubr.backoffice_role_id
                    where ubr.user_id = ?
                    """
        );
        return sanitize(rows);
    }

    private Set<String> loadRolePermissions(Long userId) {
        List<String> rows = tryQueryForList(userId,
                """
                    select distinct upper(p.code)
                    from user_backoffice_roles ubr
                    join role_permissions rp on rp.role_id = ubr.role_id
                    join permissions p on p.id = rp.permission_id
                    where ubr.user_id = ?
                    """,
                """
                    select distinct upper(p.code)
                    from user_backoffice_roles ubr
                    join role_permissions rp on rp.role_id = ubr.backoffice_role_id
                    join permissions p on p.id = rp.permission_id
                    where ubr.user_id = ?
                    """
        );
        return sanitize(rows);
    }

    private void applyOverrides(Long userId, Set<String> permissions) {
        try {
            List<PermissionOverrideRow> rows = fetchOverrideRows(userId);

            for (PermissionOverrideRow row : rows) {
                if (row.code().isBlank()) {
                    continue;
                }
                if (row.allowed()) {
                    permissions.add(row.code());
                } else {
                    permissions.remove(row.code());
                }
            }
        } catch (DataAccessException ex) {
            log.warn("No se pudieron aplicar overrides de permisos para userId={}: {}", userId, ex.getMessage());
        }
    }

    private OverrideSummary loadPermissionOverrides(Long userId) {
        try {
            List<PermissionOverrideRow> rows = fetchOverrideRows(userId);
            Set<String> allowed = rows.stream()
                    .filter(PermissionOverrideRow::allowed)
                    .map(PermissionOverrideRow::code)
                    .filter(code -> !code.isBlank())
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            Set<String> denied = rows.stream()
                    .filter(row -> !row.allowed())
                    .map(PermissionOverrideRow::code)
                    .filter(code -> !code.isBlank())
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            return new OverrideSummary(Set.copyOf(allowed), Set.copyOf(denied));
        } catch (DataAccessException ex) {
            log.warn("No se pudieron cargar overrides detallados para userId={}: {}", userId, ex.getMessage());
            return new OverrideSummary(Set.of(), Set.of());
        }
    }

    private List<PermissionOverrideRow> fetchOverrideRows(Long userId) {
        return jdbcTemplate.query("""
                select upper(p.code) as code, uo.allowed as allowed
                from user_permission_overrides uo
                join permissions p on p.id = uo.permission_id
                where uo.user_id = ?
                """, (rs, rowNum) -> new PermissionOverrideRow(
                normalize(rs.getString("code")),
                rs.getBoolean("allowed")
        ), userId);
    }

    private Set<String> sanitize(List<String> rawValues) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        if (rawValues == null) {
            return out;
        }
        for (String raw : rawValues) {
            String normalized = normalize(raw);
            if (!normalized.isBlank()) {
                out.add(normalized);
            }
        }
        return out;
    }

    private List<String> tryQueryForList(Long userId, String... sqlCandidates) {
        DataAccessException lastError = null;

        for (String sql : sqlCandidates) {
            try {
                return jdbcTemplate.queryForList(sql, String.class, userId);
            } catch (DataAccessException ex) {
                lastError = ex;
            }
        }

        if (lastError != null) {
            log.warn("No se pudo cargar acceso de backoffice para userId={}: {}", userId, lastError.getMessage());
        }
        return List.of();
    }

    private String normalize(String raw) {
        return raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
    }

    public record BackofficeAccessProfile(
            Set<String> roles,
            Set<String> permissions
    ) {
    }

    public record BackofficeAdminOverview(
            List<BackofficeUserAdminRow> users,
            Map<String, Object> summary
    ) {
    }

    public record BackofficeUserAdminRow(
            Long userId,
            String email,
            String nickname,
            String productRole,
            List<String> backofficeRoles,
            List<String> effectivePermissions,
            List<String> overrideAdditions,
            List<String> overrideRemovals,
            boolean hasOverrides
    ) {
    }

    private record OverrideSummary(
            Set<String> allowed,
            Set<String> denied
    ) {
    }

    private record PermissionOverrideRow(
            String code,
            boolean allowed
    ) {
    }
}
