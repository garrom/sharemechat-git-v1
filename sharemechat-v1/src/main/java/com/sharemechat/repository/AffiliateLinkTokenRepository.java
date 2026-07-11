package com.sharemechat.repository;

import com.sharemechat.entity.AffiliateLinkToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AffiliateLinkTokenRepository extends JpaRepository<AffiliateLinkToken, Long> {

    Optional<AffiliateLinkToken> findByTokenHash(String tokenHash);

    /**
     * ADR-049 Subpasada 2B, decision D17: al generar un magic link nuevo
     * para un email que ya tenia un token vivo (no consumido) apuntando a
     * la misma modelo, invalidamos el previo para evitar acumular tokens
     * huerfanos. Devuelve los tokens vivos ordenados por creacion.
     */
    List<AffiliateLinkToken> findByModelUserIdAndEmailAndConsumedAtIsNullOrderByCreatedAtDesc(
            Long modelUserId, String email);
}
