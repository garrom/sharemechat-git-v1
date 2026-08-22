package com.sharemechat.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * requestId en MDC por petición (trazabilidad de logs) + saneado anti-inyección.
 */
class RequestCorrelationFilterTest {

    private final RequestCorrelationFilter filter = new RequestCorrelationFilter();

    private String runCapturingMdc(MockHttpServletRequest req, MockHttpServletResponse res) throws Exception {
        AtomicReference<String> mdc = new AtomicReference<>();
        FilterChain chain = (r, s) -> mdc.set(MDC.get(RequestCorrelationFilter.MDC_KEY));
        filter.doFilter(req, res, chain);
        return mdc.get();
    }

    @Test
    void generaRequestIdSiNoViene_yLoLimpiaAlTerminar() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        MockHttpServletResponse res = new MockHttpServletResponse();

        String duringChain = runCapturingMdc(req, res);

        assertNotNull(duringChain);
        assertEquals(duringChain, res.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER));
        assertNull(MDC.get(RequestCorrelationFilter.MDC_KEY)); // limpiado tras la request
    }

    @Test
    void reusaElHeaderEntranteValido() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader(RequestCorrelationFilter.REQUEST_ID_HEADER, "abc-123");
        MockHttpServletResponse res = new MockHttpServletResponse();

        String duringChain = runCapturingMdc(req, res);

        assertEquals("abc-123", duringChain);
        assertEquals("abc-123", res.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER));
    }

    @Test
    void ignoraHeaderMalicioso_antiInyeccionDeLogs() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader(RequestCorrelationFilter.REQUEST_ID_HEADER, "bad\nINJECTED fake log");
        MockHttpServletResponse res = new MockHttpServletResponse();

        String duringChain = runCapturingMdc(req, res);

        assertNotEquals("bad\nINJECTED fake log", duringChain);
        assertTrue(duringChain.matches("[A-Za-z0-9._-]+")); // id seguro generado
    }
}
