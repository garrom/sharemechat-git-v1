package com.sharemechat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Table;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * ADR-049 Subpasada 1: contrato JPA de las tres entidades nuevas del
 * sistema de afiliadas: {@link AffiliateLinkToken}, {@link AffiliateClickEvent}
 * y {@link AffiliateCommission}. Tests por reflection sobre las anotaciones
 * @Table y @Column; el enforcement real de UNIQUE / FK / CHECK vive en la
 * Flyway V16 y se valida contra MySQL cuando toque el smoke de la subpasada.
 */
class AffiliateEntitiesJpaContractTest {

    // =====================================================
    // AffiliateLinkToken
    // =====================================================

    @Test
    @DisplayName("AffiliateLinkToken se mapea a la tabla affiliate_link_tokens")
    void linkToken_tableName() {
        Table t = AffiliateLinkToken.class.getAnnotation(Table.class);
        assertEquals("affiliate_link_tokens", t.name());
    }

    @Test
    @DisplayName("AffiliateLinkToken.tokenHash: length=64, unique=true, NOT NULL")
    void linkToken_tokenHash_columnContract() throws NoSuchFieldException {
        Field f = AffiliateLinkToken.class.getDeclaredField("tokenHash");
        Column col = f.getAnnotation(Column.class);
        assertEquals("token_hash", col.name());
        assertEquals(64, col.length(),
                "SHA-256 hex ocupa 64 caracteres.");
        assertTrue(col.unique(),
                "token_hash debe ser UNIQUE: no puede haber dos filas con el mismo hash.");
        assertFalse(col.nullable(),
                "token_hash es obligatorio.");
    }

    @Test
    @DisplayName("AffiliateLinkToken.modelUserId: NOT NULL")
    void linkToken_modelUserId_columnContract() throws NoSuchFieldException {
        Field f = AffiliateLinkToken.class.getDeclaredField("modelUserId");
        Column col = f.getAnnotation(Column.class);
        assertEquals("model_user_id", col.name());
        assertFalse(col.nullable());
    }

    @Test
    @DisplayName("AffiliateLinkToken.email: opcional, length=255")
    void linkToken_email_columnContract() throws NoSuchFieldException {
        Field f = AffiliateLinkToken.class.getDeclaredField("email");
        Column col = f.getAnnotation(Column.class);
        assertEquals("email", col.name());
        assertEquals(255, col.length());
        assertTrue(col.nullable(),
                "email es opcional en el magic link.");
    }

    // =====================================================
    // AffiliateClickEvent
    // =====================================================

    @Test
    @DisplayName("AffiliateClickEvent se mapea a la tabla affiliate_click_events")
    void clickEvent_tableName() {
        Table t = AffiliateClickEvent.class.getAnnotation(Table.class);
        assertEquals("affiliate_click_events", t.name());
    }

    @Test
    @DisplayName("AffiliateClickEvent.ipHash: length=16 (SHA-256 truncado a 64 bits para GDPR)")
    void clickEvent_ipHash_gdprCompliant() throws NoSuchFieldException {
        Field f = AffiliateClickEvent.class.getDeclaredField("ipHash");
        Column col = f.getAnnotation(Column.class);
        assertEquals("ip_hash", col.name());
        assertEquals(16, col.length(),
                "D15 GDPR-tracking: ip_hash es SHA-256 truncado a 16 chars hex (64 bits). "
                        + "Si alguien lo cambia a 64 vuelve a persistir SHA-256 completo, que no es reversible "
                        + "pero es mas debil como salvaguarda. Si lo cambia a >16 y persistiera IP en claro, "
                        + "es incumplimiento de la D15 del ADR-049.");
        assertTrue(col.nullable(),
                "ip_hash puede ser NULL para eventos server-side sin IP conocida.");
    }

    @Test
    @DisplayName("AffiliateClickEvent.uaHash: length=16 (SHA-256 truncado a 64 bits, opcional)")
    void clickEvent_uaHash_gdprCompliant() throws NoSuchFieldException {
        Field f = AffiliateClickEvent.class.getDeclaredField("uaHash");
        Column col = f.getAnnotation(Column.class);
        assertEquals("ua_hash", col.name());
        assertEquals(16, col.length());
        assertTrue(col.nullable());
    }

    @Test
    @DisplayName("AffiliateClickEvent.eventType: length=20, NOT NULL")
    void clickEvent_eventType_columnContract() throws NoSuchFieldException {
        Field f = AffiliateClickEvent.class.getDeclaredField("eventType");
        Column col = f.getAnnotation(Column.class);
        assertEquals("event_type", col.name());
        assertEquals(20, col.length());
        assertFalse(col.nullable());
    }

    @Test
    @DisplayName("AffiliateClickEvent.modelUserId: NOT NULL; clientUserId: NULL en eventos pre-registro")
    void clickEvent_userIds_contract() throws NoSuchFieldException {
        Field model = AffiliateClickEvent.class.getDeclaredField("modelUserId");
        assertFalse(model.getAnnotation(Column.class).nullable(),
                "Todo evento va anclado a la modelo afiliada del codigo.");

        Field client = AffiliateClickEvent.class.getDeclaredField("clientUserId");
        assertTrue(client.getAnnotation(Column.class).nullable(),
                "client_user_id es NULL en CLICK / EMAIL_SUBMITTED / LINK_CONSUMED (pre-registro).");
    }

