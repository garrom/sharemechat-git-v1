package com.sharemechat.service;

import com.sharemechat.entity.AffiliateLinkToken;
import com.sharemechat.repository.AffiliateLinkTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

/**
 * ADR-049 Subpasada 2B: gestion del magic link temprano (D12).
 *
 * <p>El visitante deja email en la landing publica de una modelo afiliada.
 * Este servicio genera un token opaco, guarda el hash SHA-256 en
 * {@code affiliate_link_tokens} y devuelve el token plano para incluirlo
 * en el email. Al abrir el email en cualquier dispositivo, el consumidor
 * cambia {@code consumed_at} y devuelve la modelo asociada + el email
 * para que el caller (endpoint {@code GET /link/consume}) pueda setear
 * la cookie {@code sharemechat_affiliate_ref} y redirigir.
 *
 * <p>D17: al generar un token para un email que ya tenia otro token vivo
 * (no consumido) apuntando a la misma modelo, se invalida el previo
 * marcandolo consumido con el mismo timestamp que se emite el nuevo,
 * para evitar tokens huerfanos que puedan usarse mas tarde.
 */
@Service
public class AffiliateLinkTokenService {

    private static final Logger log = LoggerFactory.getLogger(AffiliateLinkTokenService.class);
    private static final int TOKEN_RANDOM_BYTES = 32;

    public static final String ERR_TOKEN_NOT_FOUND = "token_not_found";
    public static final String ERR_TOKEN_EXPIRED = "token_expired";
    public static final String ERR_TOKEN_CONSUMED = "token_consumed";

    private final AffiliateLinkTokenRepository tokenRepository;
    private final SecureRandom secureRandom;
    private final int ttlHours;

    public AffiliateLinkTokenService(AffiliateLinkTokenRepository tokenRepository,
                                     @Value("${affiliate.magic-link.ttl-hours:72}") int ttlHours) {
        this.tokenRepository = tokenRepository;
        this.secureRandom = new SecureRandom();
        this.ttlHours = ttlHours;
    }

    /**
     * Genera un token opaco para el visitante, persiste su hash y devuelve
     * el token plano para incluirlo en el email. Invalida cualquier token
     * previo vivo para el mismo (modelUserId, email) segun D17.
     */
    @Transactional
    public String generate(Long modelUserId, String email) {
        if (modelUserId == null) {
            throw new IllegalArgumentException("modelUserId requerido");
        }
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("email requerido");
        }
        String normalizedEmail = email.trim().toLowerCase();

        LocalDateTime now = LocalDateTime.now();
        List<AffiliateLinkToken> previous = tokenRepository
                .findByModelUserIdAndEmailAndConsumedAtIsNullOrderByCreatedAtDesc(modelUserId, normalizedEmail);
        for (AffiliateLinkToken t : previous) {
            t.setConsumedAt(now);
            tokenRepository.save(t);
            log.info("[AFFILIATE-LINK] invalidated previous token id={} modelUserId={}", t.getId(), modelUserId);
        }

        byte[] raw = new byte[TOKEN_RANDOM_BYTES];
        secureRandom.nextBytes(raw);
        String tokenPlain = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        String tokenHash = sha256Hex(tokenPlain);

        AffiliateLinkToken entity = new AffiliateLinkToken();
        entity.setTokenHash(tokenHash);
        entity.setModelUserId(modelUserId);
        entity.setEmail(normalizedEmail);
        entity.setExpiresAt(now.plusHours(ttlHours));
        tokenRepository.save(entity);
        log.info("[AFFILIATE-LINK] generated tokenId={} modelUserId={} ttlHours={}",
                entity.getId(), modelUserId, ttlHours);
        return tokenPlain;
    }

    /**
     * Consume un token plano: valida existencia, expiracion y no-consumo;
     * marca {@code consumed_at=now} y devuelve el resultado con
     * {@code modelUserId} + {@code email} normalizado para que el caller
     * setee cookie y redirija.
     */
    @Transactional
    public ConsumeResult consume(String tokenPlain) {
        if (tokenPlain == null || tokenPlain.isBlank()) {
            throw new IllegalStateException(ERR_TOKEN_NOT_FOUND);
        }
        String tokenHash = sha256Hex(tokenPlain);
        Optional<AffiliateLinkToken> opt = tokenRepository.findByTokenHash(tokenHash);
        if (opt.isEmpty()) {
            throw new IllegalStateException(ERR_TOKEN_NOT_FOUND);
        }
        AffiliateLinkToken token = opt.get();
        if (token.getConsumedAt() != null) {
            throw new IllegalStateException(ERR_TOKEN_CONSUMED);
        }
        LocalDateTime now = LocalDateTime.now();
        if (token.getExpiresAt() == null || token.getExpiresAt().isBefore(now)) {
            throw new IllegalStateException(ERR_TOKEN_EXPIRED);
        }
        token.setConsumedAt(now);
        tokenRepository.save(token);
        log.info("[AFFILIATE-LINK] consumed tokenId={} modelUserId={}", token.getId(), token.getModelUserId());
        return new ConsumeResult(token.getModelUserId(), token.getEmail());
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) {
                sb.append(String.format("%02x", b & 0xff));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 no disponible", ex);
        }
    }

    public record ConsumeResult(Long modelUserId, String email) { }
}
