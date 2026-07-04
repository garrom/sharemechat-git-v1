package com.sharemechat.support.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SupportBotRouterServiceTest {

    private final SupportBotRouterService router = new SupportBotRouterService();

    private static User user(String role) {
        User u = new User();
        u.setRole(role);
        return u;
    }

    @Test
    @DisplayName("trouble-modelo: 'no me llegan clientes' con rol MODEL")
    void routeTroubleModelo() {
        assertEquals("troubleshooting-modelo",
                router.route(user(Constants.Roles.MODEL), "no me llegan clientes al matchear"));
        assertEquals("troubleshooting-modelo",
                router.route(user(Constants.Roles.MODEL), "mi cámara no funciona"));
        assertEquals("troubleshooting-modelo",
                router.route(user(Constants.Roles.MODEL), "sesión se corta cada dos por tres"));
    }

    @Test
    @DisplayName("trouble-cliente: 'no me salen modelos' con rol CLIENT")
    void routeTroubleCliente() {
        assertEquals("troubleshooting-cliente",
                router.route(user(Constants.Roles.CLIENT), "no me salen modelos al buscar"));
        assertEquals("troubleshooting-cliente",
                router.route(user(Constants.Roles.CLIENT), "mi cámara no arranca"));
        assertEquals("troubleshooting-cliente",
                router.route(user(Constants.Roles.CLIENT), "no llega el email de verificación"));
    }

    @Test
    @DisplayName("trouble por rol: 'cámara no' rutea distinto según rol")
    void routeTroubleByRole() {
        assertEquals("troubleshooting-cliente",
                router.route(user(Constants.Roles.CLIENT), "cámara no se enciende"));
        assertEquals("troubleshooting-modelo",
                router.route(user(Constants.Roles.MODEL), "cámara no se enciende"));
    }

    @Test
    @DisplayName("payout-y-tiers: 'tier', 'payout', 'wise' con rol MODEL")
    void routePayoutTiers() {
        assertEquals("payout-y-tiers",
                router.route(user(Constants.Roles.MODEL), "¿qué es un tier?"));
        assertEquals("payout-y-tiers",
                router.route(user(Constants.Roles.MODEL), "¿cómo funciona el payout?"));
        assertEquals("payout-y-tiers",
                router.route(user(Constants.Roles.MODEL), "el retiro va por Wise?"));
        assertEquals("payout-y-tiers",
                router.route(user(Constants.Roles.MODEL), "cuánto cobro por un gift"));
    }

    @Test
    @DisplayName("pagos-y-saldo: 'saldo', 'pack', 'reembolso' con rol CLIENT")
    void routePagosSaldo() {
        assertEquals("pagos-y-saldo",
                router.route(user(Constants.Roles.CLIENT), "quiero recargar saldo"));
        assertEquals("pagos-y-saldo",
                router.route(user(Constants.Roles.CLIENT), "qué pack me conviene"));
        assertEquals("pagos-y-saldo",
                router.route(user(Constants.Roles.CLIENT), "puedo pedir un reembolso"));
        assertEquals("pagos-y-saldo",
                router.route(user(Constants.Roles.CLIENT), "cuánto cuesta el minuto"));
    }

    @Test
    @DisplayName("moderacion-y-seguridad: keywords BOTH")
    void routeModeracion() {
        assertEquals("moderacion-y-seguridad",
                router.route(user(Constants.Roles.CLIENT), "quiero denunciar a un usuario"));
        assertEquals("moderacion-y-seguridad",
                router.route(user(Constants.Roles.MODEL), "me han suspendido injustamente"));
        assertEquals("moderacion-y-seguridad",
                router.route(user(Constants.Roles.CLIENT), "¿grabáis las sesiones?"));
        assertEquals("moderacion-y-seguridad",
                router.route(user(Constants.Roles.MODEL), "cómo apelar el baneo"));
    }

    @Test
    @DisplayName("privacidad-y-datos: keywords GDPR BOTH")
    void routePrivacidad() {
        assertEquals("privacidad-y-datos",
                router.route(user(Constants.Roles.CLIENT), "quiero ejercer mi derecho GDPR"));
        assertEquals("privacidad-y-datos",
                router.route(user(Constants.Roles.MODEL), "¿vendéis mis datos?"));
        assertEquals("privacidad-y-datos",
                router.route(user(Constants.Roles.CLIENT), "quiero borrar mis datos"));
    }

    @Test
    @DisplayName("cuenta: contraseñas / cerrar cuenta / cambiar email BOTH")
    void routeCuenta() {
        assertEquals("cuenta",
                router.route(user(Constants.Roles.CLIENT), "quiero cambiar mi contraseña"));
        assertEquals("cuenta",
                router.route(user(Constants.Roles.MODEL), "cómo cambio email"));
        assertEquals("cuenta",
                router.route(user(Constants.Roles.CLIENT), "quiero cerrar mi cuenta"));
    }

    @Test
    @DisplayName("empresa-y-contacto: contacto / horario / suplantación")
    void routeEmpresa() {
        assertEquals("empresa-y-contacto",
                router.route(user(Constants.Roles.CLIENT), "¿cuál es vuestro horario?"));
        assertEquals("empresa-y-contacto",
                router.route(user(Constants.Roles.MODEL),
                        "me llamaron por WhatsApp diciendo que eran de SharemeChat"));
        assertEquals("empresa-y-contacto",
                router.route(user(Constants.Roles.CLIENT), "estáis basados en estonia?"));
    }

    @Test
    @DisplayName("chat-y-favoritos: keywords sociales BOTH")
    void routeChatFavoritos() {
        assertEquals("chat-y-favoritos",
                router.route(user(Constants.Roles.CLIENT), "cómo pido un favorito"));
        assertEquals("chat-y-favoritos",
                router.route(user(Constants.Roles.CLIENT), "quiero bloquear a alguien"));
        // "gift" con rol CLIENT cae en chat-y-favoritos porque payout requiere MODEL
        assertEquals("chat-y-favoritos",
                router.route(user(Constants.Roles.CLIENT), "cómo se manda un gift"));
    }

    @Test
    @DisplayName("onboarding-modelo: registro modelo / contrato / assets")
    void routeOnboardingModelo() {
        assertEquals("onboarding-modelo",
                router.route(user(Constants.Roles.MODEL), "cómo hago el registro modelo"));
        assertEquals("onboarding-modelo",
                router.route(user(Constants.Roles.MODEL), "cuánto puedo subir foto"));
        assertEquals("onboarding-modelo",
                router.route(user(Constants.Roles.MODEL), "aceptar contrato del model contract"));
    }

    @Test
    @DisplayName("onboarding-cliente: registro cliente / activar cuenta / didit")
    void routeOnboardingCliente() {
        assertEquals("onboarding-cliente",
                router.route(user(Constants.Roles.CLIENT), "cómo activar mi cuenta"));
        assertEquals("onboarding-cliente",
                router.route(user(Constants.Roles.CLIENT), "el flujo Didit no me deja pasar"));
    }

    @Test
    @DisplayName("rol filter: MODEL nunca rutea a CLIENT-only (payout no captura al CLIENT)")
    void roleFilterModelDoesNotRouteClientOnly() {
        // "saldo" es CLIENT-only. Un MODEL que menciona "saldo" cae a fallback.
        assertEquals("producto-general",
                router.route(user(Constants.Roles.MODEL), "qué es esto del saldo"));
    }

    @Test
    @DisplayName("rol filter: CLIENT nunca rutea a MODEL-only")
    void roleFilterClientDoesNotRouteModelOnly() {
        // "tier" es MODEL-only. Un CLIENT que menciona "tier" cae a fallback.
        assertEquals("producto-general",
                router.route(user(Constants.Roles.CLIENT), "cómo funciona el tier de la modelo"));
        // "payout" idem.
        assertEquals("producto-general",
                router.route(user(Constants.Roles.CLIENT), "cuánto cobra la modelo por payout"));
    }

    @Test
    @DisplayName("fallback: mensaje sin match → producto-general")
    void routeFallback() {
        assertEquals("producto-general",
                router.route(user(Constants.Roles.CLIENT), "qué es SharemeChat"));
        assertEquals("producto-general",
                router.route(user(Constants.Roles.MODEL), "hola buenos días"));
        assertEquals("producto-general",
                router.route(user(Constants.Roles.CLIENT), "hola"));
    }

    @Test
    @DisplayName("robusto: user null / message null → fallback sin excepción")
    void routeNulls() {
        assertEquals("producto-general", router.route(null, "hola"));
        assertEquals("producto-general", router.route(user(Constants.Roles.CLIENT), null));
        assertEquals("producto-general", router.route(null, null));
    }

    @Test
    @DisplayName("case-insensitive: mayúsculas del usuario no evitan match")
    void routeCaseInsensitive() {
        assertEquals("cuenta",
                router.route(user(Constants.Roles.CLIENT), "QUIERO CAMBIAR MI CONTRASEÑA"));
        assertEquals("payout-y-tiers",
                router.route(user(Constants.Roles.MODEL), "cuánto es el UMBRAL de payout"));
    }
}
