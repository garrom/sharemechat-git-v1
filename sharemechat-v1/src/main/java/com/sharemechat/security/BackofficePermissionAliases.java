package com.sharemechat.security;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

public final class BackofficePermissionAliases {

    private static final Map<String, String> LEGACY_TO_CANONICAL = buildLegacyToCanonical();

    private BackofficePermissionAliases() {
    }

    public static String canonicalize(String permissionCode) {
        String normalized = normalize(permissionCode);
        if (normalized.isBlank()) {
            return normalized;
        }
        return LEGACY_TO_CANONICAL.getOrDefault(normalized, normalized);
    }

    private static Map<String, String> buildLegacyToCanonical() {
        LinkedHashMap<String, String> aliases = new LinkedHashMap<>();
        aliases.put("FINANCE.VIEW_SUMMARY", normalize(BackofficeAuthorities.PERM_FINANCE_READ_SUMMARY));
        return Map.copyOf(aliases);
    }

    private static String normalize(String raw) {
        return raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
    }
}
