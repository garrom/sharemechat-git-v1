package com.sharemechat.controller;

import com.sharemechat.config.IpConfig;
import com.sharemechat.constants.Constants;
import com.sharemechat.entity.AffiliateClickEvent;
import com.sharemechat.entity.User;
import com.sharemechat.repository.AffiliateClickEventRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.AffiliateHashService;
import com.sharemechat.service.AffiliateLinkTokenService;
import com.sharemechat.service.ApiRateLimitService;
import com.sharemechat.service.EmailCopyRenderer;
import com.sharemechat.service.EmailMessage;
import com.sharemechat.service.EmailService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

/**
 * ADR-049 Subpasada 2B: endpoints publicos del programa de afiliadas.
 *
 * <ul>
 *   <li>{@code POST /api/public/affiliate/click} — la landing publica
 *       registra la visita con {@code ?ref=<code>}, setea cookie 90 dias.</li>
 *   <li>{@code POST /api/public/affiliate/magic-link} — el visitante deja
 *       email opcional para preservar la atribucion cross-device (D12).</li>
 *   <li>{@code GET /api/public/affiliate/link/consume} — consume magic
 *       link + set cookie + redirect a landing product.</li>
 * </ul>
 *
 * <p>Sin autenticacion (endpoints publicos). Rate limit del magic link en
 * {@link ApiRateLimitService#checkAffiliateMagicLinkIp}.
 */
@RestController
@RequestMapping("/api/public/affiliate")
public class AffiliatePublicController {

    private static final Logger log = LoggerFactory.getLogger(AffiliatePublicController.class);

    private final UserRepository userRepository;
    private final AffiliateClickEventRepository clickEventRepository;
    private final AffiliateLinkTokenService linkTokenService;
    private final AffiliateHashService hashService;
    private final EmailService emailService;
    private final EmailCopyRenderer emailCopyRenderer;
    private final ApiRateLimitService rateLimitService;

    private final String cookieName;
    private final int cookieTtlDays;
    private final int magicLinkTtlHours;
    private final String landingBaseUrl;

    public AffiliatePublicController(UserRepository userRepository,
                                     AffiliateClickEventRepository clickEventRepository,
                                     AffiliateLinkTokenService linkTokenService,
                                     AffiliateHashService hashService,
                                     EmailService emailService,
                                     EmailCopyRenderer emailCopyRenderer,
                                     ApiRateLimitService rateLimitService,
                                     @Value("${affiliate.cookie.name:sharemechat_affiliate_ref}") String cookieName,
                                     @Value("${affiliate.cookie.ttl-days:90}") int cookieTtlDays,
                                     @Value("${affiliate.magic-link.ttl-hours:72}") int magicLinkTtlHours,
                                     @Value("${affiliate.landing.base-url:https://test.sharemechat.com}") String landingBaseUrl) {
        this.userRepository = userRepository;
        this.clickEventRepository = clickEventRepository;
        this.linkTokenService = linkTokenService;
        this.hashService = hashService;
        this.emailService = emailService;
        this.emailCopyRenderer = emailCopyRenderer;
        this.rateLimitService = rateLimitService;
        this.cookieName = cookieName;
        this.cookieTtlDays = cookieTtlDays;
        this.magicLinkTtlHours = magicLinkTtlHours;
        this.landingBaseUrl = stripTrailingSlash(landingBaseUrl);
    }

    // =========================================================
    // POST /click
    // =========================================================

    @PostMapping("/click")
    public ResponseEntity<Void> click(@Valid @RequestBody ClickRequest body,
                                       HttpServletRequest request,
                                       HttpServletResponse response) {
        String normalized = body.code().trim().toUpperCase();
        Optional<User> modelOpt = resolveActiveModelByCode(normalized);
        if (modelOpt.isEmpty()) {
            // D15: silencioso. 204 sin cookie ni evento. La UX no se rompe si
            // alguien llega con URL invalida (bot, typo, code retirado).
            log.info("[AFFILIATE-CLICK] silent_skip code_invalid_or_inactive code_len={}", normalized.length());
            return ResponseEntity.noContent().build();
        }
        User model = modelOpt.get();

        Cookie cookie = buildRefCookie(normalized, request);
        response.addCookie(cookie);

        AffiliateClickEvent evt = new AffiliateClickEvent();
        evt.setModelUserId(model.getId());
        evt.setEventType("CLICK");
        evt.setIpHash(hashService.hashTruncated(IpConfig.getClientIp(request)));
        evt.setUaHash(hashService.hashTruncated(request.getHeader("User-Agent")));
        clickEventRepository.save(evt);
        log.info("[AFFILIATE-CLICK] recorded modelUserId={} eventId={}", model.getId(), evt.getId());

        return ResponseEntity.noContent().build();
    }

    // =========================================================
    // POST /magic-link
    // =========================================================

