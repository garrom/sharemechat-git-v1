package com.sharemechat.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Component
public class StorageUrlCodec {

    @Value("${app.storage.proxy.path:/api/storage/content}")
    private String proxyPath;

    public String buildManagedUrl(String storageKey) {
        String encodedRef = encodeKey(storageKey);
        return proxyPath + "?ref=" + URLEncoder.encode(encodedRef, StandardCharsets.UTF_8);
    }

    public String extractKeyFromManagedUrl(String publicUrl) {
        if (!StringUtils.hasText(publicUrl)) return null;

        URI uri;
        try {
            uri = URI.create(publicUrl);
        } catch (IllegalArgumentException ex) {
            return null;
        }

        String path = uri.getPath();
        if (!proxyPath.equals(path)) {
            return null;
        }

        String query = uri.getRawQuery();
        if (!StringUtils.hasText(query)) return null;

        for (String part : query.split("&")) {
            int idx = part.indexOf('=');
            if (idx <= 0) continue;
            String key = part.substring(0, idx);
            if (!"ref".equals(key)) continue;
            String value = part.substring(idx + 1);
            if (!StringUtils.hasText(value)) return null;
            return decodeKey(URLDecoder.decode(value, StandardCharsets.UTF_8));
        }

        return null;
    }

    public String encodeKey(String storageKey) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(storageKey.getBytes(StandardCharsets.UTF_8));
    }

    public String decodeKey(String encoded) {
        try {
            byte[] data = Base64.getUrlDecoder().decode(encoded);
            return new String(data, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
