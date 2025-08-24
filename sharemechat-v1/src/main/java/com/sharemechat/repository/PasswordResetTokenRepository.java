package com.sharemechat.repository;

import com.sharemechat.entity.PasswordResetToken;
import com.sharemechat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByTokenHashAndUsedAtIsNullAndExpiresAtAfter(String tokenHash, LocalDateTime now);

    // Para invalidar/diagnosticar: último token activo de un usuario
    Optional<PasswordResetToken> findTopByUserAndUsedAtIsNullOrderByCreatedAtDesc(User user);
    Optional<PasswordResetToken> findByTokenHashAndUsedAtIsNull(String tokenHash);

}
