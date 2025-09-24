package com.sharemechat.service;

import com.sharemechat.consent.HmacSigner;
import com.sharemechat.consent.IpPrivacyUtil;
import com.sharemechat.entity.ConsentEvent;
import com.sharemechat.repository.ConsentEventRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ConsentService {

    private final ConsentEventRepository repository;
    private final HmacSigner hmacSigner;

    @Value("${terms.version:v1}")
    private String currentTermsVersion;

    public ConsentService(ConsentEventRepository repository, HmacSigner hmacSigner) {
        this.repository = repository;
        this.hmacSigner = hmacSigner;
    }

    public void recordAgeGate(HttpServletRequest request, String consentId, String path) {
        ConsentEvent e = baseFrom(request, consentId, path);
        e.setEventType("age_gate_accept");
        e.setVersion(null);

        String sig = sign(e);
        e.setSig(sig);
        repository.save(e);
    }

    public void recordTerms(HttpServletRequest request, String consentId, String path, String version) {
        ConsentEvent e = baseFrom(request, consentId, path);
        e.setEventType("terms_accept");
        e.setVersion(StringUtils.hasText(version) ? version : currentTermsVersion);

        String sig = sign(e);
        e.setSig(sig);
        repository.save(e);
    }

    private ConsentEvent baseFrom(HttpServletRequest request, String consentId, String path) {
        ConsentEvent e = new ConsentEvent();
        e.setConsentId(StringUtils.hasText(consentId) ? consentId : "unknown");
        e.setUserAgent(IpPrivacyUtil.userAgent(request));
        e.setIpHint(IpPrivacyUtil.ipHint(request));
        e.setPath(StringUtils.hasText(path) ? path : request.getRequestURI());
        e.setTs(Instant.now());
        return e;
    }

    private String sign(ConsentEvent e) {
        // Canonicalización estable (sin ts)
        Map<String, String> canonical = new LinkedHashMap<>();
        canonical.put("eventType", n(e.getEventType()));
        canonical.put("version",   n(e.getVersion()));
        canonical.put("consentId", n(e.getConsentId()));
        canonical.put("ipHint",    n(e.getIpHint()));
        canonical.put("path",      n(e.getPath()));
        canonical.put("userAgent", n(e.getUserAgent()));
        return hmacSigner.sign(canonical);
    }

    private static String n(String s) { return (s == null) ? "" : s; }
}
