package com.sharemechat.consent;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.StringJoiner;

@Component
public class HmacSigner {

    private final byte[] secret;

    public HmacSigner(@Value("${consent.hmacSecret}") String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("consent.hmacSecret is required");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    /**
     * Firma un mapa ordenado de campos canónicos con HMAC-SHA256.
     * Formato: key1=value1|key2=value2|...
     */
    public String sign(Map<String, String> canonicalFields) {
        StringJoiner sj = new StringJoiner("|");
        canonicalFields.forEach((k, v) -> sj.add(k + "=" + (v == null ? "" : v)));
        byte[] data = sj.toString().getBytes(StandardCharsets.UTF_8);
        byte[] mac = hmacSha256(secret, data);
        return toHex(mac);
    }

    private static byte[] hmacSha256(byte[] key, byte[] data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data);
        } catch (Exception e) {
            throw new RuntimeException("HMAC error", e);
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
