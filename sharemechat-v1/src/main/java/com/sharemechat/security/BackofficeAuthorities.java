package com.sharemechat.security;

import java.util.Set;
import java.util.List;

public final class BackofficeAuthorities {

    public static final String ROLE_ADMIN = "ADMIN";
    public static final String ROLE_SUPPORT = "SUPPORT";
    public static final String ROLE_AUDIT = "AUDIT";

    public static final String BO_ROLE_PREFIX = "BO_ROLE_";
    public static final String BO_PERMISSION_PREFIX = "BO_PERMISSION_";

    public static final String PERM_MODELS_READ_LIST = "models.read_list";
    public static final String PERM_MODELS_READ_KYC_MODE = "models.read_kyc_mode";
    public static final String PERM_MODELS_UPDATE_CHECKLIST = "models.update_checklist";

    public static final String PERM_MODERATION_READ_REPORTS = "moderation.read_reports";
    public static final String PERM_MODERATION_READ_REPORT_DETAIL = "moderation.read_report_detail";

    public static final String PERM_STREAMS_READ_ACTIVE = "streams.read_active";
    public static final String PERM_STREAMS_READ_DETAIL = "streams.read_detail";

    public static final String PERM_STATS_READ_OVERVIEW = "stats.read_overview";

    public static final String PERM_FINANCE_READ_SUMMARY = "finance.read_summary";
    public static final String PERM_FINANCE_READ_TOP_MODELS = "finance.read_top_models";
    public static final String PERM_FINANCE_READ_TOP_CLIENTS = "finance.read_top_clients";

    public static final Set<String> SUPPORT_PHASE1_PERMISSIONS = Set.of(
            PERM_MODELS_READ_LIST,
            PERM_MODELS_READ_KYC_MODE,
            PERM_MODELS_UPDATE_CHECKLIST,
            PERM_MODERATION_READ_REPORTS,
            PERM_MODERATION_READ_REPORT_DETAIL,
            PERM_STREAMS_READ_ACTIVE,
            PERM_STREAMS_READ_DETAIL,
            PERM_STATS_READ_OVERVIEW,
            PERM_FINANCE_READ_SUMMARY,
            PERM_FINANCE_READ_TOP_MODELS,
            PERM_FINANCE_READ_TOP_CLIENTS
    );

    public static final List<String> OFFICIAL_BACKOFFICE_PERMISSION_CATALOG = List.of(
            PERM_MODELS_READ_LIST,
            PERM_MODELS_READ_KYC_MODE,
            PERM_MODELS_UPDATE_CHECKLIST,
            PERM_MODERATION_READ_REPORTS,
            PERM_MODERATION_READ_REPORT_DETAIL,
            PERM_STREAMS_READ_ACTIVE,
            PERM_STREAMS_READ_DETAIL,
            PERM_STATS_READ_OVERVIEW,
            PERM_FINANCE_READ_SUMMARY,
            PERM_FINANCE_READ_TOP_MODELS,
            PERM_FINANCE_READ_TOP_CLIENTS
    );

    private BackofficeAuthorities() {
    }

    public static String roleAuthority(String roleCode) {
        return BO_ROLE_PREFIX + normalize(roleCode);
    }

    public static String permissionAuthority(String permissionCode) {
        return BO_PERMISSION_PREFIX + normalize(permissionCode);
    }

    private static String normalize(String raw) {
        return raw == null ? "" : raw.trim().toUpperCase();
    }
}
