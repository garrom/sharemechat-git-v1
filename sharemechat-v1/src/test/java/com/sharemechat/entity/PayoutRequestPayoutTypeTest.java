package com.sharemechat.entity;

import jakarta.persistence.Column;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * ADR-049 Subpasada 1: contrato JPA del campo {@code payoutType} anadido a
 * {@link PayoutRequest} para separar payouts de streaming (default STREAM)
 * de payouts de comisiones de afiliacion (AFFILIATE). El CHECK de valores
 * permitidos vive en la Flyway V16 (MySQL 8).
 */
class PayoutRequestPayoutTypeTest {

    @Test
    @DisplayName("PayoutRequest.payoutType: name=payout_type, length=20, NOT NULL")
    void payoutType_columnContract() throws NoSuchFieldException {
        Field f = PayoutRequest.class.getDeclaredField("payoutType");
        Column col = f.getAnnotation(Column.class);
        assertEquals("payout_type", col.name());
        assertEquals(20, col.length());
        assertFalse(col.nullable(),
                "payout_type debe ser NOT NULL con default STREAM.");
    }

    @Test
    @DisplayName("El constructor deja payoutType='STREAM' por defecto (preserva contrato pre-ADR-049)")
    void constructor_defaultsToStream() {
        PayoutRequest pr = new PayoutRequest();
        assertEquals("STREAM", pr.getPayoutType(),
                "Los payouts existentes son de streaming; el default protege el flujo legacy.");
    }

    @Test
    @DisplayName("Setter acepta AFFILIATE sin validacion en la entidad (validacion vive en service + CHECK BD)")
    void setter_acceptsAffiliate() {
        PayoutRequest pr = new PayoutRequest();
        pr.setPayoutType("AFFILIATE");
        assertEquals("AFFILIATE", pr.getPayoutType());
    }
}