    @PostMapping("/magic-link")
    public ResponseEntity<Void> magicLink(@Valid @RequestBody MagicLinkRequest body,
                                          HttpServletRequest request) {
        rateLimitService.checkAffiliateMagicLinkIp(IpConfig.getClientIp(request));

        String normalized = body.code().trim().toUpperCase();
        Optional<User> modelOpt = resolveActiveModelByCode(normalized);
        if (modelOpt.isEmpty()) {
            log.info("[AFFILIATE-MAGIC-LINK] silent_skip code_invalid_or_inactive");
            return ResponseEntity.noContent().build();
        }
        User model = modelOpt.get();
        String email = body.email().trim().toLowerCase();

        String tokenPlain = linkTokenService.generate(model.getId(), email);
        String consumeUrl = landingBaseUrl + "/api/public/affiliate/link/consume?token="
                + URLEncoder.encode(tokenPlain, StandardCharsets.UTF_8);

        try {
            EmailCopyRenderer.EmailContent content = emailCopyRenderer.renderReferralMagicLink(
                    email, normalized, consumeUrl, magicLinkTtlHours, resolveLocale(request));
            EmailMessage msg = new EmailMessage(
                    email,
                    content.subject(),
                    content.body(),
                    EmailMessage.Category.REFERRAL_MAGIC_LINK,
                    EmailMessage.Priority.CRITICAL
            );
            emailService.send(msg);
        } catch (Exception ex) {
            log.error("[AFFILIATE-MAGIC-LINK] email_send_failed modelUserId={}", model.getId(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }

        AffiliateClickEvent evt = new AffiliateClickEvent();
        evt.setModelUserId(model.getId());
        evt.setEventType("EMAIL_SUBMITTED");
        evt.setIpHash(hashService.hashTruncated(IpConfig.getClientIp(request)));
        evt.setUaHash(hashService.hashTruncated(request.getHeader("User-Agent")));
        clickEventRepository.save(evt);
        log.info("[AFFILIATE-MAGIC-LINK] sent modelUserId={} eventId={}", model.getId(), evt.getId());

        return ResponseEntity.noContent().build();
    }

    // =========================================================
    // GET /link/consume
    // =========================================================

    @GetMapping("/link/consume")
    public ResponseEntity<Void> consume(@RequestParam("token") String tokenPlain,
                                         HttpServletRequest request,
                                         HttpServletResponse response) {
        AffiliateLinkTokenService.ConsumeResult result;
        try {
            result = linkTokenService.consume(tokenPlain);
        } catch (IllegalStateException ex) {
            String msg = ex.getMessage() == null ? "" : ex.getMessage();
            HttpStatus status = AffiliateLinkTokenService.ERR_TOKEN_NOT_FOUND.equals(msg)
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.GONE;
            log.info("[AFFILIATE-CONSUME] token_reject reason={}", msg);
            return ResponseEntity.status(status).build();
        }
        Optional<User> modelOpt = userRepository.findById(result.modelUserId());
        if (modelOpt.isEmpty() || modelOpt.get().getReferralCodeOwner() == null) {
            log.warn("[AFFILIATE-CONSUME] model_gone modelUserId={}", result.modelUserId());
            return ResponseEntity.status(HttpStatus.GONE).build();
        }
        User model = modelOpt.get();
        String code = model.getReferralCodeOwner();

        response.addCookie(buildRefCookie(code, request));

        AffiliateClickEvent evt = new AffiliateClickEvent();
        evt.setModelUserId(model.getId());
        evt.setEventType("LINK_CONSUMED");
        evt.setIpHash(hashService.hashTruncated(IpConfig.getClientIp(request)));
        evt.setUaHash(hashService.hashTruncated(request.getHeader("User-Agent")));
        clickEventRepository.save(evt);

        String redirectUrl = landingBaseUrl + "/register/client?ref="
                + URLEncoder.encode(code, StandardCharsets.UTF_8)
                + "&email_verified=true";
        log.info("[AFFILIATE-CONSUME] redirect modelUserId={} eventId={}", model.getId(), evt.getId());
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(redirectUrl)).build();
    }

    // =========================================================
    // Helpers
    // =========================================================

    private Optional<User> resolveActiveModelByCode(String code) {
        Optional<User> opt = userRepository.findByReferralCodeOwner(code);
        if (opt.isEmpty()) return Optional.empty();
        User u = opt.get();
        if (!Constants.Roles.MODEL.equals(u.getRole())) return Optional.empty();
        if (!Constants.VerificationStatuses.APPROVED.equals(u.getVerificationStatus())) return Optional.empty();
        if (Constants.AccountStatuses.SUSPENDED.equals(u.getAccountStatus())) return Optional.empty();
        return Optional.of(u);
    }

    private Cookie buildRefCookie(String code, HttpServletRequest request) {
        Cookie cookie = new Cookie(cookieName, code);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge((int) java.time.Duration.ofDays(cookieTtlDays).getSeconds());
        // Secure siempre que la request original haya llegado por HTTPS (o
        // por CDN con X-Forwarded-Proto=https). En entornos locales http:
        // la cookie va sin Secure; en TEST/AUDIT/PROD detras de CloudFront
        // va Secure.
        boolean secure = "https".equalsIgnoreCase(request.getScheme())
                || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));
        cookie.setSecure(secure);
        cookie.setAttribute("SameSite", "Lax");
        return cookie;
    }

    private String resolveLocale(HttpServletRequest request) {
        String header = request.getHeader("Accept-Language");
        if (header == null) return "en";
        return header.toLowerCase().startsWith("es") ? "es" : "en";
    }

    private static String stripTrailingSlash(String s) {
        if (s == null) return "";
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    // =========================================================
    // Request DTOs
    // =========================================================

    public record ClickRequest(
            @NotBlank
            @Pattern(regexp = "^[0-9A-HJKMNPQRSTVWXYZ]{12}$")
            String code) { }

    public record MagicLinkRequest(
            @NotBlank
            @Pattern(regexp = "^[0-9A-HJKMNPQRSTVWXYZ]{12}$")
            String code,
            @NotBlank
            @Email
            String email) { }
}
