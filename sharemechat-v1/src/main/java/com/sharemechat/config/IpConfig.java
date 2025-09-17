package com.sharemechat.config;

import jakarta.servlet.http.HttpServletRequest;

public class IpConfig {

    public static String getClientIp(HttpServletRequest request) {
        // Orden típico de cabeceras cuando hay proxy/reverse proxy
        String[] headers = new String[]{
                "X-Forwarded-For",
                "X-Real-IP",
                "CF-Connecting-IP",     // Cloudflare (por si acaso)
                "True-Client-IP"        // Akamai/otros CDNs
        };

        for (String h : headers) {
            String ipList = request.getHeader(h);
            if (ipList != null && !ipList.isBlank() && !"unknown".equalsIgnoreCase(ipList)) {
                // X-Forwarded-For puede traer varias IPs: client, proxy1, proxy2...
                // nos quedamos con la primera no vacía.
                String ip = ipList.split(",")[0].trim();
                if (!ip.isBlank()) return ip;
            }
        }

        // Fallback
        return request.getRemoteAddr();
    }
}
