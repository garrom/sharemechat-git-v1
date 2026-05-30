package com.sharemechat.service;

import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Copia bilingüe (ES / EN) de los 10 motivos predefinidos + OTHER usados
 * por el flujo de rechazo de assets de perfil de modelo
 * ({@link ModelAssetReviewService}).
 *
 * <p>Las mismas etiquetas viven en el frontend bajo
 * {@code admin.assetModeration.reasons.*} en {@code i18n/locales/es.json}
 * y {@code en.json}; al no haber bundle compartido entre backend y
 * frontend, estas constantes deben mantenerse paralelas a las del JSON
 * cuando se editen.
 *
 * <p>Convención de fallback (defensiva):
 * <ul>
 *   <li>locale desconocido (no {@code "es"} ni {@code "en"}) → se usa
 *       el mapa EN.</li>
 *   <li>{@code reasonCode} desconocido → se devuelve el propio code
 *       tal cual (mejor pasar el código que perder información).</li>
 * </ul>
 */
@Component
public class AssetRejectionReasonCopy {

    private static final Map<String, String> ES = Map.ofEntries(
            Map.entry("LIGHTING",         "Iluminación insuficiente (demasiado oscuro)"),
            Map.entry("QUALITY",          "Calidad de imagen/vídeo baja (borrosa, pixelada)"),
            Map.entry("EXPLICIT",         "Contenido sexualmente explícito (no permitido en perfil)"),
            Map.entry("FACE_NOT_VISIBLE", "Cara no visible o parcialmente cubierta"),
            Map.entry("IDENTITY_MISMATCH", "No es la persona del documento de identidad"),
            Map.entry("WATERMARK",        "Imagen/vídeo con marca de agua de otra plataforma"),
            Map.entry("THIRD_PARTIES",    "Contiene a terceras personas no identificadas"),
            Map.entry("CONTACT_INFO",     "Contiene texto, URLs o información de contacto"),
            Map.entry("INVALID_FORMAT",   "Formato incorrecto o archivo dañado"),
            Map.entry("OTHER",            "Otro (especificar)")
    );

    private static final Map<String, String> EN = Map.ofEntries(
            Map.entry("LIGHTING",         "Insufficient lighting (too dark)"),
            Map.entry("QUALITY",          "Low image/video quality (blurry, pixelated)"),
            Map.entry("EXPLICIT",         "Sexually explicit content (not allowed in profile)"),
            Map.entry("FACE_NOT_VISIBLE", "Face not visible or partially covered"),
            Map.entry("IDENTITY_MISMATCH", "Person does not match ID document"),
            Map.entry("WATERMARK",        "Image/video contains watermark from another platform"),
            Map.entry("THIRD_PARTIES",    "Contains other unidentified people"),
            Map.entry("CONTACT_INFO",     "Contains text, URLs, or contact information"),
            Map.entry("INVALID_FORMAT",   "Incorrect format or corrupted file"),
            Map.entry("OTHER",            "Other (please specify)")
    );

    /**
     * Devuelve la etiqueta traducida del motivo. Si el {@code reasonCode}
     * no está en el catálogo, devuelve el propio código como fallback
     * defensivo (visible en el email aunque sea menos amigable).
     */
    public String getLabel(String reasonCode, String locale) {
        if (reasonCode == null || reasonCode.isBlank()) {
            return "";
        }
        Map<String, String> map = mapFor(locale);
        String value = map.get(reasonCode);
        return value != null ? value : reasonCode;
    }

    /** Devuelve el mapa completo de etiquetas para el locale dado. */
    public Map<String, String> getAllReasons(String locale) {
        return mapFor(locale);
    }

    private static Map<String, String> mapFor(String locale) {
        return "es".equalsIgnoreCase(locale) ? ES : EN;
    }
}
