package com.sharemechat.content.dto;

/**
 * Entrada de la lista `validationErrors` que el backend devuelve cuando un
 * apply-bilingual rechaza por validacion (paquete 2, ampliada en 7).
 *
 * Campos:
 *  - {@code field}: ruta JSON del campo afectado (p. ej. "locales.es.seo_title").
 *    Para errores de parseo, usar "body".
 *  - {@code message}: descripcion legible para el operador.
 *  - {@code code} (opcional, paquete 7): clasificador maquina del tipo de error.
 *    Valores documentados:
 *      - "JSON_PARSE_ERROR": fallo de parseo Jackson; ver `context` para
 *        fragmento alrededor del char offset.
 *    Otros codigos pueden anadirse en el futuro; los callers existentes que
 *    solo lean `field` y `message` siguen funcionando porque `code` es null
 *    por defecto.
 *  - {@code context} (opcional, paquete 7): fragmento de texto cercano al
 *    punto del error cuando aplique (p. ej. ~40 chars alrededor del char
 *    offset que Jackson reporta). Null si no aplica.
 *
 * Retrocompatibilidad: el constructor de 2 argumentos (field, message) se
 * conserva como conveniencia para los call sites que no necesitan code ni
 * context (la inmensa mayoria, todos los errores semanticos del adapter).
 */
public record ValidationErrorDTO(
        String field,
        String message,
        String code,
        String context
) {
    /** Conveniencia retrocompatible: code y context quedan null. */
    public ValidationErrorDTO(String field, String message) {
        this(field, message, null, null);
    }
}
