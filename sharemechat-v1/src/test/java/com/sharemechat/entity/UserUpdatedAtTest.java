package com.sharemechat.entity;

import jakarta.persistence.Column;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests del contrato JPA de {@code User.updatedAt} (deuda 2 del cierre del
 * frente Veriff, 2026-06-13).
 *
 * Bug original: el constructor seteaba {@code updatedAt = LocalDateTime.now()}
 * y la columna en BD tenía {@code DEFAULT CURRENT_TIMESTAMP ON UPDATE
 * CURRENT_TIMESTAMP}, pero Hibernate enviaba en cada UPDATE el valor del
 * objeto, lo que NO disparaba el {@code ON UPDATE} de MySQL (solo se dispara
 * cuando el SQL no menciona la columna o cuando manda un valor distinto al
 * previo). Resultado: {@code updated_at} se quedaba congelado.
 *
 * Fix: anotar el campo con {@code insertable=false, updatable=false} para que
 * Hibernate NUNCA incluya esta columna en INSERT/UPDATE; MySQL gestiona ambos
 * timestamps por columnDefinition. Mismo patron que {@code KycProviderConfig}
 * y {@code ModelKycSession}.
 *
 * Estos tests blindan el contrato a nivel de campo y de constructor; el
 * comportamiento real de Hibernate sobre BD se verificó manualmente en TEST
 * durante el frente Veriff (paso 4-bis: tras el fix, {@code users.updated_at}
 * SI avanzará al cambiar {@code verification_status}).
 */
class UserUpdatedAtTest {

    @Test
    @DisplayName("@Column(updated_at) tiene insertable=false y updatable=false (regresión: si alguien lo invierte, el timestamp vuelve a congelarse)")
    void updatedAtColumn_isNotInsertableNorUpdatable() throws NoSuchFieldException {
        Field f = User.class.getDeclaredField("updatedAt");
        Column col = f.getAnnotation(Column.class);
        assertFalse(col.insertable(),
                "updated_at debe ser insertable=false para que MySQL aplique DEFAULT CURRENT_TIMESTAMP en INSERT");
        assertFalse(col.updatable(),
                "updated_at debe ser updatable=false para que MySQL aplique ON UPDATE CURRENT_TIMESTAMP en UPDATE");
    }

    @Test
    @DisplayName("columnDefinition conserva DEFAULT CURRENT_TIMESTAMP + ON UPDATE CURRENT_TIMESTAMP")
    void updatedAtColumn_hasMysqlTimestampDefinition() throws NoSuchFieldException {
        Field f = User.class.getDeclaredField("updatedAt");
        Column col = f.getAnnotation(Column.class);
        String def = col.columnDefinition().toUpperCase().replaceAll("\\s+", " ");
        assertTrue(def.contains("DEFAULT CURRENT_TIMESTAMP"),
                "El DDL debe declarar DEFAULT CURRENT_TIMESTAMP");
        assertTrue(def.contains("ON UPDATE CURRENT_TIMESTAMP"),
                "El DDL debe declarar ON UPDATE CURRENT_TIMESTAMP");
    }

    @Test
    @DisplayName("El constructor NO inicializa updatedAt (deja que MySQL aplique el DEFAULT en INSERT)")
    void constructor_doesNotInitializeUpdatedAt() {
        User u = new User();
        assertNull(u.getUpdatedAt(),
                "El constructor no debe pre-rellenar updatedAt; con insertable=false el valor del objeto se ignora "
                        + "en el INSERT y MySQL aplica DEFAULT CURRENT_TIMESTAMP. Si se inicializa, se introduce "
                        + "ruido cosmético en el modelo en memoria sin efecto real en BD.");
    }
}
