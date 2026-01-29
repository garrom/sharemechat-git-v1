package com.sharemechat.repository;

import com.sharemechat.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    void deleteByExpiresAtBefore(LocalDateTime now);

    void deleteByUserId(Long userId);

}