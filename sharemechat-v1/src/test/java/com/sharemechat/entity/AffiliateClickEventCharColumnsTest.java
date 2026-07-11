package com.sharemechat.entity;

import jakarta.persistence.Column;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * ADR-049 Subpasada 2A — regresion 2026-07-11:
 * blindaje del contrato JPA de {@code ipHash} y {@code uaHash} en
 * {@link AffiliateClickEvent} para que Hibernate emita CHAR(16), coherente
 * con la V16 que declara {@code CHAR(16)} en la BD.
 *
 * <p>Bug original detectado durante el smoke MySQL de subpasada 2A: la
 * anotacion {@code @Column(name = "ip_hash", length = 16)} sin
 * {@code columnDefinition} genera VARCHAR(16), lo que rompia el arranque
 * con {@code Schema-validation: wrong column type encountered [char (Types#CHAR)],
 * but expecting [varchar(16) (Types#VARCHAR)]}. Fix minimo: anadir
 * {@code columnDefinition = "CHAR(16)"} a ambas anotaciones.
 *
 * <p>Este test bloquea que un cambio futuro retire {@code columnDefinition}
 * y reproduzca la regresion sin smoke MySQL para detectarla.
 */
class AffiliateClickEventCharColumnsTest {

    @Test
    @DisplayName("ipHash: @Column debe declarar columnDefinition CHAR(16) para que Hibernate genere CHAR")
    void ipHash_columnDefinitionIsChar16() throws NoSuchFieldException {
        Field f = AffiliateClickEvent.class.getDeclaredField("ipHash");
        Column col = f.getAnnotation(Column.class);
        String def = col.columnDefinition().toUpperCase().replaceAll("\\s+", "");
        assertTrue(def.contains("CHAR(16)"),
                "AffiliateClickEvent.ipHash debe declarar columnDefinition CHAR(16). "
                        + "Sin esto, Hibernate genera VARCHAR(16) y schema-validation rompe el "
                        + "arranque (regresion 2026-07-11). Encontrado: '"
                        + col.columnDefinition() + "'.");
    }

    @Test
    @DisplayName("uaHash: @Column debe declarar columnDefinition CHAR(16) para que Hibernate genere CHAR")
    void uaHash_columnDefinitionIsChar16() throws NoSuchFieldException {
        Field f = AffiliateClickEvent.class.getDeclaredField("uaHash");
        Column col = f.getAnnotation(Column.class);
        String def = col.columnDefinition().toUpperCase().replaceAll("\\s+", "");
        assertTrue(def.contains("CHAR(16)"),
                "AffiliateClickEvent.uaHash debe declarar columnDefinition CHAR(16). "
                        + "Mismo motivo que ipHash. Encontrado: '" + col.columnDefinition() + "'.");
    }
}
