package com.sharemechat.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class BackofficeAdministrationDTOs {

    private BackofficeAdministrationDTOs() {
    }

    public record BackofficeAdminOverview(
            List<BackofficeUserListItem> users,
            Map<String, Object> summary
    ) {
    }

    public record BackofficeUserListItem(
            Long userId,
            String email,
            String nickname,
            String productRole,
            boolean hasExplicitConfiguration,
            boolean hasImplicitAdminAccess,
            boolean hasEffectiveAccess,
            boolean accessActive,
            List<String> assignedRoles,
            List<String> effectiveRoles,
            int effectivePermissionsCount,
            List<String> overrideAdditions,
            List<String> overrideRemovals,
            boolean hasOverrides,
            LocalDateTime emailVerifiedAt
    ) {
    }

    public record BackofficeUserDetail(
            Long userId,
            String email,
            String nickname,
            String productRole,
            String accountStatus,
            boolean hasExplicitConfiguration,
            boolean hasImplicitAdminAccess,
            boolean hasEffectiveAccess,
            boolean accessActive,
            boolean hasExplicitAccessRow,
            List<String> assignedRoles,
            List<String> effectiveRoles,
            List<String> effectivePermissions,
            List<String> overrideAdditions,
            List<String> overrideRemovals,
            LocalDateTime emailVerifiedAt,
            List<String> availableRoles,
            List<String> availablePermissions,
            List<BackofficeAuditLogItem> recentAuditLogs
    ) {
    }

    public record BackofficeUserLookupItem(
            Long userId,
            String email,
            String nickname,
            String productRole,
            String accountStatus,
            boolean hasExplicitConfiguration,
            boolean hasImplicitAdminAccess,
            boolean hasEffectiveAccess,
            boolean accessActive,
            List<String> effectiveRoles,
            LocalDateTime emailVerifiedAt
    ) {
    }

    public record BackofficeAuditLogItem(
            Long id,
            Long actorUserId,
            Long targetUserId,
            String action,
            String summary,
            String payloadJson,
            String createdAt
    ) {
    }

    public static class BackofficeUserUpsertRequest {
        private Long userId;
        private String email;
        private String nickname;
        private String password;
        private Boolean active;
        private List<String> roleCodes;
        private List<String> overrideAdditions;
        private List<String> overrideRemovals;
        private String note;

        public Long getUserId() {
            return userId;
        }

        public void setUserId(Long userId) {
            this.userId = userId;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getNickname() {
            return nickname;
        }

        public void setNickname(String nickname) {
            this.nickname = nickname;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        public Boolean getActive() {
            return active;
        }

        public void setActive(Boolean active) {
            this.active = active;
        }

        public List<String> getRoleCodes() {
            return roleCodes;
        }

        public void setRoleCodes(List<String> roleCodes) {
            this.roleCodes = roleCodes;
        }

        public List<String> getOverrideAdditions() {
            return overrideAdditions;
        }

        public void setOverrideAdditions(List<String> overrideAdditions) {
            this.overrideAdditions = overrideAdditions;
        }

        public List<String> getOverrideRemovals() {
            return overrideRemovals;
        }

        public void setOverrideRemovals(List<String> overrideRemovals) {
            this.overrideRemovals = overrideRemovals;
        }

        public String getNote() {
            return note;
        }

        public void setNote(String note) {
            this.note = note;
        }
    }

    public static class BackofficeUserStatusUpdateRequest {
        private Boolean active;
        private String note;

        public Boolean getActive() {
            return active;
        }

        public void setActive(Boolean active) {
            this.active = active;
        }

        public String getNote() {
            return note;
        }

        public void setNote(String note) {
            this.note = note;
        }
    }
}
