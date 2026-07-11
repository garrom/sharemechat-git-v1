package com.sharemechat.entity;

import jakarta.persistence.Column;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * ADR-049 Subpasada 2A — regresion 2026-07-11 (hermana de la de ipHash/uaHash):
 * blindaje del contrato JPA de {@code tokenHash} en {@link AffiliateLinkToken}
 * para que Hibernate emita CHAR(64), coherente con la V16 que declara
 * {@code CHAR(64)} en la BD.
 *
 * <p>Bug: la anotacion {@code @Column(name = "token_hash", nullable = false,
 * length = 64, unique = true)} sin {@code columnDefinition} generaba
 * VARCHAR(64), lo que rompia el arranque con
 * {@code Schema-validation: wrong column type encountered [char (Types#CHAR)],
 * but expecting [varchar(64) (Types#VARCHAR)]} en la segunda iteracion del
 * smoke tras corregir ipHash/uaHash.
 */
class AffiliateLinkTokenCharColumnTest {

    @Test
    @DisplayName("tokenHash: @Column debe declarar columnDefinition CHAR(64) para que Hibernate genere CHAR")
    void tokenHash_columnDefinitionIsChar64() throws NoSuchFieldException {
        Field f = AffiliateLinkToken.class.getDeclaredField("tokenHash");
        Column col = f.getAnnotation(Column.class);
        String def = col.columnDefinition().toUpperCase().replaceAll("\\s+", "");
        assertTrue(def.contains("CHAR(64)"),
                "AffiliateLinkToken.tokenHash debe declarar columnDefinition CHAR(64). "
                        + "Sin esto, Hibernate genera VARCHAR(64) y schema-validation rompe el "
                        + "arranque (regresion 2026-07-11). Encontrado: '"
                        + col.columnDefinition() + "'.");
    }
}
