package com.sharemechat.service;

import com.sharemechat.entity.User;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
public class EmailLocaleResolver {

    public String resolve(User user) {
        return resolve(user != null ? user.getUiLocale() : null);
    }

    public String resolve(String rawLocale) {
        if (rawLocale == null || rawLocale.isBlank()) {
            return "en";
        }

        String normalized = rawLocale.trim().toLowerCase(Locale.ROOT)
                .replace('_', '-');

        int separator = normalized.indexOf('-');
        if (separator > 0) {
            normalized = normalized.substring(0, separator);
        }

        if ("es".equals(normalized) || "en".equals(normalized)) {
            return normalized;
        }

        return "en";
    }
}
