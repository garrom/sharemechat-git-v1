package com.sharemechat.repository;

import com.sharemechat.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    /**
     * Historial de transacciones del cliente (2026-07-19, Fase 1 vista
     * "Historial" del dashboard cliente). Filtro opcional por
     * {@code operationType}. Paginacion server-side ordenada por
     * {@code timestamp DESC}.
     * <p>Fase 1 llama SOLO con {@code operationType='INGRESO'} (recargas).
     * Fase 2 usa {@link #findClientTransactionsFiltered} con lista de
     * tipos + rango de fechas.
     */
    Page<Transaction> findByUser_IdAndOperationTypeOrderByTimestampDesc(
            Long userId, String operationType, Pageable pageable);

    Page<Transaction> findByUser_IdOrderByTimestampDesc(Long userId, Pageable pageable);

    /**
     * Fase 2 (2026-07-19): historial filtrado por lista de tipos +
     * rango de fechas opcional. Todos los params son opcionales:
     * <ul>
     *   <li>{@code types = null} -> no filtra por tipo (todos).</li>
     *   <li>{@code from = null}  -> sin cota inferior.</li>
     *   <li>{@code to = null}    -> sin cota superior.</li>
     * </ul>
     * <p>Rango semi-abierto {@code [from, to)} para evitar dependencia
     * de granularidad temporal (dia completo se pasa como
     * {@code from=00:00:00, to=+1dia 00:00:00}).
     */
    @Query("SELECT t FROM Transaction t "
            + "WHERE t.user.id = :userId "
            + "AND (:types IS NULL OR t.operationType IN :types) "
            + "AND (:from IS NULL OR t.timestamp >= :from) "
            + "AND (:to IS NULL OR t.timestamp < :to) "
            + "ORDER BY t.timestamp DESC")
    Page<Transaction> findClientTransactionsFiltered(
            @Param("userId") Long userId,
            @Param("types") List<String> types,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            Pageable pageable);

    /**
     * Fase 3 (2026-07-19): variante sin paginacion para el export CSV.
     * Mismos filtros que {@link #findClientTransactionsFiltered}. El
     * caller aplica un LIMIT alto (10k) via {@code Pageable} en el
     * controller para prevenir OOM en cuentas con historial extremo;
     * los usuarios normales tienen decenas o centenas de filas.
     */
    @Query("SELECT t FROM Transaction t "
            + "WHERE t.user.id = :userId "
            + "AND (:types IS NULL OR t.operationType IN :types) "
            + "AND (:from IS NULL OR t.timestamp >= :from) "
            + "AND (:to IS NULL OR t.timestamp < :to) "
            + "ORDER BY t.timestamp DESC")
    List<Transaction> findClientTransactionsForExport(
            @Param("userId") Long userId,
            @Param("types") List<String> types,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            Pageable pageable);
}
