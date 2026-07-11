package com.sharemechat.repository;

import com.sharemechat.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    @Query("""
        SELECT t.id
        FROM Transaction t
        WHERE NOT EXISTS (
            SELECT 1
            FROM Balance b
            WHERE b.transactionId = t.id
        )
    """)
    List<Long> findTransactionIdsWithoutBalance();

    /**
     * ADR-049 Subpasada 2B: guard de idempotencia del bono de bienvenida
     * (D7 + D23). Un cliente solo puede recibir un {@code REFERRAL_WELCOME_GRANT}
     * durante su vida. Consulta a nivel repository para que
     * {@code AffiliateBonusService} verifique antes de crear filas.
     * Uso: {@code existsByUserIdAndOperationType(clientId, "REFERRAL_WELCOME_GRANT")}.
     */
    boolean existsByUserIdAndOperationType(Long userId, String operationType);
}
