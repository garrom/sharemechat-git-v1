package com.sharemechat.consent;

import jakarta.servlet.http.HttpServletRequest;

import java.net.InetAddress;
import java.net.UnknownHostException;

public final class IpPrivacyUtil {

    private IpPrivacyUtil() {}

    public static String userAgent(HttpServletRequest request) {
        String ua = request.getHeader("User-Agent");
        return ua != null ? trim(ua, 255) : null;
    }

    /**
     * Devuelve una pista de IP que no es PII completa:
     * - IPv4: trunca a /24 (ej: 203.0.113.42 -> 203.0.113.0/24)
     * - IPv6: trunca a /48 (primeros 4 hextets)
     * - Si falla, "unknown"
     */
    public static String ipHint(HttpServletRequest request) {
        String ip = extractClientIp(request);
        if (ip == null) return "unknown";
        try {
            InetAddress addr = InetAddress.getByName(ip);
            byte[] bytes = addr.getAddress();
            if (bytes.length == 4) { // IPv4
                return maskIpv4(bytes);
            } else if (bytes.length == 16) { // IPv6
                return maskIpv6(bytes);
            } else {
                return "unknown";
            }
        } catch (UnknownHostException e) {
            return "unknown";
        }
    }

    // Respeta X-Forwarded-For si viene desde Nginx/ALB
    private static String extractClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            // Usa el primer IP de la lista
            String first = xff.split(",")[0].trim();
            if (!first.isBlank()) return first;
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) return realIp.trim();
        return request.getRemoteAddr();
    }

    private static String maskIpv4(byte[] b) {
        // /24: deja los 3 primeros octetos, pone el último a 0
        return String.format("%d.%d.%d.0/24",
                (b[0] & 0xff), (b[1] & 0xff), (b[2] & 0xff));
    }

    private static String maskIpv6(byte[] b) {
        // /48: primeros 4 hextets
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            int hextet = ((b[i * 2] & 0xff) << 8) | (b[i * 2 + 1] & 0xff);
            if (i > 0) sb.append(':');
            sb.append(Integer.toHexString(hextet));
            if (i == 3) {
                sb.append("::/48");
                break;
            }
        }
        return sb.toString();
    }

    private static String trim(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }
}
