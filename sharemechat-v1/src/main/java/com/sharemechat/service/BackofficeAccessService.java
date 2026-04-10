package com.sharemechat.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.constants.Constants;
import com.sharemechat.dto.BackofficeAdministrationDTOs;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.BackofficeAuthorities;
import com.sharemechat.security.BackofficePermissionAliases;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
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
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final EmailVerificationService emailVerificationService;

    public BackofficeAccessService(JdbcTemplate jdbcTemplate,
                                   UserRepository userRepository,
                                   ObjectMapper objectMapper,
                                   EmailVerificationService emailVerificationService) {
        this.jdbcTemplate = jdbcTemplate;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.emailVerificationService = emailVerificationService;
    }

    public BackofficeAccessProfile loadProfile(Long userId, String productRole) {
        if (userId != null && !isBackofficeAccessActive(userId)) {
            return new BackofficeAccessProfile(Set.of(), Set.of());
        }

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

        return new BackofficeAccessProfile(Set.copyOf(roles), Set.copyOf(permissions));
    }

    public BackofficeAdministrationDTOs.BackofficeAdminOverview listAdminOverview() {
        List<BackofficeAdministrationDTOs.BackofficeUserListItem> users = loadBackofficeUserListItems();

        long adminCount = users.stream().filter(u -> u.effectiveRoles().contains(BackofficeAuthorities.ROLE_ADMIN)).count();
        long supportCount = users.stream().filter(u -> u.effectiveRoles().contains(BackofficeAuthorities.ROLE_SUPPORT)).count();
        long auditCount = users.stream().filter(u -> u.effectiveRoles().contains(BackofficeAuthorities.ROLE_AUDIT)).count();
        long overrideCount = users.stream().filter(BackofficeAdministrationDTOs.BackofficeUserListItem::hasOverrides).count();
        long inactiveCount = users.stream().filter(u -> !u.accessActive()).count();
        long explicitCount = users.stream().filter(BackofficeAdministrationDTOs.BackofficeUserListItem::hasExplicitConfiguration).count();
        long implicitCount = users.stream().filter(BackofficeAdministrationDTOs.BackofficeUserListItem::hasImplicitAdminAccess).count();
        long effectiveCount = users.stream().filter(BackofficeAdministrationDTOs.BackofficeUserListItem::hasEffectiveAccess).count();

        return new BackofficeAdministrationDTOs.BackofficeAdminOverview(
                users,
                summaryMap(users.size(), explicitCount, implicitCount, effectiveCount, adminCount, supportCount, auditCount, overrideCount, inactiveCount)
        );
    }

    public BackofficeAdministrationDTOs.BackofficeUserDetail getUserDetail(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        AccessState accessState = loadAccessState(userId);
        List<String> assignedRoles = loadBackofficeRoles(userId).stream().sorted().toList();
        BackofficeAccessProfile profile = loadProfile(userId, user.getRole());
        OverrideSummary overrides = loadPermissionOverrides(userId);
        boolean implicitAdminAccess = hasImplicitAdminAccess(user.getRole());
        boolean explicitConfiguration = hasExplicitConfiguration(userId, user.getRole());
        boolean effectiveAccess = hasEffectiveAccess(profile);

        return new BackofficeAdministrationDTOs.BackofficeUserDetail(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                normalize(user.getRole()),
                normalize(user.getAccountStatus()),
                explicitConfiguration,
                implicitAdminAccess,
                effectiveAccess,
                accessState.active(),
                accessState.hasRow(),
                assignedRoles,
                profile.roles().stream().sorted().toList(),
                profile.permissions().stream().sorted().toList(),
                overrides.allowed().stream().sorted().toList(),
                overrides.denied().stream().sorted().toList(),
                user.getEmailVerifiedAt(),
                listAvailableRoles(),
                listAvailablePermissions(),
                loadRecentAuditLogs(userId, 12)
        );
    }

    public List<BackofficeAdministrationDTOs.BackofficeUserLookupItem> searchExistingUsers(String q, Integer limit) {
        String normalizedQuery = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        if (normalizedQuery.isBlank()) {
            return List.of();
        }

        int safeLimit = limit == null || limit < 1 ? 10 : Math.min(limit, 20);
        Long numericQueryId = tryParseLong(normalizedQuery);

        List<User> users;
        if (numericQueryId != null) {
            users = userRepository.findById(numericQueryId).map(List::of).orElse(List.of());
        } else {
            users = jdbcTemplate.query("""
                    select u.id, u.email, u.nickname, u.role, u.account_status, u.email_verified_at
                    from users u
                    where lower(u.email) like ?
                       or lower(coalesce(u.nickname, '')) like ?
                    order by lower(u.email), u.id
                    limit ?
                    """,
                    (rs, rowNum) -> {
                        User user = new User();
                        user.setId(rs.getLong("id"));
                        user.setEmail(rs.getString("email"));
                        user.setNickname(rs.getString("nickname"));
                        user.setRole(rs.getString("role"));
                        user.setAccountStatus(rs.getString("account_status"));
                        Timestamp verifiedAt = rs.getTimestamp("email_verified_at");
                        user.setEmailVerifiedAt(verifiedAt != null ? verifiedAt.toLocalDateTime() : null);
                        return user;
                    },
                    "%" + normalizedQuery + "%",
                    "%" + normalizedQuery + "%",
                    safeLimit
            );
        }

        return users.stream()
                .sorted(Comparator.comparing(User::getEmail, String.CASE_INSENSITIVE_ORDER))
                .map(user -> {
                    BackofficeAccessProfile profile = loadProfile(user.getId(), user.getRole());
                    boolean implicitAdminAccess = hasImplicitAdminAccess(user.getRole());
                    boolean configured = hasExplicitConfiguration(user.getId(), user.getRole());
                    return new BackofficeAdministrationDTOs.BackofficeUserLookupItem(
                            user.getId(),
                            user.getEmail(),
                            user.getNickname(),
                            normalize(user.getRole()),
                            normalize(user.getAccountStatus()),
                            configured,
                            implicitAdminAccess,
                            hasEffectiveAccess(profile),
                            isBackofficeAccessActive(user.getId()),
                            profile.roles().stream().sorted().toList(),
                            user.getEmailVerifiedAt()
                    );
                })
                .toList();
    }

    @Transactional
    public BackofficeAdministrationDTOs.BackofficeUserDetail createBackofficeAccess(
            BackofficeAdministrationDTOs.BackofficeUserUpsertRequest request,
            Long actorUserId
    ) {
        return createBackofficeAccess(request, actorUserId, false);
    }

    @Transactional
    public BackofficeAdministrationDTOs.BackofficeUserDetail createBackofficeAccess(
            BackofficeAdministrationDTOs.BackofficeUserUpsertRequest request,
            Long actorUserId,
            boolean createdBaseUser
    ) {
        User user = resolveExistingUserFromRequest(request);
        if (user == null) {
            throw new IllegalArgumentException("Usuario no encontrado");
        }
        if (hasExplicitConfiguration(user.getId(), user.getRole())) {
            throw new IllegalArgumentException("El usuario ya tiene configuracion de backoffice");
        }
        String action = createdBaseUser ? "CREATE_USER_AND_ACCESS" : "CREATE_ACCESS";
        BackofficeAdministrationDTOs.BackofficeUserDetail detail = saveBackofficeAccess(user, request, actorUserId, action);
        if (createdBaseUser) {
            writeAuditLog(
                    actorUserId,
                    user.getId(),
                    "SEND_EMAIL_VERIFICATION",
                    "Envio inicial de email de validacion para acceso backoffice",
                    auditPayload("email", user.getEmail())
            );
            return getUserDetail(user.getId());
        }
        return detail;
    }

    @Transactional
    public BackofficeAdministrationDTOs.BackofficeUserDetail updateBackofficeAccess(
            Long userId,
            BackofficeAdministrationDTOs.BackofficeUserUpsertRequest request,
            Long actorUserId
    ) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        return saveBackofficeAccess(user, request, actorUserId, "UPDATE_ACCESS");
    }

    @Transactional
    public BackofficeAdministrationDTOs.BackofficeUserDetail updateBackofficeStatus(
            Long userId,
            BackofficeAdministrationDTOs.BackofficeUserStatusUpdateRequest request,
            Long actorUserId
    ) {
        if (request == null || request.getActive() == null) {
            throw new IllegalArgumentException("active es obligatorio");
        }
        String note = safeText(request.getNote());

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        List<String> assignedRoles = loadBackofficeRoles(userId).stream().sorted().toList();
        AccessState currentState = loadAccessState(userId);

        validateNotRemovingLastAdmin(actorUserId, user, request.getActive(), assignedRoles);

        upsertAccessState(userId, request.getActive(), actorUserId);
        writeAuditLog(
                actorUserId,
                userId,
                "UPDATE_STATUS",
                "Cambio de estado de acceso backoffice a " + (request.getActive() ? "ACTIVO" : "INACTIVO"),
                auditPayload(
                        "previousActive", currentState.active(),
                        "nextActive", request.getActive(),
                        "note", note
                )
        );

        return getUserDetail(userId);
    }

    @Transactional
    public Map<String, Object> resendBackofficeEmailVerification(Long userId, Long actorUserId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        if (!hasExplicitConfiguration(userId, user.getRole()) && !hasImplicitAdminAccess(user.getRole())) {
            throw new IllegalArgumentException("El usuario no tiene acceso backoffice configurado");
        }

        if (user.getEmailVerifiedAt() != null) {
            throw new IllegalArgumentException("El email del usuario ya esta validado");
        }

        emailVerificationService.issueBackofficeVerification(user, actorUserId);
        writeAuditLog(
                actorUserId,
                userId,
                "RESEND_EMAIL_VERIFICATION",
                "Reenvio de email de validacion para acceso backoffice",
                auditPayload("email", user.getEmail())
        );

        return Map.of(
                "ok", true,
                "userId", userId,
                "message", "Email de validacion reenviado correctamente."
        );
    }

    private BackofficeAdministrationDTOs.BackofficeUserDetail saveBackofficeAccess(
            User user,
            BackofficeAdministrationDTOs.BackofficeUserUpsertRequest request,
            Long actorUserId,
            String action
    ) {
        List<String> normalizedRoles = normalizeRoleCodes(request != null ? request.getRoleCodes() : null);
        List<String> normalizedAdds = normalizePermissionCodes(request != null ? request.getOverrideAdditions() : null);
        List<String> normalizedRemovals = normalizePermissionCodes(request != null ? request.getOverrideRemovals() : null);

        validateKnownRoles(normalizedRoles);
        validateKnownPermissions(normalizedAdds, normalizedRemovals);
        validateOverrideOverlap(normalizedAdds, normalizedRemovals);
        boolean currentActive = request != null && request.getActive() != null
                ? request.getActive()
                : loadAccessState(user.getId()).active();
        validateNotEmptyIfActive(user, normalizedRoles, currentActive);
        validateNotRemovingLastAdmin(actorUserId, user, currentActive, normalizedRoles);

        List<String> previousRoles = loadBackofficeRoles(user.getId()).stream().sorted().toList();
        OverrideSummary previousOverrides = loadPermissionOverrides(user.getId());
        boolean previousActive = loadAccessState(user.getId()).active();

        replaceAssignedRoles(user.getId(), normalizedRoles);
        replacePermissionOverrides(user.getId(), normalizedAdds, normalizedRemovals);
        upsertAccessState(user.getId(), currentActive, actorUserId);

        writeAuditLog(
                actorUserId,
                user.getId(),
                action,
                "Guardado de configuracion de acceso backoffice",
                auditPayload(
                        "previousRoles", previousRoles,
                        "nextRoles", normalizedRoles,
                        "previousActive", previousActive,
                        "nextActive", currentActive,
                        "previousOverrideAdditions", previousOverrides.allowed().stream().sorted().toList(),
                        "previousOverrideRemovals", previousOverrides.denied().stream().sorted().toList(),
                        "nextOverrideAdditions", normalizedAdds,
                        "nextOverrideRemovals", normalizedRemovals,
                        "note", safeText(request != null ? request.getNote() : null)
                )
        );

        return getUserDetail(user.getId());
    }

    private List<BackofficeAdministrationDTOs.BackofficeUserListItem> loadBackofficeUserListItems() {
        List<BaseBackofficeUserRow> baseUsers = queryBaseBackofficeUsers();

        List<BackofficeAdministrationDTOs.BackofficeUserListItem> users = new ArrayList<>();
        for (BaseBackofficeUserRow base : baseUsers) {
            List<String> assignedRoles = loadBackofficeRoles(base.userId()).stream().sorted().toList();
            BackofficeAccessProfile profile = loadProfile(base.userId(), base.productRole());
            OverrideSummary overrides = loadPermissionOverrides(base.userId());
            boolean accessActive = loadAccessState(base.userId()).active();
            boolean implicitAdminAccess = hasImplicitAdminAccess(base.productRole());
            boolean explicitConfiguration = hasExplicitConfiguration(base.userId(), base.productRole());
            boolean effectiveAccess = hasEffectiveAccess(profile);

            users.add(new BackofficeAdministrationDTOs.BackofficeUserListItem(
                    base.userId(),
                    base.email(),
                    base.nickname(),
                    base.productRole(),
                    explicitConfiguration,
                    implicitAdminAccess,
                    effectiveAccess,
                    accessActive,
                    assignedRoles,
                    profile.roles().stream().sorted().toList(),
                    profile.permissions().size(),
                    overrides.allowed().stream().sorted().toList(),
                    overrides.denied().stream().sorted().toList(),
                    !overrides.allowed().isEmpty() || !overrides.denied().isEmpty(),
                    loadEmailVerifiedAt(base.userId())
            ));
        }

        users.sort(Comparator.comparing(BackofficeAdministrationDTOs.BackofficeUserListItem::email, String.CASE_INSENSITIVE_ORDER));
        return users;
    }

    public User resolveExistingUserFromRequest(BackofficeAdministrationDTOs.BackofficeUserUpsertRequest request) {
        if (request == null) {
            return null;
        }
        if (request.getUserId() != null) {
            return userRepository.findById(request.getUserId()).orElse(null);
        }
        String email = normalizeEmail(request.getEmail());
        if (email != null) {
            return userRepository.findByEmail(email).orElse(null);
        }
        return null;
    }

    private boolean hasExplicitConfiguration(Long userId, String productRole) {
        return !loadBackofficeRoles(userId).isEmpty()
                || hasAccessRow(userId)
                || hasPermissionOverrides(userId);
    }

    private boolean hasImplicitAdminAccess(String productRole) {
        return Constants.Roles.ADMIN.equals(normalize(productRole));
    }

    private boolean hasEffectiveAccess(BackofficeAccessProfile profile) {
        return !profile.roles().isEmpty();
    }

    private boolean hasPermissionOverrides(Long userId) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "select count(*) from user_permission_overrides where user_id = ?",
                    Integer.class,
                    userId
            );
            return count != null && count > 0;
        } catch (DataAccessException ex) {
            return false;
        }
    }

    private boolean hasAccessRow(Long userId) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "select count(*) from backoffice_user_access where user_id = ?",
                    Integer.class,
                    userId
            );
            return count != null && count > 0;
        } catch (DataAccessException ex) {
            return false;
        }
    }

    private boolean isBackofficeAccessActive(Long userId) {
        try {
            Boolean active = jdbcTemplate.query(
                    "select active from backoffice_user_access where user_id = ?",
                    rs -> rs.next() ? rs.getBoolean("active") : null,
                    userId
            );
            return active == null || active;
        } catch (DataAccessException ex) {
            return true;
        }
    }

    private AccessState loadAccessState(Long userId) {
        try {
            List<AccessState> rows = jdbcTemplate.query(
                    "select active from backoffice_user_access where user_id = ?",
                    (rs, rowNum) -> new AccessState(rs.getBoolean("active"), true),
                    userId
            );
            return rows.isEmpty() ? new AccessState(true, false) : rows.get(0);
        } catch (DataAccessException ex) {
            return new AccessState(true, false);
        }
    }

    private void upsertAccessState(Long userId, boolean active, Long actorUserId) {
        if (!hasBackofficeAccessTable()) {
            if (active) {
                return;
            }
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "La tabla backoffice_user_access aun no existe; no se puede desactivar acceso explicitamente en esta base de datos"
            );
        }
        try {
            int updated = jdbcTemplate.update(
                    "update backoffice_user_access set active = ?, updated_by_user_id = ? where user_id = ?",
                    active,
                    actorUserId,
                    userId
            );
            if (updated == 0) {
                jdbcTemplate.update(
                        "insert into backoffice_user_access (user_id, active, updated_by_user_id) values (?, ?, ?)",
                        userId,
                        active,
                        actorUserId
                );
            }
        } catch (DataAccessException ex) {
            throw new IllegalStateException("No se pudo guardar el estado de acceso backoffice", ex);
        }
    }

    private boolean hasBackofficeAccessTable() {
        try {
            jdbcTemplate.query("select user_id from backoffice_user_access limit 1", rs -> null);
            return true;
        } catch (DataAccessException ex) {
            return false;
        }
    }

    private List<BaseBackofficeUserRow> queryBaseBackofficeUsers() {
        String sqlWithAccess = """
                select distinct u.id, u.email, u.nickname, u.role
                from users u
                left join user_backoffice_roles ubr on ubr.user_id = u.id
                left join user_permission_overrides uo on uo.user_id = u.id
                left join backoffice_user_access bua on bua.user_id = u.id
                where upper(coalesce(u.role, '')) = 'ADMIN'
                   or ubr.user_id is not null
                   or uo.user_id is not null
                   or bua.user_id is not null
                order by lower(u.email), u.id
                """;
        String sqlWithoutAccess = """
                select distinct u.id, u.email, u.nickname, u.role
                from users u
                left join user_backoffice_roles ubr on ubr.user_id = u.id
                left join user_permission_overrides uo on uo.user_id = u.id
                where upper(coalesce(u.role, '')) = 'ADMIN'
                   or ubr.user_id is not null
                   or uo.user_id is not null
                order by lower(u.email), u.id
                """;
        try {
            return jdbcTemplate.query(hasBackofficeAccessTable() ? sqlWithAccess : sqlWithoutAccess, (rs, rowNum) -> new BaseBackofficeUserRow(
                    rs.getLong("id"),
                    rs.getString("email"),
                    rs.getString("nickname"),
                    normalize(rs.getString("role"))
            ));
        } catch (DataAccessException ex) {
            return jdbcTemplate.query(sqlWithoutAccess, (rs, rowNum) -> new BaseBackofficeUserRow(
                    rs.getLong("id"),
                    rs.getString("email"),
                    rs.getString("nickname"),
                    normalize(rs.getString("role"))
            ));
        }
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
        List<PermissionOverrideRow> rawRows = jdbcTemplate.query("""
                select upper(p.code) as code, uo.allowed as allowed
                from user_permission_overrides uo
                join permissions p on p.id = uo.permission_id
                where uo.user_id = ?
                """, (rs, rowNum) -> new PermissionOverrideRow(
                normalize(rs.getString("code")),
                rs.getBoolean("allowed")
        ), userId);
        return canonicalizeOverrideRows(rawRows);
    }

    private void replaceAssignedRoles(Long userId, List<String> roleCodes) {
        try {
            jdbcTemplate.update("delete from user_backoffice_roles where user_id = ?", userId);
        } catch (DataAccessException ex) {
            throw new IllegalStateException("No se pudieron limpiar los roles backoffice previos", ex);
        }

        for (String roleCode : roleCodes) {
            Long roleId = findRoleId(roleCode);
            if (roleId == null) {
                throw new IllegalArgumentException("Rol backoffice no encontrado: " + roleCode);
            }
            tryInsertAssignedRole(userId, roleId);
        }
    }

    private void tryInsertAssignedRole(Long userId, Long roleId) {
        DataAccessException last = null;
        List<String> candidates = List.of(
                "insert into user_backoffice_roles (user_id, role_id) values (?, ?)",
                "insert into user_backoffice_roles (user_id, backoffice_role_id) values (?, ?)"
        );
        for (String sql : candidates) {
            try {
                jdbcTemplate.update(sql, userId, roleId);
                return;
            } catch (DataAccessException ex) {
                last = ex;
            }
        }
        throw new IllegalStateException("No se pudo asignar el rol backoffice", last);
    }

    private void replacePermissionOverrides(Long userId, List<String> additions, List<String> removals) {
        jdbcTemplate.update("delete from user_permission_overrides where user_id = ?", userId);

        for (String code : additions) {
            Long permissionId = findPermissionId(code);
            if (permissionId == null) {
                throw new IllegalArgumentException("Permiso no encontrado: " + code);
            }
            jdbcTemplate.update(
                    "insert into user_permission_overrides (user_id, permission_id, allowed) values (?, ?, ?)",
                    userId,
                    permissionId,
                    true
            );
        }

        for (String code : removals) {
            Long permissionId = findPermissionId(code);
            if (permissionId == null) {
                throw new IllegalArgumentException("Permiso no encontrado: " + code);
            }
            jdbcTemplate.update(
                    "insert into user_permission_overrides (user_id, permission_id, allowed) values (?, ?, ?)",
                    userId,
                    permissionId,
                    false
            );
        }
    }

    private void validateKnownRoles(List<String> roleCodes) {
        Set<String> knownRoles = new LinkedHashSet<>(listAvailableRoles());
        for (String roleCode : roleCodes) {
            if (!knownRoles.contains(roleCode)) {
                throw new IllegalArgumentException("Rol backoffice no permitido: " + roleCode);
            }
        }
    }

    private void validateKnownPermissions(List<String> additions, List<String> removals) {
        Set<String> knownPermissions = new LinkedHashSet<>(listAvailablePermissions());
        for (String code : additions) {
            if (!knownPermissions.contains(code)) {
                throw new IllegalArgumentException("Permiso no permitido: " + code);
            }
        }
        for (String code : removals) {
            if (!knownPermissions.contains(code)) {
                throw new IllegalArgumentException("Permiso no permitido: " + code);
            }
        }
    }

    private void validateOverrideOverlap(List<String> additions, List<String> removals) {
        Set<String> overlap = new LinkedHashSet<>(additions);
        overlap.retainAll(removals);
        if (!overlap.isEmpty()) {
            throw new IllegalArgumentException("Un mismo permiso no puede estar anadido y retirado a la vez");
        }
    }

    private void validateNotEmptyIfActive(User user, List<String> assignedRoles, boolean active) {
        if (!active) {
            return;
        }
        if (Constants.Roles.ADMIN.equals(normalize(user.getRole()))) {
            return;
        }
        if (assignedRoles.isEmpty()) {
            throw new IllegalArgumentException("Un acceso backoffice activo requiere al menos un rol asignado");
        }
    }

    private void validateNotRemovingLastAdmin(Long actorUserId, User targetUser, boolean nextActive, List<String> nextAssignedRoles) {
        boolean currentlyAdmin = loadProfile(targetUser.getId(), targetUser.getRole()).roles().contains(BackofficeAuthorities.ROLE_ADMIN);
        boolean nextAdmin = wouldHaveAdminRole(targetUser, nextActive, nextAssignedRoles);

        if (!currentlyAdmin || nextAdmin) {
            return;
        }

        long activeAdminCount = countActiveAdminUsers();
        if (activeAdminCount <= 1) {
            throw new IllegalArgumentException("No puedes dejar el backoffice sin ningun ADMIN activo");
        }

        if (actorUserId != null && actorUserId.equals(targetUser.getId()) && activeAdminCount <= 1) {
            throw new IllegalArgumentException("No puedes retirarte el ultimo acceso ADMIN activo");
        }
    }

    private boolean wouldHaveAdminRole(User user, boolean nextActive, List<String> nextAssignedRoles) {
        if (!nextActive) {
            return false;
        }
        if (Constants.Roles.ADMIN.equals(normalize(user.getRole()))) {
            return true;
        }
        return nextAssignedRoles.contains(BackofficeAuthorities.ROLE_ADMIN);
    }

    private long countActiveAdminUsers() {
        List<BaseBackofficeUserRow> baseUsers = queryBaseBackofficeUsers();

        long count = 0;
        for (BaseBackofficeUserRow row : baseUsers) {
            if (loadProfile(row.userId(), row.productRole()).roles().contains(BackofficeAuthorities.ROLE_ADMIN)) {
                count++;
            }
        }
        return count;
    }

    private List<String> listAvailableRoles() {
        try {
            List<String> rows = jdbcTemplate.queryForList(
                    "select upper(code) from backoffice_roles order by sort_order asc, upper(code) asc, id asc",
                    String.class
            );
            Set<String> sanitized = sanitize(rows);
            if (!sanitized.isEmpty()) {
                return sanitized.stream().sorted().toList();
            }
        } catch (DataAccessException ex) {
            log.warn("No se pudo cargar el catalogo de roles backoffice: {}", ex.getMessage());
        }
        return List.of(
                BackofficeAuthorities.ROLE_ADMIN,
                BackofficeAuthorities.ROLE_SUPPORT,
                BackofficeAuthorities.ROLE_AUDIT
        );
    }

    private List<String> listAvailablePermissions() {
        return BackofficeAuthorities.OFFICIAL_BACKOFFICE_PERMISSION_CATALOG.stream()
                .map(this::normalize)
                .filter(code -> !code.isBlank())
                .sorted()
                .toList();
    }

    private Long findRoleId(String roleCode) {
        try {
            return jdbcTemplate.query(
                    "select id from backoffice_roles where upper(code) = ?",
                    rs -> rs.next() ? rs.getLong("id") : null,
                    normalize(roleCode)
            );
        } catch (DataAccessException ex) {
            return null;
        }
    }

    private Long findPermissionId(String permissionCode) {
        try {
            return jdbcTemplate.query(
                    "select id from permissions where upper(code) = ?",
                    rs -> rs.next() ? rs.getLong("id") : null,
                    normalize(permissionCode)
            );
        } catch (DataAccessException ex) {
            return null;
        }
    }

    private void writeAuditLog(Long actorUserId, Long targetUserId, String action, String summary, Map<String, Object> payload) {
        if (!hasBackofficeAuditLogTable()) {
            return;
        }
        String payloadJson = null;
        try {
            payloadJson = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            log.warn("No se pudo serializar el audit payload de backoffice: {}", ex.getMessage());
        }

        try {
            jdbcTemplate.update(
                    "insert into backoffice_access_audit_log (target_user_id, actor_user_id, action, summary, payload_json) values (?, ?, ?, ?, ?)",
                    targetUserId,
                    actorUserId,
                    action,
                    safeText(summary),
                    payloadJson
            );
        } catch (DataAccessException ex) {
            log.warn("No se pudo guardar el audit log de backoffice targetUserId={}: {}", targetUserId, ex.getMessage());
        }
    }

    private List<BackofficeAdministrationDTOs.BackofficeAuditLogItem> loadRecentAuditLogs(Long userId, int limit) {
        if (!hasBackofficeAuditLogTable()) {
            return List.of();
        }
        int safeLimit = Math.max(1, Math.min(limit, 25));
        try {
            return jdbcTemplate.query("""
                    select id, actor_user_id, target_user_id, action, summary, payload_json, created_at
                    from backoffice_access_audit_log
                    where target_user_id = ?
                    order by id desc
                    limit ?
                    """, (rs, rowNum) -> new BackofficeAdministrationDTOs.BackofficeAuditLogItem(
                    rs.getLong("id"),
                    nullableLong(rs.getObject("actor_user_id")),
                    nullableLong(rs.getObject("target_user_id")),
                    rs.getString("action"),
                    rs.getString("summary"),
                    rs.getString("payload_json"),
                    stringifyTimestamp(rs.getObject("created_at"))
            ), userId, safeLimit);
        } catch (DataAccessException ex) {
            return List.of();
        }
    }

    private boolean hasBackofficeAuditLogTable() {
        try {
            jdbcTemplate.query("select id from backoffice_access_audit_log limit 1", rs -> null);
            return true;
        } catch (DataAccessException ex) {
            return false;
        }
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

    private List<String> normalizeRoleCodes(List<String> roleCodes) {
        return sanitize(roleCodes).stream().sorted().toList();
    }

    private List<String> normalizePermissionCodes(List<String> permissionCodes) {
        return sanitize(permissionCodes).stream()
                .map(this::canonicalizeBackofficePermissionCode)
                .filter(code -> !code.isBlank())
                .sorted()
                .toList();
    }

    private List<PermissionOverrideRow> canonicalizeOverrideRows(List<PermissionOverrideRow> rows) {
        LinkedHashMap<String, Boolean> resolved = new LinkedHashMap<>();
        if (rows == null) {
            return List.of();
        }
        for (PermissionOverrideRow row : rows) {
            String canonicalCode = canonicalizeBackofficePermissionCode(row.code());
            if (canonicalCode.isBlank()) {
                continue;
            }
            resolved.merge(canonicalCode, row.allowed(), (current, next) -> current && next);
        }
        return resolved.entrySet().stream()
                .map(entry -> new PermissionOverrideRow(entry.getKey(), entry.getValue()))
                .toList();
    }

    private String canonicalizeBackofficePermissionCode(String permissionCode) {
        return BackofficePermissionAliases.canonicalize(permissionCode);
    }

    private Map<String, Object> summaryMap(long totalUsers,
                                           long explicitUsers,
                                           long implicitAdminUsers,
                                           long effectiveUsers,
                                           long adminUsers,
                                           long supportUsers,
                                           long auditUsers,
                                           long usersWithOverrides,
                                           long inactiveUsers) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalUsers", totalUsers);
        summary.put("explicitUsers", explicitUsers);
        summary.put("implicitAdminUsers", implicitAdminUsers);
        summary.put("effectiveUsers", effectiveUsers);
        summary.put("adminUsers", adminUsers);
        summary.put("supportUsers", supportUsers);
        summary.put("auditUsers", auditUsers);
        summary.put("usersWithOverrides", usersWithOverrides);
        summary.put("inactiveUsers", inactiveUsers);
        return summary;
    }

    private Map<String, Object> auditPayload(Object... pairs) {
        Map<String, Object> payload = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            payload.put(String.valueOf(pairs[i]), pairs[i + 1]);
        }
        return payload;
    }

    private String normalize(String raw) {
        return raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeEmail(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim().toLowerCase(Locale.ROOT);
        if (trimmed.isBlank() || containsWhitespace(trimmed)) {
            return null;
        }
        return trimmed;
    }

    private boolean containsWhitespace(String raw) {
        if (raw == null) {
            return false;
        }
        return raw.codePoints().anyMatch(cp -> Character.isWhitespace(cp) || Character.isSpaceChar(cp));
    }

    private LocalDateTime loadEmailVerifiedAt(Long userId) {
        return userRepository.findById(userId)
                .map(User::getEmailVerifiedAt)
                .orElse(null);
    }

    private Long tryParseLong(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Long nullableLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return null;
    }

    private String stringifyTimestamp(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime().toString();
        }
        return String.valueOf(value);
    }

    private String safeText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record BackofficeAccessProfile(
            Set<String> roles,
            Set<String> permissions
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

    private record BaseBackofficeUserRow(
            Long userId,
            String email,
            String nickname,
            String productRole
    ) {
    }

    private record AccessState(
            boolean active,
            boolean hasRow
    ) {
    }
}
