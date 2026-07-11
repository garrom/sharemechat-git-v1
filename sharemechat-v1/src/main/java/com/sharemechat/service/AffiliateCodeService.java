package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;

/**
 * ADR-049 Subpasada 2A: generacion del codigo de afiliacion de la modelo.
 *
 * <p>Charset: Crockford Base32 sin ambiguos (32 chars, excluye
 * <b>I, L, O, U</b>). Longitud fija por property {@code affiliate.code.length}
 * (default 12). Espacio = 32^12 = 1.15 * 10^18 combinaciones; colision con
 * 10^5 codigos vivos ~ 10^-13.
 *
 * <p>Guards de {@link #generateForModel(Long)}:
 * <ul>
 *   <li>rol {@code MODEL} — si no, {@link IllegalStateException} con
 *       mensaje {@code role_required}.</li>
 *   <li>{@code verificationStatus = APPROVED} — si no,
 *       {@link IllegalStateException} con mensaje
 *       {@code kyc_required:<status_actual>} para que el controller
 *       pueda componer respuesta accionable con el estado.</li>
 *   <li>{@code accountStatus != SUSPENDED} — si SUSPENDED,
 *       {@link IllegalStateException} con mensaje
 *       {@code account_suspended}. La lectura del panel sigue
 *       permitida; solo se bloquea la generacion de codigo nuevo (D8).</li>
 * </ul>
 *
 * <p>Idempotencia: si {@code user.referralCodeOwner != null} se devuelve
 * el codigo existente sin regenerar.
 *
 * <p>Reintentos por colision: {@value #MAX_RETRIES}. Si se agotan, log
 * ERROR (senal de bug o exhaustion real) y {@link IllegalStateException}
 * con mensaje {@code code_generation_exhausted}.
 */
@Service
public class AffiliateCodeService {

    private static final Logger log = LoggerFactory.getLogger(AffiliateCodeService.class);

    /**
     * Alfabeto Crockford Base32 sin ambiguos (excluye I, L, O, U).
     * 32 caracteres exactos: 10 digitos + 22 letras.
     */
    static final String CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    static final int MAX_RETRIES = 5;

    public static final String ERR_ROLE_REQUIRED = "role_required";
    public static final String ERR_KYC_REQUIRED_PREFIX = "kyc_required:";
    public static final String ERR_ACCOUNT_SUSPENDED = "account_suspended";
    public static final String ERR_CODE_EXHAUSTED = "code_generation_exhausted";
    public static final String ERR_USER_NOT_FOUND = "user_not_found";

    private final UserRepository userRepository;
    private final SecureRandom secureRandom;
    private final int codeLength;
    private final int charsetSize;

    public AffiliateCodeService(UserRepository userRepository,
                                @Value("${affiliate.code.length:12}") int codeLength) {
        this.userRepository = userRepository;
        this.secureRandom = new SecureRandom();
        this.codeLength = codeLength;
        this.charsetSize = CROCKFORD_BASE32.length();
        // Sanity: si algun despistado cambia CROCKFORD_BASE32 y rompe el tamaño 32,
        // fallamos temprano en el arranque via este init para no envenenar codigos.
        if (charsetSize != 32) {
            throw new IllegalStateException(
                    "CROCKFORD_BASE32 debe tener exactamente 32 caracteres (encontrados " + charsetSize + ").");
        }
    }

    /**
     * Genera (o devuelve) el codigo de afiliacion de la modelo indicada.
     * Ver guards y semantica en el javadoc de la clase.
     *
     * @param userId id del user MODEL para el que se genera el codigo.
     * @return el codigo persistido en {@code users.referral_code_owner}.
     */
    @Transactional
    public String generateForModel(Long userId) {
        if (userId == null) {
            throw new IllegalStateException(ERR_USER_NOT_FOUND);
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException(ERR_USER_NOT_FOUND));

        assertModel(user);
        assertApproved(user);
        assertNotSuspended(user);

        if (user.getReferralCodeOwner() != null) {
            return user.getReferralCodeOwner();
        }

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            String candidate = generateCandidate();
            if (!userRepository.existsByReferralCodeOwner(candidate)) {
                user.setReferralCodeOwner(candidate);
                userRepository.save(user);
                log.info("[AFFILIATE-CODE] generated code for userId={} attempt={} code_len={}",
                        userId, attempt, candidate.length());
                return candidate;
            }
            log.warn("[AFFILIATE-CODE] collision on attempt={} for userId={}", attempt, userId);
        }

        log.error("[AFFILIATE-CODE] exhausted {} retries generating code for userId={}",
                MAX_RETRIES, userId);
        throw new IllegalStateException(ERR_CODE_EXHAUSTED);
    }

    /** Devuelve un candidato aleatorio del charset con la longitud configurada. */
    String generateCandidate() {
        StringBuilder sb = new StringBuilder(codeLength);
        for (int i = 0; i < codeLength; i++) {
            sb.append(CROCKFORD_BASE32.charAt(secureRandom.nextInt(charsetSize)));
        }
        return sb.toString();
    }

    private void assertModel(User user) {
        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            throw new IllegalStateException(ERR_ROLE_REQUIRED);
        }
    }

    private void assertApproved(User user) {
        if (!Constants.VerificationStatuses.APPROVED.equals(user.getVerificationStatus())) {
            // Mensaje discriminador con el status actual para que el controller
            // pueda componer respuesta accionable ("Estado actual: PENDING, ...").
            throw new IllegalStateException(
                    ERR_KYC_REQUIRED_PREFIX + safeStatus(user.getVerificationStatus()));
        }
    }

    private void assertNotSuspended(User user) {
        if (Constants.AccountStatuses.SUSPENDED.equals(user.getAccountStatus())) {
            throw new IllegalStateException(ERR_ACCOUNT_SUSPENDED);
        }
    }

    private String safeStatus(String s) {
        return s == null || s.isBlank() ? "NULL" : s;
    }
}
