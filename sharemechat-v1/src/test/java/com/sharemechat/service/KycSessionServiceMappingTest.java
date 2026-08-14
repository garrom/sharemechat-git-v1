package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.KycSession;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-059 / ADR-035: tests de la LÓGICA DE MAPEO del KYC ({@link KycSessionService}).
 *
 * <p>Los métodos de decisión son package-private y PUROS (string/JSON matching,
 * cero Spring/BD/red), así que se prueban instanciando el service con dependencias
 * nulas ({@code new KycSessionService(null, ...)}) — unit test directo, sin Docker.
 * Es la pieza compliance-crítica: traduce el estado del vendor (Veriff/Didit) a
 * APPROVED/REJECTED/PENDING interno; un mapeo mal hecho dejaría pasar a un usuario
 * sin verificar en una plataforma adulta.
 *
 * <p>Cubre: mapeo Veriff por {@code verification.code}; mapeo Didit por status
 * (case-sensitive); frescura del timestamp anti-replay (300s); detección de
 * transiciones backwards; event_id sintético determinista; y los extractores de
 * payload de ambos vendors.
 */
class KycSessionServiceMappingTest {

    private final KycSessionService svc =
            new KycSessionService(null, null, null, null, null, null, null, null, null, null);

    @Test
    void veriff_code_mapea_al_estado_interno() {
        assertThat(svc.mapInternalStatusFromCode(9001, "s")).isEqualTo(Constants.VerificationStatuses.APPROVED);
        assertThat(svc.mapInternalStatusFromCode(9102, "s")).isEqualTo(Constants.VerificationStatuses.REJECTED);
        assertThat(svc.mapInternalStatusFromCode(9103, "s")).isEqualTo(Constants.VerificationStatuses.REJECTED);
        assertThat(svc.mapInternalStatusFromCode(9104, "s")).isEqualTo(Constants.VerificationStatuses.REJECTED);
        // 9121 = resubmission requested -> flujo abierto, sigue PENDING.
        assertThat(svc.mapInternalStatusFromCode(9121, "s")).isEqualTo(Constants.VerificationStatuses.PENDING);
        // null / código desconocido -> PENDING (NUNCA se asume APPROVED).
        assertThat(svc.mapInternalStatusFromCode(null, "s")).isEqualTo(Constants.VerificationStatuses.PENDING);
        assertThat(svc.mapInternalStatusFromCode(9999, "s")).isEqualTo(Constants.VerificationStatuses.PENDING);
    }

    @Test
    void didit_status_mapea_al_estado_interno_case_sensitive() {
        assertThat(svc.mapInternalStatusFromDiditStatus("Approved", "s"))
                .isEqualTo(Constants.VerificationStatuses.APPROVED);

        for (String rejected : List.of("Declined", "Expired", "Abandoned", "Kyc Expired")) {
            assertThat(svc.mapInternalStatusFromDiditStatus(rejected, "s"))
                    .as("status=%s", rejected)
                    .isEqualTo(Constants.VerificationStatuses.REJECTED);
        }
        for (String pending : List.of("Resubmitted", "Not Started", "In Progress", "Awaiting User", "In Review")) {
            assertThat(svc.mapInternalStatusFromDiditStatus(pending, "s"))
                    .as("status=%s", pending)
                    .isEqualTo(Constants.VerificationStatuses.PENDING);
        }
        // null / desconocido -> PENDING. Case-sensitive: "approved" != "Approved".
        assertThat(svc.mapInternalStatusFromDiditStatus(null, "s")).isEqualTo(Constants.VerificationStatuses.PENDING);
        assertThat(svc.mapInternalStatusFromDiditStatus("bogus", "s")).isEqualTo(Constants.VerificationStatuses.PENDING);
        assertThat(svc.mapInternalStatusFromDiditStatus("approved", "s")).isEqualTo(Constants.VerificationStatuses.PENDING);
    }

