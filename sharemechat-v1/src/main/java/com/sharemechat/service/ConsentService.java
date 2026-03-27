package com.sharemechat.service;

import com.sharemechat.consent.HmacSigner;
import com.sharemechat.consent.IpPrivacyUtil;
import com.sharemechat.entity.ConsentEvent;
import com.sharemechat.repository.ConsentEventRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ConsentService {

    private static final Logger log = LoggerFactory.getLogger(ConsentService.class);

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
        e.setUserId(null);
        e.setSig(sign(e));

        repository.insertIdempotent(
                e.getEventType(),
                e.getVersion(),
                e.getConsentId(),
                e.getUserId(),
                e.getUserAgent(),
                e.getIpHint(),
                e.getPath(),
                e.getSig()
        );
    }

    public void recordTerms(HttpServletRequest request, String consentId, String path, String version) {
        ConsentEvent e = baseFrom(request, consentId, path);
        e.setEventType("terms_accept");
        e.setVersion(StringUtils.hasText(version) ? version : currentTermsVersion);
        e.setUserId(null);
        e.setSig(sign(e));

        repository.insertIdempotent(
                e.getEventType(),
                e.getVersion(),
                e.getConsentId(),
                e.getUserId(),
                e.getUserAgent(),
                e.getIpHint(),
                e.getPath(),
                e.getSig()
        );
    }

    public boolean hasGuestAgeGate(String consentId) {
        if (!StringUtils.hasText(consentId)) {
            return false;
        }
        return repository.existsByConsentIdAndEventType(clamp(consentId, 64), "age_gate_accept");
    }

    public void recordGuestConsentLink(HttpServletRequest request, String consentId, Long userId, String eventType, String path) {
        if (!StringUtils.hasText(consentId) || userId == null) {
            return;
        }

        ConsentEvent e = baseFrom(request, consentId, path);
        e.setEventType(clamp(eventType, 32));
        e.setVersion(null);
        e.setUserId(userId);
        e.setSig(sign(e));

        repository.insertIdempotent(
                e.getEventType(),
                e.getVersion(),
                e.getConsentId(),
                e.getUserId(),
                e.getUserAgent(),
                e.getIpHint(),
                e.getPath(),
                e.getSig()
        );

        log.info("AGE_GATE_LINK eventType={} consentId={} userId={}", e.getEventType(), e.getConsentId(), userId);
    }

    private ConsentEvent baseFrom(HttpServletRequest request, String consentId, String path) {
        ConsentEvent e = new ConsentEvent();
        e.setConsentId(StringUtils.hasText(consentId) ? clamp(consentId, 64) : "unknown");
        e.setUserAgent(clamp(IpPrivacyUtil.userAgent(request), 512));
        e.setIpHint(clamp(IpPrivacyUtil.ipHint(request), 64));
        e.setPath(clamp(path, 1024));
        e.setTs(Instant.now());
        return e;
    }

    private static String clamp(String s, int max) {
        if (s == null) return null;
        s = s.trim();
        if (s.length() <= max) return s;
        return s.substring(0, max);
    }


    private String sign(ConsentEvent e) {
        // Canonicalización estable (sin ts)
        Map<String, String> canonical = new LinkedHashMap<>();
        canonical.put("eventType", n(e.getEventType()));
        canonical.put("version",   n(e.getVersion()));
        canonical.put("consentId", n(e.getConsentId()));
        canonical.put("userId",    e.getUserId() == null ? "" : String.valueOf(e.getUserId()));
        canonical.put("ipHint",    n(e.getIpHint()));
        canonical.put("path",      n(e.getPath()));
        canonical.put("userAgent", n(e.getUserAgent()));
        return hmacSigner.sign(canonical);
    }

    private static String n(String s) { return (s == null) ? "" : s; }
}
