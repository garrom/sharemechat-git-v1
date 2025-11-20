package com.sharemechat.repository;

import com.sharemechat.entity.PaymentSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentSessionRepository extends JpaRepository<PaymentSession, Long> {

    Optional<PaymentSession> findByOrderId(String orderId);

    Optional<PaymentSession> findByPspTransactionId(String pspTransactionId);
}
