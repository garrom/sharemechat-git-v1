package com.sharemechat.support.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ADR-054 Fase T3.5 — tests unitarios del clasificador heuristico.
 */
class TicketOfferHeuristicServiceTest {

    private final TicketOfferHeuristicService svc = new TicketOfferHeuristicService();

    // ============================================================
    // detectCategory
    // ============================================================

    @Test
    @DisplayName("STREAM_INTERRUPTED detectado en ES y EN")
    void detects_stream_interrupted() {
        assertEquals(Optional.of("STREAM_INTERRUPTED"),
                svc.detectCategory("Se cayo el stream en el minuto 3"));
        assertEquals(Optional.of("STREAM_INTERRUPTED"),
                svc.detectCategory("The stream cut off and never came back"));
    }

    @Test
    @DisplayName("PAYMENT_NOT_CREDITED detectado en ES y EN")
    void detects_payment_not_credited() {
        assertEquals(Optional.of("PAYMENT_NOT_CREDITED"),
                svc.detectCategory("Pague pero no me acredito el saldo"));
        assertEquals(Optional.of("PAYMENT_NOT_CREDITED"),
                svc.detectCategory("I paid but balance not credited"));
    }

    @Test
    @DisplayName("MODERATION_FALSE_POSITIVE detectado en ES y EN")
    void detects_moderation() {
        assertEquals(Optional.of("MODERATION_FALSE_POSITIVE"),
                svc.detectCategory("Me han cortado sin razon la camara"));
        assertEquals(Optional.of("MODERATION_FALSE_POSITIVE"),
                svc.detectCategory("Moderation cut me for no reason"));
    }

    @Test
    @DisplayName("ACCOUNT_ISSUE detectado en ES y EN")
    void detects_account_issue() {
        assertEquals(Optional.of("ACCOUNT_ISSUE"),
                svc.detectCategory("No puedo entrar, dice cuenta bloqueada"));
        assertEquals(Optional.of("ACCOUNT_ISSUE"),
                svc.detectCategory("Cannot login, account suspended"));
    }

    @Test
    @DisplayName("OTHER cuando aparecen keywords genericas sin categoria concreta")
    void detects_other_generic() {
        assertEquals(Optional.of("OTHER"),
                svc.detectCategory("Quiero presentar una reclamacion formal"));
        assertEquals(Optional.of("OTHER"),
                svc.detectCategory("I want to file a complaint"));
    }

    @Test
    @DisplayName("Consulta normal sin senyal -> Optional.empty")
    void no_signal_returns_empty() {
        assertTrue(svc.detectCategory("Como cambio mi contrasena?").isEmpty());
        assertTrue(svc.detectCategory("Que es un pack?").isEmpty());
        assertTrue(svc.detectCategory("Hola, buenos dias").isEmpty());
    }

    @Test
    @DisplayName("Mensaje null o vacio -> Optional.empty (sin NPE)")
    void null_and_empty_safe() {
        assertTrue(svc.detectCategory(null).isEmpty());
        assertTrue(svc.detectCategory("").isEmpty());
        assertTrue(svc.detectCategory("   ").isEmpty());
    }

    // ============================================================
    // interpretConfirmation
    // ============================================================

    @Test
    @DisplayName("interpretConfirmation ACCEPT en variantes comunes ES y EN")
    void accepts_yes_variants() {
        assertEquals(TicketOfferHeuristicService.ConfirmationDecision.ACCEPT,
                svc.interpretConfirmation("si"));
        assertEquals(TicketOfferHeuristicService.ConfirmationDecision.ACCEPT,
                svc.interpretConfirmation("sí, abrelo"));
        assertEquals(TicketOfferHeuristicService.ConfirmationDecision.ACCEPT,
                svc.interpretConfirmation("yes please"));
        assertEquals(TicketOfferHeuristicService.ConfirmationDecision.ACCEPT,
                svc.interpretConfirmation("ok abre"));
    }

    @Test
    @DisplayName("interpretConfirmation REJECT en variantes comunes")
    void rejects_no_variants() {
        assertEquals(TicketOfferHeuristicService.ConfirmationDecision.REJECT,
                svc.interpretConfirmation("no"));
        assertEquals(TicketOfferHeuristicService.ConfirmationDecision.REJECT,
                svc.interpretConfirmation("no gracias"));
        assertEquals(TicketOfferHeuristicService.ConfirmationDecision.REJECT,
                svc.interpretConfirmation("cancel"));
    }

    @Test
    @DisplayName("interpretConfirmation AMBIGUOUS ante mensajes que no confirman")
    void ambiguous_default() {
        assertEquals(TicketOfferHeuristicService.ConfirmationDecision.AMBIGUOUS,
                svc.interpretConfirmation("tal vez luego"));
        assertEquals(TicketOfferHeuristicService.ConfirmationDecision.AMBIGUOUS,
                svc.interpretConfirmation("what?"));
        assertEquals(TicketOfferHeuristicService.ConfirmationDecision.AMBIGUOUS,
                svc.interpretConfirmation(null));
        assertEquals(TicketOfferHeuristicService.ConfirmationDecision.AMBIGUOUS,
                svc.interpretConfirmation(""));
    }
}
