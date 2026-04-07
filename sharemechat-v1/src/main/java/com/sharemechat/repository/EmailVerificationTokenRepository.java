package com.sharemechat.repository;

import com.sharemechat.entity.EmailVerificationToken;
import com.sharemechat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {

    Optional<EmailVerificationToken> findByTokenHashAndConsumedAtIsNull(String tokenHash);

    Optional<EmailVerificationToken> findTopByUserAndConsumedAtIsNullOrderByCreatedAtDesc(User user);
}
