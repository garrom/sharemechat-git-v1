package com.sharemechat.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * ADR-049 D15 + update D-24: hashing de IP y User-Agent para persistir
 * en {@code affiliate_click_events} sin PII.
 *
 * <p>Algoritmo: SHA-256 de {@code salt + valor_plain}, salida hex,
 * truncada a los primeros <b>16 caracteres</b> (64 bits). Suficiente para
 * agregacion anti-abuso ("¿esta misma IP genero 50 clicks en 1 hora?")
 * sin permitir reversibilidad practica al valor original.
 *
 * <p>La salt se lee de la property {@code affiliate.hash-salt} (alias de
 * {@code authrisk.email-hash-salt}) para minimizar superficie de secretos.
 * Si la salt esta vacia el servicio deshabilita el hashing y devuelve
 * NULL, coherente con el schema NULL-permisivo de {@code ip_hash}/{@code ua_hash}.
 */
@Service
public class AffiliateHashService {

    private static final int TRUNCATE_HEX_CHARS = 16;
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private final String salt;

    public AffiliateHashService(@Value("${affiliate.hash-salt:}") String salt) {
        this.salt = salt == null ? "" : salt;
    }

    /**
     * Devuelve el hash 16-hex del valor (o NULL si el valor es null/blank
     * o si la salt no esta configurada). Nunca lanza excepcion: fallo
     * silencioso a NULL para no romper el pipeline por un input raro.
     */
    public String hashTruncated(String plainValue) {
        if (plainValue == null || plainValue.isBlank() || salt.isBlank()) {
            return null;
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(salt.getBytes(StandardCharsets.UTF_8));
            byte[] digest = md.digest(plainValue.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(TRUNCATE_HEX_CHARS);
            for (int i = 0; i < TRUNCATE_HEX_CHARS / 2 && i < digest.length; i++) {
                int b = digest[i] & 0xff;
                sb.append(HEX[b >>> 4]).append(HEX[b & 0x0f]);
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            return null;
        }
    }
}
