package com.sharemechat.service;

import com.sharemechat.exception.CountryBlockedException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CountryAccessService {

    @Value("${country.access.enabled:true}")
    private boolean enabled;

    @Value("${country.access.block-when-missing:false}")
    private boolean blockWhenMissing;

    @Value("${country.access.blocked-countries:}")
    private String blockedCountriesRaw;

    @Value("${country.access.blocked-message:Access to SharemeChat is not available from your location.}")
    private String blockedMessage;

    public void assertAllowed(HttpServletRequest request) {
        if (!enabled) {
            return;
        }

        String country = resolveViewerCountry(request);

        if (country == null) {
            if (blockWhenMissing) {
                throw new CountryBlockedException(blockedMessage);
            }
            return;
        }

        if (getBlockedCountries().contains(country)) {
            throw new CountryBlockedException(blockedMessage);
        }
    }

    public String resolveViewerCountry(HttpServletRequest request) {
        if (request == null) {
            return null;
        }

        String[] headers = new String[]{
                "CloudFront-Viewer-Country",
                "CF-IPCountry",
                "X-AppEngine-Country",
                "X-Country-Code"
        };

        for (String header : headers) {
            String value = request.getHeader(header);
            String normalized = normalizeCountry(value);
            if (normalized != null) {
                return normalized;
            }
        }

        return null;
    }

    private Set<String> getBlockedCountries() {
        if (blockedCountriesRaw == null || blockedCountriesRaw.isBlank()) {
            return Set.of();
        }

        return Arrays.stream(blockedCountriesRaw.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(s -> s.toUpperCase(Locale.ROOT))
                .filter(s -> s.length() == 2)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private String normalizeCountry(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (normalized.length() != 2) {
            return null;
        }

        return normalized;
    }
}