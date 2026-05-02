package com.sharemechat.constants;

/**
 * Constantes de la capa Product Operational Mode (ADR-009).
 *
 * No contiene lógica. Centraliza códigos, scopes, header y prefijo de log
 * para que filtro, interceptor y posibles consumidores futuros se mantengan
 * sincronizados con la decisión documental.
 */
public final class ProductOperationalConstants {

    // Códigos funcionales devueltos en el body JSON de la respuesta 503.
    public static final String CODE_PRODUCT_UNAVAILABLE = "PRODUCT_UNAVAILABLE";
    public static final String CODE_PRODUCT_MAINTENANCE = "PRODUCT_MAINTENANCE";
    public static final String CODE_REGISTRATION_CLOSED = "REGISTRATION_CLOSED";
    public static final String CODE_SIMULATION_DISABLED = "SIMULATION_DISABLED";

    // Scopes del campo "scope" en el body.
    public static final String SCOPE_PRODUCT = "product";
    public static final String SCOPE_CLIENT = "client";
    public static final String SCOPE_MODEL = "model";
    public static final String SCOPE_TRANSACTIONS_DIRECT = "transactions-direct";

    // Header opcional que indica el modo activo en respuestas y handshakes WS bloqueados.
    public static final String HEADER_PRODUCT_MODE = "X-Product-Mode";

    // Prefijo de log para todas las trazas operativas de esta capa.
    public static final String LOG_PREFIX = "[PRODUCT-MODE]";

    // Mensajes por defecto. Texto para frontend en la primera iteración;
    // el frontend final aplicará i18n por código, no por este texto.
    public static final String MSG_PRODUCT_UNAVAILABLE = "El producto aún no está disponible.";
    public static final String MSG_PRODUCT_MAINTENANCE = "Mantenimiento en curso. Vuelve a intentarlo en unos minutos.";
    public static final String MSG_REGISTRATION_CLIENT_CLOSED = "El registro de clientes está temporalmente cerrado.";
    public static final String MSG_REGISTRATION_MODEL_CLOSED = "El registro de modelos está temporalmente cerrado.";
    public static final String MSG_SIMULATION_DISABLED = "La operación solicitada no está disponible en este entorno.";

    private ProductOperationalConstants() {
    }
}
