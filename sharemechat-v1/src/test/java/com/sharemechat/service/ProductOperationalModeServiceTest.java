package com.sharemechat.service;

import com.sharemechat.config.ProductOperationalProperties;
import com.sharemechat.config.ProductOperationalProperties.Mode;
import com.sharemechat.service.ProductOperationalModeService.Decision;
import com.sharemechat.service.ProductOperationalModeService.DecisionType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * ADR-059 — cobertura unit del gate Product Operational Mode (ADR-009),
 * enfocada en el MODO POR ROL introducido en feat(gate) 6af36bf1
 * ({@code product.access.mode-model} / env {@code PRODUCT_ACCESS_MODE_MODEL}).
 *
 * <p>El service es puro (sin I/O, sin BD): el {@code isModel} se lo pasan el
 * filtro/interceptor. Aquí se ejercita directamente la lógica de decisión con
 * un {@link ProductOperationalProperties} real construido por setters.
 *
 * <p>Caso de uso cubierto: cliente en PRELAUNCH y modelo en OPEN a la vez
 * (la candidata USER+FORM_MODEL puede acceder al producto para la verificación
 * Didit; el cerrojo de promoción admin USER→MODEL es ortogonal a este gate).
 */
class ProductOperationalModeServiceTest {

    // Path de producto gateado en modos restrictivos (isProductPath=true, no
    // whitelisteado, no registro, no auth-login/refresh).
    private static final String PRODUCT_PATH = "/api/webrtc/config";
    private static final String GET = "GET";

    private ProductOperationalModeService svc(Mode global, Mode model, Long... allowlist) {
        ProductOperationalProperties p = new ProductOperationalProperties();
        p.getAccess().setMode(global);
        p.getAccess().setModeModel(model); // null = sin override (fallback a global)
        if (allowlist.length > 0) {
            p.getAccess().getAllowlist().setUserIds(List.of(allowlist));
        }
        return new ProductOperationalModeService(p);
    }

    // ---- modelMode() / effectiveModeForUser() ----

    @Test
    void modelMode_devuelveElOverrideSiEstaConfigurado() {
        ProductOperationalModeService s = svc(Mode.PRELAUNCH, Mode.OPEN);
        assertEquals(Mode.OPEN, s.modelMode());
        assertEquals(Mode.PRELAUNCH, s.currentMode());
    }

    @Test
    void modelMode_caeAlModoGlobalCuandoNoHayOverride() {
        ProductOperationalModeService s = svc(Mode.PRELAUNCH, null);
        assertEquals(Mode.PRELAUNCH, s.modelMode());
    }

    @Test
    void effectiveModeForUser_distingueModeloDeCliente() {
        ProductOperationalModeService s = svc(Mode.PRELAUNCH, Mode.OPEN);
        assertEquals(Mode.OPEN, s.effectiveModeForUser(true));       // modelo
        assertEquals(Mode.PRELAUNCH, s.effectiveModeForUser(false)); // cliente/otros
    }

    // ---- decideForRequest(..., isModel) ----

    @Test
    void request_prelaunchGlobalConModeloOpen_bloqueaClienteYPermiteModelo() {
        ProductOperationalModeService s = svc(Mode.PRELAUNCH, Mode.OPEN);

        Decision cliente = s.decideForRequest(null, GET, PRODUCT_PATH, null, false);
        assertFalse(cliente.isAllow());
        assertEquals(DecisionType.BLOCK_PRODUCT_UNAVAILABLE, cliente.getType());
        assertEquals(Mode.PRELAUNCH.name(), cliente.getMode());

        Decision modelo = s.decideForRequest(null, GET, PRODUCT_PATH, null, true);
        assertTrue(modelo.isAllow()); // modelo se rige por modeModel=OPEN
    }

    @Test
    void request_sinOverride_elModeloCaeAlModoGlobalRestrictivo() {
        ProductOperationalModeService s = svc(Mode.PRELAUNCH, null);
        // Sin mode-model, el modelo NO se abre: hereda el global PRELAUNCH.
        assertFalse(s.decideForRequest(null, GET, PRODUCT_PATH, null, true).isAllow());
        assertFalse(s.decideForRequest(null, GET, PRODUCT_PATH, null, false).isAllow());
    }

    @Test
    void request_ambosOpen_permiteAmbos() {
        ProductOperationalModeService s = svc(Mode.OPEN, Mode.OPEN);
        assertTrue(s.decideForRequest(null, GET, PRODUCT_PATH, null, true).isAllow());
        assertTrue(s.decideForRequest(null, GET, PRODUCT_PATH, null, false).isAllow());
    }

    @Test
    void request_allowlistHaceBypassAunEnPrelaunch() {
        ProductOperationalModeService s = svc(Mode.PRELAUNCH, Mode.OPEN, 42L);
        // Cliente (isModel=false) normalmente bloqueado, pero allowlisted → allow.
        assertTrue(s.decideForRequest(null, GET, PRODUCT_PATH, 42L, false).isAllow());
        // No allowlisted sigue bloqueado.
        assertFalse(s.decideForRequest(null, GET, PRODUCT_PATH, 99L, false).isAllow());
    }

    @Test
    void request_pathWhitelisteadoNoSeGateaNiPorRolNiPorModo() {
        ProductOperationalModeService s = svc(Mode.PRELAUNCH, null);
        // /api/users/me está en isAlwaysAllowed → allow siempre.
        assertTrue(s.decideForRequest(null, GET, "/api/users/me", null, false).isAllow());
        assertTrue(s.decideForRequest(null, GET, "/api/users/me", null, true).isAllow());
    }

    // ---- decideForWsHandshake(..., isModel) ----

    @Test
    void ws_prelaunchGlobalConModeloOpen_bloqueaClienteYPermiteModelo() {
        ProductOperationalModeService s = svc(Mode.PRELAUNCH, Mode.OPEN);

        assertTrue(s.decideForWsHandshake(null, "/match", null, true).isAllow());   // modelo OPEN
        Decision cliente = s.decideForWsHandshake(null, "/match", null, false);
        assertFalse(cliente.isAllow());
        assertEquals(DecisionType.BLOCK_PRODUCT_UNAVAILABLE, cliente.getType());
    }

    @Test
    void ws_allowlistHaceBypass() {
        ProductOperationalModeService s = svc(Mode.PRELAUNCH, null, 7L);
        assertTrue(s.decideForWsHandshake(null, "/messages", 7L, false).isAllow());
        assertFalse(s.decideForWsHandshake(null, "/messages", 8L, false).isAllow());
    }
}
