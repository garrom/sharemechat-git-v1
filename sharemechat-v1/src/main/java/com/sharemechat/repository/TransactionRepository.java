package com.sharemechat.repository;

import com.sharemechat.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
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

    /**
     * ADR-049 Subpasada 5 - query D4 (umbral mensual de facturacion propia):
     * ?"existe alguna transaccion de esta modelo con {@code operationType}
     * en la ventana temporal indicada?".
     *
     * <p>Uso tipico: umbral D4 del motor de comisiones. La modelo referidora
     * debe tener al menos un {@code STREAM_EARNING} en el mes calendario UTC
     * del cobro para que la comision del cliente atribuido pase a
     * {@code PAYABLE}; si no, la fila se marca {@code SKIPPED_NO_ACTIVITY}.
     *
     * <p>Se usa rango temporal semi-abierto {@code [start, end)} para
     * evitar dependencia de funciones locales {@code YEAR()/MONTH()} que
     * dependen de la zona horaria del servidor. El caller calcula los
     * limites explicitamente en UTC.
     */
    @Query("SELECT CASE WHEN COUNT(t) > 0 THEN true ELSE false END "
            + "FROM Transaction t "
            + "WHERE t.user.id = :userId "
            + "AND t.operationType = :operationType "
            + "AND t.timestamp >= :startInclusive "
            + "AND t.timestamp < :endExclusive")
    boolean existsByUserAndOperationTypeBetween(@Param("userId") Long userId,
                                                 @Param("operationType") String operationType,
                                                 @Param("startInclusive") LocalDateTime startInclusive,
                                                 @Param("endExclusive") LocalDateTime endExclusive);
}
