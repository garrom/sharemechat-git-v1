package com.sharemechat.service;

import com.sharemechat.exception.CountryBlockedException;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Tests del nuevo método {@code assertAllowedForModelKyc} (paso 2 del frente
 * Veriff). Cubre los cinco casos pedidos: país permitido pasa, país NO
 * permitido rechaza, país ausente con block-when-missing=true rechaza, gate
 * global desactivado deja pasar todo, bypass IP funciona.
 *
 * No usa Spring: instancia el servicio a mano y le inyecta el estado parseado
 * vía ReflectionTestUtils (el @PostConstruct ya está cubierto en producción
 * por el bootstrap real; aquí queremos un sujeto bajo control determinista).
 */
class CountryAccessServiceModelKycTest {

    private static final String MODEL_ALLOWED_HEADER = "ES";
    private static final String MODEL_DENIED_HEADER = "CN";

    private static CountryAccessService service(boolean enabled,
                                                boolean blockWhenMissing,
                                                Set<String> modelAllowed,
                                                List<IpAddressMatcher> bypass) {
        CountryAccessService s = new CountryAccessService();
        ReflectionTestUtils.setField(s, "enabled", enabled);
        ReflectionTestUtils.setField(s, "blockWhenMissing", blockWhenMissing);
        // No hace falta poblar clientAllowed/unionAllowed para los tests de KYC,
        // pero los dejamos como Set vacíos para no chocar con NPE si alguien
        // los usa indirectamente.
        ReflectionTestUtils.setField(s, "clientAllowed", Set.of());
        ReflectionTestUtils.setField(s, "modelAllowed", modelAllowed);
        ReflectionTestUtils.setField(s, "unionAllowed", modelAllowed);
        ReflectionTestUtils.setField(s, "bypassMatchers", bypass);
        return s;
    }

    private static HttpServletRequest requestWithCountry(String country, String remoteAddr) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        if (country != null) {
            req.addHeader("CloudFront-Viewer-Country", country);
        }
        if (remoteAddr != null) {
            req.setRemoteAddr(remoteAddr);
        }
        return req;
    }

    @Test
    @DisplayName("(a) país permitido -> pasa")
    void allowedCountry_passes() {
        CountryAccessService s = service(true, true, Set.of("ES", "PT"), List.of());
        assertDoesNotThrow(() -> s.assertAllowedForModelKyc(
                requestWithCountry(MODEL_ALLOWED_HEADER, "203.0.113.1")));
    }

    @Test
    @DisplayName("(b) país NO permitido -> CountryBlockedException")
    void deniedCountry_rejects() {
        CountryAccessService s = service(true, true, Set.of("ES", "PT"), List.of());
        assertThrows(CountryBlockedException.class, () -> s.assertAllowedForModelKyc(
                requestWithCountry(MODEL_DENIED_HEADER, "203.0.113.2")));
    }

    @Test
    @DisplayName("(c) cabecera de país ausente con block-when-missing=true -> rechaza")
    void missingCountry_withBlockWhenMissing_rejects() {
        CountryAccessService s = service(true, true, Set.of("ES"), List.of());
        assertThrows(CountryBlockedException.class, () -> s.assertAllowedForModelKyc(
                requestWithCountry(null, "203.0.113.3")));
    }

    @Test
    @DisplayName("(c-bis) cabecera ausente con block-when-missing=false -> deja pasar")
    void missingCountry_withoutBlockWhenMissing_passes() {
        CountryAccessService s = service(true, false, Set.of("ES"), List.of());
        assertDoesNotThrow(() -> s.assertAllowedForModelKyc(
                requestWithCountry(null, "203.0.113.4")));
    }

    @Test
    @DisplayName("(d) COUNTRY_ACCESS_ENABLED=false -> deja pasar todo (incluido país denegado)")
    void gateGloballyDisabled_passesAlways() {
        CountryAccessService s = service(false, true, Set.of("ES"), List.of());
        assertDoesNotThrow(() -> s.assertAllowedForModelKyc(
                requestWithCountry(MODEL_DENIED_HEADER, "203.0.113.5")));
        assertDoesNotThrow(() -> s.assertAllowedForModelKyc(
                requestWithCountry(null, "203.0.113.6")));
    }

    @Test
    @DisplayName("(e) bypass IP funciona: IP bypassada con país denegado pasa")
    void bypassIp_passesEvenIfCountryDenied() {
        IpAddressMatcher bypass = new IpAddressMatcher("90.175.201.51/32");
        CountryAccessService s = service(true, true, Set.of("ES"), List.of(bypass));
        // País denegado, pero IP bypassada
        assertDoesNotThrow(() -> s.assertAllowedForModelKyc(
                requestWithCountry(MODEL_DENIED_HEADER, "90.175.201.51")));
        // Misma IP fuera del rango -> sí bloquea
        assertThrows(CountryBlockedException.class, () -> s.assertAllowedForModelKyc(
                requestWithCountry(MODEL_DENIED_HEADER, "203.0.113.7")));
    }
}
