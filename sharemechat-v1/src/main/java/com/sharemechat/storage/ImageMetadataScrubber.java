package com.sharemechat.storage;

import org.apache.commons.imaging.formats.jpeg.exif.ExifRewriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayOutputStream;
import java.util.Set;

/**
 * Elimina metadatos sensibles (EXIF/GPS) de las imágenes que suben los usuarios
 * antes de persistirlas. Objetivo: evitar el doxxing de ubicación a partir de las
 * fotos personales (el GPS viaja en el bloque EXIF del JPEG de cámara/móvil).
 *
 * <p>Diseño deliberado:
 * <ul>
 *   <li><b>JPEG</b>: eliminación <b>LOSSLESS</b> del bloque EXIF completo
 *       ({@link ExifRewriter#removeExifMetadata}) — no recodifica la imagen, así que
 *       no hay pérdida de calidad (seguro también para documentos KYC).</li>
 *   <li><b>PNG / WEBP / GIF</b>: hoy NO se limpian. El JPEG cubre ~99% del riesgo real
 *       de GPS (fotos de móvil); PNG/GIF casi nunca llevan geolocalización y el EXIF en
 *       WEBP es minoritario. Gap documentado; se puede ampliar sin cambiar los llamantes.</li>
 *   <li><b>Fail-safe</b>: si el strip falla por cualquier motivo (fichero corrupto, caso
 *       raro), se devuelve el original y se registra en logs — no se bloquea la subida.</li>
 * </ul>
 *
 * <p>Nota: elimina EXIF; no cubre XMP (donde el GPS es muy raro). Ampliable si se detecta.
 */
public final class ImageMetadataScrubber {

    private static final Logger log = LoggerFactory.getLogger(ImageMetadataScrubber.class);
    private static final Set<String> JPEG_EXT = Set.of("jpg", "jpeg");

    private ImageMetadataScrubber() {
    }

    /**
     * @return true si el ext corresponde a una imagen que este scrubber intenta limpiar.
     *         Los llamantes usan esto para decidir si bufferizan+limpian o siguen streaming.
     */
    public static boolean handles(String ext) {
        return ext != null && JPEG_EXT.contains(ext.toLowerCase());
    }

    /**
     * Devuelve los bytes de la imagen sin metadatos EXIF. Si el tipo no aplica o el
     * strip falla, devuelve los bytes originales (fail-open a favor de no romper la subida).
     */
    public static byte[] scrub(byte[] original, String ext) {
        if (original == null || original.length == 0 || !handles(ext)) {
            return original;
        }
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream(original.length);
            new ExifRewriter().removeExifMetadata(original, out);
            byte[] scrubbed = out.toByteArray();
            if (scrubbed.length == 0) {
                log.warn("[EXIF-SCRUB] resultado vacío; se conserva el original (ext={})", ext);
                return original;
            }
            return scrubbed;
        } catch (Exception ex) {
            log.warn("[EXIF-SCRUB] no se pudo quitar EXIF ({}); se conserva el original (ext={})",
                    ex.getClass().getSimpleName(), ext);
            return original;
        }
    }
}
