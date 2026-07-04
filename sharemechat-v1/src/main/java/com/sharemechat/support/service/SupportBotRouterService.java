package com.sharemechat.support.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Router determinístico del Agente IA de soporte (Fase 1.C, ADR-044).
 *
 * <p>Decide qué {@code case_key} de la BdC externa
 * ({@link KnowledgeBaseService}) se concatena al system prompt en función
 * del rol del usuario y del contenido de su mensaje. Los dos prompts
 * transversales ({@code comportamiento-agente-ia} y {@code ui-reference})
 * NO son destinos del router — se incluyen siempre desde
 * {@link SupportBotService}.</p>
 *
 * <p>Reglas evaluadas en orden de prioridad. La primera que matchea gana.
 * Sin match, fallback a {@code producto-general}. Log INFO por decisión.
 * Sin dependencias externas más allá del User y el mensaje del usuario.</p>
 */
@Service
public class SupportBotRouterService {

    private static final Logger log = LoggerFactory.getLogger(SupportBotRouterService.class);

    static final String CASE_FALLBACK = "producto-general";

    /**
     * Regla de enrutado. La rama {@code requiredRole == null} admite cualquier rol.
     * El matching de keywords es substring case-insensitive sobre el mensaje del usuario.
     */
    static final class Rule {
        final String name;
        final String requiredRole;
        final List<String> keywords;
        final String caseKey;

        Rule(String name, String requiredRole, List<String> keywords, String caseKey) {
            this.name = name;
            this.requiredRole = requiredRole;
            this.keywords = keywords;
            this.caseKey = caseKey;
        }

        boolean matches(String userRole, String messageLower) {
            if (requiredRole != null && !requiredRole.equals(userRole)) {
                return false;
            }
            for (String kw : keywords) {
                if (messageLower.contains(kw)) {
                    return true;
                }
            }
            return false;
        }
    }

