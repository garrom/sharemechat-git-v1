package com.sharemechat.entity;

import jakarta.persistence.Column;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * ADR-049 Subpasada 1: contrato JPA de los tres campos de afiliacion en
 * {@link User}: {@code referralCodeOwner}, {@code referredByUserId} y
 * {@code referredAt}. Tests por reflection sobre las anotaciones @Column;
 * el enforcement real de UNIQUE / FK / CHECK vive en la Flyway V16 y se
 * valida contra MySQL cuando toque el smoke de la subpasada.
 */
class UserAffiliateFieldsTest {

    @Test
    @DisplayName("User.referralCodeOwner: name=referral_code_owner, length=12, unique=true, nullable por defecto")
    void referralCodeOwner_columnContract() throws NoSuchFieldException {
        Field f = User.class.getDeclaredField("referralCodeOwner");
        Column col = f.getAnnotation(Column.class);
        assertEquals("referral_code_owner", col.name());
        assertEquals(12, col.length(),
                "El codigo tiene longitud fija 12 (Crockford Base32 sin ambiguos).");
        assertTrue(col.unique(),
                "referral_code_owner debe ser UNIQUE: dos modelos no pueden compartir codigo.");
        // Por defecto @Column es nullable=true. Se preserva porque un USER puede
        // no ser MODEL o no haber activado el programa.
        assertTrue(col.nullable(),
                "referral_code_owner debe ser NULLABLE (USER sin activar no tiene codigo).");
    }

    @Test
    @DisplayName("User.referredByUserId: name=referred_by_user_id, nullable=true")
    void referredByUserId_columnContract() throws NoSuchFieldException {
        Field f = User.class.getDeclaredField("referredByUserId");
        Column col = f.getAnnotation(Column.class);
        assertEquals("referred_by_user_id", col.name());
        assertTrue(col.nullable(),
                "referred_by_user_id debe ser NULLABLE (USER sin atribucion queda NULL).");
    }

    @Test
    @DisplayName("User.referredAt: name=referred_at, nullable=true (LocalDateTime)")
    void referredAt_columnContract() throws NoSuchFieldException {
        Field f = User.class.getDeclaredField("referredAt");
        Column col = f.getAnnotation(Column.class);
        assertEquals("referred_at", col.name());
        assertTrue(col.nullable());
        assertEquals(LocalDateTime.class, f.getType(),
                "referred_at usa java.time.LocalDateTime para mapear DATETIME de MySQL.");
    }

    @Test
    @DisplayName("El constructor no inicializa los campos de afiliacion (se pueblan on-registration en el service)")
    void constructor_leavesAffiliateFieldsNull() {
        User u = new User();
        assertNull(u.getReferralCodeOwner());
        assertNull(u.getReferredByUserId());
        assertNull(u.getReferredAt());
    }

    @Test
    @DisplayName("Setters de afiliacion asignan tal cual (guard de inmutabilidad vive en el service, no en la entidad)")
    void setters_persistValues() {
        User u = new User();
        u.setReferralCodeOwner("ABCDEFGH2345");
        u.setReferredByUserId(42L);
        LocalDateTime now = LocalDateTime.now();
        u.setReferredAt(now);
        assertEquals("ABCDEFGH2345", u.getReferralCodeOwner());
        assertEquals(42L, u.getReferredByUserId());
        assertEquals(now, u.getReferredAt());
    }

    @Test
    @DisplayName("Regresion: los 3 campos nuevos NO pisan la anotacion insertable/updatable de updated_at")
    void updatedAt_stillNotInsertableNorUpdatable() throws NoSuchFieldException {
        Field f = User.class.getDeclaredField("updatedAt");
        Column col = f.getAnnotation(Column.class);
        assertFalse(col.insertable(),
                "updated_at sigue con insertable=false tras la ampliacion.");
        assertFalse(col.updatable(),
                "updated_at sigue con updatable=false tras la ampliacion.");
    }
}
