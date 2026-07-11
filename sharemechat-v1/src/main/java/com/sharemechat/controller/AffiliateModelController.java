package com.sharemechat.controller;

import com.sharemechat.dto.AffiliateActivateResponseDTO;
import com.sharemechat.dto.AffiliateDashboardDTO;
import com.sharemechat.dto.AffiliateStatsDTO;
import com.sharemechat.service.AffiliateCodeService;
import com.sharemechat.entity.User;
import com.sharemechat.repository.AffiliateClickEventRepository;
import com.sharemechat.repository.AffiliateCommissionRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.UserService;
import io.nayuki.qrcodegen.QrCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * ADR-049 Subpasada 2A: endpoints del panel de la modelo afiliada.
 *
 * <p>Tres endpoints:
 * <ul>
 *   <li>{@code POST /api/models/me/affiliate/activate} — genera (o devuelve
 *       idempotente) el codigo de afiliacion de la modelo actual.</li>
 *   <li>{@code GET /api/models/me/affiliate} — panel: code, active,
 *       urlCanonical, stats basicas.</li>
 *   <li>{@code GET /api/models/me/affiliate/qr.svg} — QR SVG de la
 *       urlCanonical, cachable 1 hora, ETag por codigo.</li>
 * </ul>
 *
 * <p>Guards de rol {@code hasRole('MODEL')} en {@code SecurityConfig}. El
 * guard de KYC APPROVED lo aplica {@link AffiliateCodeService} solo en
 * {@code activate}: {@code GET panel} y {@code GET qr.svg} son informativos
 * y no requieren APPROVED (una modelo con KYC caducado sigue viendo su
 * codigo si ya lo tenia).
 *
 * <p>Modelo suspendida (D8): {@code POST activate} devuelve 403; el resto
 * de endpoints funcionan con lectura normal.
 */
@RestController
@RequestMapping("/api/models/me/affiliate")
public class AffiliateModelController {

    private static final Logger log = LoggerFactory.getLogger(AffiliateModelController.class);

    /** Estados de comision que representan comision viva para el panel. */
    private static final List<String> LIVE_COMMISSION_STATUSES =
            List.of("ACCRUED", "PAYABLE", "PAID");

    private static final int QR_BORDER_MODULES = 2;
    private static final CacheControl QR_CACHE =
            CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic();

    private final AffiliateCodeService affiliateCodeService;
    private final UserService userService;
    private final UserRepository userRepository;
    private final AffiliateClickEventRepository clickEventRepository;
    private final AffiliateCommissionRepository commissionRepository;
    private final String publicBaseUrl;

    public AffiliateModelController(AffiliateCodeService affiliateCodeService,
                                    UserService userService,
                                    UserRepository userRepository,
                                    AffiliateClickEventRepository clickEventRepository,
                                    AffiliateCommissionRepository commissionRepository,
                                    @Value("${app.public.base-url}") String publicBaseUrl) {
        this.affiliateCodeService = affiliateCodeService;
        this.userService = userService;
        this.userRepository = userRepository;
        this.clickEventRepository = clickEventRepository;
        this.commissionRepository = commissionRepository;
        this.publicBaseUrl = stripTrailingSlash(publicBaseUrl);
    }

    // =====================================================
    // POST /activate
    // =====================================================

    @PostMapping("/activate")
    public ResponseEntity<?> activate(Authentication auth) {
        User user = resolveAuthenticatedUser(auth);
        if (user == null) return unauthorized();

        boolean alreadyHadCode = user.getReferralCodeOwner() != null;
        try {
            String code = affiliateCodeService.generateForModel(user.getId());
            // Si ya tenia codigo, activatedAt es una aproximacion via
            // user.updatedAt (no persistimos activatedAt en 2A; ver DTO javadoc).
            // Si acaba de generarse, es "ahora".
            LocalDateTime activatedAt = alreadyHadCode
                    ? Objects.firstNonNull(user.getUpdatedAt(), LocalDateTime.now())
                    : LocalDateTime.now();
            return ResponseEntity.ok(new AffiliateActivateResponseDTO(code, activatedAt, alreadyHadCode));
        } catch (IllegalStateException ex) {
            return mapServiceException(ex);
        }
    }

    // =====================================================
    // GET / (dashboard)
    // =====================================================

    @GetMapping("")
    public ResponseEntity<?> dashboard(Authentication auth) {
        User user = resolveAuthenticatedUser(auth);
        if (user == null) return unauthorized();

        String code = user.getReferralCodeOwner();
        boolean active = code != null;
        String url = active ? buildCanonicalUrl(code) : null;

        AffiliateStatsDTO stats = computeStats(user.getId());

        return ResponseEntity.ok(new AffiliateDashboardDTO(code, active, url, stats));
    }

    // =====================================================
    // GET /qr.svg
    // =====================================================

