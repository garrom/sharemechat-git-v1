package com.sharemechat.repository;

import com.sharemechat.entity.PaymentSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PaymentSessionRepository extends JpaRepository<PaymentSession, Long> {

    Optional<PaymentSession> findByOrderId(String orderId);

    Optional<PaymentSession> findByPspTransactionId(String pspTransactionId);

    /**
     * ADR-051 D9: lock pesimista sobre la fila para evitar doble acreditacion
     * cuando dos webhooks concurrentes intentan procesar el mismo pago
     * (ADR-012:297,332,372 alerta el riesgo). Bloquea otras transacciones
     * sobre la misma fila hasta que la actual commit/rollback.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT ps FROM PaymentSession ps WHERE ps.provider = :provider AND ps.pspTransactionId = :pspTransactionId")
    Optional<PaymentSession> findByProviderAndPspTransactionIdForUpdate(
            @Param("provider") String provider,
            @Param("pspTransactionId") String pspTransactionId);
}