    @Test
    void didit_timestamp_freshness_ventana_300s() {
        long now = Instant.now().getEpochSecond();
        assertThat(svc.isDiditTimestampFresh(String.valueOf(now))).isTrue();
        assertThat(svc.isDiditTimestampFresh(String.valueOf(now - 100))).isTrue();
        assertThat(svc.isDiditTimestampFresh(String.valueOf(now + 100))).isTrue();
        assertThat(svc.isDiditTimestampFresh(String.valueOf(now - 400))).isFalse();
        assertThat(svc.isDiditTimestampFresh(String.valueOf(now + 400))).isFalse();
        assertThat(svc.isDiditTimestampFresh(null)).isFalse();
        assertThat(svc.isDiditTimestampFresh("")).isFalse();
        assertThat(svc.isDiditTimestampFresh("no-numerico")).isFalse();
    }

    @Test
    void backwards_transition_solo_desde_estado_terminal() {
        assertThat(svc.isBackwardsTransition(Constants.VerificationStatuses.APPROVED,
                Constants.VerificationStatuses.REJECTED)).isTrue();
        assertThat(svc.isBackwardsTransition(Constants.VerificationStatuses.APPROVED,
                Constants.VerificationStatuses.PENDING)).isTrue();
        assertThat(svc.isBackwardsTransition(Constants.VerificationStatuses.REJECTED,
                Constants.VerificationStatuses.APPROVED)).isTrue();
        // Desde PENDING o null cualquier transición es legítima.
        assertThat(svc.isBackwardsTransition(Constants.VerificationStatuses.PENDING,
                Constants.VerificationStatuses.APPROVED)).isFalse();
        assertThat(svc.isBackwardsTransition(null,
                Constants.VerificationStatuses.APPROVED)).isFalse();
        // Mismo estado no es backwards.
        assertThat(svc.isBackwardsTransition(Constants.VerificationStatuses.APPROVED,
                Constants.VerificationStatuses.APPROVED)).isFalse();
    }

    @Test
    void synthetic_event_id_es_determinista_y_prefijado() {
        String a = svc.deriveSyntheticEventId("{\"x\":1}");
        String b = svc.deriveSyntheticEventId("{\"x\":1}");
        String c = svc.deriveSyntheticEventId("{\"x\":2}");

        assertThat(a).startsWith("synth_").hasSize("synth_".length() + 64); // sha-256 hex
        assertThat(a).isEqualTo(b);      // mismo body -> mismo id
        assertThat(a).isNotEqualTo(c);   // body distinto -> id distinto
    }

    @Test
    void extractores_didit_leen_el_payload() {
        JSONObject j = new JSONObject(
                "{\"event_id\":\"ev-1\",\"session_id\":\"sess-9\",\"status\":\"Approved\",\"webhook_type\":\"status.updated\"}");
        assertThat(svc.extractDiditEventId(j)).isEqualTo("ev-1");
        assertThat(svc.extractDiditSessionId(j)).isEqualTo("sess-9");
        assertThat(svc.extractDiditStatus(j)).isEqualTo("Approved");
        assertThat(svc.extractDiditEventType(j)).isEqualTo("status.updated");
    }

    @Test
    void extractores_veriff_leen_verification_anidado() {
        JSONObject j = new JSONObject(
                "{\"verification\":{\"id\":\"vid-1\",\"attemptId\":\"att-1\",\"status\":\"declined\",\"code\":9102}}");
        assertThat(svc.extractProviderEventId(j)).isEqualTo("att-1"); // attemptId es autoridad de idempotencia
        assertThat(svc.extractDecisionCode(j)).isEqualTo(9102);
        assertThat(svc.extractProviderStatus(j)).isEqualTo("declined");
    }

    @Test
    void extractDiditAgeEstimation_lee_edad_y_score_del_liveness_check() {
        // Path Adaptive Workflow: decision.liveness_checks[0].{age_estimation,score}.
        KycSession s = new KycSession();
        svc.extractDiditAgeEstimation(
                new JSONObject("{\"decision\":{\"liveness_checks\":[{\"age_estimation\":24.5,\"score\":92.3}]}}"), s);
        assertThat(s.getEstimatedAgeDecimal()).isEqualByComparingTo("24.5");
        assertThat(s.getConfidenceScore()).isEqualByComparingTo("92.3");

        // Sin bloque decision -> no toca (mejor esfuerzo, quedan null).
        KycSession s2 = new KycSession();
        svc.extractDiditAgeEstimation(new JSONObject("{}"), s2);
        assertThat(s2.getEstimatedAgeDecimal()).isNull();
        assertThat(s2.getConfidenceScore()).isNull();
    }
}
