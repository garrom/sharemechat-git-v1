package com.sharemechat.support.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Tests puros de las funciones estáticas de derivación del controller.
 * No arranca contexto Spring — sólo lógica de nombrado y overrides
 * introducida en Fase 1.B del refactor ADR-044.
 */
class KnowledgeBaseAdminControllerTest {

    @Test
    @DisplayName("deriveCaseKey rama 1: prefijo \\d+- (comportamiento previo)")
    void deriveCaseKey_prefixDigitsDash() {
        assertEquals("comportamiento-agente-ia",
                KnowledgeBaseAdminController.deriveCaseKey("00-comportamiento-agente-ia.md"));
        assertEquals("troubleshooting-modelo",
                KnowledgeBaseAdminController.deriveCaseKey("12-troubleshooting-modelo.md"));
        assertEquals("troubleshooting-cliente",
                KnowledgeBaseAdminController.deriveCaseKey("13-troubleshooting-cliente.md"));
        assertEquals("pagos-y-saldo",
                KnowledgeBaseAdminController.deriveCaseKey("05-pagos-y-saldo.md"));
    }

    @Test
    @DisplayName("deriveCaseKey rama 2: prefijo \\d+[a-z]- (introducida Fase 1.B para split)")
    void deriveCaseKey_prefixDigitsLetterDash() {
        assertEquals("payout-y-tiers",
                KnowledgeBaseAdminController.deriveCaseKey("03b-payout-y-tiers.md"));
        // Cualquier letra minúscula del sufijo alfabético
        assertEquals("something",
                KnowledgeBaseAdminController.deriveCaseKey("07c-something.md"));
    }

    @Test
    @DisplayName("deriveCaseKey sin prefijo numérico: nombre libre")
    void deriveCaseKey_noNumericPrefix() {
        assertEquals("producto-general",
                KnowledgeBaseAdminController.deriveCaseKey("producto-general.md"));
        assertEquals("simple",
                KnowledgeBaseAdminController.deriveCaseKey("simple.md"));
    }

    @Test
    @DisplayName("deriveCaseKey robusto ante nulls y sin extensión")
    void deriveCaseKey_edges() {
        assertNull(KnowledgeBaseAdminController.deriveCaseKey(null));
        assertEquals("no-extension",
                KnowledgeBaseAdminController.deriveCaseKey("no-extension"));
        // Prefijo raro: dígitos sin guion detrás — devuelve base como está
        assertEquals("42thing",
                KnowledgeBaseAdminController.deriveCaseKey("42thing.md"));
    }

    @Test
    @DisplayName("deriveRole: ROLE_OVERRIDES tiene precedencia sobre sufijos")
    void deriveRole_overridesTakePrecedence() {
        // case_key sin sufijo revelador — el override marca CLIENT
        assertEquals("CLIENT", KnowledgeBaseAdminController.deriveRole("pagos-y-saldo"));
        // case_key sin sufijo revelador — el override marca MODEL
        assertEquals("MODEL", KnowledgeBaseAdminController.deriveRole("payout-y-tiers"));
    }

    @Test
    @DisplayName("deriveRole: sufijos -modelo / -cliente para el resto")
    void deriveRole_suffixes() {
        assertEquals("MODEL",
                KnowledgeBaseAdminController.deriveRole("troubleshooting-modelo"));
        assertEquals("MODEL",
                KnowledgeBaseAdminController.deriveRole("onboarding-modelo"));
        assertEquals("CLIENT",
                KnowledgeBaseAdminController.deriveRole("troubleshooting-cliente"));
        assertEquals("CLIENT",
                KnowledgeBaseAdminController.deriveRole("onboarding-cliente"));
    }

    @Test
    @DisplayName("deriveRole: BOTH por defecto para case_keys transversales")
    void deriveRole_bothByDefault() {
        assertEquals("BOTH",
                KnowledgeBaseAdminController.deriveRole("comportamiento-agente-ia"));
        assertEquals("BOTH",
                KnowledgeBaseAdminController.deriveRole("producto-general"));
        assertEquals("BOTH",
                KnowledgeBaseAdminController.deriveRole("chat-y-favoritos"));
        assertEquals("BOTH",
                KnowledgeBaseAdminController.deriveRole("moderacion-y-seguridad"));
        assertEquals("BOTH",
                KnowledgeBaseAdminController.deriveRole("privacidad-y-datos"));
        assertEquals("BOTH",
                KnowledgeBaseAdminController.deriveRole("cuenta"));
        assertEquals("BOTH",
                KnowledgeBaseAdminController.deriveRole("empresa-y-contacto"));
        assertEquals("BOTH",
                KnowledgeBaseAdminController.deriveRole("ui-reference"));
        assertEquals("BOTH", KnowledgeBaseAdminController.deriveRole(null));
    }
}
