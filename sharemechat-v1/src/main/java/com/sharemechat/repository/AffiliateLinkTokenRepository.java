package com.sharemechat.repository;

import com.sharemechat.entity.AffiliateLinkToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AffiliateLinkTokenRepository extends JpaRepository<AffiliateLinkToken, Long> {

    Optional<AffiliateLinkToken> findByTokenHash(String tokenHash);
}
