package com.sharemechat.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * ADR-049 Subpasada 1: verifica que la Flyway V16 contiene las piezas
 * esenciales del schema del sistema de afiliadas. No ejecuta Flyway; solo
 * lee el fichero SQL como classpath resource y aplica greps de contrato.
 *
 * <p>La validacion de que el SQL aplica limpio contra MySQL real vive en
 * el smoke del deploy contra TEST, no en este test unitario.
 */
class AffiliateFlywayV16ContentTest {

    private static final String V16_PATH = "db/migration/V16__add_affiliate_system_schema.sql";

    private String loadV16() throws IOException {
        try (InputStream is = getClass().getClassLoader().getResourceAsStream(V16_PATH)) {
            assertNotNull(is, "La Flyway V16 debe existir en el classpath: " + V16_PATH);
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @Test
    @DisplayName("V16 anade las 3 columnas de afiliacion a users")
    void v16_altersUsersTable() throws IOException {
        String sql = loadV16().toLowerCase();
        assertTrue(sql.contains("alter table users"),
                "V16 debe hacer ALTER TABLE users.");
        assertTrue(sql.contains("referral_code_owner"));
        assertTrue(sql.contains("referred_by_user_id"));
        assertTrue(sql.contains("referred_at"));
    }

    @Test
    @DisplayName("V16 crea UNIQUE en users.referral_code_owner")
    void v16_createsUniqueOnReferralCode() throws IOException {
        String sql = loadV16().toLowerCase();
        assertTrue(sql.contains("uq_users_referral_code_owner"));
        assertTrue(sql.contains("unique (referral_code_owner)"));
    }

    @Test
    @DisplayName("V16 crea indice explicito en users.referred_by_user_id (D14)")
    void v16_createsIndexOnReferredBy() throws IOException {
        String sql = loadV16().toLowerCase();
        assertTrue(sql.contains("idx_users_referred_by"));
        assertTrue(sql.contains("on users (referred_by_user_id)"));
    }

    @Test
    @DisplayName("V16 crea FK users.referred_by_user_id -> users(id)")
    void v16_createsForeignKeyReferredBy() throws IOException {
        String sql = loadV16().toLowerCase();
        assertTrue(sql.contains("fk_users_referred_by"));
        assertTrue(sql.contains("foreign key (referred_by_user_id) references users(id)"));
    }

    @Test
    @DisplayName("V16 declara el CHECK del charset Crockford Base32 sin ambiguos (D7)")
    void v16_declaresCharsetCheck() throws IOException {
        String sql = loadV16();
        assertTrue(sql.contains("chk_users_referral_code_owner_charset"),
                "El CHECK debe estar declarado con nombre estable.");
        // El regex del CHECK excluye deliberadamente I, L, O, U (Crockford Base32).
        assertTrue(sql.contains("REGEXP '^[0-9A-HJKMNPQRSTVWXYZ]{12}$'"),
                "El regex debe reflejar Crockford Base32 sin ambiguos y longitud fija 12.");
        assertFalse(sql.contains("REGEXP '^[A-Z0-9]{12}$'"),
                "Regresion: el regex NO debe permitir el alfabeto completo A-Z. Si aparece, "
                        + "alguien relajo el charset y volvimos a admitir I/L/O/U que son ambiguos.");
    }

    @Test
    @DisplayName("V16 anade payout_type a payout_requests con default STREAM y CHECK")
    void v16_ampliesPayoutRequests() throws IOException {
        String sql = loadV16().toLowerCase();
        assertTrue(sql.contains("alter table payout_requests"));
        assertTrue(sql.contains("payout_type"));
        assertTrue(sql.contains("default 'stream'"));
        assertTrue(sql.contains("chk_pr_payout_type"));
        assertTrue(sql.contains("'stream', 'affiliate'"));
    }

    @Test
    @DisplayName("V16 crea las 3 tablas nuevas")
    void v16_createsThreeNewTables() throws IOException {
        String sql = loadV16().toLowerCase();
        assertTrue(sql.contains("create table affiliate_link_tokens"));
        assertTrue(sql.contains("create table affiliate_click_events"));
        assertTrue(sql.contains("create table affiliate_commissions"));
    }

    @Test
    @DisplayName("V16 declara CHECK sobre event_type y sobre status")
    void v16_declaresChecksOnEnums() throws IOException {
        String sql = loadV16().toLowerCase();
        // event_type
        assertTrue(sql.contains("chk_ace_event_type"));
        assertTrue(sql.contains("'click'") && sql.contains("'email_submitted'")
                && sql.contains("'link_consumed'") && sql.contains("'registered'")
                && sql.contains("'first_payment'"));
        // status affiliate_commissions
        assertTrue(sql.contains("chk_ac_status"));
        assertTrue(sql.contains("'accrued'") && sql.contains("'payable'")
                && sql.contains("'skipped_no_activity'") && sql.contains("'reversed_chargeback'")
                && sql.contains("'paid'"));
    }

    @Test
    @DisplayName("V16 usa BIGINT para montos en cents (no DECIMAL)")
    void v16_usesBigintForCents() throws IOException {
        String sql = loadV16().toLowerCase();
        // Busca declaraciones de columnas cents como BIGINT.
        assertTrue(sql.contains("base_amount_cents           bigint"),
                "base_amount_cents debe declararse como BIGINT.");
        assertTrue(sql.contains("commission_amount_cents     bigint"),
                "commission_amount_cents debe declararse como BIGINT.");
        assertFalse(Objects.requireNonNullElse(sql, "").contains("base_amount_cents           decimal"),
                "Regresion: base_amount_cents nunca debe ser DECIMAL (D9 cents en BIGINT).");
    }

    @Test
    @DisplayName("V16 declara UNIQUE compuesto (payment_session_id, status) en affiliate_commissions (no UNIQUE simple)")
    void v16_uniqueOnPaymentSessionAndStatus() throws IOException {
        String sql = loadV16().toLowerCase();
        assertTrue(sql.contains("uq_ac_payment_session_status"));
        assertTrue(sql.contains("unique (payment_session_id, status)"),
                "UNIQUE debe ser sobre el par para permitir ACCRUED + REVERSED_CHARGEBACK sobre el mismo pago.");
    }

    @Test
    @DisplayName("V16 declara ip_hash y ua_hash como CHAR(16) (D15 GDPR)")
    void v16_hashColumnsAreChar16() throws IOException {
        String sql = loadV16().toLowerCase();
        assertTrue(sql.contains("ip_hash             char(16)"),
                "ip_hash debe ser CHAR(16) — SHA-256 truncado a 64 bits.");
        assertTrue(sql.contains("ua_hash             char(16)"),
                "ua_hash debe ser CHAR(16).");
    }
}
