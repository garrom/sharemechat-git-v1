package com.sharemechat.service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

public record AuthRiskContext(
        String ip,
        String uaHash,
        String emailHash,
        Long userId,
        String channel,
        String env
) {

    public static AuthRiskContext of(
            String ip,
            String userAgent,
            String email,
            Long userId,
            String channel,
            String env,
            String secret
    ) {
        String safeIp = (ip == null || ip.isBlank()) ? "-" : ip;
        String safeChannel = (channel == null || channel.isBlank()) ? "-" : channel;
        String safeEnv = (env == null || env.isBlank()) ? "-" : env;

        String emailHash = "-";
        if (email != null && !email.isBlank() && secret != null && !secret.isBlank()) {
            String normalized = email.trim().toLowerCase();
            emailHash = hmacHex(secret, normalized, 16);
        }

        String uaHash = "-";
        if (userAgent != null && !userAgent.isBlank()) {
            uaHash = sha256Hex(userAgent, 8);
        }

        return new AuthRiskContext(safeIp, uaHash, emailHash, userId, safeChannel, safeEnv);
    }

    public AuthRiskContext withUserId(Long userId) {
        return new AuthRiskContext(this.ip, this.uaHash, this.emailHash, userId, this.channel, this.env);
    }

    private static String hmacHex(String secret, String message, int hexChars) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] out = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            String hex = HexFormat.of().formatHex(out);
            return hex.length() <= hexChars ? hex : hex.substring(0, hexChars);
        } catch (Exception e) {
            return "-";
        }
    }

    private static String sha256Hex(String input, int hexChars) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] out = md.digest(input.getBytes(StandardCharsets.UTF_8));
            String hex = HexFormat.of().formatHex(out);
            return hex.length() <= hexChars ? hex : hex.substring(0, hexChars);
        } catch (Exception e) {
            return "-";
        }
    }
}
