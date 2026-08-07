package com.sharemechat.service.translation;

/**
 * pending-hardening §5.3: interfaz vendor-agnostic para el proveedor de
 * traduccion automatica de chat P2P cross-language.
 *
 * Implementaciones: {@link GoogleCloudTranslationClient} (default).
 * Diseño previsto para poder anadir DeepL, Microsoft, Amazon, etc. sin
 * cambios en el dominio ni en {@code MessageTranslationService}.
 */
public interface TranslationProvider {

    /**
     * Traduce {@code text} al idioma {@code targetLang} (BCP-47, ej. "es",
     * "en"). El proveedor detecta automaticamente el idioma origen; el
     * resultado devuelve el idioma detectado para poder persistirlo.
     *
     * Comportamiento en modo degradado (proveedor sin configurar): lanza
     * {@link TranslationUnavailableException}. El caller HTTP mapea a
     * 503.
     *
     * @throws TranslationUnavailableException si el proveedor no esta
     *         configurado o falla al llamar al API externo.
     */
    TranslatedResult translate(String text, String targetLang);

    /**
     * Traduce {@code texts} al idioma {@code targetLang} en una sola llamada
     * al API externo. Preserva el orden: el resultado[i] corresponde a
     * texts[i]. Usado por {@code MessageTranslationService} para reducir
     * latencia al renderizar historial de chat con N mensajes sin cache.
     *
     * Implementaciones sin batch nativo pueden hacer fallback a llamadas
     * secuenciales.
     *
     * @throws TranslationUnavailableException si el proveedor no esta
     *         configurado o falla al llamar al API externo.
     */
    java.util.List<TranslatedResult> translateBatch(java.util.List<String> texts, String targetLang);

    /**
     * Identificador corto del proveedor ("google", "deepl", ...). Se
     * persiste en {@code message_translations.provider} para diagnostico.
     */
    String providerName();

    /**
     * True si el proveedor esta configurado y disponible. El endpoint
     * GET /api/support/health o similar puede usarlo para exponer estado.
     */
    boolean isConfigured();
}