    // =====================================================
    // AffiliateCommission
    // =====================================================

    @Test
    @DisplayName("AffiliateCommission se mapea a la tabla affiliate_commissions")
    void commission_tableName() {
        Table t = AffiliateCommission.class.getAnnotation(Table.class);
        assertEquals("affiliate_commissions", t.name());
    }

    @Test
    @DisplayName("AffiliateCommission: base_amount_cents y commission_amount_cents son BIGINT (Long) en cents")
    void commission_amounts_areCentsLong() throws NoSuchFieldException {
        Field baseAmount = AffiliateCommission.class.getDeclaredField("baseAmountCents");
        assertEquals(Long.class, baseAmount.getType(),
                "base_amount_cents es BIGINT en centesimas para calculos exactos. "
                        + "Si alguien lo cambia a BigDecimal o Double se pierden garantias de exactitud.");
        assertEquals("base_amount_cents", baseAmount.getAnnotation(Column.class).name());
        assertFalse(baseAmount.getAnnotation(Column.class).nullable());

        Field commissionAmount = AffiliateCommission.class.getDeclaredField("commissionAmountCents");
        assertEquals(Long.class, commissionAmount.getType(),
                "commission_amount_cents es BIGINT. Puede ser negativo en REVERSED_CHARGEBACK.");
        assertEquals("commission_amount_cents", commissionAmount.getAnnotation(Column.class).name());
        assertFalse(commissionAmount.getAnnotation(Column.class).nullable());
    }

    @Test
    @DisplayName("AffiliateCommission.rateBps: default 3000 (30% en basis points)")
    void commission_rateBps_defaultsTo3000() {
        AffiliateCommission ac = new AffiliateCommission();
        assertEquals(3000, ac.getRateBps(),
                "rateBps por defecto 3000 = 30% (30 * 100 = 3000 basis points). "
                        + "Si alguien lo cambia a 300 estaria persistiendo 3%, no 30%.");
    }

    @Test
    @DisplayName("AffiliateCommission.periodYyyymm: Integer, NOT NULL (encoding anio*100+mes)")
    void commission_periodYyyymm_contract() throws NoSuchFieldException {
        Field f = AffiliateCommission.class.getDeclaredField("periodYyyymm");
        Column col = f.getAnnotation(Column.class);
        assertEquals("period_yyyymm", col.name());
        assertEquals(Integer.class, f.getType());
        assertFalse(col.nullable());
    }

    @Test
    @DisplayName("AffiliateCommission.status: length=30, NOT NULL")
    void commission_status_columnContract() throws NoSuchFieldException {
        Field f = AffiliateCommission.class.getDeclaredField("status");
        Column col = f.getAnnotation(Column.class);
        assertEquals("status", col.name());
        assertEquals(30, col.length());
        assertFalse(col.nullable());
    }

    @Test
    @DisplayName("AffiliateCommission.updatedAt: insertable=false, updatable=false (patron MySQL ON UPDATE)")
    void commission_updatedAt_delegatesToMysql() throws NoSuchFieldException {
        Field f = AffiliateCommission.class.getDeclaredField("updatedAt");
        Column col = f.getAnnotation(Column.class);
        assertFalse(col.insertable(),
                "Igual patron que User.updated_at: Hibernate no toca la columna, MySQL aplica DEFAULT/ON UPDATE.");
        assertFalse(col.updatable());
    }

    @Test
    @DisplayName("AffiliateCommission.paymentSessionId: NOT NULL. El UNIQUE compuesto vive en Flyway V16.")
    void commission_paymentSessionId_notNull() throws NoSuchFieldException {
        Field f = AffiliateCommission.class.getDeclaredField("paymentSessionId");
        Column col = f.getAnnotation(Column.class);
        assertEquals("payment_session_id", col.name());
        assertFalse(col.nullable(),
                "Toda comision se ancla a una sesion de pago. El UNIQUE compuesto (payment_session_id, status) "
                        + "para permitir reversos vive en la Flyway V16, no en la anotacion @Column.");
    }

    @Test
    @DisplayName("AffiliateCommission.paidViaPayoutRequestId: NULLABLE (se pobla en la transicion a PAID)")
    void commission_paidViaPayoutRequestId_nullable() throws NoSuchFieldException {
        Field f = AffiliateCommission.class.getDeclaredField("paidViaPayoutRequestId");
        Column col = f.getAnnotation(Column.class);
        assertEquals("paid_via_payout_request_id", col.name());
        assertTrue(col.nullable());
    }

    @Test
    @DisplayName("Los constructores de las 3 entidades inicializan createdAt (no dependen del DEFAULT de BD)")
    void allConstructors_initializeCreatedAt() {
        AffiliateLinkToken t = new AffiliateLinkToken();
        assertNotNull(t.getCreatedAt());

        AffiliateClickEvent e = new AffiliateClickEvent();
        assertNotNull(e.getCreatedAt());

        AffiliateCommission c = new AffiliateCommission();
        assertNotNull(c.getCreatedAt());

        // Cordura: createdAt esta cerca de "ahora" (no un valor placeholder viejo).
        LocalDateTime now = LocalDateTime.now();
        assertTrue(t.getCreatedAt().isAfter(now.minusMinutes(1)));
        assertTrue(e.getCreatedAt().isAfter(now.minusMinutes(1)));
        assertTrue(c.getCreatedAt().isAfter(now.minusMinutes(1)));
    }
}