    /**
     * Lista ordenada de reglas. Los troubleshoot por rol van primeros
     * (síntomas concretos ganan sobre casos temáticos genéricos); luego
     * la operativa económica por rol; luego los transversales BOTH; y
     * los onboardings al final para no capturar preguntas más específicas
     * de KYC ya cubiertas por cuenta / troubleshooting.
     */
    static final List<Rule> RULES = List.of(
            new Rule("trouble-modelo", Constants.Roles.MODEL, List.of(
                    "no me llegan clientes", "no llegan clientes",
                    "cámara no ", "camara no ",
                    "no puedo activar cámara", "no puedo activar camara",
                    "sesión se corta", "sesion se corta", "se cortó", "se corto",
                    "sesión cortada", "sesion cortada",
                    "cortó la sesión", "corto la sesion",
                    "no estoy aprobada", "cuenta pendiente", "pending",
                    "no veo estadísticas", "no veo estadisticas",
                    "dónde están mis estadísticas", "donde estan mis estadisticas"
            ), "troubleshooting-modelo"),

            new Rule("trouble-cliente", Constants.Roles.CLIENT, List.of(
                    "no me salen modelos", "no salen modelos",
                    "cámara no ", "camara no ",
                    "no puedo activar cámara", "no puedo activar camara",
                    "sesión se corta", "sesion se corta", "se cortó", "se corto",
                    "sesión cortada", "sesion cortada",
                    "cortó la sesión", "corto la sesion",
                    "no llega el email", "no me llega el email",
                    "email de verificación", "email de verificacion",
                    "no puedo comprar", "compra falla", "compra saldo falla"
            ), "troubleshooting-cliente"),

            new Rule("payout-tiers", Constants.Roles.MODEL, List.of(
                    "tier", "5-15", "7-20", "9-40",
                    "payout", "retirar", "retirada", "retiro",
                    "cobrar", "cobro", "cómo cobro", "como cobro",
                    "wise", "100 eur", "€100", "umbral",
                    "primer minuto", "resto de minutos",
                    "gift", "gifts", "regalo", "regalos",
                    "estadísticas", "estadisticas"
            ), "payout-y-tiers"),

            new Rule("pagos-saldo", Constants.Roles.CLIENT, List.of(
                    "saldo", "recarga", "recargar",
                    "pack", "packs",
                    "10 eur", "20 eur", "40 eur", "€10", "€20", "€40",
                    "bonus",
                    "1 eur/min", "1 eur por minuto",
                    "precio", "cuánto cuesta", "cuanto cuesta",
                    "reembolso", "refund",
                    "chargeback",
                    "cargo", "cargos",
                    "factura", "facturación", "facturacion",
                    "método de pago", "metodo de pago",
                    "comprar saldo"
            ), "pagos-y-saldo"),

            new Rule("moderacion", null, List.of(
                    "moderación", "moderacion",
                    "denuncia", "denunciar",
                    "/complaint", "complaint",
                    "apelación", "apelacion", "apelar",
                    "sightengine",
                    "menor", "menor de edad",
                    "grabación", "grabacion", "graban", "grabar",
                    "grabáis", "grabais",
                    "reportar", "reporte",
                    "suspend", "suspended",
                    "suspensión", "suspension", "suspender",
                    "baneo", "banned", "banear",
                    "sanción", "sancion", "warning"
            ), "moderacion-y-seguridad"),

            new Rule("privacidad", null, List.of(
                    "gdpr",
                    "datos personales", "mis datos",
                    "privacidad", "privacy",
                    "cookies",
                    "portabilidad",
                    "vendéis", "vendeis", "vender datos", "vender mis datos",
                    "borrar datos", "borrar mis datos",
                    "compartir datos", "compartís datos", "compartis datos"
            ), "privacidad-y-datos"),

            new Rule("cuenta", null, List.of(
                    "contraseña", "contrasena", "password",
                    "olvidé", "olvide", "forgot",
                    "cambiar email", "cambiar mi email",
                    "cambio email", "cambio de email", "cambio mi email",
                    "cerrar cuenta", "cerrar mi cuenta",
                    "borrar cuenta", "eliminar cuenta",
                    "cerrar sesión", "cerrar sesion", "logout", "salir",
                    "cambiar rol", "cambio de rol",
                    "cuenta duplicada",
                    "kyc rechazado",
                    "verificación pendiente", "verificacion pendiente",
                    "cambiar contraseña", "cambiar contrasena"
            ), "cuenta"),

            new Rule("empresa-contacto", null, List.of(
                    "contacto", "email de soporte", "correo de soporte",
                    "horario",
                    "estonia", "shareme technologies",
                    "whatsapp", "sms",
                    "suplantación", "suplantacion",
                    "prensa", "medios",
                    "reclutamiento", "empleo", "vacantes",
                    "partnership", "comercial"
            ), "empresa-y-contacto"),

            new Rule("chat-favoritos", null, List.of(
                    "favorito", "favoritos",
                    "petición favorito", "peticion favorito",
                    "aceptar favorito", "rechazar favorito",
                    "emoji", "emojis",
                    "gift", "gifts", "regalo", "regalos",
                    "bloquear", "bloqueo",
                    "eliminar de favoritos",
                    "videochat 1-a-1", "videochat 1a1", "videochat con favorito",
                    "chatear con"
            ), "chat-y-favoritos"),

            new Rule("onboarding-modelo", Constants.Roles.MODEL, List.of(
                    "registro modelo", "registrarme como modelo",
                    "model contract", "contrato de modelo",
                    "aceptar contrato",
                    "kyc", "verificación modelo", "verificacion modelo",
                    "assets",
                    "subir foto", "subir video", "subir fotos", "subir videos",
                    "biografía", "biografia",
                    "aprobación", "aprobacion", "aprobar",
                    "didit"
            ), "onboarding-modelo"),

            new Rule("onboarding-cliente", Constants.Roles.CLIENT, List.of(
                    "registro cliente", "registrarme como cliente",
                    "activar cuenta", "activar mi cuenta",
                    "primer login",
                    "kyc",
                    "verificación edad", "verificacion edad",
                    "age estimation",
                    "didit"
            ), "onboarding-cliente")
    );

    /**
     * Devuelve el {@code case_key} de la BdC al que enrutar. Nunca lanza:
     * si el usuario es null, tiene rol desconocido o el mensaje es null,
     * cae a la evaluación normal (posiblemente sin match) y termina en
     * el fallback {@link #CASE_FALLBACK}.
     */
    public String route(User user, String message) {
        String userRole = user == null ? null : user.getRole();
        Long userId = user == null ? null : user.getId();
        String msgLower = message == null ? "" : message.toLowerCase();

        for (Rule r : RULES) {
            if (r.matches(userRole, msgLower)) {
                log.info("[SUPPORT-ROUTER] user_id={} role={} matched_rule={} case_key={}",
                        userId, userRole, r.name, r.caseKey);
                return r.caseKey;
            }
        }
        log.info("[SUPPORT-ROUTER] user_id={} role={} fallback case_key={}",
                userId, userRole, CASE_FALLBACK);
        return CASE_FALLBACK;
    }
}
