package com.sharemechat.support.service;

import com.sharemechat.support.service.TicketOfferHeuristicService.ConfirmationDecision;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-059 / ADR-054 D2: tests de la HEURÍSTICA de oferta de ticket del agente IA
 * de soporte ({@link TicketOfferHeuristicService}).
 *
 * <p>Lógica PURA: string matching case-insensitive, cero LLM, cero BD, cero Spring
 * → unit test directo sobre {@code new TicketOfferHeuristicService()}. Es la pieza
 * que decide cuándo el bot ofrece escalar a ticket humano y cómo interpreta el
 * sí/no del usuario, en una plataforma adulta → alto valor, coste de test mínimo.
 *
 * <p>Reglas cubiertas de {@code detectCategory}: (1) keyword de categoría concreta
 * gana; (2) empate entre concretas → OTHER; (3) sin concretas pero keyword genérica
 * → OTHER; (4) sin señal → vacío; (5) null/blank → vacío. Y de
 * {@code interpretConfirmation}: ACCEPT / REJECT / AMBIGUOUS incluyendo la
 * precedencia del rechazo sobre el positivo.
 */
class TicketOfferHeuristicServiceTest {

    private final TicketOfferHeuristicService service = new TicketOfferHeuristicService();

    // --- detectCategory ---

    @Test
    void detecta_categoria_concreta_por_keyword() {
        assertThat(service.detectCategory("se cayó el stream a mitad de la llamada"))
                .contains("STREAM_INTERRUPTED");
        assertThat(service.detectCategory("pagué pero no me acreditó el saldo"))
                .contains("PAYMENT_NOT_CREDITED");
        assertThat(service.detectCategory("no puedo entrar, mi cuenta bloqueada"))
                .contains("ACCOUNT_ISSUE");
    }

    @Test
    void empate_entre_categorias_concretas_devuelve_OTHER() {
        // 1 match STREAM ("se cayó") + 1 match ACCOUNT ("cuenta bloqueada") -> empate.
        assertThat(service.detectCategory("se cayó todo y encima mi cuenta bloqueada"))
                .contains("OTHER");
    }

    @Test
    void keyword_generica_sin_concreta_devuelve_OTHER() {
        assertThat(service.detectCategory("quiero un reembolso ya mismo"))
                .contains("OTHER");
    }

    @Test
    void sin_senal_devuelve_vacio() {
        assertThat(service.detectCategory("hola, tengo una duda sobre mi perfil"))
                .isEmpty();
    }

    @Test
    void null_o_blank_devuelve_vacio() {
        assertThat(service.detectCategory(null)).isEmpty();
        assertThat(service.detectCategory("   ")).isEmpty();
    }

    // --- interpretConfirmation ---

    @Test
    void interpreta_afirmaciones_como_ACCEPT() {
        assertThat(service.interpretConfirmation("sí, ábrelo")).isEqualTo(ConfirmationDecision.ACCEPT);
        assertThat(service.interpretConfirmation("ok")).isEqualTo(ConfirmationDecision.ACCEPT);
        assertThat(service.interpretConfirmation("adelante")).isEqualTo(ConfirmationDecision.ACCEPT);
    }

    @Test
    void interpreta_negaciones_como_REJECT() {
        assertThat(service.interpretConfirmation("no gracias")).isEqualTo(ConfirmationDecision.REJECT);
        assertThat(service.interpretConfirmation("cancelar")).isEqualTo(ConfirmationDecision.REJECT);
    }

    @Test
    void rechazo_tiene_precedencia_sobre_positivo() {
        // "no, mejor déjalo" empieza por "no," -> REJECT aunque contenga otras palabras.
        assertThat(service.interpretConfirmation("no, mejor déjalo")).isEqualTo(ConfirmationDecision.REJECT);
    }

    @Test
    void ambiguo_o_vacio_devuelve_AMBIGUOUS() {
        assertThat(service.interpretConfirmation("quizás más tarde")).isEqualTo(ConfirmationDecision.AMBIGUOUS);
        assertThat(service.interpretConfirmation("")).isEqualTo(ConfirmationDecision.AMBIGUOUS);
        assertThat(service.interpretConfirmation(null)).isEqualTo(ConfirmationDecision.AMBIGUOUS);
    }
}
