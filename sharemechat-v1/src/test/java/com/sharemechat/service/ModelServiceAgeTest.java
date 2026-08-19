package com.sharemechat.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Card 1 Fase 2: edad derivada de date_of_birth para el perfil público.
 * No se expone la fecha, solo el entero.
 */
class ModelServiceAgeTest {

    @Test
    void computeAge_nullSiNoHayFecha() {
        assertNull(ModelService.computeAge(null));
    }

    @Test
    void computeAge_calculaAniosCumplidos() {
        LocalDate dob = LocalDate.now().minusYears(25).minusDays(3);
        assertEquals(25, ModelService.computeAge(dob));
    }

    @Test
    void computeAge_aunNoCumpleEsteAnio() {
        // Nació hace 25 años pero el cumpleaños es dentro de unos días.
        LocalDate dob = LocalDate.now().minusYears(25).plusDays(5);
        assertEquals(24, ModelService.computeAge(dob));
    }

    @Test
    void computeAge_noNegativa() {
        // Fecha futura (dato corrupto): no debe devolver edad negativa.
        Integer age = ModelService.computeAge(LocalDate.now().plusYears(2));
        assertTrue(age == null || age >= 0);
    }
}