    @GetMapping("/qr.svg")
    public ResponseEntity<?> qrSvg(Authentication auth) {
        User user = resolveAuthenticatedUser(auth);
        if (user == null) return unauthorized();

        String code = user.getReferralCodeOwner();
        if (code == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", "code_not_activated",
                    "message", "La modelo aun no ha activado el programa de afiliadas."
            ));
        }

        String url = buildCanonicalUrl(code);
        String svg;
        try {
            QrCode qr = QrCode.encodeText(url, QrCode.Ecc.MEDIUM);
            svg = renderQrToSvg(qr, QR_BORDER_MODULES);
        } catch (Exception ex) {
            log.error("[AFFILIATE-QR] failed to encode QR for userId={} url_len={}",
                    user.getId(), url.length(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "qr_generation_failed"
            ));
        }

        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("image/svg+xml"))
                .eTag("\"" + code + "\"")
                .cacheControl(QR_CACHE)
                .body(svg);
    }

    // =====================================================
    // Helpers
    // =====================================================

    private User resolveAuthenticatedUser(Authentication auth) {
        if (auth == null || auth.getName() == null) return null;
        return userService.findByEmail(auth.getName());
    }

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "error", "unauthenticated"
        ));
    }

    private AffiliateStatsDTO computeStats(Long modelUserId) {
        long clicksTotal = clickEventRepository.countByModelUserIdAndEventType(modelUserId, "CLICK");
        long clicksUnique = clickEventRepository.countUniqueVisitorsForModel(modelUserId);
        long clientsReferred = userRepository.countByReferredByUserId(modelUserId);
        long commissionAccruedCents = commissionRepository.sumCommissionAmountByReferrerInStatuses(
                modelUserId, LIVE_COMMISSION_STATUSES);
        return new AffiliateStatsDTO(clicksTotal, clicksUnique, clientsReferred, commissionAccruedCents);
    }

    private String buildCanonicalUrl(String code) {
        return publicBaseUrl + "/i?ref=" + code;
    }

    private static String stripTrailingSlash(String s) {
        if (s == null) return "";
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    /**
     * Renderer SVG minimo sobre {@link QrCode#getModule(int, int)}. Nayuki
     * 1.8.0 en Maven Central no publica un helper para SVG (a diferencia
     * de otras distribuciones del codigo). Emitimos:
     *  - fondo blanco cubriendo todo el area (border incluido);
     *  - un unico {@code <path>} con la union de los modulos negros como
     *    subpaths {@code M x y h1 v1 h-1 z} (evita imprimir un {@code <rect>}
     *    por modulo — SVG mas pequeno y mas rapido de parsear).
     * ViewBox proporcional al tamano del codigo + 2 * border.
     */
    static String renderQrToSvg(QrCode qr, int border) {
        if (border < 0) border = 0;
        int size = qr.size + border * 2;
        StringBuilder path = new StringBuilder();
        for (int y = 0; y < qr.size; y++) {
            for (int x = 0; x < qr.size; x++) {
                if (qr.getModule(x, y)) {
                    if (path.length() > 0) path.append(' ');
                    path.append("M").append(x + border).append(',').append(y + border)
                            .append("h1v1h-1z");
                }
            }
        }
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\" "
                + "viewBox=\"0 0 " + size + " " + size + "\" "
                + "stroke=\"none\" shape-rendering=\"crispEdges\">"
                + "<rect width=\"100%\" height=\"100%\" fill=\"#FFFFFF\"/>"
                + "<path d=\"" + path + "\" fill=\"#000000\"/>"
                + "</svg>";
    }

    /**
     * Mapea excepciones del service a respuestas HTTP con body accionable.
     * Ver mensajes en {@link AffiliateCodeService}.
     */
    private ResponseEntity<?> mapServiceException(IllegalStateException ex) {
        String msg = ex.getMessage() == null ? "" : ex.getMessage();
        if (AffiliateCodeService.ERR_ROLE_REQUIRED.equals(msg)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "role_required",
                    "message", "Solo modelos pueden activar el programa de afiliadas."
            ));
        }
        if (msg.startsWith(AffiliateCodeService.ERR_KYC_REQUIRED_PREFIX)) {
            String status = msg.substring(AffiliateCodeService.ERR_KYC_REQUIRED_PREFIX.length());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "kyc_required",
                    "current_status", status,
                    "message", "KYC no aprobado. Estado actual: " + status
                            + ". Completa la verificacion desde el panel de perfil para activar el programa de afiliadas."
            ));
        }
        if (AffiliateCodeService.ERR_ACCOUNT_SUSPENDED.equals(msg)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "account_suspended",
                    "message", "Tu cuenta esta suspendida. No puedes activar el programa de afiliadas hasta que se restaure."
            ));
        }
        if (AffiliateCodeService.ERR_CODE_EXHAUSTED.equals(msg)) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "error", "code_generation_exhausted",
                    "message", "No se pudo generar un codigo unico. Intentalo de nuevo mas tarde."
            ));
        }
        if (AffiliateCodeService.ERR_USER_NOT_FOUND.equals(msg)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", "user_not_found"
            ));
        }
        log.warn("[AFFILIATE-CTRL] unmapped service exception message={}", msg);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "error", "internal_error"
        ));
    }

    /** Util local para evitar import extra de commons-lang3 solo para esto. */
    private static final class Objects {
        static <T> T firstNonNull(T a, T b) {
            return a != null ? a : b;
        }
    }
}
